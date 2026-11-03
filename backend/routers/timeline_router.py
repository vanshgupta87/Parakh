"""
PARAKH (परख) - Patient Clinical Timeline Router
Aggregates appointments, consultations, prescriptions, documents, EMR updates,
and AI pre-screenings into a unified, chronological clinical history.
Clearly delineates AI assistive screening from doctor-confirmed diagnoses.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from database.db import get_db
from auth.dependencies import get_current_user, require_role
from routers.emr_router import check_patient_access

router = APIRouter(prefix="/api/v1/timeline", tags=["Timeline"])


@router.get("/patient/{patient_id}")
def get_patient_timeline(
    patient_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None, description="Filter by event category"),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns an aggregated, chronological patient clinical timeline.
    """
    with get_db() as db:
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized to access this patient's clinical timeline."
            )

        events: List[dict] = []

        # 1. Appointments
        appts = db.execute(
            """
            SELECT a.id, a.appointment_date, a.slot_start, a.slot_end, a.status,
                   a.reason_for_visit, a.created_at,
                   u.full_name as doctor_name, d.specialization as doctor_specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE a.patient_id = ?
            """,
            (patient_id,)
        ).fetchall()

        for a in appts:
            events.append({
                "id": f"evt_appt_{a['id']}",
                "event_type": "appointment",
                "category": "scheduling",
                "timestamp": f"{a['appointment_date']}T{a['slot_start']}:00",
                "title": f"Appointment: {a['status'].capitalize()}",
                "description": f"With Dr. {a['doctor_name']} ({a['doctor_specialization']}). Reason: {a['reason_for_visit'] or 'General visit'}",
                "status": a["status"],
                "metadata": {
                    "appointment_id": a["id"],
                    "doctor_name": a["doctor_name"],
                    "specialization": a["doctor_specialization"],
                    "date": a["appointment_date"],
                    "slot": f"{a['slot_start']} - {a['slot_end']}"
                },
                "is_ai_prediction": False,
                "is_doctor_confirmed": False
            })

        # 2. Consultations & Doctor Assessments
        consults = db.execute(
            """
            SELECT cr.id, cr.appointment_id, cr.chief_complaint, cr.clinical_notes,
                   cr.diagnosis, cr.follow_up_date, cr.created_at,
                   u.full_name as doctor_name, d.specialization as doctor_specialization
            FROM consultation_records cr
            JOIN doctors d ON cr.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE cr.patient_id = ?
            """,
            (patient_id,)
        ).fetchall()

        for c in consults:
            events.append({
                "id": f"evt_cns_{c['id']}",
                "event_type": "consultation",
                "category": "clinical",
                "timestamp": c["created_at"],
                "title": f"Doctor Consultation Completed",
                "description": f"Diagnosis: {c['diagnosis'] or 'Evaluated'}. Assessed by Dr. {c['doctor_name']}.",
                "metadata": {
                    "consultation_id": c["id"],
                    "appointment_id": c["appointment_id"],
                    "doctor_name": c["doctor_name"],
                    "specialization": c["doctor_specialization"],
                    "diagnosis": c["diagnosis"],
                    "clinical_notes": c["clinical_notes"],
                    "follow_up_date": c["follow_up_date"]
                },
                "is_ai_prediction": False,
                "is_doctor_confirmed": True
            })

        # 3. Prescriptions
        rx_rows = db.execute(
            """
            SELECT pr.id, pr.prescription_number, pr.status, pr.diagnosis,
                   pr.follow_up_date, pr.finalized_at, pr.created_at,
                   u.full_name as doctor_name,
                   (SELECT COUNT(*) FROM prescription_items WHERE prescription_id = pr.id) as med_count
            FROM prescriptions pr
            JOIN doctors d ON pr.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE pr.patient_id = ?
            """,
            (patient_id,)
        ).fetchall()

        for r in rx_rows:
            events.append({
                "id": f"evt_rx_{r['id']}",
                "event_type": "prescription",
                "category": "medication",
                "timestamp": r["finalized_at"] or r["created_at"],
                "title": f"Digital Prescription ({r['prescription_number']})",
                "description": f"{r['status'].capitalize()} prescription by Dr. {r['doctor_name']} containing {r['med_count']} medications.",
                "status": r["status"],
                "metadata": {
                    "prescription_id": r["id"],
                    "prescription_number": r["prescription_number"],
                    "doctor_name": r["doctor_name"],
                    "med_count": r["med_count"],
                    "diagnosis": r["diagnosis"],
                    "follow_up_date": r["follow_up_date"]
                },
                "is_ai_prediction": False,
                "is_doctor_confirmed": True
            })

        # 4. Medical Documents
        docs = db.execute(
            """
            SELECT md.id, md.title, md.category, md.file_name, md.file_size_bytes,
                   md.mime_type, md.created_at, u.full_name as uploaded_by_name
            FROM medical_documents md
            JOIN users u ON md.uploaded_by_user_id = u.id
            WHERE md.patient_id = ?
            """,
            (patient_id,)
        ).fetchall()

        for d in docs:
            cat_label = d["category"].replace("_", " ").title()
            events.append({
                "id": f"evt_doc_{d['id']}",
                "event_type": "document",
                "category": "records",
                "timestamp": d["created_at"],
                "title": f"Medical Document Uploaded ({cat_label})",
                "description": f"'{d['title']}' ({d['file_name']}) uploaded by {d['uploaded_by_name']}.",
                "metadata": {
                    "document_id": d["id"],
                    "title": d["title"],
                    "category": d["category"],
                    "file_name": d["file_name"],
                    "file_size_bytes": d["file_size_bytes"],
                    "mime_type": d["mime_type"]
                },
                "is_ai_prediction": False,
                "is_doctor_confirmed": False
            })

        # 5. AI Lesion Analysis Reports (Assistive Pre-Screening)
        ai_reps = db.execute(
            """
            SELECT id, prediction, confidence, risk_level, risk_score, recommendation, created_at
            FROM ai_reports
            WHERE patient_id = ?
            """,
            (patient_id,)
        ).fetchall()

        for rep in ai_reps:
            events.append({
                "id": f"evt_ai_{rep['id']}",
                "event_type": "ai_analysis",
                "category": "ai_screening",
                "timestamp": rep["created_at"],
                "title": f"AI Lesion Analysis: {rep['prediction']}",
                "description": f"AI Pre-Screening detected {rep['prediction']} ({int((rep['confidence'] or 0)*100)}% confidence, Risk: {rep['risk_level']}).",
                "metadata": {
                    "report_id": rep["id"],
                    "prediction": rep["prediction"],
                    "confidence": rep["confidence"],
                    "risk_level": rep["risk_level"],
                    "risk_score": rep["risk_score"],
                    "recommendation": rep["recommendation"],
                    "disclaimer": "PARAKH AI Pre-Screening. This is an assistive prediction and NOT a definitive medical diagnosis. Consult a qualified dermatologist."
                },
                "is_ai_prediction": True,
                "is_doctor_confirmed": False
            })

        # Filter by event_type if specified
        if event_type:
            events = [e for e in events if e["event_type"] == event_type or e["category"] == event_type]

        # Sort reverse chronologically
        events.sort(key=lambda x: str(x["timestamp"]), reverse=True)

        total_count = len(events)
        paginated_events = events[offset : offset + limit]

        return {
            "status": "success",
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "events": paginated_events
        }


@router.get("/my")
def get_my_timeline(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = None,
    current_user: dict = Depends(require_role("patient"))
):
    """Patient views their own clinical timeline."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    return get_patient_timeline(
        patient_id=pat_profile["patient_id"],
        limit=limit,
        offset=offset,
        event_type=event_type,
        current_user=current_user
    )
