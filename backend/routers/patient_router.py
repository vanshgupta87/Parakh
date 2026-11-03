import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from database.db import get_db
from auth.dependencies import require_role
from auth.tokens import generate_id

router = APIRouter(prefix="/api/v1/patient", tags=["Patient Workspace"])

class PatientProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)

class SaveAIReportRequest(BaseModel):
    prediction: str = Field(..., max_length=100)
    confidence: float
    risk_score: int
    risk_level: str = Field(..., max_length=50)
    recommendation: Optional[str] = None
    image_data: Optional[str] = None
    heatmap_data: Optional[str] = None
    probabilities: Optional[Dict[str, Any]] = None
    clinical_metadata: Optional[Dict[str, Any]] = None
    yolo_detection: Optional[str] = None

@router.get("/profile")
def get_patient_profile(current_user: dict = Depends(require_role("patient"))):
    """Fetches private profile for logged in patient."""
    user_id = current_user["id"]
    with get_db() as db:
        row = db.execute(
            """
            SELECT p.id AS patient_id, p.date_of_birth, p.gender, p.patient_unique_id, p.created_at,
                   u.full_name, u.email, u.phone, u.account_status, u.email_verified
            FROM patients p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
            """,
            (user_id,)
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        return {"status": "success", "profile": dict(row)}

@router.put("/profile")
def update_patient_profile(
    payload: PatientProfileUpdateRequest,
    current_user: dict = Depends(require_role("patient"))
):
    """Updates permitted patient profile fields."""
    user_id = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        updates = []
        params = []
        if payload.full_name is not None:
            updates.append("full_name = ?")
            params.append(payload.full_name.strip())
        if payload.phone is not None:
            updates.append("phone = ?")
            params.append(payload.phone.strip())

        if updates:
            updates.append("updated_at = ?")
            params.append(now_iso)
            params.append(user_id)
            db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", tuple(params))

    return {"status": "success", "message": "Profile updated successfully."}

@router.get("/dashboard-summary")
def get_patient_dashboard_summary(current_user: dict = Depends(require_role("patient"))):
    """Returns patient personal portal summary with real DB data."""
    user_id = current_user["id"]
    patient_id = current_user.get("patient_profile", {}).get("patient_id")

    with get_db() as db:
        pat = db.execute("SELECT patient_unique_id FROM patients WHERE user_id = ?", (user_id,)).fetchone()
        patient_code = pat["patient_unique_id"] if pat else "N/A"

        if not patient_id:
            pat2 = db.execute("SELECT id FROM patients WHERE user_id = ?", (user_id,)).fetchone()
            patient_id = pat2["id"] if pat2 else None

        upcoming_count = 0
        scan_count = 0
        rx_count = 0
        upcoming_appts = []
        recent_scans = []
        recent_rxs = []

        if patient_id:
            upcoming_count = db.execute("""
                SELECT COUNT(*) FROM appointments
                WHERE patient_id = ? AND appointment_date >= DATE('now')
                AND status NOT IN ('cancelled','rejected')
            """, (patient_id,)).fetchone()[0]

            scan_count = db.execute("""
                SELECT COUNT(*) FROM ai_reports
                WHERE patient_id = ? AND image_data IS NOT NULL AND LENGTH(TRIM(image_data)) > 0
            """, (patient_id,)).fetchone()[0]

            rx_count = db.execute("""
                SELECT COUNT(*) FROM prescriptions
                WHERE patient_id = ? AND status = 'finalized'
            """, (patient_id,)).fetchone()[0]

            rows = db.execute("""
                SELECT a.id, a.appointment_date, a.slot_start, a.slot_end, a.status,
                       u.full_name AS doctor_name, d.specialization, d.clinic_name
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                JOIN users u ON d.user_id = u.id
                WHERE a.patient_id = ? AND a.appointment_date >= DATE('now')
                AND a.status NOT IN ('cancelled','rejected')
                ORDER BY a.appointment_date ASC, a.slot_start ASC
                LIMIT 3
            """, (patient_id,)).fetchall()
            upcoming_appts = [dict(r) for r in rows]

            rows = db.execute("""
                SELECT id, prediction, confidence, risk_level, risk_score, created_at
                FROM ai_reports
                WHERE patient_id = ? AND image_data IS NOT NULL AND LENGTH(TRIM(image_data)) > 0
                ORDER BY created_at DESC
                LIMIT 3
            """, (patient_id,)).fetchall()
            recent_scans = [dict(r) for r in rows]

            rows = db.execute("""
                SELECT rx.id, rx.prescription_number, rx.status, rx.created_at,
                       u.full_name AS doctor_name
                FROM prescriptions rx
                JOIN doctors d ON rx.doctor_id = d.id
                JOIN users u ON d.user_id = u.id
                WHERE rx.patient_id = ?
                ORDER BY rx.created_at DESC
                LIMIT 3
            """, (patient_id,)).fetchall()
            recent_rxs = [dict(r) for r in rows]

    return {
        "status": "success",
        "patient_name": current_user["full_name"],
        "patient_unique_id": patient_code,
        "upcoming_appointments_count": upcoming_count,
        "skin_scan_count": scan_count,
        "active_prescriptions_count": rx_count,
        "upcoming_appointments": upcoming_appts,
        "recent_scans": recent_scans,
        "recent_prescriptions": recent_rxs,
    }

@router.post("/reports", status_code=201)
def save_ai_report(
    payload: SaveAIReportRequest,
    current_user: dict = Depends(require_role("patient"))
):
    """Saves an AI screening report under the patient's authenticated profile."""
    patient_id = current_user.get("patient_profile", {}).get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="Patient profile not found.")

    report_id = generate_id("air")
    now_iso = datetime.now(timezone.utc).isoformat()
    probs_json = json.dumps(payload.probabilities) if payload.probabilities else None
    meta_json = json.dumps(payload.clinical_metadata) if payload.clinical_metadata else None

    with get_db() as db:
        db.execute(
            """
            INSERT INTO ai_reports (
                id, patient_id, image_data, prediction, confidence, risk_score,
                risk_level, recommendation, yolo_detection, heatmap_data,
                probabilities, clinical_metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_id, patient_id, payload.image_data, payload.prediction,
                payload.confidence, payload.risk_score, payload.risk_level,
                payload.recommendation, payload.yolo_detection, payload.heatmap_data,
                probs_json, meta_json, now_iso
            )
        )

    return {"status": "success", "report_id": report_id, "created_at": now_iso}

@router.get("/reports")
def list_my_ai_reports(current_user: dict = Depends(require_role("patient"))):
    """Lists saved AI screening reports for the logged-in patient."""
    patient_id = current_user.get("patient_profile", {}).get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="Patient profile not found.")

    with get_db() as db:
        rows = db.execute(
            """
            SELECT id, prediction, confidence, risk_score, risk_level, recommendation,
                   created_at, yolo_detection
            FROM ai_reports
            WHERE patient_id = ?
            ORDER BY created_at DESC
            """,
            (patient_id,)
        ).fetchall()

    return {"status": "success", "reports": [dict(r) for r in rows]}

@router.get("/reports/{report_id}")
def get_ai_report_detail(
    report_id: str,
    current_user: dict = Depends(require_role("patient"))
):
    """Retrieves full details of an AI report owned by the patient."""
    patient_id = current_user.get("patient_profile", {}).get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="Patient profile not found.")

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM ai_reports WHERE id = ? AND patient_id = ?",
            (report_id, patient_id)
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="AI Report not found.")

        data = dict(row)
        if data.get("probabilities"):
            try:
                data["probabilities"] = json.loads(data["probabilities"])
            except Exception:
                pass
        if data.get("clinical_metadata"):
            try:
                data["clinical_metadata"] = json.loads(data["clinical_metadata"])
            except Exception:
                pass

    return {"status": "success", "report": data}
