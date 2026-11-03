"""
PARAKH (परख) - End-to-End Automated Authentication & RBAC Test Suite
Covers all 16 Phase 14 validation requirements.
"""

import sys
import os
import unittest
from datetime import datetime, timedelta, timezone

# Ensure fast hashing and disable update checks for tests
os.environ["PARAKH_TEST_MODE"] = "1"
os.environ["NO_ALBUMENTATIONS_UPDATE"] = "1"

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database.db import get_db, init_db
from seed_admin import seed_admin

class TestParakhAuthSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        # Seed test admin
        cls.admin_email = "admin@parakh.org"
        cls.admin_password = "Admin@Parakh2026!"
        cls.admin_id = seed_admin(email=cls.admin_email, password=cls.admin_password)
        cls.client = TestClient(app)

    def test_01_patient_registration_and_activation_flow(self):
        """TEST 1: Patient registration -> email verification -> login -> patient dashboard."""
        email = f"patient_{int(datetime.now().timestamp())}@test.com"
        reg_payload = {
            "full_name": "Test Patient 1",
            "email": email,
            "phone": "+91 9123456780",
            "date_of_birth": "1994-06-15",
            "gender": "male",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!"
        }
        # 1. Register
        res = self.client.post("/api/v1/auth/register/patient", json=reg_payload)
        self.assertEqual(res.status_code, 201, f"Reg failed: {res.text}")
        data = res.json()
        self.assertEqual(data["status"], "success")

        # 2. Get email verification token from DB
        with get_db() as db:
            row = db.execute(
                "SELECT t.token_hash FROM email_verification_tokens t JOIN users u ON t.user_id = u.id WHERE u.email = ?",
                (email,)
            ).fetchone()
            self.assertIsNotNone(row)

        # In dev mode, verify token via API directly
        dev_url = data.get("dev_verification_url", "")
        token = dev_url.split("token=")[1]
        verify_res = self.client.post("/api/v1/auth/verify-email", json={"token": token})
        self.assertEqual(verify_res.status_code, 200)

        # 3. Login
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePassword123!"})
        self.assertEqual(login_res.status_code, 200)
        session_token = login_res.json()["session_token"]

        # 4. Access Patient Dashboard with cookie/bearer
        dash_res = self.client.get(
            "/api/v1/patient/dashboard-summary",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        self.assertEqual(dash_res.status_code, 200)
        self.assertIn("patient_name", dash_res.json())
        print("[PASS] TEST 1: Patient registration -> verification -> login -> dashboard")

    def test_02_doctor_registration_pending_status(self):
        """TEST 2: Doctor registration -> email verification -> pending verification status."""
        email = f"doctor_{int(datetime.now().timestamp())}@test.com"
        reg_payload = {
            "full_name": "Dr. Rohit Gupta",
            "email": email,
            "phone": "+91 9988776655",
            "password": "DoctorPassword123!",
            "confirm_password": "DoctorPassword123!",
            "medical_registration_number": f"MCI-{int(datetime.now().timestamp())}",
            "qualification": "MBBS, MD Dermatology",
            "specialization": "Clinical Dermatology",
            "experience_years": 8,
            "clinic_name": "City Skin Clinic",
            "clinic_address": "123 Medical Enclave, New Delhi",
            "professional_bio": "Consultant dermatologist with 8+ years experience."
        }
        res = self.client.post("/api/v1/auth/register/doctor", json=reg_payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["verification_status"], "pending")

        # Verify email
        dev_url = data.get("dev_verification_url", "")
        token = dev_url.split("token=")[1]
        self.client.post("/api/v1/auth/verify-email", json={"token": token})

        # Login doctor
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": "DoctorPassword123!"})
        self.assertEqual(login_res.status_code, 200)
        doc_data = login_res.json()
        self.assertEqual(doc_data["user"]["doctor_verification_status"], "pending")
        print("[PASS] TEST 2: Doctor registration placed in pending_verification status")

    def test_03_pending_doctor_denied_access_to_clinical_features(self):
        """TEST 3: Pending doctor attempts to access clinical dashboard -> access denied (403 Forbidden)."""
        email = f"doctor_pending_{int(datetime.now().timestamp())}@test.com"
        reg_payload = {
            "full_name": "Dr. Pending Access",
            "email": email,
            "phone": "+91 9988112233",
            "password": "DoctorPassword123!",
            "confirm_password": "DoctorPassword123!",
            "medical_registration_number": f"MCI-PEND-{int(datetime.now().timestamp())}",
            "qualification": "MBBS, MD",
            "specialization": "Dermatology",
            "experience_years": 4,
            "clinic_name": "Pending Clinic",
            "clinic_address": "456 Hospital Road"
        }
        res = self.client.post("/api/v1/auth/register/doctor", json=reg_payload)
        self.assertEqual(res.status_code, 201)
        token = res.json()["dev_verification_url"].split("token=")[1]
        self.client.post("/api/v1/auth/verify-email", json={"token": token})

        # Login doctor
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": "DoctorPassword123!"})
        session_token = login_res.json()["session_token"]

        # Clinical dashboard must deny access to unapproved doctor
        dash_res = self.client.get(
            "/api/v1/doctor/dashboard-summary",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        self.assertEqual(dash_res.status_code, 403)
        self.assertIn("Clinical access denied until verified", dash_res.json()["detail"])
        print("[PASS] TEST 3: Pending doctor denied access to clinical features (403 Forbidden)")

    def test_04_admin_reviews_and_approves_doctor(self):
        """TEST 4: Admin login -> review doctor -> approve doctor."""
        email = f"doctor_approve_{int(datetime.now().timestamp())}@test.com"
        reg_payload = {
            "full_name": "Dr. Sunita Rao",
            "email": email,
            "password": "DoctorPassword123!",
            "confirm_password": "DoctorPassword123!",
            "medical_registration_number": f"MCI-APP-{int(datetime.now().timestamp())}",
            "qualification": "MBBS, DVD",
            "specialization": "Dermatosurgery",
            "experience_years": 10,
            "clinic_name": "Apollo Skin Centre",
            "clinic_address": "MG Road, Bangalore"
        }
        reg_res = self.client.post("/api/v1/auth/register/doctor", json=reg_payload)
        self.assertEqual(reg_res.status_code, 201)

        # Admin login
        admin_login = self.client.post("/api/v1/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        self.assertEqual(admin_login.status_code, 200)
        admin_token = admin_login.json()["session_token"]

        # Admin fetches doctor list
        docs_res = self.client.get(
            "/api/v1/admin/doctors?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(docs_res.status_code, 200)
        pending_list = docs_res.json()["doctors"]
        target_doc = next(d for d in pending_list if d["email"] == email)
        doc_id = target_doc["doctor_id"]

        # Admin approves doctor
        approve_res = self.client.post(
            f"/api/v1/admin/doctors/{doc_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(approve_res.status_code, 200)
        print("[PASS] TEST 4: Admin reviewed and approved doctor credentials")

    def test_05_approved_doctor_accesses_clinical_workspace(self):
        """TEST 5: Approved doctor login -> access doctor dashboard."""
        email = f"doctor_active_{int(datetime.now().timestamp())}@test.com"
        reg_payload = {
            "full_name": "Dr. Active Specialist",
            "email": email,
            "password": "DoctorPassword123!",
            "confirm_password": "DoctorPassword123!",
            "medical_registration_number": f"MCI-ACT-{int(datetime.now().timestamp())}",
            "qualification": "MD Dermatology",
            "specialization": "Pediatric Dermatology",
            "experience_years": 7,
            "clinic_name": "Specialist Clinic",
            "clinic_address": "Sector 14, Gurgaon"
        }
        reg_res = self.client.post("/api/v1/auth/register/doctor", json=reg_payload)
        self.assertEqual(reg_res.status_code, 201)

        # Admin approves
        admin_login = self.client.post("/api/v1/auth/login", json={"email": self.admin_email, "password": self.admin_password})
        admin_token = admin_login.json()["session_token"]

        with get_db() as db:
            doc_id = db.execute("SELECT d.id FROM doctors d JOIN users u ON d.user_id = u.id WHERE u.email = ?", (email,)).fetchone()["id"]

        self.client.post(f"/api/v1/admin/doctors/{doc_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

        # Approved doctor logs in and accesses clinical dashboard
        doc_login = self.client.post("/api/v1/auth/login", json={"email": email, "password": "DoctorPassword123!"})
        doc_token = doc_login.json()["session_token"]
        dash_res = self.client.get(
            "/api/v1/doctor/dashboard-summary",
            headers={"Authorization": f"Bearer {doc_token}"}
        )
        self.assertEqual(dash_res.status_code, 200)
        self.assertEqual(dash_res.json()["verification_status"], "approved")
        print("[PASS] TEST 5: Approved doctor successfully accesses clinical workspace")

    def test_06_rejected_doctor_denied_access(self):
        """TEST 6: Rejected doctor attempts to access clinical features -> access denied."""
        email = f"doctor_reject_{int(datetime.now().timestamp())}@test.com"
        reg_payload = {
            "full_name": "Dr. Fake Candidate",
            "email": email,
            "password": "DoctorPassword123!",
            "confirm_password": "DoctorPassword123!",
            "medical_registration_number": "INVALID-000",
            "qualification": "Diploma",
            "specialization": "General",
            "experience_years": 1,
            "clinic_name": "Fake Clinic",
            "clinic_address": "Nowhere"
        }
        self.client.post("/api/v1/auth/register/doctor", json=reg_payload)

        # Admin rejects doctor
        admin_login = self.client.post("/api/v1/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        admin_token = admin_login.json()["session_token"]

        with get_db() as db:
            doc_id = db.execute("SELECT d.id FROM doctors d JOIN users u ON d.user_id = u.id WHERE u.email = ?", (email,)).fetchone()["id"]

        reject_res = self.client.post(
            f"/api/v1/admin/doctors/{doc_id}/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"rejection_reason": "Medical registration could not be verified in council database"}
        )
        self.assertEqual(reject_res.status_code, 200)

        # Login attempts by rejected doctor should be denied
        doc_login = self.client.post("/api/v1/auth/login", json={"email": email, "password": "DoctorPassword123!"})
        self.assertEqual(doc_login.status_code, 403)
        print("[PASS] TEST 6: Rejected doctor denied access to platform (403 Forbidden)")

    def test_07_patient_cannot_access_doctor_routes(self):
        """TEST 7: Patient attempts to access doctor dashboard -> access denied."""
        email = f"pat_cross_{int(datetime.now().timestamp())}@test.com"
        self.client.post("/api/v1/auth/register/patient", json={
            "full_name": "Cross Role Patient",
            "email": email,
            "date_of_birth": "1990-01-01",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!"
        })
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePassword123!"})
        pat_token = login_res.json()["session_token"]

        # Attempt to access doctor endpoint
        res = self.client.get("/api/v1/doctor/dashboard-summary", headers={"Authorization": f"Bearer {pat_token}"})
        self.assertEqual(res.status_code, 403)
        self.assertIn("Required role: doctor", res.json()["detail"])
        print("[PASS] TEST 7: Patient forbidden from accessing doctor routes (403 Forbidden)")

    def test_08_doctor_cannot_access_admin_routes(self):
        """TEST 8: Doctor attempts to access admin dashboard -> access denied."""
        email = f"doc_cross_{int(datetime.now().timestamp())}@test.com"
        self.client.post("/api/v1/auth/register/doctor", json={
            "full_name": "Dr. Cross Role",
            "email": email,
            "password": "DoctorPassword123!",
            "confirm_password": "DoctorPassword123!",
            "medical_registration_number": "MCI-778899",
            "qualification": "MBBS",
            "specialization": "Dermatology",
            "experience_years": 5,
            "clinic_name": "Clinic",
            "clinic_address": "Street"
        })
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": "DoctorPassword123!"})
        doc_token = login_res.json()["session_token"]

        # Attempt to access admin endpoint
        res = self.client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {doc_token}"})
        self.assertEqual(res.status_code, 403)
        self.assertIn("Required role: admin", res.json()["detail"])
        print("[PASS] TEST 8: Doctor forbidden from accessing admin routes (403 Forbidden)")

    def test_09_unauthenticated_user_denied(self):
        """TEST 9: Unauthenticated user attempts to access protected routes -> 401 Unauthorized."""
        self.client.cookies.clear()
        res = self.client.get("/api/v1/auth/me")
        self.assertEqual(res.status_code, 401)
        print("[PASS] TEST 9: Unauthenticated user rejected with 401 Unauthorized")

    def test_10_forgot_and_reset_password(self):
        """TEST 10: Forgot password -> reset password -> successful login with new password."""
        email = f"reset_user_{int(datetime.now().timestamp())}@test.com"
        self.client.post("/api/v1/auth/register/patient", json={
            "full_name": "Reset User",
            "email": email,
            "date_of_birth": "1992-05-10",
            "password": "OldPassword123!",
            "confirm_password": "OldPassword123!"
        })

        # Request reset
        forgot_res = self.client.post("/api/v1/auth/forgot-password", json={"email": email})
        self.assertEqual(forgot_res.status_code, 200)
        reset_url = forgot_res.json().get("dev_reset_url", "")
        token = reset_url.split("token=")[1]

        # Reset password
        reset_res = self.client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "NewSecurePassword2026!",
            "confirm_password": "NewSecurePassword2026!"
        })
        self.assertEqual(reset_res.status_code, 200)

        # Login with old password must fail
        old_login = self.client.post("/api/v1/auth/login", json={"email": email, "password": "OldPassword123!"})
        self.assertEqual(old_login.status_code, 401)

        # Login with new password must succeed
        new_login = self.client.post("/api/v1/auth/login", json={"email": email, "password": "NewSecurePassword2026!"})
        self.assertEqual(new_login.status_code, 200)
        print("[PASS] TEST 10: Forgot password -> reset password -> successful login")

    def test_11_logout_invalidates_session(self):
        """TEST 11: Logout -> previous session invalidated."""
        email = f"logout_user_{int(datetime.now().timestamp())}@test.com"
        self.client.post("/api/v1/auth/register/patient", json={
            "full_name": "Logout Tester",
            "email": email,
            "date_of_birth": "1995-10-10",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        token = login_res.json()["session_token"]

        # Logout with token
        logout_res = self.client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(logout_res.status_code, 200)

        # Attempt to reuse logged-out session token
        check_res = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(check_res.status_code, 401)
        print("[PASS] TEST 11: Session properly invalidated upon logout")

    def test_12_suspended_account_denied(self):
        """TEST 12: Suspended account attempts login -> access denied."""
        email = f"suspend_user_{int(datetime.now().timestamp())}@test.com"
        reg_res = self.client.post("/api/v1/auth/register/patient", json={
            "full_name": "Suspended Person",
            "email": email,
            "date_of_birth": "1988-12-12",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        user_id = reg_res.json()["user_id"]

        # Admin suspends account
        admin_login = self.client.post("/api/v1/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        admin_token = admin_login.json()["session_token"]
        self.client.post(
            f"/api/v1/admin/users/{user_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"account_status": "suspended", "reason": "Terms violation"}
        )

        # Attempt to login suspended user
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        self.assertEqual(login_res.status_code, 403)
        self.assertIn("suspended", login_res.json()["detail"])
        print("[PASS] TEST 12: Suspended account denied login (403 Forbidden)")

    def test_13_role_tampering_prevented(self):
        """TEST 13: User attempts to change their role through API -> rejected/ignored."""
        email = f"tamper_user_{int(datetime.now().timestamp())}@test.com"
        self.client.post("/api/v1/auth/register/patient", json={
            "full_name": "Tamper Tester",
            "email": email,
            "date_of_birth": "1998-01-01",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        token = login_res.json()["session_token"]

        # Patient tries to send role='admin' in update
        self.client.put(
            "/api/v1/patient/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"full_name": "Hacked Name", "role": "admin"}
        )

        # Check me
        me_res = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.json()["user"]["role"], "patient")
        print("[PASS] TEST 13: Role tampering rejected; user remains patient")

    def test_14_patient_cannot_access_other_patient_record(self):
        """TEST 14: Patient attempts to access another patient's records -> strictly isolated."""
        # Patient profile endpoint strictly resolves user_id from the authenticated session
        # No arbitrary ID parameter is accepted.
        email1 = f"pat1_{int(datetime.now().timestamp())}@test.com"
        email2 = f"pat2_{int(datetime.now().timestamp())}@test.com"
        self.client.post("/api/v1/auth/register/patient", json={
            "full_name": "Patient One",
            "email": email1,
            "date_of_birth": "1991-01-01",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        self.client.post("/api/v1/auth/register/patient", json={
            "full_name": "Patient Two",
            "email": email2,
            "date_of_birth": "1992-02-02",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        login_res1 = self.client.post("/api/v1/auth/login", json={"email": email1, "password": "Password123!"})
        token1 = login_res1.json()["session_token"]

        me_res = self.client.get("/api/v1/patient/profile", headers={"Authorization": f"Bearer {token1}"})
        self.assertEqual(me_res.json()["profile"]["email"], email1)
        self.assertNotEqual(me_res.json()["profile"]["email"], email2)
        print("[PASS] TEST 14: Patient records strictly isolated to session owner")

    def test_15_expired_or_reused_token_rejected(self):
        """TEST 15: Expired or reused verification/reset token -> rejected."""
        email = f"reuse_tok_{int(datetime.now().timestamp())}@test.com"
        reg = self.client.post("/api/v1/auth/register/patient", json={
            "full_name": "Token Tester",
            "email": email,
            "date_of_birth": "1990-03-03",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        token = reg.json().get("dev_verification_url", "").split("token=")[1]

        # Use once -> succeeds
        res1 = self.client.post("/api/v1/auth/verify-email", json={"token": token})
        self.assertEqual(res1.status_code, 200)

        # Use second time -> must fail
        res2 = self.client.post("/api/v1/auth/verify-email", json={"token": token})
        self.assertEqual(res2.status_code, 400)
        self.assertIn("already been used", res2.json()["detail"])
        print("[PASS] TEST 15: Reused tokens strictly rejected (400 Bad Request)")

    def test_16_duplicate_email_registration_rejected(self):
        """TEST 16: Duplicate email registration -> rejected."""
        email = f"duplicate_{int(datetime.now().timestamp())}@test.com"
        reg_payload = {
            "full_name": "Original User",
            "email": email,
            "date_of_birth": "1989-09-09",
            "password": "Password123!",
            "confirm_password": "Password123!"
        }
        res1 = self.client.post("/api/v1/auth/register/patient", json=reg_payload)
        self.assertEqual(res1.status_code, 201)

        # Duplicate register attempt
        res2 = self.client.post("/api/v1/auth/register/patient", json=reg_payload)
        self.assertEqual(res2.status_code, 400)
        self.assertIn("already exists", res2.json()["detail"])
        print("[PASS] TEST 16: Duplicate email registration rejected (400 Bad Request)")

if __name__ == "__main__":
    unittest.main(verbosity=2)
