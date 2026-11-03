-- PARAKH Step 2 Phase 4 Database Schema
-- AI Reports Attachment & Notifications

PRAGMA foreign_keys = ON;

-- 1. AI REPORTS
CREATE TABLE IF NOT EXISTS ai_reports (
    id                  TEXT PRIMARY KEY,
    patient_id          TEXT NOT NULL,
    image_data          TEXT,           -- base64 or stored image reference
    prediction          TEXT NOT NULL,
    confidence          REAL NOT NULL,
    risk_score          INTEGER NOT NULL,
    risk_level          TEXT NOT NULL,
    recommendation      TEXT,
    yolo_detection      TEXT,           -- JSON/detection data if present
    heatmap_data        TEXT,           -- Grad-CAM visualization base64/reference
    probabilities       TEXT,           -- JSON breakdown
    clinical_metadata   TEXT,           -- JSON (anatomical site, elevation, etc.)
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_patient ON ai_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_created ON ai_reports(created_at);

-- 2. APPOINTMENT AI REPORT ATTACHMENTS
CREATE TABLE IF NOT EXISTS appointment_ai_reports (
    id                  TEXT PRIMARY KEY,
    appointment_id      TEXT NOT NULL,
    report_id           TEXT NOT NULL,
    notes               TEXT,
    attached_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY(report_id) REFERENCES ai_reports(id) ON DELETE CASCADE,
    UNIQUE(appointment_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_appt_reports_appt   ON appointment_ai_reports(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appt_reports_report ON appointment_ai_reports(report_id);

-- 3. IN-APP NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    type        TEXT NOT NULL CHECK(type IN (
                    'appointment_request',
                    'appointment_confirmed',
                    'appointment_rejected',
                    'appointment_cancelled',
                    'reschedule_request',
                    'reschedule_confirmed',
                    'reschedule_rejected',
                    'appointment_reminder',
                    'system'
                )),
    link        TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
