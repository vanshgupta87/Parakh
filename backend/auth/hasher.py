import os
import re
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

# In test mode use a minimal-cost hasher to avoid slow hashing in tests
_IS_TEST = os.environ.get("PARAKH_TEST_MODE") == "1"

if _IS_TEST:
    _ph = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1, hash_len=16, salt_len=8)
else:
    # Argon2id hasher with standard secure memory and time cost
    _ph = PasswordHasher(
        time_cost=3,
        memory_cost=65536,  # 64 MB
        parallelism=4,
        hash_len=32,
        salt_len=16
    )

def hash_password(password: str) -> str:
    """Hashes a plain-text password using Argon2id."""
    return _ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against an Argon2id hash."""
    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError):
        return False
    except Exception:
        return False

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validates password complexity:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special symbol
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if len(password) > 128:
        return False, "Password must not exceed 128 characters."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number."
    if not re.search(r"[@$!%*?&#^()_\-+=\[\]{}|:;<>,./~`]", password):
        return False, "Password must contain at least one special character."
    return True, ""
