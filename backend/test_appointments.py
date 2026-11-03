"""
PARAKH (परख) — Appointment Management Test Suite (Step 2, Phase 1)
Tests every specified scenario at the backend API level.
"""

import os
import sys
import time
import threading
import unittest
from datetime import date, timedelta, datetime

os.environ["PARAKH_TEST_MODE"] = "1"
os.environ["NO_ALBUMENTATIONS_UPDATE"] = "1"
os.environ["EXPOSE_DEV_TOKENS"] = "1"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database.db import get_db, init_db
from seed_admin import seed_admin

# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

TODAY = date.today()
FUTURE_DATE = (TODAY + timedelta(days=7)).strftime("%Y-%m-%d")   # next week
PAST_DATE   = (TODAY - timedelta(days=1)).strftime("%Y-%m-%d")   # yesterday

# FUTURE_DATE weekday → we need an availability window on that day-of-week
FUTURE_DOW  = (TODAY + timedelta(days=7)).weekday()  # 0=Mon … 6=Sun


def _register_patient(client, suffix=""):
    ts = str(int(time.time())) + suffix
    email = f"pat_{ts}@appttest.com"
    reg = client.post("/api/v1/auth/register/patient", json={
        "full_name": f"Test Patient {ts}",
        "email": email,
        "date_of_birth": "1995-06-15",
        "password": "Password123!",
        "confirm_password": "Password123!",
    })
    assert reg.status_code == 201, reg.text
    token = reg.json()["dev_verification_url"].split("token=")[1]
    client.post("/api/v1/auth/verify-email", json={"token": token})
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login.status_code == 200, login.text
    client.cookies.clear()
    return login.json()["session_token"]


def _register_doctor(client, suffix="") -> tuple[str, str]:
    """Returns (session_token, email)."""
    ts = str(int(time.time())) + suffix
    email = f"doc_{ts}@appttest.com"
    reg = client.post("/api/v1/auth/register/doctor", json={
        "full_name": f"Dr. Test {ts}",
        "email": email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "medical_registration_number": f"MCI-TEST-{ts}",
        "qualification": "MBBS, MD",
        "specialization": "Dermatology",
        "experience_years": 5,
        "clinic_name": "Test Clinic",
        "clinic_address": "123 Test Street",
    })
    assert reg.status_code == 201, reg.text
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login.status_code == 200, login.text
    client.cookies.clear()
    return login.json()["session_token"], email


def _approve_doctor(client, admin_token: str, doctor_session: str) -> str:
    """Approve doctor and return their doctor_id. Always uses explicit Bearer headers."""
    client.cookies.clear()
    doc_me = client.get("/api/v1/doctor/profile",
                        headers={"Authorization": f"Bearer {doctor_session}"})
    assert doc_me.status_code == 200, f"Doctor profile fetch failed: {doc_me.text}"
    doc_id = doc_me.json()["profile"]["id"]
    client.cookies.clear()
    res = client.post(f"/api/v1/admin/doctors/{doc_id}/approve",
                      headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200, f"Approve failed: {res.text}"
    client.cookies.clear()
    return doc_id


def _add_availability(client, doc_token: str, dow: int, start="09:00", end="17:00", duration=30) -> str:
    res = client.post("/api/v1/appointments/availability", json={
        "day_of_week": dow,
        "start_time": start,
        "end_time": end,
        "slot_duration_minutes": duration,
    }, headers={"Authorization": f"Bearer {doc_token}"})
    assert res.status_code == 201, res.text
    return res.json()["availability_id"]


def _book(client, pat_token: str, doctor_id: str, appt_date: str, slot_start: str = "09:00"):
    return client.post("/api/v1/appointments/book", json={
        "doctor_id": doctor_id,
        "appointment_date": appt_date,
        "slot_start": slot_start,
        "reason_for_visit": "Skin rash evaluation",
    }, headers={"Authorization": f"Bearer {pat_token}"})


# ---------------------------------------------------------------------------
#  Test Suite
# ---------------------------------------------------------------------------

class TestAppointmentSuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()
        cls.admin_email = "admin@parakh.org"
        cls.admin_password = "Admin@Parakh2026!"
        seed_admin(email=cls.admin_email, password=cls.admin_password)
        cls.client = TestClient(app)
        cls.client.cookies.clear()

        # Admin login — store token, then clear cookies so later logins don't override
        admin_login = cls.client.post("/api/v1/auth/login", json={
            "email": cls.admin_email, "password": cls.admin_password
        })
        assert admin_login.status_code == 200, admin_login.text
        cls.admin_token = admin_login.json()["session_token"]
        cls.client.cookies.clear()

        # Register & approve a reusable doctor
        doc_token_raw, doc_email = _register_doctor(cls.client, suffix="main")
        cls.client.cookies.clear()
        cls.doctor_id = _approve_doctor(cls.client, cls.admin_token, doc_token_raw)

        # Re-login doctor after approval so their session reflects approved status
        doc_login = cls.client.post("/api/v1/auth/login", json={
            "email": doc_email, "password": "Password123!"
        })
        assert doc_login.status_code == 200, doc_login.text
        cls.doc_token = doc_login.json()["session_token"]
        cls.client.cookies.clear()

        # Add default availability for FUTURE_DOW
        cls.avail_id = _add_availability(cls.client, cls.doc_token, FUTURE_DOW, "09:00", "17:00", 30)
        cls.client.cookies.clear()

        cls.pat_token = _register_patient(cls.client, suffix="main")

    # ── TEST 1: Availability Creation ────────────────────────────────────────
    def test_01_availability_creation(self):
        """Approved doctor can create availability."""
        # Already created in setUpClass; verify it's listed
        res = self.client.get("/api/v1/appointments/availability/my",
                              headers={"Authorization": f"Bearer {self.doc_token}"})
        self.assertEqual(res.status_code, 200)
        ids = [a["id"] for a in res.json()["availability"]]
        self.assertIn(self.avail_id, ids)
        print("[PASS] TEST 1: Doctor availability creation and listing")

    # ── TEST 2: Overlap Prevention ───────────────────────────────────────────
    def test_02_availability_overlap_rejected(self):
        """Overlapping availability window is rejected with 409."""
        res = self.client.post("/api/v1/appointments/availability", json={
            "day_of_week": FUTURE_DOW,
            "start_time": "10:00",  # overlaps 09:00–17:00
            "end_time": "12:00",
            "slot_duration_minutes": 30,
        }, headers={"Authorization": f"Bearer {self.doc_token}"})
        self.assertEqual(res.status_code, 409)
        print("[PASS] TEST 2: Overlapping availability rejected (409 Conflict)")

    # ── TEST 3: Unauthorized Availability Management ─────────────────────────
    def test_03_patient_cannot_manage_availability(self):
        """Patient cannot create doctor availability (403)."""
        res = self.client.post("/api/v1/appointments/availability", json={
            "day_of_week": 1,
            "start_time": "09:00",
            "end_time": "12:00",
            "slot_duration_minutes": 30,
        }, headers={"Authorization": f"Bearer {self.pat_token}"})
        self.assertEqual(res.status_code, 403)
        print("[PASS] TEST 3: Patient forbidden from managing availability (403)")

    # ── TEST 4: Unverified Doctor Cannot Manage Availability ─────────────────
    def test_04_pending_doctor_cannot_manage_availability(self):
        """Pending (unapproved) doctor cannot create availability (403)."""
        doc_token_raw, _ = _register_doctor(self.client, suffix="pending")
        self.client.cookies.clear()
        res = self.client.post("/api/v1/appointments/availability", json={
            "day_of_week": 1,
            "start_time": "09:00",
            "end_time": "12:00",
            "slot_duration_minutes": 30,
        }, headers={"Authorization": f"Bearer {doc_token_raw}"})
        self.assertEqual(res.status_code, 403)
        print("[PASS] TEST 4: Pending doctor forbidden from managing availability (403)")

    # ── TEST 5: Doctor Discovery ─────────────────────────────────────────────
    def test_05_patient_discovers_doctors(self):
        """Patient can list approved doctors and filter by specialization."""
        res = self.client.get("/api/v1/appointments/doctors",
                              headers={"Authorization": f"Bearer {self.pat_token}"})
        self.assertEqual(res.status_code, 200)
        doctors = res.json()["doctors"]
        self.assertGreater(len(doctors), 0)

        # Filter by specialization
        res2 = self.client.get(
            "/api/v1/appointments/doctors?specialization=Dermatology",
            headers={"Authorization": f"Bearer {self.pat_token}"}
        )
        self.assertEqual(res2.status_code, 200)
        for d in res2.json()["doctors"]:
            self.assertIn("Dermatology", d["specialization"])
        print("[PASS] TEST 5: Patient discovers and filters doctors")

    # ── TEST 6: Slot Listing ─────────────────────────────────────────────────
    def test_06_slots_listed(self):
        """Available slots returned for approved doctor on future date."""
        res = self.client.get(
            f"/api/v1/appointments/doctors/{self.doctor_id}/slots?date={FUTURE_DATE}",
            headers={"Authorization": f"Bearer {self.pat_token}"}
        )
        self.assertEqual(res.status_code, 200)
        slots = res.json()["slots"]
        self.assertGreater(len(slots), 0)
        # 09:00–17:00 / 30 min = 16 slots
        available_count = sum(1 for s in slots if s["available"])
        self.assertEqual(available_count, 16)
        print("[PASS] TEST 6: Available slots correctly generated (16 × 30-min slots)")

    # ── TEST 7: Successful Booking ───────────────────────────────────────────
    def test_07_successful_booking(self):
        """Patient successfully books an appointment."""
        res = _book(self.client, self.pat_token, self.doctor_id, FUTURE_DATE, "09:00")
        self.assertEqual(res.status_code, 201, res.text)
        self.assertIn("appointment_id", res.json())
        self.__class__.appt_id = res.json()["appointment_id"]
        print("[PASS] TEST 7: Patient successfully booked appointment")

    # ── TEST 8: Duplicate Booking (same slot) ────────────────────────────────
    def test_08_duplicate_booking_rejected(self):
        """Booking the same slot again returns 409 Conflict."""
        # Another patient tries the same slot
        pat2_token = _register_patient(self.client, suffix="dup")
        res = _book(self.client, pat2_token, self.doctor_id, FUTURE_DATE, "09:00")
        self.assertEqual(res.status_code, 409, res.text)
        print("[PASS] TEST 8: Duplicate booking rejected (409 Conflict)")

    # ── TEST 9: Slot No Longer Available After Booking ───────────────────────
    def test_09_slot_unavailable_after_booking(self):
        """Booked slot is shown as unavailable in slot listing."""
        res = self.client.get(
            f"/api/v1/appointments/doctors/{self.doctor_id}/slots?date={FUTURE_DATE}",
            headers={"Authorization": f"Bearer {self.pat_token}"}
        )
        self.assertEqual(res.status_code, 200)
        slot_map = {s["slot_start"]: s["available"] for s in res.json()["slots"]}
        self.assertFalse(slot_map.get("09:00", True))
        print("[PASS] TEST 9: Booked slot correctly marked unavailable")

    # ── TEST 10: Concurrent Booking ──────────────────────────────────────────
    def test_10_concurrent_booking_only_one_succeeds(self):
        """Two concurrent booking requests for the same slot — only one succeeds."""
        slot = "10:00"
        pat_a = _register_patient(self.client, suffix="conca")
        pat_b = _register_patient(self.client, suffix="concb")
        results = []

        def do_book(token, label):
            r = _book(self.client, token, self.doctor_id, FUTURE_DATE, slot)
            results.append((label, r.status_code))

        t1 = threading.Thread(target=do_book, args=(pat_a, "A"))
        t2 = threading.Thread(target=do_book, args=(pat_b, "B"))
        t1.start(); t2.start()
        t1.join();  t2.join()

        codes = [r[1] for r in results]
        self.assertIn(201, codes, "At least one booking must succeed")
        self.assertIn(409, codes, "At least one duplicate must be rejected")
        print("[PASS] TEST 10: Concurrent booking — only one succeeds (other gets 409)")

    # ── TEST 11: Patient Appointment Isolation ───────────────────────────────
    def test_11_patient_sees_only_own_appointments(self):
        """Patient A cannot see Patient B's appointments."""
        pat_b = _register_patient(self.client, suffix="iso")
        res = self.client.get("/api/v1/appointments/my",
                              headers={"Authorization": f"Bearer {pat_b}"})
        self.assertEqual(res.status_code, 200)
        # pat_b has no appointments
        self.assertEqual(len(res.json()["appointments"]), 0)
        print("[PASS] TEST 11: Patient appointment isolation confirmed")

    # ── TEST 12: Doctor Appointment Isolation ────────────────────────────────
    def test_12_doctor_sees_only_own_appointments(self):
        """Doctor B cannot see Doctor A's appointments via their endpoint."""
        doc_b_token_raw, doc_b_email = _register_doctor(self.client, suffix="isoB")
        self.client.cookies.clear()
        _approve_doctor(self.client, self.admin_token, doc_b_token_raw)
        self.client.cookies.clear()
        doc_b_login = self.client.post("/api/v1/auth/login",
                                       json={"email": doc_b_email, "password": "Password123!"})
        doc_b_token = doc_b_login.json()["session_token"]
        self.client.cookies.clear()

        res = self.client.get("/api/v1/appointments/doctor",
                              headers={"Authorization": f"Bearer {doc_b_token}"})
        self.assertEqual(res.status_code, 200)
        # Verify doc A's appointment NOT visible to doc B
        if hasattr(self.__class__, "appt_id"):
            appt_detail = self.client.get(
                f"/api/v1/appointments/doctor/{self.__class__.appt_id}",
                headers={"Authorization": f"Bearer {doc_b_token}"}
            )
            self.assertEqual(appt_detail.status_code, 404)
        print("[PASS] TEST 12: Doctor appointment isolation confirmed")

    # ── TEST 13: Doctor Confirms Appointment ─────────────────────────────────
    def test_13_doctor_confirms_appointment(self):
        """Doctor confirms a pending appointment → status becomes confirmed."""
        appt_id = self.__class__.appt_id
        res = self.client.post(f"/api/v1/appointments/doctor/{appt_id}/confirm",
                               headers={"Authorization": f"Bearer {self.doc_token}"})
        self.assertEqual(res.status_code, 200, res.text)

        # Verify status
        appt = self.client.get(f"/api/v1/appointments/my/{appt_id}",
                               headers={"Authorization": f"Bearer {self.pat_token}"})
        self.assertEqual(appt.json()["appointment"]["status"], "confirmed")
        print("[PASS] TEST 13: Doctor confirmed appointment; status = confirmed")

    # ── TEST 14: Doctor Rejects Another Appointment ──────────────────────────
    def test_14_doctor_rejects_appointment(self):
        """Doctor can reject a pending appointment."""
        pat3_token = _register_patient(self.client, suffix="rej")
        book_res = _book(self.client, pat3_token, self.doctor_id, FUTURE_DATE, "11:00")
        self.assertEqual(book_res.status_code, 201, book_res.text)
        appt_id = book_res.json()["appointment_id"]

        res = self.client.post(
            f"/api/v1/appointments/doctor/{appt_id}/reject",
            json={"reason": "Slot unavailable due to emergency"},
            headers={"Authorization": f"Bearer {self.doc_token}"}
        )
        self.assertEqual(res.status_code, 200, res.text)

        detail = self.client.get(f"/api/v1/appointments/my/{appt_id}",
                                 headers={"Authorization": f"Bearer {pat3_token}"})
        self.assertEqual(detail.json()["appointment"]["status"], "rejected")
        print("[PASS] TEST 14: Doctor rejected appointment; status = rejected")

    # ── TEST 15: Patient Cancels Appointment ─────────────────────────────────
    def test_15_patient_cancels_appointment(self):
        """Patient can cancel a confirmed appointment."""
        pat_c = _register_patient(self.client, suffix="cancel")
        book_res = _book(self.client, pat_c, self.doctor_id, FUTURE_DATE, "14:00")
        self.assertEqual(book_res.status_code, 201, book_res.text)
        appt_id = book_res.json()["appointment_id"]

        # Doctor confirms
        self.client.post(f"/api/v1/appointments/doctor/{appt_id}/confirm",
                         headers={"Authorization": f"Bearer {self.doc_token}"})

        # Patient cancels
        res = self.client.post(f"/api/v1/appointments/my/{appt_id}/cancel",
                               json={"reason": "Changed my mind"},
                               headers={"Authorization": f"Bearer {pat_c}"})
        self.assertEqual(res.status_code, 200, res.text)

        detail = self.client.get(f"/api/v1/appointments/my/{appt_id}",
                                 headers={"Authorization": f"Bearer {pat_c}"})
        self.assertEqual(detail.json()["appointment"]["status"], "cancelled")
        print("[PASS] TEST 15: Patient cancelled confirmed appointment; status = cancelled")

    # ── TEST 16: Past Date Booking Rejected ──────────────────────────────────
    def test_16_past_date_booking_rejected(self):
        """Booking on a past date returns 400."""
        res = _book(self.client, self.pat_token, self.doctor_id, PAST_DATE, "09:00")
        self.assertEqual(res.status_code, 400)
        print("[PASS] TEST 16: Past-date booking rejected (400)")

    # ── TEST 17: Auth Tests Still Pass ───────────────────────────────────────
    def test_17_auth_unauthenticated_still_401(self):
        """Regression: unauthenticated requests to protected endpoints still return 401."""
        self.client.cookies.clear()
        res = self.client.get("/api/v1/auth/me")
        self.assertEqual(res.status_code, 401)

        res2 = self.client.get("/api/v1/appointments/my")
        self.assertEqual(res2.status_code, 401)
        print("[PASS] TEST 17: Auth regression — unauthenticated requests still 401")

    # ── TEST 18: Update and Delete Availability ──────────────────────────────
    def test_18_update_and_delete_availability(self):
        """Doctor can update slot duration and delete an availability window."""
        # Create a new window on a different day for isolation
        dow_other = (FUTURE_DOW + 1) % 7
        avail_id2 = _add_availability(self.client, self.doc_token, dow_other, "08:00", "10:00", 30)

        update_res = self.client.put(
            f"/api/v1/appointments/availability/{avail_id2}",
            json={"slot_duration_minutes": 60},
            headers={"Authorization": f"Bearer {self.doc_token}"}
        )
        self.assertEqual(update_res.status_code, 200, update_res.text)

        del_res = self.client.delete(
            f"/api/v1/appointments/availability/{avail_id2}",
            headers={"Authorization": f"Bearer {self.doc_token}"}
        )
        self.assertEqual(del_res.status_code, 200, del_res.text)

        # Confirm it's gone
        my = self.client.get("/api/v1/appointments/availability/my",
                             headers={"Authorization": f"Bearer {self.doc_token}"})
        ids = [a["id"] for a in my.json()["availability"]]
        self.assertNotIn(avail_id2, ids)
        print("[PASS] TEST 18: Availability updated and deleted successfully")

    # ── TEST 19: Unavailable Date Blocks Slots ───────────────────────────────
    def test_19_unavailable_date_blocks_all_slots(self):
        """Doctor marks a date unavailable → all slots return empty."""
        # Use the day after FUTURE_DATE so it's a fresh unbooked date
        block_date = (TODAY + timedelta(days=8)).strftime("%Y-%m-%d")
        block_dow  = (TODAY + timedelta(days=8)).weekday()

        # Add availability for that day if not already set
        _add_availability(self.client, self.doc_token, block_dow, "09:00", "12:00", 30)

        # Block date
        block_res = self.client.post(
            "/api/v1/appointments/availability/unavailable-dates",
            json={"date": block_date, "reason": "Personal leave"},
            headers={"Authorization": f"Bearer {self.doc_token}"}
        )
        # 201 or 409 (already blocked from a previous run)
        self.assertIn(block_res.status_code, (201, 409))

        slots_res = self.client.get(
            f"/api/v1/appointments/doctors/{self.doctor_id}/slots?date={block_date}",
            headers={"Authorization": f"Bearer {self.pat_token}"}
        )
        self.assertEqual(slots_res.status_code, 200)
        self.assertEqual(len(slots_res.json()["slots"]), 0)
        print("[PASS] TEST 19: Unavailable date blocks all slots")


if __name__ == "__main__":
    unittest.main(verbosity=2)
