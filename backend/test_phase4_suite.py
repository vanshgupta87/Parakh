"""
PARAKH (परख) - Phase 4 Comprehensive Automated Test Suite
Covers:
  - AI report creation and ownership isolation
  - Report attachment to appointments (at booking & post-booking)
  - Authorized viewing of reports by assigned doctor & patient
  - Isolation: Doctor B and Patient B cannot view unauthorized reports
  - In-app notification creation, unread count, mark-read, and isolation
  - Two-way Rescheduling workflow (Patient-requested & Doctor-proposed)
  - Security constraints & invalid state transitions
"""

import os
import sys
import time
import unittest
from datetime import date, timedelta

os.environ["PARAKH_TEST_MODE"] = "1"
os.environ["NO_ALBUMENTATIONS_UPDATE"] = "1"
os.environ["EXPOSE_DEV_TOKENS"] = "1"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database.db import get_db, init_db
from seed_admin import seed_admin

TODAY = date.today()
FUTURE_DATE = (TODAY + timedelta(days=10)).strftime("%Y-%m-%d")
FUTURE_DOW = (TODAY + timedelta(days=10)).weekday()

def _register_patient(client, suffix=""):
    ts = str(int(time.time() * 1000)) + suffix
    email = f"pat_{ts}@p4test.com"
    reg = client.post("/api/v1/auth/register/patient", json={
        "full_name": f"Patient {ts}",
        "email": email,
        "date_of_birth": "1994-01-01",
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
    ts = str(int(time.time() * 1000)) + suffix
    email = f"doc_{ts}@p4test.com"
    reg = client.post("/api/v1/auth/register/doctor", json={
        "full_name": f"Dr. PhaseFour {ts}",
        "email": email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "medical_registration_number": f"MCI-P4-{ts}",
        "qualification": "MBBS, MD",
        "specialization": "Dermatology",
        "experience_years": 8,
        "clinic_name": "Skin Care Clinic",
        "clinic_address": "45 Park Avenue",
    })
    assert reg.status_code == 201, reg.text
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login.status_code == 200, login.text
    client.cookies.clear()
    return login.json()["session_token"], email

def _approve_doctor(client, admin_token: str, doctor_session: str) -> str:
    client.cookies.clear()
    doc_me = client.get("/api/v1/doctor/profile", headers={"Authorization": f"Bearer {doctor_session}"})
    assert doc_me.status_code == 200, doc_me.text
    doc_id = doc_me.json()["profile"]["id"]
    client.cookies.clear()
    res = client.post(f"/api/v1/admin/doctors/{doc_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200, res.text
    client.cookies.clear()
    return doc_id

class TestPhase4Suite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        cls.client.cookies.clear()

        # Seed admin
        cls.admin_email = "admin@parakh.org"
        cls.admin_password = "Admin@Parakh2026!"
        seed_admin(email=cls.admin_email, password=cls.admin_password)

        admin_login = cls.client.post("/api/v1/auth/login", json={
            "email": cls.admin_email, "password": cls.admin_password
        })
        cls.admin_token = admin_login.json()["session_token"]
        cls.client.cookies.clear()

        # Doctor A (approved)
        doc_a_raw, doc_a_email = _register_doctor(cls.client, "docA")
        cls.doc_a_id = _approve_doctor(cls.client, cls.admin_token, doc_a_raw)
        login_a = cls.client.post("/api/v1/auth/login", json={"email": doc_a_email, "password": "Password123!"})
        cls.doc_a_token = login_a.json()["session_token"]
        cls.client.cookies.clear()

        # Doctor B (approved)
        doc_b_raw, doc_b_email = _register_doctor(cls.client, "docB")
        cls.doc_b_id = _approve_doctor(cls.client, cls.admin_token, doc_b_raw)
        login_b = cls.client.post("/api/v1/auth/login", json={"email": doc_b_email, "password": "Password123!"})
        cls.doc_b_token = login_b.json()["session_token"]
        cls.client.cookies.clear()

        # Add availability for Doctor A on FUTURE_DOW
        cls.client.post("/api/v1/appointments/availability", json={
            "day_of_week": FUTURE_DOW,
            "start_time": "09:00",
            "end_time": "17:00",
            "slot_duration_minutes": 30
        }, headers={"Authorization": f"Bearer {cls.doc_a_token}"})
        cls.client.cookies.clear()

        # Patient 1
        cls.pat_1_token = _register_patient(cls.client, "pat1")
        # Patient 2
        cls.pat_2_token = _register_patient(cls.client, "pat2")

    def test_01_save_ai_report_and_ownership(self):
        """TEST 1: Patient saves an AI lesion report and retrieves it."""
        res = self.client.post(
            "/api/v1/patient/reports",
            json={
                "prediction": "Melanocytic Nevus",
                "confidence": 0.94,
                "risk_score": 12,
                "risk_level": "Low",
                "recommendation": "Routine monitoring during annual skin check.",
                "image_data": "data:image/png;base64,mockrawimage",
                "heatmap_data": "data:image/png;base64,mockgradcam",
                "probabilities": {"Melanocytic Nevus": 0.94, "Melanoma": 0.02},
                "clinical_metadata": {"anatomical_site": "forearm", "age": 30}
            },
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(res.status_code, 201)
        report_id = res.json()["report_id"]
        self.__class__.report_id = report_id

        # Verify listing
        list_res = self.client.get("/api/v1/patient/reports", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(list_res.status_code, 200)
        reports = list_res.json()["reports"]
        self.assertTrue(any(r["id"] == report_id for r in reports))
        print("[PASS] TEST 1: Patient successfully saved AI report")

    def test_02_patient_report_isolation(self):
        """TEST 2: Patient 2 cannot access Patient 1's saved AI report."""
        report_id = self.__class__.report_id
        res = self.client.get(
            f"/api/v1/patient/reports/{report_id}",
            headers={"Authorization": f"Bearer {self.pat_2_token}"}
        )
        self.assertEqual(res.status_code, 404)
        print("[PASS] TEST 2: Patient AI report strictly isolated to owner")

    def test_03_booking_with_attached_ai_report(self):
        """TEST 3: Patient 1 books appointment attaching their saved AI report."""
        report_id = self.__class__.report_id
        book_res = self.client.post(
            "/api/v1/appointments/book",
            json={
                "doctor_id": self.doc_a_id,
                "appointment_date": FUTURE_DATE,
                "slot_start": "09:00",
                "reason_for_visit": "Evaluating suspicious nevus on left arm",
                "attached_report_id": report_id
            },
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(book_res.status_code, 201, book_res.text)
        appt_id = book_res.json()["appointment_id"]
        self.__class__.appt_id = appt_id
        print("[PASS] TEST 3: Appointment booked with attached AI report")

    def test_04_doctor_receives_booking_notification(self):
        """TEST 4: Doctor A received in-app notification for the new booking."""
        notifs_res = self.client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {self.doc_a_token}"})
        self.assertEqual(notifs_res.status_code, 200)
        data = notifs_res.json()
        self.assertGreater(data["unread_count"], 0)
        types = [n["type"] for n in data["notifications"]]
        self.assertIn("appointment_request", types)
        print("[PASS] TEST 4: Doctor received in-app booking notification")

    def test_05_assigned_doctor_can_view_attached_report(self):
        """TEST 5: Assigned Doctor A can view the patient's attached AI report with Grad-CAM."""
        appt_id = self.__class__.appt_id
        rep_res = self.client.get(
            f"/api/v1/appointments/{appt_id}/reports",
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(rep_res.status_code, 200, rep_res.text)
        reports = rep_res.json()["reports"]
        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]["prediction"], "Melanocytic Nevus")
        self.assertIn("mockgradcam", reports[0]["heatmap_data"])
        print("[PASS] TEST 5: Assigned doctor accessed attached AI report & Grad-CAM")

    def test_06_unauthorized_doctor_denied_report_access(self):
        """TEST 6: Doctor B (not assigned to this appointment) is denied report access (403)."""
        appt_id = self.__class__.appt_id
        rep_res = self.client.get(
            f"/api/v1/appointments/{appt_id}/reports",
            headers={"Authorization": f"Bearer {self.doc_b_token}"}
        )
        self.assertEqual(rep_res.status_code, 403)
        print("[PASS] TEST 6: Unassigned Doctor B denied access to appointment reports (403)")

    def test_07_unauthorized_patient_denied_report_access(self):
        """TEST 7: Patient 2 is denied access to Patient 1's appointment reports (403)."""
        appt_id = self.__class__.appt_id
        rep_res = self.client.get(
            f"/api/v1/appointments/{appt_id}/reports",
            headers={"Authorization": f"Bearer {self.pat_2_token}"}
        )
        self.assertEqual(rep_res.status_code, 403)
        print("[PASS] TEST 7: Patient 2 denied access to Patient 1 appointment reports (403)")

    def test_08_confirmation_notifies_patient(self):
        """TEST 8: Doctor A confirms appointment -> Patient 1 receives notification."""
        appt_id = self.__class__.appt_id
        conf_res = self.client.post(
            f"/api/v1/appointments/doctor/{appt_id}/confirm",
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(conf_res.status_code, 200)

        # Check Patient 1 notifications
        notifs_res = self.client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(notifs_res.status_code, 200)
        types = [n["type"] for n in notifs_res.json()["notifications"]]
        self.assertIn("appointment_confirmed", types)
        print("[PASS] TEST 8: Patient received appointment confirmation notification")

    def test_09_two_way_rescheduling_patient_to_doctor(self):
        """TEST 9: Patient requests reschedule -> Doctor accepts -> Appointment moved."""
        appt_id = self.__class__.appt_id
        resch_res = self.client.post(
            f"/api/v1/appointments/my/{appt_id}/reschedule",
            json={
                "new_date": FUTURE_DATE,
                "new_slot_start": "11:00",
                "reason": "Need later slot due to work"
            },
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(resch_res.status_code, 200, resch_res.text)
        req_id = resch_res.json()["reschedule_request_id"]

        # Doctor accepts
        accept_res = self.client.post(
            f"/api/v1/appointments/doctor/reschedule/{req_id}/accept",
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(accept_res.status_code, 200)

        # Verify appointment updated
        appt = self.client.get(f"/api/v1/appointments/my/{appt_id}", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(appt.json()["appointment"]["slot_start"], "11:00")
        self.assertEqual(appt.json()["appointment"]["status"], "rescheduled")
        print("[PASS] TEST 9: Patient reschedule request accepted & slot updated")

    def test_10_two_way_rescheduling_doctor_proposes(self):
        """TEST 10: Doctor proposes new slot -> Patient accepts."""
        appt_id = self.__class__.appt_id
        prop_res = self.client.post(
            f"/api/v1/appointments/doctor/{appt_id}/reschedule",
            json={
                "new_date": FUTURE_DATE,
                "new_slot_start": "14:00",
                "reason": "Clinic schedule adjustment"
            },
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(prop_res.status_code, 200, prop_res.text)
        req_id = prop_res.json()["reschedule_request_id"]

        # Patient accepts
        pat_accept = self.client.post(
            f"/api/v1/appointments/my/reschedule/{req_id}/accept",
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(pat_accept.status_code, 200)

        # Verify updated
        appt = self.client.get(f"/api/v1/appointments/my/{appt_id}", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(appt.json()["appointment"]["slot_start"], "14:00")
        print("[PASS] TEST 10: Doctor-proposed reschedule accepted by patient")

    def test_11_notification_mark_read_and_read_all(self):
        """TEST 11: Notification mark-as-read and mark-all-read work properly."""
        notifs_res = self.client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        notifs = notifs_res.json()["notifications"]
        self.assertGreater(len(notifs), 0)
        first_id = notifs[0]["id"]

        # Mark single
        m_res = self.client.post(f"/api/v1/notifications/{first_id}/read", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(m_res.status_code, 200)

        # Mark all
        all_res = self.client.post("/api/v1/notifications/read-all", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(all_res.status_code, 200)

        # Check count is 0
        after = self.client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(after.json()["unread_count"], 0)
        print("[PASS] TEST 11: Notifications mark single and mark-all as read")

    def test_12_notification_isolation(self):
        """TEST 12: User cannot mark another user's notification as read."""
        # Create a notification on Doctor A, Patient 2 attempts to mark it read
        doc_notifs = self.client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {self.doc_a_token}"}).json()["notifications"]
        if doc_notifs:
            target_id = doc_notifs[0]["id"]
            res = self.client.post(f"/api/v1/notifications/{target_id}/read", headers={"Authorization": f"Bearer {self.pat_2_token}"})
            self.assertEqual(res.status_code, 404)
        print("[PASS] TEST 12: Notification ownership isolation enforced")

    def test_13_unapproved_doctor_denied_report_access(self):
        """TEST 13: Unapproved doctor cannot access reports (403 Forbidden)."""
        doc_raw, _ = _register_doctor(self.client, "unapp")
        # Attempt to access appointment reports
        appt_id = self.__class__.appt_id
        res = self.client.get(
            f"/api/v1/appointments/{appt_id}/reports",
            headers={"Authorization": f"Bearer {doc_raw}"}
        )
        self.assertEqual(res.status_code, 403)
        print("[PASS] TEST 13: Unapproved doctor denied report access (403)")

    def test_14_cannot_attach_another_patients_report(self):
        """TEST 14: Patient 2 cannot attach Patient 1's AI report to their own appointment."""
        pat2_report_id = self.__class__.report_id  # owned by patient 1
        book_res = self.client.post(
            "/api/v1/appointments/book",
            json={
                "doctor_id": self.doc_a_id,
                "appointment_date": FUTURE_DATE,
                "slot_start": "15:00",
                "reason_for_visit": "Test cross-attach",
                "attached_report_id": pat2_report_id
            },
            headers={"Authorization": f"Bearer {self.pat_2_token}"}
        )
        self.assertEqual(book_res.status_code, 400)
        print("[PASS] TEST 14: Cross-patient report attachment blocked (400)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
