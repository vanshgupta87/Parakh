-- PARAKH Step 2 — Appointment Management Schema Extension
-- Safe: all CREATE TABLE IF NOT EXISTS, never drops existing tables.

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. DOCTOR AVAILABILITY
-- Stores recurring weekly availability windows per doctor.
-- day_of_week: 0=Monday … 6=Sunday
-- slot_duration_minutes: length of each bookable slot (e.g. 15/20/30/60)
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_availability (
    id                     TEXT PRIMARY KEY,
    doctor_id              TEXT NOT NULL,
    day_of_week            INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time             TEXT NOT NULL,   -- "HH:MM" 24-hr
    end_time               TEXT NOT NULL,   -- "HH:MM" 24-hr, must be > start_time
    slot_duration_minutes  INTEGER NOT NULL DEFAULT 30 CHECK(slot_duration_minutes IN (10,15,20,30,45,60)),
    is_active              INTEGER NOT NULL DEFAULT 1,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    -- No two active windows for the same doctor/day may share overlapping times.
    -- Overlap is enforced in application code (SQLite has no range exclusion).
    UNIQUE(doctor_id, day_of_week, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_availability_doctor ON doctor_availability(doctor_id);
CREATE INDEX IF NOT EXISTS idx_availability_day    ON doctor_availability(doctor_id, day_of_week);

-- ============================================================
-- 2. DOCTOR UNAVAILABLE DATES
-- Blocks specific calendar dates (holidays, leave, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_unavailable_dates (
    id          TEXT PRIMARY KEY,
    doctor_id   TEXT NOT NULL,
    date        TEXT NOT NULL,   -- "YYYY-MM-DD"
    reason      TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    UNIQUE(doctor_id, date)
);

CREATE INDEX IF NOT EXISTS idx_unavailable_doctor ON doctor_unavailable_dates(doctor_id);
CREATE INDEX IF NOT EXISTS idx_unavailable_date   ON doctor_unavailable_dates(doctor_id, date);

-- ============================================================
-- 3. APPOINTMENTS
-- Core booking table.
-- slot_start / slot_end stored as "YYYY-MM-DD HH:MM"
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
    id              TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL,   -- FK → patients.id
    doctor_id       TEXT NOT NULL,   -- FK → doctors.id
    appointment_date TEXT NOT NULL,  -- "YYYY-MM-DD"
    slot_start      TEXT NOT NULL,   -- "HH:MM"
    slot_end        TEXT NOT NULL,   -- "HH:MM"
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','rescheduled','no_show')),
    reason_for_visit TEXT,
    notes           TEXT,            -- doctor can add notes
    rejection_reason TEXT,
    cancelled_by    TEXT,            -- 'patient' | 'doctor' | 'admin'
    cancellation_reason TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY(doctor_id)  REFERENCES doctors(id)  ON DELETE RESTRICT,
    -- Prevent double-booking: one patient per doctor slot per day
    UNIQUE(doctor_id, appointment_date, slot_start)
);

CREATE INDEX IF NOT EXISTS idx_appt_patient       ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_doctor        ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_date          ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appt_status        ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appt_doctor_date   ON appointments(doctor_id, appointment_date);

-- ============================================================
-- 4. APPOINTMENT RESCHEDULE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_reschedule_requests (
    id                  TEXT PRIMARY KEY,
    appointment_id      TEXT NOT NULL,
    requested_by        TEXT NOT NULL,  -- user_id (patient or doctor)
    requested_by_role   TEXT NOT NULL CHECK(requested_by_role IN ('patient','doctor')),
    new_date            TEXT NOT NULL,  -- "YYYY-MM-DD"
    new_slot_start      TEXT NOT NULL,  -- "HH:MM"
    new_slot_end        TEXT NOT NULL,  -- "HH:MM"
    reason              TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','accepted','rejected')),
    responded_at        TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reschedule_appt ON appointment_reschedule_requests(appointment_id);

-- ============================================================
-- 5. CONSULTATION RECORDS
-- Linked to a completed appointment.
-- ============================================================
CREATE TABLE IF NOT EXISTS consultation_records (
    id                  TEXT PRIMARY KEY,
    appointment_id      TEXT UNIQUE NOT NULL,
    doctor_id           TEXT NOT NULL,
    patient_id          TEXT NOT NULL,
    chief_complaint     TEXT,
    clinical_notes      TEXT,
    diagnosis           TEXT,
    follow_up_date      TEXT,   -- "YYYY-MM-DD"
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY(doctor_id)      REFERENCES doctors(id)      ON DELETE RESTRICT,
    FOREIGN KEY(patient_id)     REFERENCES patients(id)     ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_consult_appointment ON consultation_records(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consult_doctor      ON consultation_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consult_patient     ON consultation_records(patient_id);
