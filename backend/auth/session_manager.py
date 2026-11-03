import os
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional
from database.db import get_db
from auth.tokens import generate_secure_token, hash_token, generate_id

SESSION_COOKIE_NAME = "parakh_session"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0") == "1"
COOKIE_SAMESITE = "lax"

DEFAULT_SESSION_DAYS = 7
REMEMBER_ME_DAYS = 30

def create_session(
    user_id: str,
    remember_me: bool = False,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    conn: Optional[sqlite3.Connection] = None
) -> tuple[str, datetime]:
    """
    Creates a new server-side session. Returns (raw_session_token, expires_at).
    Stores only the SHA-256 hash of the session token in the database.
    """
    raw_token = generate_secure_token()
    token_hash = hash_token(raw_token)
    session_id = generate_id("sess")

    duration = timedelta(days=REMEMBER_ME_DAYS if remember_me else DEFAULT_SESSION_DAYS)
    expires_at = datetime.now(timezone.utc) + duration

    sql = """
    INSERT INTO sessions (id, user_id, session_identifier_hash, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """
    params = (session_id, user_id, token_hash, ip_address, user_agent, expires_at.isoformat())

    if conn is not None:
        conn.execute(sql, params)
    else:
        with get_db() as db:
            db.execute(sql, params)

    return raw_token, expires_at

def get_user_from_session(raw_token: str) -> Optional[dict]:
    """
    Validates session token. Returns dict containing user info if valid, else None.
    """
    if not raw_token:
        return None

    token_hash = hash_token(raw_token)
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        row = db.execute(
            """
            SELECT s.id AS session_id, s.expires_at, s.revoked_at,
                   u.id, u.full_name, u.email, u.phone, u.role,
                   u.email_verified, u.account_status, u.created_at, u.last_login
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_identifier_hash = ?
            """,
            (token_hash,)
        ).fetchone()

        if not row:
            return None

        # Check if revoked or expired
        if row["revoked_at"] is not None:
            return None

        if row["expires_at"] < now_iso:
            return None

        user_dict = dict(row)
        return user_dict

def revoke_session(raw_token: str, conn: Optional[sqlite3.Connection] = None) -> bool:
    """Revokes a specific session."""
    if not raw_token:
        return False
    token_hash = hash_token(raw_token)
    now_iso = datetime.now(timezone.utc).isoformat()
    sql = "UPDATE sessions SET revoked_at = ? WHERE session_identifier_hash = ? AND revoked_at IS NULL"
    params = (now_iso, token_hash)

    if conn is not None:
        conn.execute(sql, params)
    else:
        with get_db() as db:
            db.execute(sql, params)
    return True

def revoke_all_user_sessions(user_id: str, conn: Optional[sqlite3.Connection] = None) -> int:
    """Revokes all active sessions for a user (useful upon password reset)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    sql = "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL"
    params = (now_iso, user_id)

    if conn is not None:
        cursor = conn.execute(sql, params)
        return cursor.rowcount
    else:
        with get_db() as db:
            cursor = db.execute(sql, params)
            return cursor.rowcount
