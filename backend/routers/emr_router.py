"""
PARAKH (परख) - Electronic Medical Records (EMR) Router
Handles patient medical profiles, allergies, chronic conditions, medications,
and clinical audit trails with strict role-based access control.
"""

from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field

from database.db import get_db
from auth.dependencies import get_current_user, require_role
from auth.tokens import generate_id
from services.clinical_audit_service import log_clinical_audit

router = APIRouter(prefix="/api/v1/emr", tags=["EMR"])


def resolve_patient_id(db, patient_id_or_code: str) -> str:
    cleaned = (patient_id_or_code or "").strip()
    row = db.execute("SELECT id FROM patients WHERE id = ? OR patient_unique_id = ?", (cleaned, cleaned)).fetchone()
    if row:
        return row[0]
    return cleaned


def check_patient_access(current_user: dict, patient_id: str, db) -> bool:
    role = current_user.get("role")
    patient_id = resolve_patient_id(db, patient_id)
    if role == "admin":
        return True
    if role == "patient":
        pat_profile = current_user.get("patient_profile")
        if pat_profile and pat_profile["patient_id"] == patient_id:
            return True
        return False
    if role == "doctor":
        doc_profile = current_user.get("doctor_profile")
        if not doc_profile:
            return False
        if doc_profile.get("verification_status") != "approved":
            return False
        doc_id = doc_profile["doctor_id"]
        # Established care: appointment or consultation
        rel = db.execute(
            """
            SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ?
            UNION
            SELECT 1 FROM consultation_records WHERE doctor_id = ? AND patient_id = ?
            """,
            (doc_id, patient_id, doc_id, patient_id)
        ).fetchone()
        return bool(rel)
    return False


# --- Schemas ---

class MedicalProfileUpdateRequest(BaseModel):
    blood_group: Optional[str] = Field(None, max_length=10)
    height_cm: Optional[float] = Field(None, ge=30, le=300)
    weight_kg: Optional[float] = Field(None, ge=1, le=500)
    emergency_contact_name: Optional[str] = Field(None, max_length=120)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)
    lifestyle_notes: Optional[str] = Field(None, max_length=2000)
    family_medical_history: Optional[str] = Field(None, max_length=2000)


class AllergyCreateRequest(BaseModel):
    allergen: str = Field(..., min_length=1, max_length=200)
    reaction: Optional[str] = Field(None, max_length=500)
    severity: str = Field("mild", pattern="^(mild|moderate|severe|life-threatening)$")
    diagnosed_date: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=1000)


class ConditionCreateRequest(BaseModel):
    condition_name: str = Field(..., min_length=1, max_length=200)
    status: str = Field("active", pattern="^(active|resolved|chronic|remission)$")
    diagnosed_date: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=1000)


class MedicationCreateRequest(BaseModel):
    medication_name: str = Field(..., min_length=1, max_length=200)
    dosage: str = Field(..., min_length=1, max_length=100)
    frequency: str = Field(..., min_length=1, max_length=100)
    start_date: Optional[str] = Field(None, max_length=20)
    end_date: Optional[str] = Field(None, max_length=20)
    status: str = Field("active", pattern="^(active|discontinued|completed)$")
    prescribed_by: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)


# --- Endpoints ---

@router.get("/patient/{patient_id}")
def get_patient_emr(
    patient_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves complete electronic medical record for a patient.
    Accessible only to the patient themself, authorized doctor with appointment, or admin.
    """
    with get_db() as db:
        patient_id = resolve_patient_id(db, patient_id)
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have authorization to view this patient's medical records."
            )

        # 1. Patient User info & core profile
        patient = db.execute(
            """
            SELECT p.id as patient_id, u.id as user_id, u.full_name, u.email, u.phone,
                   p.gender, p.date_of_birth,
                   mp.blood_group, mp.height_cm, mp.weight_kg, mp.emergency_contact_name,
                   mp.emergency_contact_phone, mp.lifestyle_notes, mp.family_medical_history,
                   mp.updated_at as profile_updated_at
            FROM patients p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN patient_medical_profiles mp ON p.id = mp.patient_id
            WHERE p.id = ?
            """,
            (patient_id,)
        ).fetchone()

        if not patient:
            raise HTTPException(status_code=404, detail="Patient record not found.")

        # 2. Allergies
        allergies = db.execute(
            """
            SELECT a.*, u.full_name as author_name
            FROM patient_allergies a
            LEFT JOIN users u ON a.created_by_user_id = u.id
            WHERE a.patient_id = ?
            ORDER BY a.created_at DESC
            """,
            (patient_id,)
        ).fetchall()

        # 3. Medical Conditions
        conditions = db.execute(
            """
            SELECT c.*, u.full_name as author_name
            FROM patient_medical_conditions c
            LEFT JOIN users u ON c.created_by_user_id = u.id
            WHERE c.patient_id = ?
            ORDER BY c.created_at DESC
            """,
            (patient_id,)
        ).fetchall()

        # 4. Medications
        medications = db.execute(
            """
            SELECT m.*, u.full_name as author_name
            FROM patient_medications m
            LEFT JOIN users u ON m.created_by_user_id = u.id
            WHERE m.patient_id = ?
            ORDER BY m.created_at DESC
            """,
            (patient_id,)
        ).fetchall()

        # 5. Past Consultations
        consultations = db.execute(
            """
            SELECT cr.*, u.full_name as doctor_name, d.specialization as doctor_specialization,
                   a.appointment_date, a.slot_start
            FROM consultation_records cr
            JOIN doctors d ON cr.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            JOIN appointments a ON cr.appointment_id = a.id
            WHERE cr.patient_id = ?
            ORDER BY cr.created_at DESC
            """,
            (patient_id,)
        ).fetchall()

        return {
            "status": "success",
            "patient": dict(patient),
            "allergies": [dict(r) for r in allergies],
            "conditions": [dict(r) for r in conditions],
            "medications": [dict(r) for r in medications],
            "consultations": [dict(r) for r in consultations]
        }


@router.get("/my")
def get_my_emr(current_user: dict = Depends(require_role("patient"))):
    """Convenience endpoint for logged-in patient to view their own complete EMR."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    return get_patient_emr(patient_id=pat_profile["patient_id"], current_user=current_user)


@router.put("/patient/{patient_id}/profile")
def update_patient_medical_profile(
    patient_id: str,
    payload: MedicalProfileUpdateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Updates core patient medical profile with audit logging."""
    client_ip = request.client.host if request.client else "unknown"
    with get_db() as db:
        patient_id = resolve_patient_id(db, patient_id)
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized to modify this patient profile.")

        # Check existing
        existing = db.execute(
            "SELECT * FROM patient_medical_profiles WHERE patient_id = ?",
            (patient_id,)
        ).fetchone()

        now_iso = datetime.now(timezone.utc).isoformat()
        new_data = payload.model_dump(exclude_unset=True)

        if existing:
            prev_data = dict(existing)
            db.execute(
                """
                UPDATE patient_medical_profiles
                SET blood_group = COALESCE(?, blood_group),
                    height_cm = COALESCE(?, height_cm),
                    weight_kg = COALESCE(?, weight_kg),
                    emergency_contact_name = COALESCE(?, emergency_contact_name),
                    emergency_contact_phone = COALESCE(?, emergency_contact_phone),
                    lifestyle_notes = COALESCE(?, lifestyle_notes),
                    family_medical_history = COALESCE(?, family_medical_history),
                    updated_at = ?
                WHERE patient_id = ?
                """,
                (
                    payload.blood_group, payload.height_cm, payload.weight_kg,
                    payload.emergency_contact_name, payload.emergency_contact_phone,
                    payload.lifestyle_notes, payload.family_medical_history,
                    now_iso, patient_id
                )
            )
            log_clinical_audit(
                record_type="medical_profile",
                record_id=patient_id,
                patient_id=patient_id,
                action="updated",
                performed_by_user_id=current_user["id"],
                previous_data=prev_data,
                new_data=new_data,
                reason="Patient profile updated",
                ip_address=client_ip,
                conn=db
            )
        else:
            db.execute(
                """
                INSERT INTO patient_medical_profiles
                (patient_id, blood_group, height_cm, weight_kg, emergency_contact_name,
                 emergency_contact_phone, lifestyle_notes, family_medical_history, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    patient_id, payload.blood_group, payload.height_cm, payload.weight_kg,
                    payload.emergency_contact_name, payload.emergency_contact_phone,
                    payload.lifestyle_notes, payload.family_medical_history, now_iso, now_iso
                )
            )
            log_clinical_audit(
                record_type="medical_profile",
                record_id=patient_id,
                patient_id=patient_id,
                action="created",
                performed_by_user_id=current_user["id"],
                previous_data=None,
                new_data=new_data,
                reason="Initial patient medical profile created",
                ip_address=client_ip,
                conn=db
            )

        return {"status": "success", "message": "Medical profile updated successfully."}


# --- Allergies ---

@router.post("/patient/{patient_id}/allergies", status_code=201)
def add_patient_allergy(
    patient_id: str,
    payload: AllergyCreateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Add a documented allergy for a patient."""
    client_ip = request.client.host if request.client else "unknown"
    with get_db() as db:
        patient_id = resolve_patient_id(db, patient_id)
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized to add allergy records for this patient.")

        allergy_id = generate_id("alg")
        now_iso = datetime.now(timezone.utc).isoformat()

        db.execute(
            """
            INSERT INTO patient_allergies (id, patient_id, allergen, reaction, severity, diagnosed_date, notes, created_by_user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                allergy_id, patient_id, payload.allergen, payload.reaction,
                payload.severity, payload.diagnosed_date, payload.notes,
                current_user["id"], now_iso, now_iso
            )
        )

        log_clinical_audit(
            record_type="allergy",
            record_id=allergy_id,
            patient_id=patient_id,
            action="created",
            performed_by_user_id=current_user["id"],
            new_data=payload.model_dump(),
            reason="Allergy entry recorded",
            ip_address=client_ip,
            conn=db
        )

        return {"status": "success", "allergy_id": allergy_id, "message": "Allergy recorded."}


@router.delete("/allergies/{allergy_id}")
def delete_patient_allergy(
    allergy_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Removes an allergy record with audit preservation."""
    client_ip = request.client.host if request.client else "unknown"
    with get_db() as db:
        allergy = db.execute("SELECT * FROM patient_allergies WHERE id = ?", (allergy_id,)).fetchone()
        if not allergy:
            raise HTTPException(status_code=404, detail="Allergy record not found.")

        patient_id = allergy["patient_id"]
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized to modify this record.")

        db.execute("DELETE FROM patient_allergies WHERE id = ?", (allergy_id,))

        log_clinical_audit(
            record_type="allergy",
            record_id=allergy_id,
            patient_id=patient_id,
            action="deleted",
            performed_by_user_id=current_user["id"],
            previous_data=dict(allergy),
            reason="Allergy record removed",
            ip_address=client_ip,
            conn=db
        )

        return {"status": "success", "message": "Allergy record removed."}


# --- Conditions ---

@router.post("/patient/{patient_id}/conditions", status_code=201)
def add_patient_condition(
    patient_id: str,
    payload: ConditionCreateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Add a documented medical condition for a patient."""
    client_ip = request.client.host if request.client else "unknown"
    with get_db() as db:
        patient_id = resolve_patient_id(db, patient_id)
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized to add condition for this patient.")

        condition_id = generate_id("cnd")
        now_iso = datetime.now(timezone.utc).isoformat()

        db.execute(
            """
            INSERT INTO patient_medical_conditions (id, patient_id, condition_name, status, diagnosed_date, notes, created_by_user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                condition_id, patient_id, payload.condition_name, payload.status,
                payload.diagnosed_date, payload.notes, current_user["id"], now_iso, now_iso
            )
        )

        log_clinical_audit(
            record_type="condition",
            record_id=condition_id,
            patient_id=patient_id,
            action="created",
            performed_by_user_id=current_user["id"],
            new_data=payload.model_dump(),
            reason="Medical condition recorded",
            ip_address=client_ip,
            conn=db
        )

        return {"status": "success", "condition_id": condition_id, "message": "Condition recorded."}


@router.delete("/conditions/{condition_id}")
def delete_patient_condition(
    condition_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Deletes a condition with audit preservation."""
    client_ip = request.client.host if request.client else "unknown"
    with get_db() as db:
        condition = db.execute("SELECT * FROM patient_medical_conditions WHERE id = ?", (condition_id,)).fetchone()
        if not condition:
            raise HTTPException(status_code=404, detail="Condition record not found.")

        patient_id = condition["patient_id"]
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized.")

        db.execute("DELETE FROM patient_medical_conditions WHERE id = ?", (condition_id,))

        log_clinical_audit(
            record_type="condition",
            record_id=condition_id,
            patient_id=patient_id,
            action="deleted",
            performed_by_user_id=current_user["id"],
            previous_data=dict(condition),
            reason="Condition record removed",
            ip_address=client_ip,
            conn=db
        )

        return {"status": "success", "message": "Condition record removed."}


# --- Medications ---

@router.post("/patient/{patient_id}/medications", status_code=201)
def add_patient_medication(
    patient_id: str,
    payload: MedicationCreateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Add a documented ongoing or past medication for a patient."""
    client_ip = request.client.host if request.client else "unknown"
    with get_db() as db:
        patient_id = resolve_patient_id(db, patient_id)
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized to add medication record for this patient.")

        medication_id = generate_id("med")
        now_iso = datetime.now(timezone.utc).isoformat()

        db.execute(
            """
            INSERT INTO patient_medications (id, patient_id, medication_name, dosage, frequency, start_date, end_date, status, prescribed_by, notes, created_by_user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                medication_id, patient_id, payload.medication_name, payload.dosage,
                payload.frequency, payload.start_date, payload.end_date, payload.status,
                payload.prescribed_by, payload.notes, current_user["id"], now_iso, now_iso
            )
        )

        log_clinical_audit(
            record_type="medication",
            record_id=medication_id,
            patient_id=patient_id,
            action="created",
            performed_by_user_id=current_user["id"],
            new_data=payload.model_dump(),
            reason="Medication record created",
            ip_address=client_ip,
            conn=db
        )

        return {"status": "success", "medication_id": medication_id, "message": "Medication recorded."}


@router.delete("/medications/{medication_id}")
def delete_patient_medication(
    medication_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Deletes a medication with audit preservation."""
    client_ip = request.client.host if request.client else "unknown"
    with get_db() as db:
        med = db.execute("SELECT * FROM patient_medications WHERE id = ?", (medication_id,)).fetchone()
        if not med:
            raise HTTPException(status_code=404, detail="Medication record not found.")

        patient_id = med["patient_id"]
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized.")

        db.execute("DELETE FROM patient_medications WHERE id = ?", (medication_id,))

        log_clinical_audit(
            record_type="medication",
            record_id=medication_id,
            patient_id=patient_id,
            action="deleted",
            performed_by_user_id=current_user["id"],
            previous_data=dict(med),
            reason="Medication record deleted",
            ip_address=client_ip,
            conn=db
        )

        return {"status": "success", "message": "Medication removed."}


@router.get("/patient/{patient_id}/audit-logs")
def get_patient_clinical_audit_logs(
    patient_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Returns clinical modification audit trail. Restricted to doctors & admins."""
    if current_user.get("role") not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Clinical audit trail access restricted to clinicians and administrators.")

    with get_db() as db:
        patient_id = resolve_patient_id(db, patient_id)
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized.")

        logs = db.execute(
            """
            SELECT l.*, u.full_name as performed_by_name, u.role as performed_by_role
            FROM clinical_record_audit_logs l
            JOIN users u ON l.performed_by_user_id = u.id
            WHERE l.patient_id = ?
            ORDER BY l.created_at DESC
            """,
            (patient_id,)
        ).fetchall()

        return {"status": "success", "audit_logs": [dict(l) for l in logs]}
