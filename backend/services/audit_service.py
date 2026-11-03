import json
import sqlite3
from typing import Optional
from database.db import get_db
from auth.tokens import generate_id

def log_audit_event(
    action: str,
    actor_user_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[dict] = None,
    conn: Optional[sqlite3.Connection] = None
):
    """
    Records an administrative or security-sensitive audit event.
    """
    event_id = generate_id("aud")
    meta_json = json.dumps(metadata) if metadata else None

    query = """
    INSERT INTO audit_logs (id, actor_user_id, action, target_user_id, ip_address, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
    """

    if conn is not None:
        conn.execute(query, (event_id, actor_user_id, action, target_user_id, ip_address, meta_json))
    else:
        with get_db() as db:
            db.execute(query, (event_id, actor_user_id, action, target_user_id, ip_address, meta_json))
