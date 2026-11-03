from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from auth.session_manager import get_user_from_session, SESSION_COOKIE_NAME
from database.db import get_db

def get_session_token_from_request(request: Request) -> Optional[str]:
    """
    Extracts session token from HttpOnly cookie, Authorization header (Bearer token),
    or query parameter 'token' for direct browser previews/downloads.
    """
    # 1. Cookie
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        return token
    # 2. Header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    # 3. Query parameter (for direct browser <a> links, <img>, or window.open)
    query_token = request.query_params.get("token")
    if query_token:
        return query_token.strip()
    return None

def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency: authenticates user via session token.
    Raises 401 Unauthorized if missing, expired, or invalid.
    """
    token = get_session_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. No active session found."
        )

    user = get_user_from_session(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is invalid or expired. Please log in again."
        )

    # Attach doctor or patient profile details if applicable
    user_id = user["id"]
    with get_db() as db:
        if user["role"] == "doctor":
            doc_row = db.execute(
                """
                SELECT id AS doctor_id, medical_registration_number, qualification,
                       specialization, experience_years, clinic_name, clinic_address,
                       profile_image, professional_bio, verification_status, verified_by,
                       verified_at, rejection_reason
                FROM doctors WHERE user_id = ?
                """,
                (user_id,)
            ).fetchone()
            if doc_row:
                user["doctor_profile"] = dict(doc_row)
        elif user["role"] == "patient":
            pat_row = db.execute(
                """
                SELECT id AS patient_id, date_of_birth, gender, patient_unique_id
                FROM patients WHERE user_id = ?
                """,
                (user_id,)
            ).fetchone()
            if pat_row:
                user["patient_profile"] = dict(pat_row)

    return user

def require_active_user(user: dict = Depends(get_current_user)) -> dict:
    """
    Ensures user account is active and not suspended or rejected.
    """
    if user["account_status"] == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended by an administrator."
        )
    if user["account_status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account application has been rejected."
        )
    return user

def require_role(*allowed_roles: str):
    """
    Role-based authorization dependency factory.
    """
    def role_checker(user: dict = Depends(require_active_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}."
            )
        return user
    return role_checker

def require_verified_doctor(user: dict = Depends(require_role("doctor"))) -> dict:
    """
    Ensures that the doctor is fully verified and approved by an admin
    before accessing sensitive clinical features.
    """
    doc_profile = user.get("doctor_profile")
    if not doc_profile or doc_profile.get("verification_status") != "approved":
        status_val = doc_profile.get("verification_status") if doc_profile else "unverified"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Doctor account is not approved (Current status: {status_val}). Clinical access denied until verified by an administrator."
        )
    return user
