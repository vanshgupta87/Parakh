import base64
import io
import os
import sys
import tempfile
import time
import unittest

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

import database.db as database_module


def image_data_url(contents: bytes) -> str:
    encoded = base64.b64encode(contents).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


class DoctorAIReportHistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.original_db_path = database_module.DB_PATH
        database_module.DB_PATH = os.path.join(cls.temp_dir.name, "history-test.db")

        from fastapi.testclient import TestClient
        from auth.session_manager import create_session
        from database.db import get_db, init_db
        from main import app

        cls.get_db = staticmethod(get_db)
        cls.init_db = staticmethod(init_db)
        cls.create_session = staticmethod(create_session)
        cls.client = TestClient(app)
        cls.init_db()

        with cls.get_db() as db:
            db.execute(
                """
                INSERT INTO users (id, full_name, email, password_hash, role, email_verified, account_status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                ("doctor-user-1", "Dr. History Test", "history-doctor@example.test", "test", "doctor", 1, "active"),
            )
            db.execute(
                """
                INSERT INTO doctors (
                    id, user_id, medical_registration_number, qualification, specialization,
                    experience_years, clinic_name, clinic_address, verification_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ("doctor-1", "doctor-user-1", "TEST-REG-1", "MD", "Dermatology", 5, "Test Clinic", "Test Address", "approved"),
            )
            db.execute(
                """
                INSERT INTO users (id, full_name, email, password_hash, role, email_verified, account_status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                ("doctor-user-2", "Dr. Unrelated", "unrelated-doctor@example.test", "test", "doctor", 1, "active"),
            )
            db.execute(
                """
                INSERT INTO doctors (
                    id, user_id, medical_registration_number, qualification, specialization,
                    experience_years, clinic_name, clinic_address, verification_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ("doctor-2", "doctor-user-2", "TEST-REG-2", "MD", "Dermatology", 4, "Other Clinic", "Other Address", "approved"),
            )
            for patient_id, user_id, unique_id in (
                ("patient-1", "patient-user-1", "PRK-TEST-1"),
                ("patient-2", "patient-user-2", "PRK-TEST-2"),
            ):
                db.execute(
                    """
                    INSERT INTO users (id, full_name, email, password_hash, role, email_verified, account_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, patient_id, f"{user_id}@example.test", "test", "patient", 1, "active"),
                )
                db.execute(
                    """
                    INSERT INTO patients (id, user_id, date_of_birth, patient_unique_id)
                    VALUES (?, ?, ?, ?)
                    """,
                    (patient_id, user_id, "1990-01-01", unique_id),
                )
            db.execute(
                """
                INSERT INTO appointments (
                    id, patient_id, doctor_id, appointment_date, slot_start, slot_end, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                ("appointment-1", "patient-1", "doctor-1", "2026-01-01", "09:00", "09:30", "completed"),
            )
            db.execute(
                """
                INSERT INTO ai_reports (
                    id, patient_id, image_data, prediction, confidence, risk_score,
                    risk_level, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ("legacy-no-image", "patient-1", None, "Unavailable image", 0.5, 50, "Moderate", "2020-01-01T00:00:00+00:00"),
            )

        cls.doctor_token, _ = cls.create_session("doctor-user-1")
        cls.unrelated_doctor_token, _ = cls.create_session("doctor-user-2")
        cls.headers = {"Authorization": f"Bearer {cls.doctor_token}"}

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        database_module.DB_PATH = cls.original_db_path
        cls.temp_dir.cleanup()

    def test_two_distinct_images_are_stored_and_returned_chronologically(self):
        image_paths = [
            os.path.join(BACKEND_DIR, "raw_data", "ISIC_0024306.jpg"),
            os.path.join(BACKEND_DIR, "raw_data", "ISIC_0024307.jpg"),
        ]
        image_contents = []
        for image_path in image_paths:
            with open(image_path, "rb") as image_file:
                image_contents.append(image_file.read())
        images = [image_data_url(contents) for contents in image_contents]
        self.assertNotEqual(images[0], images[1])
        report_ids = []

        for index, (image_path, image_data) in enumerate(zip(image_paths, images)):
            with open(image_path, "rb") as image_file:
                diagnosis_response = self.client.post(
                    "/api/v1/diagnose",
                    files={"file": (os.path.basename(image_path), image_file, "image/jpeg")},
                )
            self.assertEqual(diagnosis_response.status_code, 200, diagnosis_response.text)
            diagnosis = diagnosis_response.json()
            self.assertTrue(diagnosis.get("prediction"))
            self.assertTrue(diagnosis.get("heatmap_base64", "").startswith("data:image/png;base64,"))

            response = self.client.post(
                "/api/v1/doctor/patients/patient-1/ai-reports",
                headers=self.headers,
                json={
                    "prediction": diagnosis["prediction"],
                    "confidence": diagnosis["confidence"],
                    "risk_score": diagnosis["risk_score"],
                    "risk_level": diagnosis["risk_level"],
                    "recommendation": diagnosis["recommendation"],
                    "image_data": image_data,
                    "heatmap_data": diagnosis["heatmap_base64"],
                    "probabilities": diagnosis["probabilities"],
                    "clinical_metadata": {"anatomicalSite": "Torso (Front)"},
                },
            )
            self.assertEqual(response.status_code, 201, response.text)
            report_ids.append(response.json()["report_id"])
            time.sleep(0.01)

        history_response = self.client.get(
            "/api/v1/doctor/patients/patient-1/ai-reports",
            headers=self.headers,
        )
        self.assertEqual(history_response.status_code, 200, history_response.text)
        reports = history_response.json()["reports"]

        self.assertEqual([report["id"] for report in reports], report_ids)
        self.assertEqual([report["image_data"] for report in reports], images)
        self.assertNotEqual(reports[0]["image_data"], reports[-1]["image_data"])
        self.assertTrue(reports[0]["prediction"])
        self.assertTrue(reports[-1]["prediction"])
        self.assertLessEqual(reports[0]["created_at"], reports[-1]["created_at"])
        self.assertNotIn("legacy-no-image", [report["id"] for report in reports])

        with self.get_db() as db:
            retained = db.execute("SELECT id FROM ai_reports WHERE id = ?", ("legacy-no-image",)).fetchone()
        self.assertIsNotNone(retained)

    def test_doctor_cannot_read_or_write_unrelated_patient_history(self):
        denied_read = self.client.get(
            "/api/v1/doctor/patients/patient-2/ai-reports",
            headers=self.headers,
        )
        self.assertEqual(denied_read.status_code, 403)

        denied_write = self.client.post(
            "/api/v1/doctor/patients/patient-1/ai-reports",
            headers={"Authorization": f"Bearer {self.unrelated_doctor_token}"},
            json={
                "prediction": "Unauthorized",
                "confidence": 0.5,
                "risk_score": 50,
                "risk_level": "Moderate",
                "image_data": image_data_url(b"not-used"),
            },
        )
        self.assertEqual(denied_write.status_code, 403)


if __name__ == "__main__":
    unittest.main()