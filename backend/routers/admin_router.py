from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from database.db import get_db
from auth.dependencies import require_role
from services.audit_service import log_audit_event

router = APIRouter(prefix="/api/v1/admin", tags=["Administration"])

# ==================== SCHEMAS ====================

class RejectDoctorRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=3, max_length=500)

class UpdateUserStatusRequest(BaseModel):
    account_status: str = Field(..., pattern="^(active|suspended)$")
    reason: Optional[str] = None

# ==================== ENDPOINTS ====================

@router.get("/stats")
def get_admin_stats(admin_user: dict = Depends(require_role("admin"))):
    """
    Returns platform statistics computed directly from live database tables.
    """
    with get_db() as db:
        total_users = db.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        total_doctors = db.execute("SELECT COUNT(*) AS c FROM users WHERE role = 'doctor'").fetchone()["c"]
        total_patients = db.execute("SELECT COUNT(*) AS c FROM users WHERE role = 'patient'").fetchone()["c"]
        
        pending_doctors = db.execute(
            "SELECT COUNT(*) AS c FROM doctors WHERE verification_status = 'pending'"
        ).fetchone()["c"]
        approved_doctors = db.execute(
            "SELECT COUNT(*) AS c FROM doctors WHERE verification_status = 'approved'"
        ).fetchone()["c"]
        rejected_doctors = db.execute(
            "SELECT COUNT(*) AS c FROM doctors WHERE verification_status = 'rejected'"
        ).fetchone()["c"]
        suspended_accounts = db.execute(
            "SELECT COUNT(*) AS c FROM users WHERE account_status = 'suspended'"
        ).fetchone()["c"]

        recent_users_rows = db.execute(
            """
            SELECT id, full_name, email, role, account_status, email_verified, created_at
            FROM users ORDER BY created_at DESC LIMIT 5
            """
        ).fetchall()
        recent_users = [dict(r) for r in recent_users_rows]

        recent_activities_rows = db.execute(
            """
            SELECT a.id, a.action, a.timestamp, a.ip_address, a.metadata,
                   u.full_name AS actor_name, u.email AS actor_email
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_user_id = u.id
            ORDER BY a.timestamp DESC LIMIT 10
            """
        ).fetchall()
        recent_activities = [dict(r) for r in recent_activities_rows]

    return {
        "status": "success",
        "data": {
            "total_users": total_users,
            "total_doctors": total_doctors,
            "total_patients": total_patients,
            "pending_doctors": pending_doctors,
            "approved_doctors": approved_doctors,
            "rejected_doctors": rejected_doctors,
            "suspended_accounts": suspended_accounts,
            "recent_registrations": recent_users,
            "recent_activities": recent_activities
        }
    }

@router.get("/doctors")
def list_doctors(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    admin_user: dict = Depends(require_role("admin"))
):
    """
    Lists all doctors with credential details, verification status, and user info.
    """
    query = """
    SELECT d.id AS doctor_id, d.user_id, d.medical_registration_number, d.qualification,
           d.specialization, d.experience_years, d.clinic_name, d.clinic_address,
           d.profile_image, d.professional_bio, d.verification_status, d.verified_by,
           d.verified_at, d.rejection_reason, d.created_at,
           u.full_name, u.email, u.phone, u.account_status, u.email_verified,
           v.full_name AS verified_by_name
    FROM doctors d
    JOIN users u ON d.user_id = u.id
    LEFT JOIN users v ON d.verified_by = v.id
    WHERE 1=1
    """
    params = []

    if status_filter:
        query += " AND d.verification_status = ?"
        params.append(status_filter)

    if search:
        search_like = f"%{search.strip()}%"
        query += " AND (u.full_name LIKE ? OR u.email LIKE ? OR d.medical_registration_number LIKE ? OR d.clinic_name LIKE ?)"
        params.extend([search_like, search_like, search_like, search_like])

    query += " ORDER BY d.created_at DESC"

    with get_db() as db:
        rows = db.execute(query, tuple(params)).fetchall()
        doctors = [dict(r) for r in rows]

    return {"status": "success", "count": len(doctors), "doctors": doctors}

@router.get("/doctors/{doctor_id}")
def get_doctor_detail(doctor_id: str, admin_user: dict = Depends(require_role("admin"))):
    """Retrieves full doctor details for administrative review."""
    with get_db() as db:
        row = db.execute(
            """
            SELECT d.*, u.full_name, u.email, u.phone, u.account_status, u.email_verified,
                   v.full_name AS verified_by_name
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            LEFT JOIN users v ON d.verified_by = v.id
            WHERE d.id = ?
            """,
            (doctor_id,)
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Doctor record not found.")

        return {"status": "success", "doctor": dict(row)}

@router.post("/doctors/{doctor_id}/approve")
def approve_doctor(doctor_id: str, admin_user: dict = Depends(require_role("admin"))):
    """
    Approves a doctor's medical credentials.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    admin_id = admin_user["id"]

    with get_db() as db:
        doc = db.execute("SELECT id, user_id, verification_status FROM doctors WHERE id = ?", (doctor_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not found.")

        # Update doctor table
        db.execute(
            """
            UPDATE doctors
            SET verification_status = 'approved', verified_by = ?, verified_at = ?, rejection_reason = NULL
            WHERE id = ?
            """,
            (admin_id, now_iso, doctor_id)
        )

        # Update user table account_status to active
        db.execute(
            "UPDATE users SET account_status = 'active', updated_at = ? WHERE id = ?",
            (now_iso, doc["user_id"])
        )

        log_audit_event(
            "doctor_approved",
            actor_user_id=admin_id,
            target_user_id=doc["user_id"],
            metadata={"doctor_id": doctor_id},
            conn=db
        )

    return {"status": "success", "message": "Doctor credentials approved successfully."}

@router.post("/doctors/{doctor_id}/reject")
def reject_doctor(
    doctor_id: str,
    payload: RejectDoctorRequest,
    admin_user: dict = Depends(require_role("admin"))
):
    """
    Rejects a doctor's credentials with an explicit justification.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    admin_id = admin_user["id"]

    with get_db() as db:
        doc = db.execute("SELECT id, user_id FROM doctors WHERE id = ?", (doctor_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not found.")

        db.execute(
            """
            UPDATE doctors
            SET verification_status = 'rejected', verified_by = ?, verified_at = ?, rejection_reason = ?
            WHERE id = ?
            """,
            (admin_id, now_iso, payload.rejection_reason.strip(), doctor_id)
        )

        db.execute(
            "UPDATE users SET account_status = 'rejected', updated_at = ? WHERE id = ?",
            (now_iso, doc["user_id"])
        )

        log_audit_event(
            "doctor_rejected",
            actor_user_id=admin_id,
            target_user_id=doc["user_id"],
            metadata={"doctor_id": doctor_id, "reason": payload.rejection_reason},
            conn=db
        )

    return {"status": "success", "message": "Doctor application marked as rejected."}

@router.get("/patients")
def list_patients(
    search: Optional[str] = None,
    admin_user: dict = Depends(require_role("admin"))
):
    """
    Lists registered patients with demographic info (without exposing medical data).
    """
    query = """
    SELECT p.id AS patient_id, p.user_id, p.date_of_birth, p.gender, p.patient_unique_id, p.created_at,
           u.full_name, u.email, u.phone, u.account_status, u.email_verified, u.last_login
    FROM patients p
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
    """
    params = []
    if search:
        search_like = f"%{search.strip()}%"
        query += " AND (u.full_name LIKE ? OR u.email LIKE ? OR p.patient_unique_id LIKE ?)"
        params.extend([search_like, search_like, search_like])

    query += " ORDER BY p.created_at DESC"

    with get_db() as db:
        rows = db.execute(query, tuple(params)).fetchall()
        patients = [dict(r) for r in rows]

    return {"status": "success", "count": len(patients), "patients": patients}

@router.get("/users")
def list_all_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    admin_user: dict = Depends(require_role("admin"))
):
    """Lists all platform users."""
    query = "SELECT id, full_name, email, phone, role, email_verified, account_status, created_at, last_login FROM users WHERE 1=1"
    params = []
    if role:
        query += " AND role = ?"
        params.append(role)
    if status:
        query += " AND account_status = ?"
        params.append(status)
    if search:
        search_like = f"%{search.strip()}%"
        query += " AND (full_name LIKE ? OR email LIKE ?)"
        params.extend([search_like, search_like])

    query += " ORDER BY created_at DESC"

    with get_db() as db:
        rows = db.execute(query, tuple(params)).fetchall()
        users = [dict(r) for r in rows]

    return {"status": "success", "count": len(users), "users": users}

@router.post("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: UpdateUserStatusRequest,
    admin_user: dict = Depends(require_role("admin"))
):
    """
    Allows admin to suspend or reactivate an account.
    """
    if user_id == admin_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot alter your own administrative status.")

    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        user = db.execute("SELECT id, role, account_status FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        db.execute(
            "UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?",
            (payload.account_status, now_iso, user_id)
        )

        # If doctor, keep doctor table verification_status in sync if suspending
        if user["role"] == "doctor" and payload.account_status == "suspended":
            db.execute("UPDATE doctors SET verification_status = 'suspended' WHERE user_id = ?", (user_id,))
        elif user["role"] == "doctor" and payload.account_status == "active":
            db.execute("UPDATE doctors SET verification_status = 'approved' WHERE user_id = ?", (user_id,))

        log_audit_event(
            f"user_status_{payload.account_status}",
            actor_user_id=admin_user["id"],
            target_user_id=user_id,
            metadata={"reason": payload.reason},
            conn=db
        )

    return {"status": "success", "message": f"User status updated to {payload.account_status}."}

@router.get("/activity-logs")
def get_activity_logs(
    limit: int = Query(50, ge=1, le=200),
    admin_user: dict = Depends(require_role("admin"))
):
    """Fetches administrative audit trail logs."""
    with get_db() as db:
        rows = db.execute(
            """
            SELECT a.id, a.action, a.timestamp, a.ip_address, a.metadata,
                   u.full_name AS actor_name, u.email AS actor_email,
                   t.full_name AS target_name, t.email AS target_email
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_user_id = u.id
            LEFT JOIN users t ON a.target_user_id = t.id
            ORDER BY a.timestamp DESC LIMIT ?
            """,
            (limit,)
        ).fetchall()

        logs = [dict(r) for r in rows]

    return {"status": "success", "count": len(logs), "logs": logs}
