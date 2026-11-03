"""
PARAKH — Appointment Management Router
Covers:
  - Doctor availability CRUD
  - Doctor unavailable dates
  - Public doctor discovery
  - Appointment booking, confirmation, rejection, cancellation, completion
  - Reschedule requests
"""

import os
from datetime import datetime, date, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from database.db import get_db
from auth.tokens import generate_id
from auth.dependencies import (
    require_role,
    require_verified_doctor,
    require_active_user,
)
from services.notification_service import create_notification

router = APIRouter(prefix="/api/v1/appointments", tags=["Appointments"])

# ─────────────────────────────────────────────────────────────
#  HELPER UTILITIES
# ─────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _time_to_minutes(t: str) -> int:
    """Convert 'HH:MM' to total minutes from midnight."""
    h, m = map(int, t.split(":"))
    return h * 60 + m

def _minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"

def _generate_slots(start: str, end: str, duration: int) -> list[str]:
    """Return list of 'HH:MM' slot-start times."""
    s = _time_to_minutes(start)
    e = _time_to_minutes(end)
    return [_minutes_to_time(s + i * duration) for i in range((e - s) // duration)]

def _validate_time(v: str) -> str:
    try:
        h, m = map(int, v.split(":"))
        assert 0 <= h < 24 and 0 <= m < 60
    except Exception:
        raise ValueError("Time must be HH:MM (24-hour)")
    return v

def _validate_date(v: str) -> str:
    try:
        datetime.strptime(v, "%Y-%m-%d")
    except ValueError:
        raise ValueError("Date must be YYYY-MM-DD")
    return v


# ─────────────────────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────────────────────

class AvailabilityCreateRequest(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Mon … 6=Sun")
    start_time: str
    end_time: str
    slot_duration_minutes: int = Field(30, description="10/15/20/30/45/60")

    @field_validator("start_time", "end_time")
    @classmethod
    def check_time(cls, v: str) -> str:
        return _validate_time(v)

    @field_validator("slot_duration_minutes")
    @classmethod
    def check_duration(cls, v: int) -> int:
        if v not in (10, 15, 20, 30, 45, 60):
            raise ValueError("slot_duration_minutes must be one of 10,15,20,30,45,60")
        return v


class AvailabilityUpdateRequest(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    slot_duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def check_time(cls, v):
        if v is not None:
            return _validate_time(v)
        return v

    @field_validator("slot_duration_minutes")
    @classmethod
    def check_duration(cls, v):
        if v is not None and v not in (10, 15, 20, 30, 45, 60):
            raise ValueError("slot_duration_minutes must be one of 10,15,20,30,45,60")
        return v


class UnavailableDateRequest(BaseModel):
    date: str
    reason: Optional[str] = None

    @field_validator("date")
    @classmethod
    def check_date(cls, v: str) -> str:
        return _validate_date(v)


class AppointmentBookRequest(BaseModel):
    doctor_id: str
    appointment_date: str
    slot_start: str
    reason_for_visit: Optional[str] = Field(None, max_length=500)
    attached_report_id: Optional[str] = None

    @field_validator("appointment_date")
    @classmethod
    def check_date(cls, v: str) -> str:
        return _validate_date(v)

    @field_validator("slot_start")
    @classmethod
    def check_time(cls, v: str) -> str:
        return _validate_time(v)


class AttachReportRequest(BaseModel):
    report_id: str
    notes: Optional[str] = Field(None, max_length=500)


class AppointmentActionRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class ConsultationRecordRequest(BaseModel):
    chief_complaint: Optional[str] = None
    clinical_notes: Optional[str] = None
    diagnosis: Optional[str] = None
    follow_up_date: Optional[str] = None

    @field_validator("follow_up_date")
    @classmethod
    def check_date(cls, v):
        if v is not None:
            return _validate_date(v)
        return v


class RescheduleRequest(BaseModel):
    new_date: str
    new_slot_start: str
    reason: Optional[str] = None

    @field_validator("new_date")
    @classmethod
    def check_date(cls, v: str) -> str:
        return _validate_date(v)

    @field_validator("new_slot_start")
    @classmethod
    def check_time(cls, v: str) -> str:
        return _validate_time(v)


# ─────────────────────────────────────────────────────────────
#  DOCTOR AVAILABILITY
# ─────────────────────────────────────────────────────────────

@router.post("/availability", status_code=201)
def create_availability(
    payload: AvailabilityCreateRequest,
    current_user: dict = Depends(require_verified_doctor),
):
    """Approved doctor creates a weekly availability window."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    # Validate time logic
    if _time_to_minutes(payload.start_time) >= _time_to_minutes(payload.end_time):
        raise HTTPException(status_code=400, detail="end_time must be after start_time.")
    if (_time_to_minutes(payload.end_time) - _time_to_minutes(payload.start_time)) < payload.slot_duration_minutes:
        raise HTTPException(status_code=400, detail="Window is shorter than one slot duration.")

    with get_db() as db:
        # Overlap check — load all active windows for this doctor+day
        existing = db.execute(
            "SELECT start_time, end_time FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1",
            (doctor_id, payload.day_of_week),
        ).fetchall()

        new_s = _time_to_minutes(payload.start_time)
        new_e = _time_to_minutes(payload.end_time)
        for row in existing:
            ex_s = _time_to_minutes(row["start_time"])
            ex_e = _time_to_minutes(row["end_time"])
            if new_s < ex_e and new_e > ex_s:
                raise HTTPException(
                    status_code=409,
                    detail=f"Overlaps with existing window {row['start_time']}–{row['end_time']} on the same day.",
                )

        avail_id = generate_id("avl")
        now = _now()
        db.execute(
            """INSERT INTO doctor_availability
               (id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            (avail_id, doctor_id, payload.day_of_week, payload.start_time, payload.end_time,
             payload.slot_duration_minutes, now, now),
        )

    return {"status": "success", "availability_id": avail_id}


@router.get("/availability/my")
def get_my_availability(current_user: dict = Depends(require_verified_doctor)):
    """Doctor views own availability windows."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week, start_time",
            (doctor_id,),
        ).fetchall()
    return {"status": "success", "availability": [dict(r) for r in rows]}


@router.put("/availability/{avail_id}")
def update_availability(
    avail_id: str,
    payload: AvailabilityUpdateRequest,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor updates one of their availability windows."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM doctor_availability WHERE id = ? AND doctor_id = ?",
            (avail_id, doctor_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Availability window not found.")

        new_start = payload.start_time if payload.start_time is not None else row["start_time"]
        new_end   = payload.end_time   if payload.end_time   is not None else row["end_time"]
        new_dur   = payload.slot_duration_minutes if payload.slot_duration_minutes is not None else row["slot_duration_minutes"]

        if _time_to_minutes(new_start) >= _time_to_minutes(new_end):
            raise HTTPException(status_code=400, detail="end_time must be after start_time.")

        # Overlap check against OTHER windows
        others = db.execute(
            "SELECT start_time, end_time FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ? AND id != ? AND is_active = 1",
            (doctor_id, row["day_of_week"], avail_id),
        ).fetchall()
        ns, ne = _time_to_minutes(new_start), _time_to_minutes(new_end)
        for o in others:
            if ns < _time_to_minutes(o["end_time"]) and ne > _time_to_minutes(o["start_time"]):
                raise HTTPException(status_code=409, detail="Updated window overlaps an existing window.")

        updates = ["start_time = ?", "end_time = ?", "slot_duration_minutes = ?", "updated_at = ?"]
        params  = [new_start, new_end, new_dur, _now()]

        if payload.is_active is not None:
            updates.append("is_active = ?")
            params.append(1 if payload.is_active else 0)

        params.append(avail_id)
        db.execute(f"UPDATE doctor_availability SET {', '.join(updates)} WHERE id = ?", params)

    return {"status": "success", "message": "Availability updated."}


@router.delete("/availability/{avail_id}", status_code=200)
def delete_availability(
    avail_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor deletes an availability window."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]
    with get_db() as db:
        res = db.execute(
            "DELETE FROM doctor_availability WHERE id = ? AND doctor_id = ?",
            (avail_id, doctor_id),
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Availability window not found.")
    return {"status": "success", "message": "Availability window deleted."}


@router.post("/availability/unavailable-dates", status_code=201)
def add_unavailable_date(
    payload: UnavailableDateRequest,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor blocks a specific calendar date (holiday/leave)."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]
    uid = generate_id("unav")
    try:
        with get_db() as db:
            db.execute(
                "INSERT INTO doctor_unavailable_dates (id, doctor_id, date, reason, created_at) VALUES (?, ?, ?, ?, ?)",
                (uid, doctor_id, payload.date, payload.reason, _now()),
            )
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(status_code=409, detail="That date is already marked unavailable.")
        raise
    return {"status": "success", "id": uid}


@router.delete("/availability/unavailable-dates/{date_id}", status_code=200)
def remove_unavailable_date(
    date_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    doctor_id = current_user["doctor_profile"]["doctor_id"]
    with get_db() as db:
        res = db.execute(
            "DELETE FROM doctor_unavailable_dates WHERE id = ? AND doctor_id = ?",
            (date_id, doctor_id),
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Unavailable date entry not found.")
    return {"status": "success", "message": "Date unblocked."}


# ─────────────────────────────────────────────────────────────
#  DOCTOR DISCOVERY  (public — any authenticated user)
# ─────────────────────────────────────────────────────────────

@router.get("/doctors")
def list_doctors(
    name: Optional[str] = Query(None),
    specialization: Optional[str] = Query(None),
    current_user: dict = Depends(require_active_user),
):
    """List approved, active doctors. Optional name/specialization filters."""
    if not isinstance(name, str):
        name = None
    if not isinstance(specialization, str):
        specialization = None
    with get_db() as db:
        rows = db.execute(
            """
            SELECT d.id AS doctor_id, u.full_name, d.specialization, d.qualification,
                   d.experience_years, d.clinic_name, d.clinic_address, d.professional_bio
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE d.verification_status = 'approved'
              AND u.account_status = 'active'
              AND (? IS NULL OR u.full_name LIKE '%' || ? || '%')
              AND (? IS NULL OR d.specialization LIKE '%' || ? || '%')
            ORDER BY u.full_name
            """,
            (name, name, specialization, specialization),
        ).fetchall()
    return {"status": "success", "doctors": [dict(r) for r in rows]}


@router.get("/doctors/{doctor_id}")
def get_doctor_profile_public(
    doctor_id: str,
    current_user: dict = Depends(require_active_user),
):
    """Public doctor profile (no private/contact data)."""
    with get_db() as db:
        row = db.execute(
            """
            SELECT d.id AS doctor_id, u.full_name, d.specialization, d.qualification,
                   d.experience_years, d.clinic_name, d.clinic_address, d.professional_bio
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = ? AND d.verification_status = 'approved' AND u.account_status = 'active'
            """,
            (doctor_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Doctor not found or not available.")
    return {"status": "success", "doctor": dict(row)}


@router.get("/doctors/{doctor_id}/slots")
def get_available_slots(
    doctor_id: str,
    date: str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(require_active_user),
):
    """Return free slots for a doctor on a given date."""
    _validate_date(date)

    # day_of_week: Python weekday() → 0=Mon
    try:
        d = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format.")

    day_of_week = d.weekday()

    with get_db() as db:
        # Verify doctor exists and is approved
        doc = db.execute(
            "SELECT id FROM doctors WHERE id = ? AND verification_status = 'approved'", (doctor_id,)
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not found or not approved.")

        # Check unavailability
        blocked = db.execute(
            "SELECT id FROM doctor_unavailable_dates WHERE doctor_id = ? AND date = ?",
            (doctor_id, date),
        ).fetchone()
        if blocked:
            return {"status": "success", "slots": [], "reason": "Doctor unavailable on this date."}

        # Load availability windows for that day
        windows = db.execute(
            "SELECT start_time, end_time, slot_duration_minutes FROM doctor_availability "
            "WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1",
            (doctor_id, day_of_week),
        ).fetchall()

        if not windows:
            return {"status": "success", "slots": [], "reason": "No availability set for this day."}

        # Load already-booked slots (not cancelled/rejected)
        booked = db.execute(
            """SELECT slot_start FROM appointments
               WHERE doctor_id = ? AND appointment_date = ?
               AND status NOT IN ('cancelled','rejected')""",
            (doctor_id, date),
        ).fetchall()
        booked_starts = {r["slot_start"] for r in booked}

        all_slots = []
        for w in windows:
            for slot_start in _generate_slots(w["start_time"], w["end_time"], w["slot_duration_minutes"]):
                slot_end = _minutes_to_time(_time_to_minutes(slot_start) + w["slot_duration_minutes"])
                all_slots.append({
                    "slot_start": slot_start,
                    "slot_end": slot_end,
                    "available": slot_start not in booked_starts,
                })

    return {"status": "success", "date": date, "slots": all_slots}


# ─────────────────────────────────────────────────────────────
#  APPOINTMENT BOOKING
# ─────────────────────────────────────────────────────────────

@router.post("/book", status_code=201)
def book_appointment(
    payload: AppointmentBookRequest,
    current_user: dict = Depends(require_role("patient")),
):
    """Patient books an appointment. Double-booking prevented via UNIQUE constraint + pre-check."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    patient_id = pat_profile["patient_id"]

    # Refuse past dates
    try:
        appt_date = datetime.strptime(payload.appointment_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid appointment_date.")
    if appt_date < date.today():
        raise HTTPException(status_code=400, detail="Cannot book an appointment in the past.")

    day_of_week = appt_date.weekday()

    with get_db() as db:
        # 1. Doctor must be approved + active
        doc = db.execute(
            """SELECT d.id FROM doctors d JOIN users u ON d.user_id = u.id
               WHERE d.id = ? AND d.verification_status = 'approved' AND u.account_status = 'active'""",
            (payload.doctor_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not available for booking.")

        # 2. Date not blocked
        blocked = db.execute(
            "SELECT id FROM doctor_unavailable_dates WHERE doctor_id = ? AND date = ?",
            (payload.doctor_id, payload.appointment_date),
        ).fetchone()
        if blocked:
            raise HTTPException(status_code=409, detail="Doctor is unavailable on this date.")

        # 3. Slot must fall within an active availability window
        windows = db.execute(
            "SELECT start_time, end_time, slot_duration_minutes FROM doctor_availability "
            "WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1",
            (payload.doctor_id, day_of_week),
        ).fetchall()

        slot_end = None
        for w in windows:
            slots = _generate_slots(w["start_time"], w["end_time"], w["slot_duration_minutes"])
            if payload.slot_start in slots:
                slot_end = _minutes_to_time(
                    _time_to_minutes(payload.slot_start) + w["slot_duration_minutes"]
                )
                break

        if slot_end is None:
            raise HTTPException(status_code=400, detail="Requested slot is not within doctor's availability.")

        # 4. Double-booking check INSIDE the same transaction
        conflict = db.execute(
            """SELECT id FROM appointments
               WHERE doctor_id = ? AND appointment_date = ? AND slot_start = ?
               AND status NOT IN ('cancelled', 'rejected')""",
            (payload.doctor_id, payload.appointment_date, payload.slot_start),
        ).fetchone()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This time slot has already been booked. Please choose another slot.",
            )

        # 5. Patient cannot have two appointments with the same doctor at the same time
        self_conflict = db.execute(
            """SELECT id FROM appointments
               WHERE patient_id = ? AND doctor_id = ? AND appointment_date = ? AND slot_start = ?
               AND status NOT IN ('cancelled','rejected')""",
            (patient_id, payload.doctor_id, payload.appointment_date, payload.slot_start),
        ).fetchone()
        if self_conflict:
            raise HTTPException(status_code=409, detail="You already have an appointment for this slot.")

        appt_id = generate_id("appt")
        now = _now()
        try:
            db.execute(
                """INSERT INTO appointments
                   (id, patient_id, doctor_id, appointment_date, slot_start, slot_end,
                    status, reason_for_visit, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)""",
                (appt_id, patient_id, payload.doctor_id, payload.appointment_date,
                 payload.slot_start, slot_end, payload.reason_for_visit, now, now),
            )

            # 6. Optional AI Report Attachment
            if payload.attached_report_id:
                rep = db.execute(
                    "SELECT id FROM ai_reports WHERE id = ? AND patient_id = ?",
                    (payload.attached_report_id, patient_id)
                ).fetchone()
                if not rep:
                    raise HTTPException(status_code=400, detail="Specified AI report does not belong to you or does not exist.")
                db.execute(
                    "INSERT INTO appointment_ai_reports (id, appointment_id, report_id, attached_at) VALUES (?, ?, ?, ?)",
                    (generate_id("aar"), appt_id, payload.attached_report_id, now)
                )

            # 7. Notify Doctor
            doc_user = db.execute("SELECT user_id FROM doctors WHERE id = ?", (payload.doctor_id,)).fetchone()
            if doc_user:
                patient_name = current_user.get("full_name", "Patient")
                create_notification(
                    user_id=doc_user["user_id"],
                    title="New Appointment Request",
                    message=(
                        f"Patient {patient_name} has requested an appointment with you on "
                        f"{payload.appointment_date} at {payload.slot_start}. "
                        f"Please review and approve this appointment in your portal to confirm your availability."
                    ),
                    notif_type="appointment_request",
                    link="/doctor",
                    conn=db
                )

        except Exception as e:
            if "UNIQUE" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This time slot has already been booked (concurrent request). Please choose another slot.",
                )
            raise

    return {"status": "success", "appointment_id": appt_id, "slot_end": slot_end}


# ─────────────────────────────────────────────────────────────
#  PATIENT — APPOINTMENT VIEWS
# ─────────────────────────────────────────────────────────────

@router.get("/my")
def patient_list_appointments(
    appt_status: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(require_role("patient")),
):
    """Patient views their own appointments."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    patient_id = pat_profile["patient_id"]

    with get_db() as db:
        query = """
            SELECT a.id, a.appointment_date, a.slot_start, a.slot_end, a.status,
                   a.reason_for_visit, a.notes, a.rejection_reason,
                   a.cancellation_reason, a.created_at,
                   u.full_name AS doctor_name, d.specialization, d.clinic_name
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE a.patient_id = ?
        """
        params: list = [patient_id]
        if appt_status:
            query += " AND a.status = ?"
            params.append(appt_status)
        query += " ORDER BY a.appointment_date DESC, a.slot_start DESC"

        rows = db.execute(query, params).fetchall()
    return {"status": "success", "appointments": [dict(r) for r in rows]}


@router.get("/my/{appt_id}")
def patient_get_appointment(
    appt_id: str,
    current_user: dict = Depends(require_role("patient")),
):
    """Patient views a specific appointment (must belong to them)."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    patient_id = pat_profile["patient_id"]

    with get_db() as db:
        row = db.execute(
            """SELECT a.*, u.full_name AS doctor_name, d.specialization, d.clinic_name
               FROM appointments a
               JOIN doctors d ON a.doctor_id = d.id
               JOIN users u ON d.user_id = u.id
               WHERE a.id = ? AND a.patient_id = ?""",
            (appt_id, patient_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return {"status": "success", "appointment": dict(row)}


@router.post("/my/{appt_id}/cancel")
def patient_cancel_appointment(
    appt_id: str,
    payload: AppointmentActionRequest,
    current_user: dict = Depends(require_role("patient")),
):
    """Patient cancels a pending or confirmed appointment."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    patient_id = pat_profile["patient_id"]

    with get_db() as db:
        appt = db.execute(
            """SELECT a.id, a.doctor_id, a.status, a.appointment_date, d.user_id AS doctor_user_id
               FROM appointments a
               JOIN doctors d ON a.doctor_id = d.id
               WHERE a.id = ? AND a.patient_id = ?""",
            (appt_id, patient_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] not in ("pending", "confirmed"):
            raise HTTPException(status_code=400, detail=f"Cannot cancel an appointment with status '{appt['status']}'.")

        now = _now()
        db.execute(
            """UPDATE appointments SET status='cancelled', cancelled_by='patient',
               cancellation_reason=?, updated_at=? WHERE id=?""",
            (payload.reason, now, appt_id),
        )

        create_notification(
            user_id=appt["doctor_user_id"],
            title="Appointment Cancelled",
            message=f"Appointment on {appt['appointment_date']} was cancelled by the patient.",
            notif_type="appointment_cancelled",
            link="/doctor",
            conn=db
        )
    return {"status": "success", "message": "Appointment cancelled."}


@router.post("/my/{appt_id}/reschedule")
def patient_request_reschedule(
    appt_id: str,
    payload: RescheduleRequest,
    current_user: dict = Depends(require_role("patient")),
):
    """Patient requests a reschedule for a confirmed or pending appointment."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    patient_id = pat_profile["patient_id"]

    with get_db() as db:
        appt = db.execute(
            """SELECT a.id, a.doctor_id, a.status, d.user_id AS doctor_user_id
               FROM appointments a
               JOIN doctors d ON a.doctor_id = d.id
               WHERE a.id = ? AND a.patient_id = ?""",
            (appt_id, patient_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] not in ("pending", "confirmed", "rescheduled"):
            raise HTTPException(status_code=400, detail="Only pending, confirmed, or active rescheduled appointments can be rescheduled.")

        # Validate new slot exists
        new_d = datetime.strptime(payload.new_date, "%Y-%m-%d")
        day_of_week = new_d.weekday()
        windows = db.execute(
            "SELECT start_time, end_time, slot_duration_minutes FROM doctor_availability "
            "WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1",
            (appt["doctor_id"], day_of_week),
        ).fetchall()
        slot_end = None
        for w in windows:
            if payload.new_slot_start in _generate_slots(w["start_time"], w["end_time"], w["slot_duration_minutes"]):
                slot_end = _minutes_to_time(
                    _time_to_minutes(payload.new_slot_start) + w["slot_duration_minutes"]
                )
                break
        if not slot_end:
            raise HTTPException(status_code=400, detail="Requested new slot is not within doctor's availability.")

        req_id = generate_id("rsch")
        db.execute(
            """INSERT INTO appointment_reschedule_requests
               (id, appointment_id, requested_by, requested_by_role, new_date, new_slot_start, new_slot_end, reason, status, created_at)
               VALUES (?, ?, ?, 'patient', ?, ?, ?, ?, 'pending', ?)""",
            (req_id, appt_id, current_user["id"], payload.new_date, payload.new_slot_start, slot_end, payload.reason, _now()),
        )

        create_notification(
            user_id=appt["doctor_user_id"],
            title="Reschedule Requested",
            message=f"Patient requested rescheduling appointment to {payload.new_date} at {payload.new_slot_start}.",
            notif_type="reschedule_request",
            link="/doctor",
            conn=db
        )
    return {"status": "success", "reschedule_request_id": req_id}


# ─────────────────────────────────────────────────────────────
#  DOCTOR — APPOINTMENT MANAGEMENT
# ─────────────────────────────────────────────────────────────

@router.get("/doctor")
def doctor_list_appointments(
    appt_status: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(require_verified_doctor),
):
    """Approved doctor views their assigned appointments."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        query = """
            SELECT a.id, a.appointment_date, a.slot_start, a.slot_end, a.status,
                   a.reason_for_visit, a.notes, a.rejection_reason,
                   a.cancellation_reason, a.created_at,
                   u.full_name AS patient_name, p.patient_unique_id,
                   p.id AS patient_id
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE a.doctor_id = ?
        """
        params: list = [doctor_id]
        if appt_status:
            query += " AND a.status = ?"
            params.append(appt_status)
        query += " ORDER BY a.appointment_date ASC, a.slot_start ASC"

        rows = db.execute(query, params).fetchall()
    return {"status": "success", "appointments": [dict(r) for r in rows]}


@router.get("/doctor/{appt_id}")
def doctor_get_appointment(
    appt_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor views a specific appointment (must be assigned to them)."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        row = db.execute(
            """SELECT a.*, u.full_name AS patient_name, p.patient_unique_id, p.date_of_birth, p.gender
               FROM appointments a
               JOIN patients p ON a.patient_id = p.id
               JOIN users u ON p.user_id = u.id
               WHERE a.id = ? AND a.doctor_id = ?""",
            (appt_id, doctor_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return {"status": "success", "appointment": dict(row)}


@router.post("/doctor/{appt_id}/confirm")
def doctor_confirm_appointment(
    appt_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor confirms a pending appointment."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        appt = db.execute(
            """SELECT a.id, a.status, a.appointment_date, a.slot_start, p.user_id AS patient_user_id,
                      u_doc.full_name AS doctor_name
               FROM appointments a
               JOIN patients p ON a.patient_id = p.id
               JOIN doctors d ON a.doctor_id = d.id
               JOIN users u_doc ON d.user_id = u_doc.id
               WHERE a.id = ? AND a.doctor_id = ?""",
            (appt_id, doctor_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Only pending appointments can be confirmed. Current: {appt['status']}")
        db.execute(
            "UPDATE appointments SET status='confirmed', updated_at=? WHERE id=?",
            (_now(), appt_id),
        )

        doctor_name = appt["doctor_name"] if appt and appt["doctor_name"] else "Dr. Rajesh Verma"
        create_notification(
            user_id=appt["patient_user_id"],
            title="Appointment Approved",
            message=(
                f"Great news! {doctor_name} has approved your appointment for "
                f"{appt['appointment_date']} at {appt['slot_start']}. "
                f"Your consultation time is confirmed. You can now contact the doctor."
            ),
            notif_type="appointment_confirmed",
            link="/patient",
            conn=db
        )
    return {"status": "success", "message": "Appointment confirmed."}


@router.post("/doctor/{appt_id}/reject")
def doctor_reject_appointment(
    appt_id: str,
    payload: AppointmentActionRequest,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor rejects a pending appointment."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        appt = db.execute(
            """SELECT a.id, a.status, a.appointment_date, p.user_id AS patient_user_id
               FROM appointments a
               JOIN patients p ON a.patient_id = p.id
               WHERE a.id = ? AND a.doctor_id = ?""",
            (appt_id, doctor_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Only pending appointments can be rejected. Current: {appt['status']}")
        db.execute(
            "UPDATE appointments SET status='rejected', rejection_reason=?, updated_at=? WHERE id=?",
            (payload.reason, _now(), appt_id),
        )

        create_notification(
            user_id=appt["patient_user_id"],
            title="Appointment Update",
            message=f"Your appointment request for {appt['appointment_date']} was declined. {payload.reason or ''}".strip(),
            notif_type="appointment_rejected",
            link="/patient",
            conn=db
        )
    return {"status": "success", "message": "Appointment rejected."}


@router.post("/doctor/{appt_id}/complete")
def doctor_complete_appointment(
    appt_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor marks an appointment as completed."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        appt = db.execute(
            "SELECT id, status FROM appointments WHERE id = ? AND doctor_id = ?",
            (appt_id, doctor_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] != "confirmed":
            raise HTTPException(status_code=400, detail=f"Only confirmed appointments can be completed. Current: {appt['status']}")
        db.execute(
            "UPDATE appointments SET status='completed', updated_at=? WHERE id=?",
            (_now(), appt_id),
        )
    return {"status": "success", "message": "Appointment marked as completed."}


@router.post("/doctor/{appt_id}/no-show")
def doctor_mark_no_show(
    appt_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor marks confirmed appointment as no_show."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        appt = db.execute(
            "SELECT id, status FROM appointments WHERE id = ? AND doctor_id = ?",
            (appt_id, doctor_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] != "confirmed":
            raise HTTPException(status_code=400, detail="Only confirmed appointments can be marked no-show.")
        db.execute(
            "UPDATE appointments SET status='no_show', updated_at=? WHERE id=?",
            (_now(), appt_id),
        )
    return {"status": "success", "message": "Appointment marked as no-show."}


@router.post("/doctor/{appt_id}/cancel")
def doctor_cancel_appointment(
    appt_id: str,
    payload: AppointmentActionRequest,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor cancels a pending or confirmed appointment."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        appt = db.execute(
            """SELECT a.id, a.status, a.appointment_date, p.user_id AS patient_user_id
               FROM appointments a
               JOIN patients p ON a.patient_id = p.id
               WHERE a.id = ? AND a.doctor_id = ?""",
            (appt_id, doctor_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] not in ("pending", "confirmed"):
            raise HTTPException(status_code=400, detail=f"Cannot cancel an appointment with status '{appt['status']}'.")
        db.execute(
            """UPDATE appointments SET status='cancelled', cancelled_by='doctor',
               cancellation_reason=?, updated_at=? WHERE id=?""",
            (payload.reason, _now(), appt_id),
        )

        create_notification(
            user_id=appt["patient_user_id"],
            title="Appointment Cancelled",
            message=f"Your appointment on {appt['appointment_date']} was cancelled by the doctor.",
            notif_type="appointment_cancelled",
            link="/patient",
            conn=db
        )
    return {"status": "success", "message": "Appointment cancelled."}


@router.post("/doctor/{appt_id}/consultation")
def create_or_update_consultation(
    appt_id: str,
    payload: ConsultationRecordRequest,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor creates or updates consultation record for a completed appointment."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        appt = db.execute(
            "SELECT id, patient_id, status FROM appointments WHERE id = ? AND doctor_id = ?",
            (appt_id, doctor_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] != "completed":
            raise HTTPException(status_code=400, detail="Consultation records can only be added to completed appointments.")

        now = _now()
        existing = db.execute(
            "SELECT id FROM consultation_records WHERE appointment_id = ?", (appt_id,)
        ).fetchone()

        if existing:
            db.execute(
                """UPDATE consultation_records SET chief_complaint=?, clinical_notes=?, diagnosis=?,
                   follow_up_date=?, updated_at=? WHERE appointment_id=?""",
                (payload.chief_complaint, payload.clinical_notes, payload.diagnosis,
                 payload.follow_up_date, now, appt_id),
            )
            return {"status": "success", "message": "Consultation record updated."}
        else:
            rec_id = generate_id("cns")
            db.execute(
                """INSERT INTO consultation_records
                   (id, appointment_id, doctor_id, patient_id, chief_complaint, clinical_notes,
                    diagnosis, follow_up_date, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (rec_id, appt_id, doctor_id, appt["patient_id"],
                 payload.chief_complaint, payload.clinical_notes, payload.diagnosis,
                 payload.follow_up_date, now, now),
            )
            return {"status": "success", "consultation_id": rec_id}


@router.post("/doctor/reschedule/{request_id}/accept")
def accept_reschedule(
    request_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor accepts a patient reschedule request — moves the appointment to new slot."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        req = db.execute(
            """SELECT r.*, a.doctor_id, a.patient_id, p.user_id AS patient_user_id
               FROM appointment_reschedule_requests r
               JOIN appointments a ON r.appointment_id = a.id
               JOIN patients p ON a.patient_id = p.id
               WHERE r.id = ? AND a.doctor_id = ?""",
            (request_id, doctor_id),
        ).fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Reschedule request not found.")
        if req["status"] != "pending":
            raise HTTPException(status_code=400, detail="This request has already been responded to.")

        # Double-booking check for new slot
        conflict = db.execute(
            """SELECT id FROM appointments
               WHERE doctor_id = ? AND appointment_date = ? AND slot_start = ?
               AND status NOT IN ('cancelled','rejected') AND id != ?""",
            (doctor_id, req["new_date"], req["new_slot_start"], req["appointment_id"]),
        ).fetchone()
        if conflict:
            raise HTTPException(status_code=409, detail="New slot is already booked.")

        now = _now()
        db.execute(
            """UPDATE appointments SET appointment_date=?, slot_start=?, slot_end=?,
               status='rescheduled', updated_at=? WHERE id=?""",
            (req["new_date"], req["new_slot_start"], req["new_slot_end"], now, req["appointment_id"]),
        )
        db.execute(
            "UPDATE appointment_reschedule_requests SET status='accepted', responded_at=? WHERE id=?",
            (now, request_id),
        )

        create_notification(
            user_id=req["patient_user_id"],
            title="Reschedule Confirmed",
            message=f"Your appointment has been rescheduled to {req['new_date']} at {req['new_slot_start']}.",
            notif_type="reschedule_confirmed",
            link="/patient",
            conn=db
        )
    return {"status": "success", "message": "Appointment rescheduled."}


@router.post("/doctor/reschedule/{request_id}/reject")
def reject_reschedule(
    request_id: str,
    current_user: dict = Depends(require_verified_doctor),
):
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        req = db.execute(
            """SELECT r.id, p.user_id AS patient_user_id, r.new_date
               FROM appointment_reschedule_requests r
               JOIN appointments a ON r.appointment_id = a.id
               JOIN patients p ON a.patient_id = p.id
               WHERE r.id = ? AND a.doctor_id = ?""",
            (request_id, doctor_id),
        ).fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Reschedule request not found.")

        now = _now()
        db.execute(
            "UPDATE appointment_reschedule_requests SET status='rejected', responded_at=? WHERE id=?",
            (now, request_id),
        )

        create_notification(
            user_id=req["patient_user_id"],
            title="Reschedule Request Declined",
            message=f"Your request to reschedule appointment to {req['new_date']} was declined.",
            notif_type="reschedule_rejected",
            link="/patient",
            conn=db
        )
    return {"status": "success", "message": "Reschedule request rejected."}


@router.post("/doctor/{appt_id}/reschedule")
def doctor_propose_reschedule(
    appt_id: str,
    payload: RescheduleRequest,
    current_user: dict = Depends(require_verified_doctor),
):
    """Doctor proposes an alternative slot to the patient."""
    doctor_id = current_user["doctor_profile"]["doctor_id"]

    with get_db() as db:
        appt = db.execute(
            """SELECT a.id, a.patient_id, a.status, p.user_id AS patient_user_id
               FROM appointments a
               JOIN patients p ON a.patient_id = p.id
               WHERE a.id = ? AND a.doctor_id = ?""",
            (appt_id, doctor_id),
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] not in ("pending", "confirmed", "rescheduled"):
            raise HTTPException(status_code=400, detail="Only pending, confirmed, or active rescheduled appointments can be rescheduled.")

        # Validate slot
        new_d = datetime.strptime(payload.new_date, "%Y-%m-%d")
        day_of_week = new_d.weekday()
        windows = db.execute(
            "SELECT start_time, end_time, slot_duration_minutes FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1",
            (doctor_id, day_of_week),
        ).fetchall()
        slot_end = None
        for w in windows:
            if payload.new_slot_start in _generate_slots(w["start_time"], w["end_time"], w["slot_duration_minutes"]):
                slot_end = _minutes_to_time(_time_to_minutes(payload.new_slot_start) + w["slot_duration_minutes"])
                break
        if not slot_end:
            raise HTTPException(status_code=400, detail="Proposed slot is not within your active availability.")

        req_id = generate_id("rsch")
        now = _now()
        db.execute(
            """INSERT INTO appointment_reschedule_requests
               (id, appointment_id, requested_by, requested_by_role, new_date, new_slot_start, new_slot_end, reason, status, created_at)
               VALUES (?, ?, ?, 'doctor', ?, ?, ?, ?, 'pending', ?)""",
            (req_id, appt_id, current_user["id"], payload.new_date, payload.new_slot_start, slot_end, payload.reason, now),
        )

        create_notification(
            user_id=appt["patient_user_id"],
            title="Doctor Proposed New Slot",
            message=f"Doctor proposed moving your appointment to {payload.new_date} at {payload.new_slot_start}.",
            notif_type="reschedule_request",
            link="/patient",
            conn=db
        )

    return {"status": "success", "reschedule_request_id": req_id}


@router.post("/my/reschedule/{request_id}/accept")
def patient_accept_reschedule(
    request_id: str,
    current_user: dict = Depends(require_role("patient")),
):
    """Patient accepts a reschedule proposed by their doctor."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    patient_id = pat_profile["patient_id"]

    with get_db() as db:
        req = db.execute(
            """SELECT r.*, a.doctor_id, a.patient_id, d.user_id AS doctor_user_id
               FROM appointment_reschedule_requests r
               JOIN appointments a ON r.appointment_id = a.id
               JOIN doctors d ON a.doctor_id = d.id
               WHERE r.id = ? AND a.patient_id = ? AND r.requested_by_role = 'doctor'""",
            (request_id, patient_id),
        ).fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Reschedule request not found.")
        if req["status"] != "pending":
            raise HTTPException(status_code=400, detail="This request has already been handled.")

        # Double booking check
        conflict = db.execute(
            """SELECT id FROM appointments
               WHERE doctor_id = ? AND appointment_date = ? AND slot_start = ?
               AND status NOT IN ('cancelled', 'rejected') AND id != ?""",
            (req["doctor_id"], req["new_date"], req["new_slot_start"], req["appointment_id"]),
        ).fetchone()
        if conflict:
            raise HTTPException(status_code=409, detail="This slot has already been booked in the interim.")

        now = _now()
        db.execute(
            "UPDATE appointments SET appointment_date=?, slot_start=?, slot_end=?, status='rescheduled', updated_at=? WHERE id=?",
            (req["new_date"], req["new_slot_start"], req["new_slot_end"], now, req["appointment_id"]),
        )
        db.execute(
            "UPDATE appointment_reschedule_requests SET status='accepted', responded_at=? WHERE id=?",
            (now, request_id),
        )

        create_notification(
            user_id=req["doctor_user_id"],
            title="Reschedule Accepted",
            message=f"Patient accepted your proposed reschedule to {req['new_date']} at {req['new_slot_start']}.",
            notif_type="reschedule_confirmed",
            link="/doctor",
            conn=db
        )

    return {"status": "success", "message": "Appointment rescheduled."}


@router.post("/my/reschedule/{request_id}/reject")
def patient_reject_reschedule(
    request_id: str,
    current_user: dict = Depends(require_role("patient")),
):
    """Patient declines doctor's proposed reschedule."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    patient_id = pat_profile["patient_id"]

    with get_db() as db:
        req = db.execute(
            """SELECT r.*, a.doctor_id, d.user_id AS doctor_user_id
               FROM appointment_reschedule_requests r
               JOIN appointments a ON r.appointment_id = a.id
               JOIN doctors d ON a.doctor_id = d.id
               WHERE r.id = ? AND a.patient_id = ? AND r.requested_by_role = 'doctor'""",
            (request_id, patient_id),
        ).fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Reschedule request not found.")

        now = _now()
        db.execute(
            "UPDATE appointment_reschedule_requests SET status='rejected', responded_at=? WHERE id=?",
            (now, request_id),
        )

        create_notification(
            user_id=req["doctor_user_id"],
            title="Reschedule Declined",
            message="Patient declined the proposed alternative time slot.",
            notif_type="reschedule_rejected",
            link="/doctor",
            conn=db
        )

    return {"status": "success", "message": "Reschedule request rejected."}


# ─────────────────────────────────────────────────────────────
#  AI REPORT ATTACHMENT TO APPOINTMENTS
# ─────────────────────────────────────────────────────────────

@router.post("/{appointment_id}/attach-report", status_code=201)
def attach_report_to_appointment(
    appointment_id: str,
    payload: AttachReportRequest,
    current_user: dict = Depends(require_role("patient")),
):
    """Patient attaches their AI screening report to an existing appointment."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    patient_id = pat_profile["patient_id"]

    with get_db() as db:
        # Verify appointment belongs to this patient
        appt = db.execute(
            "SELECT id, status FROM appointments WHERE id = ? AND patient_id = ?",
            (appointment_id, patient_id)
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if appt["status"] in ("cancelled", "rejected"):
            raise HTTPException(status_code=400, detail="Cannot attach reports to cancelled or rejected appointments.")

        # Verify report belongs to this patient
        rep = db.execute(
            "SELECT id FROM ai_reports WHERE id = ? AND patient_id = ?",
            (payload.report_id, patient_id)
        ).fetchone()
        if not rep:
            raise HTTPException(status_code=404, detail="AI report not found or does not belong to you.")

        # Insert attachment
        att_id = generate_id("aar")
        now = _now()
        try:
            db.execute(
                """INSERT INTO appointment_ai_reports (id, appointment_id, report_id, notes, attached_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (att_id, appointment_id, payload.report_id, payload.notes, now)
            )
        except Exception as e:
            if "UNIQUE" in str(e):
                return {"status": "success", "message": "Report is already attached to this appointment."}
            raise

    return {"status": "success", "attachment_id": att_id}


@router.get("/{appointment_id}/reports")
def get_appointment_attached_reports(
    appointment_id: str,
    current_user: dict = Depends(require_active_user),
):
    """
    Returns AI reports attached to an appointment.
    Security: Access restricted strictly to:
      - The patient who owns the appointment
      - The assigned doctor (must be verified)
      - Administrator
    """
    with get_db() as db:
        appt = db.execute(
            "SELECT id, patient_id, doctor_id FROM appointments WHERE id = ?",
            (appointment_id,)
        ).fetchone()
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found.")

        # Authorization check
        user_role = current_user.get("role")
        is_authorized = False

        if user_role == "admin":
            is_authorized = True
        elif user_role == "patient":
            pat_profile = current_user.get("patient_profile")
            if pat_profile and pat_profile.get("patient_id") == appt["patient_id"]:
                is_authorized = True
        elif user_role == "doctor":
            doc_profile = current_user.get("doctor_profile")
            if doc_profile and doc_profile.get("doctor_id") == appt["doctor_id"]:
                if doc_profile.get("verification_status") == "approved":
                    is_authorized = True
                else:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Doctor account is not approved. Clinical records access denied."
                    )

        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not authorized to view reports for this appointment."
            )

        rows = db.execute(
            """
            SELECT r.id AS report_id, r.prediction, r.confidence, r.risk_score, r.risk_level,
                   r.recommendation, r.yolo_detection, r.image_data, r.heatmap_data,
                   r.probabilities, r.clinical_metadata, r.created_at,
                   ar.notes AS attachment_notes, ar.attached_at
            FROM appointment_ai_reports ar
            JOIN ai_reports r ON ar.report_id = r.id
            WHERE ar.appointment_id = ?
            ORDER BY ar.attached_at DESC
            """,
            (appointment_id,)
        ).fetchall()

    reports = []
    for r in rows:
        item = dict(r)
        if item.get("probabilities"):
            try:
                import json
                item["probabilities"] = json.loads(item["probabilities"])
            except Exception:
                pass
        if item.get("clinical_metadata"):
            try:
                import json
                item["clinical_metadata"] = json.loads(item["clinical_metadata"])
            except Exception:
                pass
        reports.append(item)

    return {"status": "success", "reports": reports}
