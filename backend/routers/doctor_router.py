import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from database.db import get_db
from auth.dependencies import require_role, require_verified_doctor
from auth.tokens import generate_id

router = APIRouter(prefix="/api/v1/doctor", tags=["Doctor Clinical Workspace"])

class DoctorProfileUpdateRequest(BaseModel):
    phone: Optional[str] = Field(None, max_length=20)
    clinic_name: Optional[str] = Field(None, min_length=2, max_length=150)
    clinic_address: Optional[str] = Field(None, min_length=5, max_length=300)
    professional_bio: Optional[str] = Field(None, max_length=2000)
    profile_image: Optional[str] = None


class DoctorAIReportRequest(BaseModel):
    prediction: str = Field(..., min_length=1, max_length=100)
    confidence: float = Field(..., ge=0, le=1)
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: str = Field(..., min_length=1, max_length=50)
    recommendation: Optional[str] = Field(None, max_length=2000)
    image_data: str = Field(..., min_length=1, max_length=21_000_000)
    heatmap_data: Optional[str] = Field(None, max_length=5_000_000)
    probabilities: Optional[Dict[str, Any]] = None
    clinical_metadata: Optional[Dict[str, Any]] = None


def _resolve_patient_id(db, patient_id_or_code: str) -> str:
    cleaned = (patient_id_or_code or "").strip()
    row = db.execute("SELECT id FROM patients WHERE id = ? OR patient_unique_id = ?", (cleaned, cleaned)).fetchone()
    if row:
        return row[0]
    return cleaned


def _require_patient_relationship(db, doctor_id: str, patient_id: str) -> str:
    resolved_id = _resolve_patient_id(db, patient_id)
    relationship = db.execute(
        """
        SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ?
        UNION
        SELECT 1 FROM consultation_records WHERE doctor_id = ? AND patient_id = ?
        """,
        (doctor_id, resolved_id, doctor_id, resolved_id),
    ).fetchone()
    if not relationship:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No appointment or consultation exists between this doctor and patient.",
        )
    return resolved_id


@router.get("/patients")
def get_doctor_patients(current_user: dict = Depends(require_verified_doctor)):
    """
    Returns list of all distinct patients who have established clinical relationships
    (appointments or consultations) with this doctor.
    """
    doctor_id = current_user["doctor_profile"]["doctor_id"]
    with get_db() as db:
        rows = db.execute("""
            SELECT p.id AS patient_id, p.patient_unique_id, u.full_name, u.email, u.phone,
                   p.gender, p.date_of_birth,
                   mp.blood_group,
                   MAX(a.appointment_date) AS last_appointment_date,
                   COUNT(DISTINCT a.id) AS appointment_count,
                   (
                       SELECT COUNT(*) FROM ai_reports 
                       WHERE patient_id = p.id AND image_data IS NOT NULL AND LENGTH(TRIM(image_data)) > 0
                   ) AS scan_count,
                   (
                       SELECT COUNT(*) FROM prescriptions 
                       WHERE patient_id = p.id AND doctor_id = ?
                   ) AS prescription_count
            FROM patients p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN patient_medical_profiles mp ON mp.patient_id = p.id
            LEFT JOIN appointments a ON a.patient_id = p.id AND a.doctor_id = ?
            WHERE p.id IN (
                SELECT patient_id FROM appointments WHERE doctor_id = ?
                UNION
                SELECT patient_id FROM consultation_records WHERE doctor_id = ?
            )
            GROUP BY p.id
            ORDER BY (last_appointment_date IS NULL), last_appointment_date DESC, p.created_at DESC
        """, (doctor_id, doctor_id, doctor_id, doctor_id)).fetchall()

    return {
        "status": "success",
        "total": len(rows),
        "patients": [dict(r) for r in rows]
    }


@router.post("/patients/{patient_id}/ai-reports", status_code=201)
def save_patient_ai_report(
    patient_id: str,
    payload: DoctorAIReportRequest,
    current_user: dict = Depends(require_verified_doctor),
):
    doctor_id = current_user["doctor_profile"]["doctor_id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    report_id = generate_id("air")

    with get_db() as db:
        patient_id = _require_patient_relationship(db, doctor_id, patient_id)
        db.execute(
            """
            INSERT INTO ai_reports (
                id, patient_id, image_data, prediction, confidence, risk_score,
                risk_level, recommendation, heatmap_data, probabilities,
                clinical_metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_id,
                patient_id,
                payload.image_data,
                payload.prediction,
                payload.confidence,
                payload.risk_score,
                payload.risk_level,
                payload.recommendation,
                payload.heatmap_data,
                json.dumps(payload.probabilities) if payload.probabilities is not None else None,
                json.dumps(payload.clinical_metadata) if payload.clinical_metadata is not None else None,
                now_iso,
            ),
        )

    return {"status": "success", "report_id": report_id, "created_at": now_iso}


@router.get("/patients/{patient_id}/ai-reports")
def list_patient_ai_reports(
    patient_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    doctor_id = current_user["doctor_profile"]["doctor_id"]
    with get_db() as db:
        patient_id = _require_patient_relationship(db, doctor_id, patient_id)
        rows = db.execute(
            """
            SELECT id, patient_id, image_data, prediction, confidence, risk_score,
                   risk_level, recommendation, heatmap_data, probabilities,
                   clinical_metadata, created_at
            FROM ai_reports
            WHERE patient_id = ?
              AND image_data IS NOT NULL
              AND LENGTH(TRIM(image_data)) > 0
            ORDER BY julianday(created_at) ASC, created_at ASC, id ASC
            """,
            (patient_id,),
        ).fetchall()

    reports = []
    for row in rows:
        report = dict(row)
        for field in ("probabilities", "clinical_metadata"):
            if report[field]:
                try:
                    report[field] = json.loads(report[field])
                except (TypeError, json.JSONDecodeError):
                    report[field] = None
        reports.append(report)

    return {"status": "success", "reports": reports}

@router.get("/profile")
def get_doctor_profile(current_user: dict = Depends(require_role("doctor"))):
    """Fetches profile for logged in doctor."""
    user_id = current_user["id"]
    with get_db() as db:
        row = db.execute(
            """
            SELECT d.*, u.full_name, u.email, u.phone, u.account_status, u.email_verified
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
            """,
            (user_id,)
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Doctor profile not found.")
        return {"status": "success", "profile": dict(row)}

@router.put("/profile")
def update_doctor_profile(
    payload: DoctorProfileUpdateRequest,
    current_user: dict = Depends(require_role("doctor"))
):
    """Updates permitted doctor profile fields."""
    user_id = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        if payload.phone is not None:
            db.execute("UPDATE users SET phone = ?, updated_at = ? WHERE id = ?", (payload.phone, now_iso, user_id))

        updates = []
        params = []
        if payload.clinic_name is not None:
            updates.append("clinic_name = ?")
            params.append(payload.clinic_name)
        if payload.clinic_address is not None:
            updates.append("clinic_address = ?")
            params.append(payload.clinic_address)
        if payload.professional_bio is not None:
            updates.append("professional_bio = ?")
            params.append(payload.professional_bio)
        if payload.profile_image is not None:
            updates.append("profile_image = ?")
            params.append(payload.profile_image)

        if updates:
            params.append(user_id)
            db.execute(f"UPDATE doctors SET {', '.join(updates)} WHERE user_id = ?", tuple(params))

    return {"status": "success", "message": "Doctor profile updated successfully."}

@router.get("/dashboard-summary")
def get_doctor_dashboard_summary(current_user: dict = Depends(require_verified_doctor)):
    """
    Returns clinical workspace summary with real-time analytics for an approved doctor.
    Blocked if doctor is pending verification or rejected.
    """
    doctor_id = current_user["doctor_profile"]["doctor_id"]
    with get_db() as db:
        # 1. Total distinct patients
        total_patients = db.execute("""
            SELECT COUNT(DISTINCT patient_id) FROM (
                SELECT patient_id FROM appointments WHERE doctor_id = ?
                UNION
                SELECT patient_id FROM consultation_records WHERE doctor_id = ?
            )
        """, (doctor_id, doctor_id)).fetchone()[0]

        # 2. Today's appointments & pending requests
        today_appts = db.execute("""
            SELECT COUNT(*) FROM appointments 
            WHERE doctor_id = ? AND appointment_date = DATE('now')
        """, (doctor_id,)).fetchone()[0]

        pending_appts = db.execute("""
            SELECT COUNT(*) FROM appointments 
            WHERE doctor_id = ? AND status = 'pending'
        """, (doctor_id,)).fetchone()[0]

        total_appts = db.execute("""
            SELECT COUNT(*) FROM appointments 
            WHERE doctor_id = ?
        """, (doctor_id,)).fetchone()[0]

        # 3. AI analyses performed (today's count & total count)
        today_ai_scans = db.execute("""
            SELECT COUNT(*) FROM ai_reports 
            WHERE patient_id IN (
                SELECT patient_id FROM appointments WHERE doctor_id = ?
                UNION
                SELECT patient_id FROM consultation_records WHERE doctor_id = ?
            ) AND DATE(created_at) = DATE('now')
        """, (doctor_id, doctor_id)).fetchone()[0]

        total_ai_scans = db.execute("""
            SELECT COUNT(*) FROM ai_reports 
            WHERE patient_id IN (
                SELECT patient_id FROM appointments WHERE doctor_id = ?
                UNION
                SELECT patient_id FROM consultation_records WHERE doctor_id = ?
            )
        """, (doctor_id, doctor_id)).fetchone()[0]

        # 4. Recent AI analyses list
        recent_rows = db.execute("""
            SELECT ar.id, ar.patient_id, ar.prediction, ar.confidence, ar.risk_level, 
                   ar.risk_score, ar.created_at, ar.recommendation, ar.image_data, ar.heatmap_data,
                   u.full_name AS patient_name, p.patient_unique_id
            FROM ai_reports ar
            JOIN patients p ON ar.patient_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE ar.patient_id IN (
                SELECT patient_id FROM appointments WHERE doctor_id = ?
                UNION
                SELECT patient_id FROM consultation_records WHERE doctor_id = ?
            )
            ORDER BY julianday(ar.created_at) DESC, ar.created_at DESC, ar.id DESC
            LIMIT 15
        """, (doctor_id, doctor_id)).fetchall()

    return {
        "status": "success",
        "doctor_name": current_user["full_name"],
        "verification_status": current_user.get("doctor_profile", {}).get("verification_status", "approved"),
        "total_patients": total_patients,
        "today_appointments": today_appts,
        "pending_appointments": pending_appts,
        "total_appointments": total_appts,
        "today_ai_scans": today_ai_scans,
        "total_ai_scans": total_ai_scans,
        "recent_ai_analyses": [dict(r) for r in recent_rows],
        "announcements": [
            "Welcome to the PARAKH Clinical Workspace. Your credentials are fully verified.",
            "AI Skin Lesion diagnostic model EfficientNetV2 is operational."
        ]
    }
