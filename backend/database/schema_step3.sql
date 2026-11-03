-- ============================================================================
-- PARAKH (परख) - STEP 3 DATABASE SCHEMA
-- Electronic Medical Records (EMR), Prescriptions, Documents & Clinical Audit
-- ============================================================================

-- 1. Patient Core Medical Profiles
CREATE TABLE IF NOT EXISTS patient_medical_profiles (
    patient_id              TEXT PRIMARY KEY,
    blood_group             TEXT,
    height_cm               REAL,
    weight_kg               REAL,
    emergency_contact_name  TEXT,
    emergency_contact_phone TEXT,
    lifestyle_notes         TEXT,
    family_medical_history  TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 2. Patient Allergies
CREATE TABLE IF NOT EXISTS patient_allergies (
    id                  TEXT PRIMARY KEY,
    patient_id          TEXT NOT NULL,
    allergen            TEXT NOT NULL,
    reaction            TEXT,
    severity            TEXT NOT NULL CHECK(severity IN ('mild', 'moderate', 'severe', 'life-threatening')),
    diagnosed_date      TEXT,
    notes               TEXT,
    created_by_user_id  TEXT NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id)         REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON patient_allergies(patient_id);

-- 3. Patient Medical Conditions
CREATE TABLE IF NOT EXISTS patient_medical_conditions (
    id                  TEXT PRIMARY KEY,
    patient_id          TEXT NOT NULL,
    condition_name      TEXT NOT NULL,
    status              TEXT NOT NULL CHECK(status IN ('active', 'resolved', 'chronic', 'remission')) DEFAULT 'active',
    diagnosed_date      TEXT,
    notes               TEXT,
    created_by_user_id  TEXT NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id)         REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_conditions_patient ON patient_medical_conditions(patient_id);

-- 4. Patient Medication History
CREATE TABLE IF NOT EXISTS patient_medications (
    id                  TEXT PRIMARY KEY,
    patient_id          TEXT NOT NULL,
    medication_name     TEXT NOT NULL,
    dosage              TEXT NOT NULL,
    frequency           TEXT NOT NULL,
    start_date          TEXT,
    end_date            TEXT,
    status              TEXT NOT NULL CHECK(status IN ('active', 'discontinued', 'completed')) DEFAULT 'active',
    prescribed_by       TEXT,
    notes               TEXT,
    created_by_user_id  TEXT NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id)         REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_medications_patient ON patient_medications(patient_id);

-- 5. Digital Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id                      TEXT PRIMARY KEY,
    prescription_number     TEXT UNIQUE NOT NULL,
    consultation_id         TEXT,
    appointment_id          TEXT,
    doctor_id               TEXT NOT NULL,
    patient_id              TEXT NOT NULL,
    status                  TEXT NOT NULL CHECK(status IN ('draft', 'finalized', 'cancelled')) DEFAULT 'draft',
    clinical_assessment     TEXT,
    diagnosis               TEXT,
    follow_up_date          TEXT,
    general_instructions    TEXT,
    finalized_at            TIMESTAMP,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(consultation_id) REFERENCES consultation_records(id) ON DELETE SET NULL,
    FOREIGN KEY(appointment_id)  REFERENCES appointments(id)         ON DELETE SET NULL,
    FOREIGN KEY(doctor_id)       REFERENCES doctors(id)              ON DELETE RESTRICT,
    FOREIGN KEY(patient_id)      REFERENCES patients(id)             ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor  ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_number  ON prescriptions(prescription_number);

-- 6. Prescription Medicine Items
CREATE TABLE IF NOT EXISTS prescription_items (
    id                  TEXT PRIMARY KEY,
    prescription_id     TEXT NOT NULL,
    medicine_name       TEXT NOT NULL,
    dosage              TEXT NOT NULL,
    frequency           TEXT NOT NULL,
    duration            TEXT NOT NULL,
    instructions        TEXT,
    item_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rx_items_prescription ON prescription_items(prescription_id);

-- 7. Medical Documents Storage
CREATE TABLE IF NOT EXISTS medical_documents (
    id                  TEXT PRIMARY KEY,
    patient_id          TEXT NOT NULL,
    uploaded_by_user_id TEXT NOT NULL,
    title               TEXT NOT NULL,
    category            TEXT NOT NULL CHECK(category IN (
                            'laboratory_report',
                            'dermatology_report',
                            'medical_image',
                            'previous_prescription',
                            'medical_certificate',
                            'other'
                        )),
    file_name           TEXT NOT NULL,
    file_path           TEXT NOT NULL,
    mime_type           TEXT NOT NULL,
    file_size_bytes     INTEGER NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id)         REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_med_docs_patient ON medical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_med_docs_category ON medical_documents(category);

-- 8. Clinical Records Audit Log (preserves audit trail for medical edits)
CREATE TABLE IF NOT EXISTS clinical_record_audit_logs (
    id                  TEXT PRIMARY KEY,
    record_type         TEXT NOT NULL, -- 'medical_profile', 'allergy', 'condition', 'medication', 'prescription'
    record_id           TEXT NOT NULL,
    patient_id          TEXT NOT NULL,
    action              TEXT NOT NULL, -- 'created', 'updated', 'finalized', 'cancelled', 'deleted'
    performed_by_user_id TEXT NOT NULL,
    previous_data       TEXT,          -- JSON snapshot before modification
    new_data            TEXT,          -- JSON snapshot after modification
    reason              TEXT,
    ip_address          TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id)           REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY(performed_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_clinical_audit_record ON clinical_record_audit_logs(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_clinical_audit_patient ON clinical_record_audit_logs(patient_id);
