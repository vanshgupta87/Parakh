"""
PARAKH (परख) - Digital Prescriptions Router
Allows verified doctors to draft, update, and finalize digital prescriptions,
provides patient access, and serves downloadable branded PDFs.
"""

from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, Field

from database.db import get_db
from auth.dependencies import get_current_user, require_role
from auth.tokens import generate_id
from services.clinical_audit_service import log_clinical_audit
from services.prescription_pdf_service import generate_prescription_pdf
from services.notification_service import create_notification

router = APIRouter(prefix="/api/v1/prescriptions", tags=["Prescriptions"])


def _generate_rx_number(conn) -> str:
    """Generates sequential/unique RX-YYYY-XXXX number."""
    year = datetime.now().strftime("%Y")
    count_row = conn.execute("SELECT COUNT(*) FROM prescriptions").fetchone()
    count = (count_row[0] if count_row else 0) + 1
    return f"RX-{year}-{count:05d}"


# --- Schemas ---

class PrescriptionItemSchema(BaseModel):
    medicine_name: str = Field(..., min_length=1, max_length=200)
    dosage: str = Field(..., min_length=1, max_length=100)
    frequency: str = Field(..., min_length=1, max_length=100)
    duration: str = Field(..., min_length=1, max_length=100)
    instructions: Optional[str] = Field(None, max_length=500)


class PrescriptionCreateRequest(BaseModel):
    patient_id: str
    appointment_id: Optional[str] = None
    consultation_id: Optional[str] = None
    clinical_assessment: Optional[str] = Field(None, max_length=2000)
    diagnosis: Optional[str] = Field(None, max_length=500)
    follow_up_date: Optional[str] = Field(None, max_length=20)
    general_instructions: Optional[str] = Field(None, max_length=2000)
    items: List[PrescriptionItemSchema] = Field(default_factory=list)
    finalize_now: bool = False


class PrescriptionUpdateRequest(BaseModel):
    clinical_assessment: Optional[str] = Field(None, max_length=2000)
    diagnosis: Optional[str] = Field(None, max_length=500)
    follow_up_date: Optional[str] = Field(None, max_length=20)
    general_instructions: Optional[str] = Field(None, max_length=2000)
    items: Optional[List[PrescriptionItemSchema]] = None
    edit_reason: Optional[str] = Field(None, description="Required if amending a finalized prescription")


# --- Endpoints ---

@router.post("", status_code=201)
def create_prescription(
    payload: PrescriptionCreateRequest,
    request: Request,
    current_user: dict = Depends(require_role("doctor"))
):
    """
    Approved doctor creates a digital prescription (draft or finalized).
    Ensures doctor has an appointment or consultation with this patient.
    """
    client_ip = request.client.host if request.client else "unknown"
    doc_profile = current_user.get("doctor_profile")
    if not doc_profile or doc_profile.get("verification_status") != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approved medical practitioners can issue prescriptions."
        )

    doctor_id = doc_profile["doctor_id"]
    patient_id = payload.patient_id

    with get_db() as db:
        # Verify doctor-patient association
        rel = db.execute(
            """
            SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ?
            UNION
            SELECT 1 FROM consultation_records WHERE doctor_id = ? AND patient_id = ?
            """,
            (doctor_id, patient_id, doctor_id, patient_id)
        ).fetchone()

        if not rel:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot issue prescription: no active appointment or consultation exists with this patient."
            )

        rx_id = generate_id("rx")
        rx_number = _generate_rx_number(db)
        now_iso = datetime.now(timezone.utc).isoformat()
        rx_status = "finalized" if payload.finalize_now else "draft"
        finalized_at = now_iso if payload.finalize_now else None

        db.execute(
            """
            INSERT INTO prescriptions
            (id, prescription_number, consultation_id, appointment_id, doctor_id, patient_id,
             status, clinical_assessment, diagnosis, follow_up_date, general_instructions,
             finalized_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rx_id, rx_number, payload.consultation_id, payload.appointment_id,
                doctor_id, patient_id, rx_status, payload.clinical_assessment,
                payload.diagnosis, payload.follow_up_date, payload.general_instructions,
                finalized_at, now_iso, now_iso
            )
        )

        # Insert medicine items
        for order_idx, item in enumerate(payload.items):
            item_id = generate_id("rxi")
            db.execute(
                """
                INSERT INTO prescription_items
                (id, prescription_id, medicine_name, dosage, frequency, duration, instructions, item_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item_id, rx_id, item.medicine_name, item.dosage,
                    item.frequency, item.duration, item.instructions,
                    order_idx, now_iso
                )
            )

        # Audit log
        log_clinical_audit(
            record_type="prescription",
            record_id=rx_id,
            patient_id=patient_id,
            action="created" if not payload.finalize_now else "finalized",
            performed_by_user_id=current_user["id"],
            new_data=payload.model_dump(),
            reason="Prescription issued" if payload.finalize_now else "Prescription draft created",
            ip_address=client_ip,
            conn=db
        )

        # If finalized, notify patient
        if payload.finalize_now:
            pat_user = db.execute("SELECT user_id FROM patients WHERE id = ?", (patient_id,)).fetchone()
            if pat_user:
                create_notification(
                    user_id=pat_user["user_id"],
                    title="New Digital Prescription Issued",
                    message=f"Dr. {current_user['full_name']} has issued prescription {rx_number}.",
                    notif_type="system",
                    link="/patient/prescriptions",
                    conn=db
                )

        return {
            "status": "success",
            "prescription_id": rx_id,
            "prescription_number": rx_number,
            "prescription_status": rx_status,
            "message": f"Prescription {rx_number} {'finalized' if payload.finalize_now else 'saved as draft'}."
        }


@router.get("/{prescription_id}")
def get_prescription_detail(
    prescription_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieves full prescription details with medicine items and party profiles."""
    with get_db() as db:
        rx = db.execute(
            """
            SELECT pr.*,
                   u_doc.full_name as doctor_name, d.specialization as doctor_specialization,
                   d.qualification as doctor_qualification, d.medical_registration_number,
                   d.clinic_name, d.clinic_address,
                   u_pat.full_name as patient_name, u_pat.email as patient_email,
                   u_pat.phone as patient_phone, p.gender as patient_gender, p.date_of_birth
            FROM prescriptions pr
            JOIN doctors d ON pr.doctor_id = d.id
            JOIN users u_doc ON d.user_id = u_doc.id
            JOIN patients p ON pr.patient_id = p.id
            JOIN users u_pat ON p.user_id = u_pat.id
            WHERE pr.id = ?
            """,
            (prescription_id,)
        ).fetchone()

        if not rx:
            raise HTTPException(status_code=404, detail="Prescription not found.")

        # Check authorization
        role = current_user.get("role")
        user_id = current_user.get("id")

        if role == "patient":
            pat_profile = current_user.get("patient_profile")
            if not pat_profile or pat_profile["patient_id"] != rx["patient_id"]:
                raise HTTPException(status_code=403, detail="Unauthorized to view this prescription.")
        elif role == "doctor":
            doc_profile = current_user.get("doctor_profile")
            if not doc_profile:
                raise HTTPException(status_code=403, detail="Doctor profile not found.")
            # Allowed if prescribing doctor or has relationship with this patient
            if doc_profile["doctor_id"] != rx["doctor_id"]:
                rel = db.execute(
                    "SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ?",
                    (doc_profile["doctor_id"], rx["patient_id"])
                ).fetchone()
                if not rel:
                    raise HTTPException(status_code=403, detail="Unauthorized to view this prescription.")
        elif role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized.")

        # Fetch medicine items
        items = db.execute(
            """
            SELECT * FROM prescription_items
            WHERE prescription_id = ?
            ORDER BY item_order ASC
            """,
            (prescription_id,)
        ).fetchall()

        return {
            "status": "success",
            "prescription": dict(rx),
            "items": [dict(it) for it in items]
        }


@router.put("/{prescription_id}")
def update_prescription(
    prescription_id: str,
    payload: PrescriptionUpdateRequest,
    request: Request,
    current_user: dict = Depends(require_role("doctor"))
):
    """
    Updates a prescription.
    Draft prescriptions can be updated freely by the authoring doctor.
    Finalized prescriptions cannot be edited without providing an `edit_reason`
    which is immutably recorded in the clinical audit trail.
    """
    client_ip = request.client.host if request.client else "unknown"
    doc_profile = current_user.get("doctor_profile")
    if not doc_profile or doc_profile.get("verification_status") != "approved":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    doctor_id = doc_profile["doctor_id"]

    with get_db() as db:
        rx = db.execute("SELECT * FROM prescriptions WHERE id = ?", (prescription_id,)).fetchone()
        if not rx:
            raise HTTPException(status_code=404, detail="Prescription not found.")

        if rx["doctor_id"] != doctor_id:
            raise HTTPException(status_code=403, detail="Only the prescribing doctor can amend this prescription.")

        if rx["status"] == "finalized" and not payload.edit_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This prescription is already finalized. An explicit 'edit_reason' is required to amend finalized records."
            )

        prev_items = db.execute("SELECT * FROM prescription_items WHERE prescription_id = ?", (prescription_id,)).fetchall()
        prev_data = {
            "prescription": dict(rx),
            "items": [dict(it) for it in prev_items]
        }

        now_iso = datetime.now(timezone.utc).isoformat()

        # Update prescription header
        db.execute(
            """
            UPDATE prescriptions
            SET clinical_assessment = COALESCE(?, clinical_assessment),
                diagnosis = COALESCE(?, diagnosis),
                follow_up_date = COALESCE(?, follow_up_date),
                general_instructions = COALESCE(?, general_instructions),
                updated_at = ?
            WHERE id = ?
            """,
            (
                payload.clinical_assessment, payload.diagnosis,
                payload.follow_up_date, payload.general_instructions,
                now_iso, prescription_id
            )
        )

        # Replace items if passed
        if payload.items is not None:
            db.execute("DELETE FROM prescription_items WHERE prescription_id = ?", (prescription_id,))
            for order_idx, item in enumerate(payload.items):
                item_id = generate_id("rxi")
                db.execute(
                    """
                    INSERT INTO prescription_items
                    (id, prescription_id, medicine_name, dosage, frequency, duration, instructions, item_order, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item_id, prescription_id, item.medicine_name, item.dosage,
                        item.frequency, item.duration, item.instructions,
                        order_idx, now_iso
                    )
                )

        # Audit log amendment
        log_clinical_audit(
            record_type="prescription",
            record_id=prescription_id,
            patient_id=rx["patient_id"],
            action="amended" if rx["status"] == "finalized" else "updated",
            performed_by_user_id=current_user["id"],
            previous_data=prev_data,
            new_data=payload.model_dump(),
            reason=payload.edit_reason or "Draft prescription updated",
            ip_address=client_ip,
            conn=db
        )

        return {"status": "success", "message": "Prescription updated successfully."}


@router.post("/{prescription_id}/finalize")
def finalize_prescription(
    prescription_id: str,
    request: Request,
    current_user: dict = Depends(require_role("doctor"))
):
    """Locks a draft prescription into finalized state."""
    client_ip = request.client.host if request.client else "unknown"
    doc_profile = current_user.get("doctor_profile")
    if not doc_profile:
        raise HTTPException(status_code=403, detail="Unauthorized.")

    doctor_id = doc_profile["doctor_id"]

    with get_db() as db:
        rx = db.execute("SELECT * FROM prescriptions WHERE id = ?", (prescription_id,)).fetchone()
        if not rx:
            raise HTTPException(status_code=404, detail="Prescription not found.")

        if rx["doctor_id"] != doctor_id:
            raise HTTPException(status_code=403, detail="Only the prescribing doctor can finalize this prescription.")

        if rx["status"] == "finalized":
            return {"status": "success", "message": "Prescription is already finalized."}

        now_iso = datetime.now(timezone.utc).isoformat()
        db.execute(
            "UPDATE prescriptions SET status = 'finalized', finalized_at = ?, updated_at = ? WHERE id = ?",
            (now_iso, now_iso, prescription_id)
        )

        log_clinical_audit(
            record_type="prescription",
            record_id=prescription_id,
            patient_id=rx["patient_id"],
            action="finalized",
            performed_by_user_id=current_user["id"],
            previous_data={"status": rx["status"]},
            new_data={"status": "finalized", "finalized_at": now_iso},
            reason="Prescription finalized by clinician",
            ip_address=client_ip,
            conn=db
        )

        # Notify patient
        pat_user = db.execute("SELECT user_id FROM patients WHERE id = ?", (rx["patient_id"],)).fetchone()
        if pat_user:
            create_notification(
                user_id=pat_user["user_id"],
                title="Prescription Finalized",
                message=f"Prescription {rx['prescription_number']} has been signed and finalized by your doctor.",
                notif_type="system",
                link="/patient/prescriptions",
                conn=db
            )

        return {"status": "success", "message": "Prescription finalized."}


@router.get("/patient/{patient_id}")
def list_patient_prescriptions(
    patient_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lists prescriptions for a given patient with authorization check."""
    with get_db() as db:
        role = current_user.get("role")
        if role == "patient":
            pat_profile = current_user.get("patient_profile")
            if not pat_profile or pat_profile["patient_id"] != patient_id:
                raise HTTPException(status_code=403, detail="Unauthorized.")
        elif role == "doctor":
            doc_profile = current_user.get("doctor_profile")
            if not doc_profile:
                raise HTTPException(status_code=403, detail="Unauthorized.")
            # Check relation
            rel = db.execute(
                "SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ?",
                (doc_profile["doctor_id"], patient_id)
            ).fetchone()
            if not rel:
                raise HTTPException(status_code=403, detail="Unauthorized to access this patient's prescriptions.")
        elif role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized.")

        rows = db.execute(
            """
            SELECT pr.*, u.full_name as doctor_name, d.specialization as doctor_specialization,
                   (SELECT COUNT(*) FROM prescription_items WHERE prescription_id = pr.id) as item_count
            FROM prescriptions pr
            JOIN doctors d ON pr.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE pr.patient_id = ?
            ORDER BY pr.created_at DESC
            """,
            (patient_id,)
        ).fetchall()

        return {"status": "success", "prescriptions": [dict(r) for r in rows]}


@router.get("/my/list")
def list_my_prescriptions(current_user: dict = Depends(get_current_user)):
    """Lists prescriptions for the currently logged in user (patient or doctor)."""
    role = current_user.get("role")
    with get_db() as db:
        if role == "patient":
            pat_profile = current_user.get("patient_profile")
            if not pat_profile:
                raise HTTPException(status_code=400, detail="Patient profile not found.")
            return list_patient_prescriptions(patient_id=pat_profile["patient_id"], current_user=current_user)
        elif role == "doctor":
            doc_profile = current_user.get("doctor_profile")
            if not doc_profile:
                raise HTTPException(status_code=400, detail="Doctor profile not found.")
            rows = db.execute(
                """
                SELECT pr.*, u_pat.full_name as patient_name,
                       (SELECT COUNT(*) FROM prescription_items WHERE prescription_id = pr.id) as item_count
                FROM prescriptions pr
                JOIN patients p ON pr.patient_id = p.id
                JOIN users u_pat ON p.user_id = u_pat.id
                WHERE pr.doctor_id = ?
                ORDER BY pr.created_at DESC
                """,
                (doc_profile["doctor_id"],)
            ).fetchall()
            return {"status": "success", "prescriptions": [dict(r) for r in rows]}
        else:
            raise HTTPException(status_code=403, detail="Use /patient/{id} for administrative view.")


@router.get("/{prescription_id}/pdf")
def download_prescription_pdf(
    prescription_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Renders and serves a downloadable, branded PDF for a prescription.
    """
    detail_res = get_prescription_detail(prescription_id=prescription_id, current_user=current_user)
    rx = detail_res["prescription"]
    items = detail_res["items"]

    pdf_payload = {
        "prescription_number": rx["prescription_number"],
        "status": rx["status"],
        "created_at": rx["created_at"],
        "clinical_assessment": rx.get("clinical_assessment"),
        "diagnosis": rx.get("diagnosis"),
        "follow_up_date": rx.get("follow_up_date"),
        "general_instructions": rx.get("general_instructions"),
        "doctor": {
            "full_name": rx.get("doctor_name", "Doctor"),
            "qualification": rx.get("doctor_qualification", "MBBS"),
            "specialization": rx.get("doctor_specialization", "General"),
            "medical_registration_number": rx.get("medical_registration_number", "N/A"),
            "clinic_name": rx.get("clinic_name", "PARAKH Healthcare"),
            "clinic_address": rx.get("clinic_address", "Digital Clinic Portal"),
        },
        "patient": {
            "full_name": rx.get("patient_name", "Patient"),
            "gender": rx.get("patient_gender", "N/A"),
            "date_of_birth": rx.get("date_of_birth", "N/A"),
            "phone": rx.get("patient_phone", "N/A"),
            "email": rx.get("patient_email", "N/A"),
            "patient_id": rx.get("patient_id", "N/A"),
        },
        "items": items
    }

    pdf_bytes = generate_prescription_pdf(pdf_payload)

    filename = f"Prescription_{rx['prescription_number']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
            "Cache-Control": "no-cache, no-store, must-revalidate"
        }
    )
