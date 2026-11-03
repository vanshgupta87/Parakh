import secrets
import hashlib
import uuid
from datetime import datetime, timezone

def generate_secure_token() -> str:
    """Generates a cryptographically secure 256-bit URL-safe token."""
    return secrets.token_urlsafe(32)

def hash_token(raw_token: str) -> str:
    """Returns SHA-256 hash hex string of the given raw token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

def generate_id(prefix: str = "") -> str:
    """Generates a unique ID with an optional prefix."""
    uid = str(uuid.uuid4())
    return f"{prefix}_{uid}" if prefix else uid

def generate_patient_id() -> str:
    """Generates a human-friendly unique patient identifier: PRK-YYYY-XXXXX"""
    year = datetime.now(timezone.utc).year
    rand = secrets.randbelow(90000) + 10000
    return f"PRK-{year}-{rand}"
