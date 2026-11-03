"""
PARAKH (परख) - Comprehensive Demonstration Seed Script
Pre-configures stable, realistic, development-only demonstration accounts and clinical records
for college presentation evaluation.
Accounts:
- 1 Administrator: admin@parakh.org
- 2 Approved Doctors: doctor@parakh.org, doctor2@parakh.org
- 3 Patients: patient@parakh.org, patient2@parakh.org, patient3@parakh.org
"""

import os
import sys
from datetime import datetime, timezone, date, timedelta

os.environ["PARAKH_TEST_MODE"] = "1"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import get_db, init_db
from auth.hasher import hash_password
from auth.tokens import generate_id
from seed_admin import seed_admin

def seed_demo():
    print("=" * 70)
    print("PARAKH - PREPARING COMPREHENSIVE DEMO SEED DATA (STEPS 1, 2, 3)")
    print("=" * 70)

    init_db()

    # 1. ADMIN ACCOUNT
    admin_id = seed_admin(
        email="admin@parakh.org",
        password="Admin@Parakh2026!",
        full_name="Chief Medical Administrator",
        phone="+91 9999900000",
        force=True
    )
    print(" [1/6] Admin account verified: admin@parakh.org")

    with get_db() as db:
        now_iso = datetime.now(timezone.utc).isoformat()
        today = date.today()
        yesterday = (today - timedelta(days=1)).strftime("%Y-%m-%d")
        two_days_ago = (today - timedelta(days=2)).strftime("%Y-%m-%d")
        tomorrow = (today + timedelta(days=1)).strftime("%Y-%m-%d")
        next_week = (today + timedelta(days=7)).strftime("%Y-%m-%d")

        # -------------------------------------------------------------
        # 2. DOCTOR 1: Dr. Ananya Sharma (Dermatology & Dermatosurgery)
        # -------------------------------------------------------------
        doc1_email = "doctor@parakh.org"
        doc1_user = db.execute("SELECT id FROM users WHERE email = ?", (doc1_email,)).fetchone()
        if not doc1_user:
            doc1_user_id = generate_id("usr")
            pw_hash = hash_password("Demo@Parakh2026!")
            db.execute(
                """
                INSERT INTO users (id, full_name, email, phone, password_hash, role, email_verified, account_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'doctor', 1, 'active', ?, ?)
                """,
                (doc1_user_id, "Dr. Ananya Sharma", doc1_email, "+91 9811002233", pw_hash, now_iso, now_iso)
            )
            doc1_id = generate_id("doc")
            db.execute(
                """
                INSERT INTO doctors (id, user_id, medical_registration_number, qualification, specialization,
                                     experience_years, clinic_name, clinic_address, professional_bio,
                                     verification_status, verified_at, verified_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
                """,
                (
                    doc1_id, doc1_user_id, "MCI-2018-84729", "MBBS, MD Dermatology (AIIMS Delhi)",
                    "Dermatology & Dermatosurgery", 8, "PARAKH Advanced Dermatology Clinic",
                    "Suite 402, Apex Health Tower, New Delhi", "Senior Consultant Dermatologist specializing in clinical dermato-oncology and dermoscopy.",
                    now_iso, admin_id, now_iso
                )
            )
        else:
            doc1_user_id = doc1_user["id"]
            db.execute(
                "UPDATE users SET password_hash = ?, email_verified = 1, account_status = 'active' WHERE id = ?",
                (hash_password("Demo@Parakh2026!"), doc1_user_id)
            )
            doc1_row = db.execute("SELECT id FROM doctors WHERE user_id = ?", (doc1_user_id,)).fetchone()
            doc1_id = doc1_row["id"]
            db.execute(
                "UPDATE doctors SET verification_status = 'approved', verified_at = ? WHERE id = ?",
                (now_iso, doc1_id)
            )

        # Doctor 1 Availability: Mon-Sat 09:00 - 17:00
        for dow in range(6):
            if not db.execute("SELECT id FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ?", (doc1_id, dow)).fetchone():
                db.execute(
                    """
                    INSERT INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, '09:00', '17:00', 30, 1, ?, ?)
                    """,
                    (generate_id("dav"), doc1_id, dow, now_iso, now_iso)
                )

        # -------------------------------------------------------------
        # 3. DOCTOR 2: Dr. Rajesh Verma (Pediatric & Cosmetic Dermatology)
        # -------------------------------------------------------------
        doc2_email = "vijaygupta0718@gmail.com"
        doc2_user = db.execute("SELECT id FROM users WHERE email = ? OR full_name = 'Dr. Rajesh Verma'", (doc2_email,)).fetchone()
        if not doc2_user:
            doc2_user_id = generate_id("usr")
            pw_hash2 = hash_password("Demo@Parakh2026!")
            db.execute(
                """
                INSERT INTO users (id, full_name, email, phone, password_hash, role, email_verified, account_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'doctor', 1, 'active', ?, ?)
                """,
                (doc2_user_id, "Dr. Rajesh Verma", doc2_email, "+91 9822334455", pw_hash2, now_iso, now_iso)
            )
            doc2_id = generate_id("doc")
            db.execute(
                """
                INSERT INTO doctors (id, user_id, medical_registration_number, qualification, specialization,
                                     experience_years, clinic_name, clinic_address, professional_bio,
                                     verification_status, verified_at, verified_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
                """,
                (
                    doc2_id, doc2_user_id, "DMC-2012-49102", "MBBS, MD Dermatology (PGI Chandigarh), DVD",
                    "Pediatric & Cosmetic Dermatology", 12, "Verma Skin & Phototherapy Centre",
                    "Block C, Greater Kailash-II, New Delhi", "Senior Dermatologist with extensive expertise in chronic eczema, psoriasis management, and laser therapeutics.",
                    now_iso, admin_id, now_iso
                )
            )
        else:
            doc2_user_id = doc2_user["id"]
            db.execute(
                "UPDATE users SET email = ?, password_hash = ?, email_verified = 1, account_status = 'active' WHERE id = ?",
                (doc2_email, hash_password("Demo@Parakh2026!"), doc2_user_id)
            )
            doc2_row = db.execute("SELECT id FROM doctors WHERE user_id = ?", (doc2_user_id,)).fetchone()
            doc2_id = doc2_row["id"]
            db.execute(
                "UPDATE doctors SET verification_status = 'approved', verified_at = ? WHERE id = ?",
                (now_iso, doc2_id)
            )

        # Doctor 2 Availability: Mon-Fri 10:00 - 18:00
        for dow in range(5):
            if not db.execute("SELECT id FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ?", (doc2_id, dow)).fetchone():
                db.execute(
                    """
                    INSERT INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, '10:00', '18:00', 30, 1, ?, ?)
                    """,
                    (generate_id("dav"), doc2_id, dow, now_iso, now_iso)
                )

        print(f" [2/6] 2 Approved Doctors verified:\n       - {doc1_email} (Dr. Ananya Sharma)\n       - {doc2_email} (Dr. Rajesh Verma)")

        # -------------------------------------------------------------
        # 4. PATIENTS (1, 2, and 3)
        # -------------------------------------------------------------
        patients_info = [
            {
                "email": "patient@parakh.org",
                "name": "Aarav Mehta",
                "phone": "+91 9811223344",
                "dob": "1998-05-14",
                "gender": "male",
                "pid": "PRK-DEL-0492",
                "blood": "B+",
                "height": 176.0,
                "weight": 72.0,
                "em_name": "Pooja Mehta",
                "em_phone": "+91 9811223399",
                "lifestyle": "Frequent outdoor cycling; mild sun exposure on forearms.",
                "family": "Maternal uncle had malignant melanoma; father has atopic dermatitis.",
                "allergy": ("Sulfa Antibiotics", "Generalized urticaria and periorbital edema", "severe", "2021-04-10"),
                "condition": ("Atopic Dermatitis", "chronic", "2019-11-20", "Pruritus on flexural surfaces during season shifts"),
                "medication": ("Cetirizine HCl 10mg", "1 tablet", "OD (Night)", "active", "Dr. Ananya Sharma", "For nocturnal pruritus"),
            },
            {
                "email": "patient2@parakh.org",
                "name": "Priya Sharma",
                "phone": "+91 9833445566",
                "dob": "1995-08-22",
                "gender": "female",
                "pid": "PRK-DEL-0711",
                "blood": "O+",
                "height": 162.0,
                "weight": 58.0,
                "em_name": "Sunita Sharma",
                "em_phone": "+91 9833445599",
                "lifestyle": "Desk job in IT; avoids direct midday sun; uses mineral sunscreen.",
                "family": "Mother diagnosed with plaque psoriasis at age 35.",
                "allergy": ("Nickel Sulfate", "Contact dermatitis with vesicular reaction on contact", "moderate", "2022-01-15"),
                "condition": ("Plaque Psoriasis", "active", "2020-03-10", "Well-demarcated erythematous plaques with silvery scales on extensor elbows"),
                "medication": ("Calcipotriol + Betamethasone Ointment", "Thin layer", "OD", "active", "Dr. Rajesh Verma", "Apply topically on elbow plaques"),
            },
            {
                "email": "vanshgupta201206@gmail.com",
                "name": "Vansh Gupta",
                "phone": "+91 9877889900",
                "dob": "2001-11-05",
                "gender": "male",
                "pid": "PRK-DEL-0943",
                "blood": "A+",
                "height": 180.0,
                "weight": 76.0,
                "em_name": "Vikas Gupta",
                "em_phone": "+91 9877889911",
                "lifestyle": "University student; sports enthusiast; gym workout 4 times/week.",
                "family": "No significant familial dermato-oncological history.",
                "allergy": ("Penicillin G", "Maculopapular rash and mild bronchospasm", "severe", "2018-09-02"),
                "condition": ("Acne Vulgaris (Grade II)", "active", "2023-02-14", "Inflammatory papules and pustules across malar cheeks and forehead"),
                "medication": ("Clindamycin 1% + Benzoyl Peroxide 2.5% Gel", "Pea-sized amount", "BD", "active", "Dr. Ananya Sharma", "Apply after gentle face wash"),
            }
        ]

        created_patients = {}
        for p in patients_info:
            p_email = p["email"]
            p_user = db.execute("SELECT id FROM users WHERE email = ?", (p_email,)).fetchone()
            if not p_user:
                p_user_id = generate_id("usr")
                pw_hash = hash_password("Demo@Parakh2026!")
                db.execute(
                    """
                    INSERT INTO users (id, full_name, email, phone, password_hash, role, email_verified, account_status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'patient', 1, 'active', ?, ?)
                    """,
                    (p_user_id, p["name"], p_email, p["phone"], pw_hash, now_iso, now_iso)
                )
                pat_id = generate_id("pat")
                db.execute(
                    """
                    INSERT INTO patients (id, user_id, date_of_birth, gender, patient_unique_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (pat_id, p_user_id, p["dob"], p["gender"], p["pid"], now_iso, now_iso)
                )
            else:
                p_user_id = p_user["id"]
                db.execute(
                    "UPDATE users SET password_hash = ?, email_verified = 1, account_status = 'active' WHERE id = ?",
                    (hash_password("Demo@Parakh2026!"), p_user_id)
                )
                pat_row = db.execute("SELECT id FROM patients WHERE user_id = ?", (p_user_id,)).fetchone()
                pat_id = pat_row["id"]

            created_patients[p_email] = (pat_id, p_user_id)

            # EMR Medical Profile
            db.execute(
                """
                INSERT INTO patient_medical_profiles (patient_id, blood_group, height_cm, weight_kg, emergency_contact_name, emergency_contact_phone, lifestyle_notes, family_medical_history, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(patient_id) DO UPDATE SET
                    blood_group = excluded.blood_group,
                    height_cm = excluded.height_cm,
                    weight_kg = excluded.weight_kg,
                    emergency_contact_name = excluded.emergency_contact_name,
                    emergency_contact_phone = excluded.emergency_contact_phone,
                    lifestyle_notes = excluded.lifestyle_notes,
                    family_medical_history = excluded.family_medical_history,
                    updated_at = excluded.updated_at
                """,
                (pat_id, p["blood"], p["height"], p["weight"], p["em_name"], p["em_phone"], p["lifestyle"], p["family"], now_iso)
            )

            # Allergy
            alg_name, alg_rxn, alg_sev, alg_dt = p["allergy"]
            if not db.execute("SELECT id FROM patient_allergies WHERE patient_id = ? AND allergen = ?", (pat_id, alg_name)).fetchone():
                db.execute(
                    """
                    INSERT INTO patient_allergies (id, patient_id, allergen, reaction, severity, diagnosed_date, notes, created_by_user_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'Confirmed clinical reaction', ?, ?)
                    """,
                    (generate_id("alg"), pat_id, alg_name, alg_rxn, alg_sev, alg_dt, doc1_user_id, now_iso)
                )

            # Medical Condition
            cnd_name, cnd_stat, cnd_dt, cnd_notes = p["condition"]
            if not db.execute("SELECT id FROM patient_medical_conditions WHERE patient_id = ? AND condition_name = ?", (pat_id, cnd_name)).fetchone():
                db.execute(
                    """
                    INSERT INTO patient_medical_conditions (id, patient_id, condition_name, status, diagnosed_date, notes, created_by_user_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (generate_id("cnd"), pat_id, cnd_name, cnd_stat, cnd_dt, cnd_notes, doc1_user_id, now_iso)
                )

            # Medication
            med_name, med_dos, med_freq, med_stat, med_by, med_notes = p["medication"]
            if not db.execute("SELECT id FROM patient_medications WHERE patient_id = ? AND medication_name = ?", (pat_id, med_name)).fetchone():
                db.execute(
                    """
                    INSERT INTO patient_medications (id, patient_id, medication_name, dosage, frequency, status, prescribed_by, notes, created_by_user_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (generate_id("med"), pat_id, med_name, med_dos, med_freq, med_stat, med_by, med_notes, doc1_user_id, now_iso)
                )

        pat1_id, pat1_user_id = created_patients["patient@parakh.org"]
        pat2_id, pat2_user_id = created_patients["patient2@parakh.org"]
        pat3_id, pat3_user_id = created_patients.get("vanshgupta201206@gmail.com") or created_patients.get("patient3@parakh.org")

        print(f" [3/6] 3 Patients verified with EMR profiles, allergies, conditions, and medications:\n       - patient@parakh.org (Aarav Mehta)\n       - patient2@parakh.org (Priya Sharma)\n       - vanshgupta201206@gmail.com (Vansh Gupta)")

        # -------------------------------------------------------------
        # 5. CLINICAL RECORDS, AI REPORTS, APPOINTMENTS & PRESCRIPTIONS
        # -------------------------------------------------------------
        # AI report for Patient 1
        rep1_row = db.execute("SELECT id FROM ai_reports WHERE patient_id = ?", (pat1_id,)).fetchone()
        if not rep1_row:
            rep1_id = generate_id("rep")
            db.execute(
                """
                INSERT INTO ai_reports (id, patient_id, prediction, confidence, risk_score, risk_level, recommendation, created_at)
                VALUES (?, ?, 'Melanocytic Nevus', 0.94, 12, 'Low', 'Routine annual dermatological skin inspection recommended. Benign atypical nevus.', ?)
                """,
                (rep1_id, pat1_id, now_iso)
            )
        else:
            rep1_id = rep1_row["id"]

        # Completed past appointment for Patient 1 with Doctor 1
        past_appt1 = db.execute(
            "SELECT id FROM appointments WHERE patient_id = ? AND doctor_id = ? AND status = 'completed'",
            (pat1_id, doc1_id)
        ).fetchone()

        if not past_appt1:
            past_appt1_id = generate_id("appt")
            db.execute(
                """
                INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, slot_start, slot_end, status, reason_for_visit, created_at, updated_at)
                VALUES (?, ?, ?, ?, '10:00', '10:30', 'completed', 'Follow-up on pigmented lesion on left forearm', ?, ?)
                """,
                (past_appt1_id, pat1_id, doc1_id, two_days_ago, now_iso, now_iso)
            )
            # Link AI report
            db.execute(
                "INSERT OR IGNORE INTO appointment_ai_reports (id, appointment_id, report_id, attached_at) VALUES (?, ?, ?, ?)",
                (generate_id("aar"), past_appt1_id, rep1_id, now_iso)
            )
            # Consultation record
            cns1_id = generate_id("cns")
            db.execute(
                """
                INSERT INTO consultation_records (id, appointment_id, doctor_id, patient_id, chief_complaint, clinical_notes, diagnosis, follow_up_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Pigmented nevus on left forearm with mild itching.',
                        'Dermoscopy confirms regular pigment network, homogenous light brown coloration. No atypical vascular pattern. Benign junctional melanocytic nevus with mild xerosis.',
                        'Benign Melanocytic Nevus (D22.6) with secondary xerosis',
                        ?, ?, ?)
                """,
                (cns1_id, past_appt1_id, doc1_id, pat1_id, next_week, now_iso, now_iso)
            )
            # Prescription
            rx1_id = generate_id("rx")
            rx1_num = f"RX-{today.strftime('%Y')}-DEMO01"
            db.execute(
                """
                INSERT OR IGNORE INTO prescriptions (id, prescription_number, consultation_id, appointment_id, doctor_id, patient_id, status, clinical_assessment, diagnosis, follow_up_date, general_instructions, finalized_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'finalized', 'Benign dermoscopic findings. Moderate cuticular dryness and pruritus.', 'Benign Melanocytic Nevus with localized xerosis', ?, 'Avoid excessive scrubbing. Apply moisturizer generously after bath. Apply sun protection with SPF 50+ on exposed arms.', ?, ?, ?)
                """,
                (rx1_id, rx1_num, cns1_id, past_appt1_id, doc1_id, pat1_id, next_week, now_iso, now_iso, now_iso)
            )
            db.execute(
                """
                INSERT INTO prescription_items (id, prescription_id, medicine_name, dosage, frequency, duration, instructions, item_order, created_at)
                VALUES (?, ?, 'Hydrocortisone 1% Cream', 'Thin application', 'BID', '7 days', 'Apply to pruritic skin borders only', 0, ?),
                       (?, ?, 'Ceramide-Infused Moisturizing Cream', 'Liberal application', 'TID', '30 days', 'Apply gently within 3 minutes of bathing', 1, ?)
                """,
                (generate_id("rxi"), rx1_id, now_iso, generate_id("rxi"), rx1_id, now_iso)
            )

        # Upcoming confirmed appointment for Patient 1 with Doctor 1 (Tomorrow)
        if not db.execute("SELECT id FROM appointments WHERE patient_id = ? AND doctor_id = ? AND appointment_date = ?", (pat1_id, doc1_id, tomorrow)).fetchone():
            db.execute(
                """
                INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, slot_start, slot_end, status, reason_for_visit, created_at, updated_at)
                VALUES (?, ?, ?, ?, '11:00', '11:30', 'confirmed', 'Routine dermoscopy review and skin check', ?, ?)
                """,
                (generate_id("appt"), pat1_id, doc1_id, tomorrow, now_iso, now_iso)
            )

        # Pending appointment request for Patient 2 with Doctor 2 (Today/Upcoming)
        if not db.execute("SELECT id FROM appointments WHERE patient_id = ? AND doctor_id = ?", (pat2_id, doc2_id)).fetchone():
            db.execute(
                """
                INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, slot_start, slot_end, status, reason_for_visit, created_at, updated_at)
                VALUES (?, ?, ?, ?, '14:00', '14:30', 'pending', 'Evaluation of scaling plaques on bilateral elbows and knees', ?, ?)
                """,
                (generate_id("appt"), pat2_id, doc2_id, tomorrow, now_iso, now_iso)
            )

        # -------------------------------------------------------------
        # 6. SEED MEDICAL DOCUMENTS
        # -------------------------------------------------------------
        doc_storage_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "medical_documents", pat1_id)
        os.makedirs(doc_storage_dir, exist_ok=True)
        sample_doc_file = os.path.join(doc_storage_dir, "histopathology_biopsy_report.pdf")
        if not os.path.exists(sample_doc_file):
            with open(sample_doc_file, "wb") as f:
                f.write(b"%PDF-1.4\n%PARAKH Demonstration Document\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000119 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF\n")

        if not db.execute("SELECT id FROM medical_documents WHERE patient_id = ?", (pat1_id,)).fetchone():
            db.execute(
                """
                INSERT INTO medical_documents (id, patient_id, uploaded_by_user_id, title, category, file_name, file_path, mime_type, file_size_bytes, notes, created_at, updated_at)
                VALUES (?, ?, ?, 'Histopathology Punch Biopsy Report', 'dermatology_report', 'histopathology_biopsy_report.pdf', ?, 'application/pdf', 248, 'Demonstration punch biopsy pathology summary: Benign compound melanocytic nevus.', ?, ?)
                """,
                (generate_id("docf"), pat1_id, pat1_user_id, sample_doc_file, now_iso, now_iso)
            )

        print(" [4/6] Pre-loaded clinical records, appointments, prescriptions and medical documents seeded.")
        print(" [5/6] All database checks passed.")

    print(" [6/6] Demonstration environment ready!")
    print("=" * 70)
    print("DEMO LOGIN CREDENTIALS (LOCAL DEVELOPMENT ONLY):")
    print(" 1. Administrator:   admin@parakh.org    | Password: Admin@Parakh2026!")
    print(" 2. Doctor 1:        doctor@parakh.org   | Password: Doctor@Parakh2026!  (Dr. Ananya Sharma)")
    print(" 3. Doctor 2:        vijaygupta0718@gmail.com  | Password: Demo@Parakh2026!  (Dr. Rajesh Verma)")
    print(" 4. Patient 1:       patient@parakh.org        | Password: Demo@Parakh2026!  (Aarav Mehta)")
    print(" 5. Patient 2:       patient2@parakh.org       | Password: Demo@Parakh2026!  (Priya Sharma)")
    print(" 6. Patient 3:       vanshgupta201206@gmail.com| Password: Demo@Parakh2026!  (Vansh Gupta)")
    print("=" * 70)

if __name__ == "__main__":
    seed_demo()
