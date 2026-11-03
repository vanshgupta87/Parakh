import time
from collections import defaultdict
from fastapi import HTTPException, status

# In-memory rate limiting records: key -> list of timestamps
_attempts = defaultdict(list)

def check_rate_limit(key: str, max_attempts: int = 5, window_seconds: int = 300):
    """
    Checks if `key` has exceeded `max_attempts` within `window_seconds`.
    Raises HTTP 429 Too Many Requests if exceeded.
    """
    now = time.time()
    history = _attempts[key]
    
    # Filter out timestamps outside window
    recent = [t for t in history if now - t < window_seconds]
    _attempts[key] = recent

    if len(recent) >= max_attempts:
        retry_after = int(window_seconds - (now - recent[0]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Please try again in {max(1, retry_after)} seconds."
        )

def record_attempt(key: str):
    """Records an attempt for `key`."""
    _attempts[key].append(time.time())

def clear_attempts(key: str):
    """Clears attempt history for `key` upon success."""
    if key in _attempts:
        del _attempts[key]
