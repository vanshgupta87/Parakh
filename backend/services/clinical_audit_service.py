"""
PARAKH (परख) - Clinical Audit Service
Tracks all creation, modification, and finalization of medical records,
prescriptions, and documents to ensure complete regulatory compliance and non-repudiation.
"""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Any
from database.db import get_db
from auth.tokens import generate_id

def log_clinical_audit(
    record_type: str,
    record_id: str,
    patient_id: str,
    action: str,
    performed_by_user_id: str,
    previous_data: Optional[Any] = None,
    new_data: Optional[Any] = None,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    conn: Optional[sqlite3.Connection] = None
) -> str:
    """
    Logs an immutable clinical record audit event.
    """
    audit_id = generate_id("caud")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    prev_json = json.dumps(previous_data, default=str) if previous_data is not None else None
    new_json = json.dumps(new_data, default=str) if new_data is not None else None

    query = """
    INSERT INTO clinical_record_audit_logs 
    (id, record_type, record_id, patient_id, action, performed_by_user_id, previous_data, new_data, reason, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (
        audit_id, record_type, record_id, patient_id, action,
        performed_by_user_id, prev_json, new_json, reason, ip_address, now_iso
    )

    if conn is not None:
        conn.execute(query, params)
    else:
        with get_db() as db:
            db.execute(query, params)

    return audit_id
