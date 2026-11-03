"""
PARAKH (परख) - STEP 3 Comprehensive Automated Test Suite
Validates:
  1. Medical record creation (profile, conditions, medications)
  2. Medical record authorization
  3. Allergy management (creation, listing, deletion, audit logging)
  4. Prescription creation (draft & finalized)
  5. Multiple prescription medicines
  6. PDF generation (valid PDF stream with PARAKH branding)
  7. Unauthorized prescription access (403 for unrelated doctor/patient)
  8. Medical document upload (validation & metadata storage)
  9. Secure document download & view (streaming & isolation)
 10. Patient record isolation (Patient 2 blocked from Patient 1's records)
 11. Doctor access restrictions (Doctor 2 without relationship blocked)
 12. Clinical timeline generation (aggregates EMR, appointments, prescriptions, AI reports)
 13. Audit trail preservation for clinical record modifications
"""

import os
import sys
import io
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
FUTURE_DATE = (TODAY + timedelta(days=12)).strftime("%Y-%m-%d")
FUTURE_DOW = (TODAY + timedelta(days=12)).weekday()


def _register_patient(client, suffix="") -> tuple[str, str]:
    ts = str(int(time.time() * 1000)) + suffix
    email = f"pat_{ts}@step3test.com"
    reg = client.post("/api/v1/auth/register/patient", json={
        "full_name": f"Patient {ts}",
        "email": email,
        "date_of_birth": "1995-04-12",
        "gender": "female",
        "password": "Password123!",
        "confirm_password": "Password123!",
    })
    assert reg.status_code == 201, reg.text
    token = reg.json()["dev_verification_url"].split("token=")[1]
    client.post("/api/v1/auth/verify-email", json={"token": token})
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login.status_code == 200, login.text
    sess_token = login.json()["session_token"]
    client.cookies.clear()
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {sess_token}"})
    assert me.status_code == 200, me.text
    pat_id = me.json()["user"]["patient_profile"]["patient_id"]
    client.cookies.clear()
    return sess_token, pat_id


def _register_doctor(client, suffix="") -> tuple[str, str, str]:
    ts = str(int(time.time() * 1000)) + suffix
    email = f"doc_{ts}@step3test.com"
    reg = client.post("/api/v1/auth/register/doctor", json={
        "full_name": f"Dr. StepThree {ts}",
        "email": email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "medical_registration_number": f"MCI-S3-{ts}",
        "qualification": "MBBS, MD Dermatology",
        "specialization": "Dermatology",
        "experience_years": 10,
        "clinic_name": "PARAKH Derma Institute",
        "clinic_address": "88 Medical Square",
    })
    assert reg.status_code == 201, reg.text
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login.status_code == 200, login.text
    client.cookies.clear()
    return login.json()["session_token"], email, ts


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


class TestStep3Suite(unittest.TestCase):
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
        doc_a_raw, doc_a_email, _ = _register_doctor(cls.client, "docA")
        cls.doc_a_id = _approve_doctor(cls.client, cls.admin_token, doc_a_raw)
        login_a = cls.client.post("/api/v1/auth/login", json={"email": doc_a_email, "password": "Password123!"})
        cls.doc_a_token = login_a.json()["session_token"]
        cls.client.cookies.clear()

        # Doctor B (approved, but unrelated to Patient 1)
        doc_b_raw, doc_b_email, _ = _register_doctor(cls.client, "docB")
        cls.doc_b_id = _approve_doctor(cls.client, cls.admin_token, doc_b_raw)
        login_b = cls.client.post("/api/v1/auth/login", json={"email": doc_b_email, "password": "Password123!"})
        cls.doc_b_token = login_b.json()["session_token"]
        cls.client.cookies.clear()

        # Doctor A Availability
        cls.client.post("/api/v1/appointments/availability", json={
            "day_of_week": FUTURE_DOW,
            "start_time": "09:00",
            "end_time": "17:00",
            "slot_duration_minutes": 30
        }, headers={"Authorization": f"Bearer {cls.doc_a_token}"})
        cls.client.cookies.clear()

        # Patients
        cls.pat_1_token, cls.pat_1_id = _register_patient(cls.client, "pat1")
        cls.pat_2_token, cls.pat_2_id = _register_patient(cls.client, "pat2")

        # Book appointment between Patient 1 and Doctor A (establishes clinical care relationship)
        book_res = cls.client.post("/api/v1/appointments/book", json={
            "doctor_id": cls.doc_a_id,
            "appointment_date": FUTURE_DATE,
            "slot_start": "09:00",
            "reason_for_visit": "Suspicious dermal pigmentation"
        }, headers={"Authorization": f"Bearer {cls.pat_1_token}"})
        assert book_res.status_code == 201, book_res.text
        cls.appt_id = book_res.json()["appointment_id"]
        cls.client.cookies.clear()

        # Doctor A confirms appointment
        cls.client.post(f"/api/v1/appointments/doctor/{cls.appt_id}/confirm", headers={"Authorization": f"Bearer {cls.doc_a_token}"})
        cls.client.cookies.clear()

    def test_01_patient_medical_profile_update_and_retrieval(self):
        """TEST 1: Patient updates core medical profile (blood group, height, weight, allergies)."""
        res = self.client.put(
            f"/api/v1/emr/patient/{self.pat_1_id}/profile",
            json={
                "blood_group": "O+",
                "height_cm": 168.5,
                "weight_kg": 64.0,
                "emergency_contact_name": "John Doe",
                "emergency_contact_phone": "+91 9876543210",
                "lifestyle_notes": "Non-smoker, mild outdoor sun exposure.",
                "family_medical_history": "Maternal grandmother had melanoma."
            },
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(res.status_code, 200, res.text)

        # Retrieve profile
        get_res = self.client.get(f"/api/v1/emr/patient/{self.pat_1_id}", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(get_res.status_code, 200)
        data = get_res.json()["patient"]
        self.assertEqual(data["blood_group"], "O+")
        self.assertEqual(data["height_cm"], 168.5)
        self.assertEqual(data["weight_kg"], 64.0)
        print("[PASS] TEST 1: Patient medical profile updated and verified")

    def test_02_allergy_creation_and_deletion_with_audit(self):
        """TEST 2: Add allergy, verify in list, delete with audit trail."""
        # 1. Add allergy
        add_res = self.client.post(
            f"/api/v1/emr/patient/{self.pat_1_id}/allergies",
            json={
                "allergen": "Penicillin",
                "reaction": "Cutaneous urticaria and facial swelling",
                "severity": "severe",
                "diagnosed_date": "2020-03-15",
                "notes": "Avoid all beta-lactam antibiotics"
            },
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(add_res.status_code, 201, add_res.text)
        allergy_id = add_res.json()["allergy_id"]

        # 2. Verify listing
        get_res = self.client.get(f"/api/v1/emr/patient/{self.pat_1_id}", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        allergies = get_res.json()["allergies"]
        self.assertTrue(any(a["id"] == allergy_id for a in allergies))

        # 3. Delete allergy
        del_res = self.client.delete(f"/api/v1/emr/allergies/{allergy_id}", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(del_res.status_code, 200)

        # 4. Verify audit log entry
        audit_res = self.client.get(f"/api/v1/emr/patient/{self.pat_1_id}/audit-logs", headers={"Authorization": f"Bearer {self.doc_a_token}"})
        self.assertEqual(audit_res.status_code, 200)
        actions = [log["action"] for log in audit_res.json()["audit_logs"] if log["record_type"] == "allergy"]
        self.assertIn("created", actions)
        self.assertIn("deleted", actions)
        print("[PASS] TEST 2: Allergy lifecycle and audit log verified")

    def test_03_conditions_and_medications_management(self):
        """TEST 3: Add chronic condition and ongoing medication."""
        c_res = self.client.post(
            f"/api/v1/emr/patient/{self.pat_1_id}/conditions",
            json={
                "condition_name": "Atopic Dermatitis",
                "status": "chronic",
                "diagnosed_date": "2022-01-10",
                "notes": "Erythematous pruritic lesions on flexural folds"
            },
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(c_res.status_code, 201)

        m_res = self.client.post(
            f"/api/v1/emr/patient/{self.pat_1_id}/medications",
            json={
                "medication_name": "Hydrocortisone 1% Cream",
                "dosage": "Thin layer twice daily",
                "frequency": "BID",
                "status": "active",
                "prescribed_by": "Dr. StepThree",
                "notes": "Apply to affected areas"
            },
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(m_res.status_code, 201)
        print("[PASS] TEST 3: Chronic condition and medication recorded")

    def test_04_doctor_creates_digital_prescription_with_multiple_medicines(self):
        """TEST 4: Doctor A creates a finalized digital prescription with multiple medications."""
        res = self.client.post(
            "/api/v1/prescriptions",
            json={
                "patient_id": self.pat_1_id,
                "appointment_id": self.appt_id,
                "clinical_assessment": "Erythematous maculopapular rash secondary to acute eczema flare.",
                "diagnosis": "Acute Eczematous Dermatitis (L30.9)",
                "follow_up_date": (TODAY + timedelta(days=21)).strftime("%Y-%m-%d"),
                "general_instructions": "Avoid hot showers and harsh soaps. Use gentle emollient immediately after bathing.",
                "finalize_now": True,
                "items": [
                    {
                        "medicine_name": "Mometasone Furoate 0.1% Ointment",
                        "dosage": "Thin layer once daily",
                        "frequency": "OD (Night)",
                        "duration": "14 days",
                        "instructions": "Apply to affected lesions only. Do not apply on broken skin."
                    },
                    {
                        "medicine_name": "Cetirizine HCl 10mg",
                        "dosage": "1 tablet",
                        "frequency": "OD (Bedtime)",
                        "duration": "10 days",
                        "instructions": "Take at night. May cause mild drowsiness."
                    },
                    {
                        "medicine_name": "Ceramide-Infused Moisturizing Lotion",
                        "dosage": "Liberal application",
                        "frequency": "TID",
                        "duration": "30 days",
                        "instructions": "Apply liberally over body after showering."
                    }
                ]
            },
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(res.status_code, 201, res.text)
        rx_data = res.json()
        self.assertEqual(rx_data["prescription_status"], "finalized")
        self.assertTrue(rx_data["prescription_number"].startswith("RX-"))
        self.__class__.prescription_id = rx_data["prescription_id"]
        print("[PASS] TEST 4: Digital prescription with 3 medicines created and finalized")

    def test_05_prescription_detail_and_pdf_generation(self):
        """TEST 5: Retrieve prescription details and download branded PDF."""
        rx_id = self.__class__.prescription_id
        
        # 1. Detail
        detail_res = self.client.get(f"/api/v1/prescriptions/{rx_id}", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(len(detail_res.json()["items"]), 3)
        self.assertEqual(detail_res.json()["prescription"]["status"], "finalized")

        # 2. PDF generation
        pdf_res = self.client.get(f"/api/v1/prescriptions/{rx_id}/pdf", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res.headers["content-type"], "application/pdf")
        self.assertTrue(pdf_res.content.startswith(b"%PDF-"), "Invalid PDF binary stream")
        self.assertGreater(len(pdf_res.content), 1000)
        print(f"[PASS] TEST 5: Prescription PDF rendered successfully ({len(pdf_res.content)} bytes)")

    def test_06_unauthorized_prescription_access_blocked(self):
        """TEST 6: Doctor B and Patient 2 cannot access Patient 1's prescription (403 Forbidden)."""
        rx_id = self.__class__.prescription_id

        # Doctor B (no clinical relationship)
        doc_b_res = self.client.get(f"/api/v1/prescriptions/{rx_id}", headers={"Authorization": f"Bearer {self.doc_b_token}"})
        self.assertEqual(doc_b_res.status_code, 403)

        # Patient 2 (different patient)
        pat_2_res = self.client.get(f"/api/v1/prescriptions/{rx_id}", headers={"Authorization": f"Bearer {self.pat_2_token}"})
        self.assertEqual(pat_2_res.status_code, 403)

        # PDF download blocked for unauthorized users
        doc_b_pdf = self.client.get(f"/api/v1/prescriptions/{rx_id}/pdf", headers={"Authorization": f"Bearer {self.doc_b_token}"})
        self.assertEqual(doc_b_pdf.status_code, 403)
        print("[PASS] TEST 6: Unauthorized prescription access strictly blocked (403)")

    def test_07_finalized_prescription_cannot_be_silently_modified(self):
        """TEST 7: Finalized prescription cannot be modified without providing an explicit edit_reason."""
        rx_id = self.__class__.prescription_id

        # Attempt to edit without reason
        res_no_reason = self.client.put(
            f"/api/v1/prescriptions/{rx_id}",
            json={"clinical_assessment": "Altered assessment without justification"},
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(res_no_reason.status_code, 400)

        # Edit with explicit clinical reason
        res_with_reason = self.client.put(
            f"/api/v1/prescriptions/{rx_id}",
            json={
                "clinical_assessment": "Eczema flare with secondary mild excoriation.",
                "edit_reason": "Corrected clinical assessment following in-person review of lesion borders."
            },
            headers={"Authorization": f"Bearer {self.doc_a_token}"}
        )
        self.assertEqual(res_with_reason.status_code, 200)

        # Verify audit log recorded the amendment
        audit_res = self.client.get(f"/api/v1/emr/patient/{self.pat_1_id}/audit-logs", headers={"Authorization": f"Bearer {self.doc_a_token}"})
        actions = [log["action"] for log in audit_res.json()["audit_logs"] if log["record_type"] == "prescription"]
        self.assertIn("amended", actions)
        print("[PASS] TEST 7: Finalized prescription silent modification prevented and audited")

    def test_08_medical_document_upload_and_validation(self):
        """TEST 8: Upload PDF laboratory report and test file extension/size validation."""
        # Valid upload
        fake_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        files = {"file": ("blood_work.pdf", io.BytesIO(fake_pdf), "application/pdf")}
        data = {
            "patient_id": self.pat_1_id,
            "title": "Serum IgE and CBC Panel",
            "category": "laboratory_report",
            "notes": "Elevated IgE confirms allergic atopic diathesis."
        }
        res = self.client.post("/api/v1/medical-documents/upload", data=data, files=files, headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(res.status_code, 201, res.text)
        doc_id = res.json()["document_id"]
        self.__class__.document_id = doc_id

        # Invalid extension blocked
        files_invalid = {"file": ("malicious.exe", io.BytesIO(b"MZ..."), "application/x-msdownload")}
        bad_res = self.client.post("/api/v1/medical-documents/upload", data=data, files=files_invalid, headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(bad_res.status_code, 400)
        print("[PASS] TEST 8: Medical document upload succeeded; invalid formats rejected")

    def test_09_secure_document_download_and_view(self):
        """TEST 9: Securely stream and download uploaded document; unauthorized blocked."""
        doc_id = self.__class__.document_id

        # Patient 1 views document
        view_res = self.client.get(f"/api/v1/medical-documents/{doc_id}/view", headers={"Authorization": f"Bearer {self.pat_1_token}"})
        self.assertEqual(view_res.status_code, 200)
        self.assertTrue(view_res.content.startswith(b"%PDF-1.4"))

        # Doctor A (treating doctor) downloads document
        dl_res = self.client.get(f"/api/v1/medical-documents/{doc_id}/download", headers={"Authorization": f"Bearer {self.doc_a_token}"})
        self.assertEqual(dl_res.status_code, 200)

        # Doctor B (unrelated) blocked (403)
        b_res = self.client.get(f"/api/v1/medical-documents/{doc_id}/download", headers={"Authorization": f"Bearer {self.doc_b_token}"})
        self.assertEqual(b_res.status_code, 403)

        # Patient 2 (different patient) blocked (403)
        p2_res = self.client.get(f"/api/v1/medical-documents/{doc_id}/download", headers={"Authorization": f"Bearer {self.pat_2_token}"})
        self.assertEqual(p2_res.status_code, 403)
        print("[PASS] TEST 9: Medical document download and viewing protected by strict authorization")

    def test_10_medical_document_search_and_filters(self):
        """TEST 10: Search documents by title and category."""
        # Search by query
        s_res = self.client.get(
            f"/api/v1/medical-documents/patient/{self.pat_1_id}?search=Serum",
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(s_res.status_code, 200)
        self.assertEqual(len(s_res.json()["documents"]), 1)

        # Filter by category
        cat_res = self.client.get(
            f"/api/v1/medical-documents/patient/{self.pat_1_id}?category=dermatology_report",
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(cat_res.status_code, 200)
        self.assertEqual(len(cat_res.json()["documents"]), 0)
        print("[PASS] TEST 10: Document search and category filtering verified")

    def test_11_clinical_timeline_aggregates_all_patient_events(self):
        """TEST 11: Clinical timeline aggregates appointments, prescriptions, documents, EMR updates & AI scans."""
        # 1. Attach an AI analysis report for Patient 1
        self.client.post(
            "/api/v1/patient/reports",
            json={
                "prediction": "Melanocytic Nevus",
                "confidence": 0.96,
                "risk_score": 10,
                "risk_level": "Low",
                "recommendation": "Routine monitoring.",
                "image_data": "data:image/png;base64,mock",
                "heatmap_data": "data:image/png;base64,mock"
            },
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )

        timeline_res = self.client.get(
            f"/api/v1/timeline/patient/{self.pat_1_id}",
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(timeline_res.status_code, 200)
        data = timeline_res.json()
        events = data["events"]
        types = [e["event_type"] for e in events]

        self.assertIn("appointment", types)
        self.assertIn("prescription", types)
        self.assertIn("document", types)
        self.assertIn("ai_analysis", types)

        # Verify AI prediction is clearly flagged and not marked as doctor-confirmed
        ai_events = [e for e in events if e["event_type"] == "ai_analysis"]
        self.assertTrue(len(ai_events) > 0)
        self.assertTrue(ai_events[0]["is_ai_prediction"])
        self.assertFalse(ai_events[0]["is_doctor_confirmed"])
        self.assertIn("disclaimer", ai_events[0]["metadata"])

        # Verify prescription is marked as doctor-confirmed
        rx_events = [e for e in events if e["event_type"] == "prescription"]
        self.assertTrue(len(rx_events) > 0)
        self.assertTrue(rx_events[0]["is_doctor_confirmed"])
        self.assertFalse(rx_events[0]["is_ai_prediction"])
        print(f"[PASS] TEST 11: Clinical timeline unified ({len(events)} events) with clear AI vs clinician distinctions")

    def test_12_doctor_b_isolated_from_patient_1_records(self):
        """TEST 12: Doctor B cannot access Patient 1's EMR, timeline, or documents."""
        # EMR
        res_emr = self.client.get(f"/api/v1/emr/patient/{self.pat_1_id}", headers={"Authorization": f"Bearer {self.doc_b_token}"})
        self.assertEqual(res_emr.status_code, 403)

        # Timeline
        res_tl = self.client.get(f"/api/v1/timeline/patient/{self.pat_1_id}", headers={"Authorization": f"Bearer {self.doc_b_token}"})
        self.assertEqual(res_tl.status_code, 403)

        # Documents
        res_docs = self.client.get(f"/api/v1/medical-documents/patient/{self.pat_1_id}", headers={"Authorization": f"Bearer {self.doc_b_token}"})
        self.assertEqual(res_docs.status_code, 403)
        print("[PASS] TEST 12: Doctor access restrictions enforced (403 across all EMR endpoints)")

    def test_13_patient_cannot_modify_doctor_prescription(self):
        """TEST 13: Patient cannot modify prescriptions (only doctors can issue/edit)."""
        rx_id = self.__class__.prescription_id
        res = self.client.put(
            f"/api/v1/prescriptions/{rx_id}",
            json={"clinical_assessment": "Hacked assessment by patient"},
            headers={"Authorization": f"Bearer {self.pat_1_token}"}
        )
        self.assertEqual(res.status_code, 403)
        print("[PASS] TEST 13: Role escalation prevented: patient cannot modify prescriptions")


if __name__ == "__main__":
    unittest.main(verbosity=2)
