import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from database.db import get_db
from auth.hasher import hash_password, verify_password, validate_password_strength
from auth.tokens import generate_secure_token, hash_token, generate_id, generate_patient_id
from auth.session_manager import (
    create_session, revoke_session, revoke_all_user_sessions,
    SESSION_COOKIE_NAME, COOKIE_SECURE, COOKIE_SAMESITE
)
from auth.dependencies import get_current_user, require_active_user
from auth.rate_limiter import check_rate_limit, record_attempt, clear_attempts
from services.email_service import send_verification_email, send_password_reset_email
from services.audit_service import log_audit_event

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"
EXPOSE_DEV_TOKENS = (not IS_PRODUCTION) and os.getenv("EXPOSE_DEV_AUTH_TOKENS", "1") == "1"

# ==================== SCHEMAS ====================

EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

class PatientRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=EMAIL_REGEX)
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: str = Field(..., description="YYYY-MM-DD")
    gender: Optional[str] = Field(None, pattern="^(male|female|other|prefer_not_to_say)$")
    password: str = Field(..., min_length=8)
    confirm_password: str

class DoctorRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=EMAIL_REGEX)
    phone: Optional[str] = Field(None, max_length=20)
    password: str = Field(..., min_length=8)
    confirm_password: str
    medical_registration_number: str = Field(..., min_length=3, max_length=50)
    qualification: str = Field(..., min_length=2, max_length=100)
    specialization: str = Field(..., min_length=2, max_length=100)
    experience_years: int = Field(0, ge=0, le=70)
    clinic_name: str = Field(..., min_length=2, max_length=150)
    clinic_address: str = Field(..., min_length=5, max_length=300)
    profile_image: Optional[str] = None
    professional_bio: Optional[str] = Field(None, max_length=2000)

class LoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str
    remember_me: bool = False

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

class VerifyEmailRequest(BaseModel):
    token: str

# ==================== HELPERS ====================

def set_auth_cookie(response: Response, raw_token: str, expires_at: datetime):
    max_age = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=max_age,
        expires=expires_at.strftime("%a, %d %b %Y %H:%M:%S GMT"),
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE
    )

def clear_auth_cookie(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE
    )

# ==================== ENDPOINTS ====================

@router.post("/register/patient", status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientRegisterRequest, request: Request):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    is_valid, msg = validate_password_strength(payload.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    # Validate DOB format YYYY-MM-DD
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", payload.date_of_birth):
        raise HTTPException(status_code=400, detail="Date of birth must be in YYYY-MM-DD format.")

    email_clean = payload.email.lower().strip()
    client_ip = request.client.host if request.client else None

    with get_db() as db:
        # Check duplicate email
        existing = db.execute("SELECT id FROM users WHERE email = ?", (email_clean,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="An account with this email address already exists.")

        user_id = generate_id("usr")
        patient_id = generate_id("pat")
        patient_unique_num = generate_patient_id()
        pw_hash = hash_password(payload.password)

        # Create user
        db.execute(
            """
            INSERT INTO users (id, full_name, email, phone, password_hash, role, email_verified, account_status)
            VALUES (?, ?, ?, ?, ?, 'patient', 0, 'active')
            """,
            (user_id, payload.full_name.strip(), email_clean, payload.phone, pw_hash)
        )

        # Create patient record
        db.execute(
            """
            INSERT INTO patients (id, user_id, date_of_birth, gender, patient_unique_id)
            VALUES (?, ?, ?, ?, ?)
            """,
            (patient_id, user_id, payload.date_of_birth, payload.gender, patient_unique_num)
        )

        # Generate email verification token
        raw_verify_token = generate_secure_token()
        token_hash = hash_token(raw_verify_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        db.execute(
            """
            INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (generate_id("vtok"), user_id, token_hash, expires_at.isoformat())
        )

        log_audit_event("patient_registered", actor_user_id=user_id, target_user_id=user_id, ip_address=client_ip, conn=db)

    # Send verification link
    verify_url = send_verification_email(email_clean, payload.full_name, raw_verify_token)

    res_data = {
        "status": "success",
        "message": "Registration successful. Please verify your email address.",
        "user_id": user_id,
        "patient_id": patient_unique_num
    }
    if EXPOSE_DEV_TOKENS:
        res_data["dev_verification_url"] = verify_url

    return res_data

@router.post("/register/doctor", status_code=status.HTTP_201_CREATED)
def register_doctor(payload: DoctorRegisterRequest, request: Request):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    is_valid, msg = validate_password_strength(payload.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    email_clean = payload.email.lower().strip()
    client_ip = request.client.host if request.client else None

    with get_db() as db:
        # Check duplicate email
        existing = db.execute("SELECT id FROM users WHERE email = ?", (email_clean,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="An account with this email address already exists.")

        user_id = generate_id("usr")
        doctor_id = generate_id("doc")
        pw_hash = hash_password(payload.password)

        # Doctors start with pending_verification status
        db.execute(
            """
            INSERT INTO users (id, full_name, email, phone, password_hash, role, email_verified, account_status)
            VALUES (?, ?, ?, ?, ?, 'doctor', 0, 'pending_verification')
            """,
            (user_id, payload.full_name.strip(), email_clean, payload.phone, pw_hash)
        )

        db.execute(
            """
            INSERT INTO doctors (
                id, user_id, medical_registration_number, qualification,
                specialization, experience_years, clinic_name, clinic_address,
                profile_image, professional_bio, verification_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            """,
            (
                doctor_id, user_id, payload.medical_registration_number.strip(),
                payload.qualification.strip(), payload.specialization.strip(),
                payload.experience_years, payload.clinic_name.strip(),
                payload.clinic_address.strip(), payload.profile_image,
                payload.professional_bio
            )
        )

        # Generate email verification token
        raw_verify_token = generate_secure_token()
        token_hash = hash_token(raw_verify_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        db.execute(
            """
            INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (generate_id("vtok"), user_id, token_hash, expires_at.isoformat())
        )

        log_audit_event("doctor_registered", actor_user_id=user_id, target_user_id=user_id, ip_address=client_ip, conn=db)

    verify_url = send_verification_email(email_clean, payload.full_name, raw_verify_token)

    res_data = {
        "status": "success",
        "message": "Doctor registration submitted successfully. Please verify your email and await administrator credential review.",
        "user_id": user_id,
        "verification_status": "pending"
    }
    if EXPOSE_DEV_TOKENS:
        res_data["dev_verification_url"] = verify_url

    return res_data

@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{payload.email.lower()}"
    check_rate_limit(rate_key, max_attempts=5, window_seconds=300)

    email_clean = payload.email.lower().strip()

    with get_db() as db:
        user_row = db.execute(
            """
            SELECT id, full_name, email, password_hash, role, email_verified, account_status
            FROM users WHERE email = ?
            """,
            (email_clean,)
        ).fetchone()

        if not user_row or not verify_password(payload.password, user_row["password_hash"]):
            record_attempt(rate_key)
            log_audit_event("login_failed", actor_user_id=None, ip_address=client_ip, metadata={"email": email_clean})
            raise HTTPException(status_code=401, detail="Invalid email address or password.")

        # Check account status
        user_id = user_row["id"]
        role = user_row["role"]
        status_val = user_row["account_status"]

        if status_val == "suspended":
            record_attempt(rate_key)
            raise HTTPException(status_code=403, detail="Your account has been suspended by an administrator. Please contact support.")

        if status_val == "rejected":
            record_attempt(rate_key)
            raise HTTPException(status_code=403, detail="Your account application has been rejected by administration.")

        # Check doctor verification details if doctor
        doc_verification = None
        if role == "doctor":
            doc_row = db.execute("SELECT verification_status, rejection_reason FROM doctors WHERE user_id = ?", (user_id,)).fetchone()
            if doc_row:
                doc_verification = doc_row["verification_status"]

        # Clear failed attempts on success
        clear_attempts(rate_key)

        # Check if default admin password is in use
        requires_password_change = False
        if role == "admin" and verify_password("Admin@Parakh2026!", user_row["password_hash"]):
            requires_password_change = True

        # Update last_login
        now_iso = datetime.now(timezone.utc).isoformat()
        db.execute("UPDATE users SET last_login = ? WHERE id = ?", (now_iso, user_id))

        # Create session
        user_agent = request.headers.get("user-agent", "")
        raw_token, expires_at = create_session(user_id, remember_me=payload.remember_me, ip_address=client_ip, user_agent=user_agent, conn=db)

        log_audit_event("login_success", actor_user_id=user_id, target_user_id=user_id, ip_address=client_ip, conn=db)

    # Set HttpOnly cookie
    set_auth_cookie(response, raw_token, expires_at)

    return {
        "status": "success",
        "message": "Login successful.",
        "user": {
            "id": user_row["id"],
            "full_name": user_row["full_name"],
            "email": user_row["email"],
            "role": user_row["role"],
            "email_verified": bool(user_row["email_verified"]),
            "account_status": user_row["account_status"],
            "doctor_verification_status": doc_verification,
            "requires_password_change": requires_password_change
        },
        "session_token": raw_token
    }

@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

    if token:
        revoke_session(token)

    clear_auth_cookie(response)
    return {"status": "success", "message": "Logged out successfully."}

@router.get("/me")
def get_current_user_profile(user: dict = Depends(get_current_user)):
    """Returns currently authenticated user profile with role-specific details."""
    # Sanitize password hash out of dictionary
    safe_user = {k: v for k, v in user.items() if k not in ("password_hash", "session_identifier_hash")}
    return {"status": "success", "user": safe_user}

@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, request: Request):
    client_ip = request.client.host if request.client else None
    token_hash = hash_token(payload.token.strip())
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        token_row = db.execute(
            """
            SELECT id, user_id, expires_at, used_at
            FROM email_verification_tokens
            WHERE token_hash = ?
            """,
            (token_hash,)
        ).fetchone()

        if not token_row:
            raise HTTPException(status_code=400, detail="Invalid verification link or token.")

        if token_row["used_at"] is not None:
            raise HTTPException(status_code=400, detail="This email verification link has already been used.")

        if token_row["expires_at"] < now_iso:
            raise HTTPException(status_code=400, detail="This verification link has expired. Please request a new one.")

        user_id = token_row["user_id"]
        # Mark token used
        db.execute("UPDATE email_verification_tokens SET used_at = ? WHERE id = ?", (now_iso, token_row["id"]))
        # Mark user verified
        db.execute("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?", (now_iso, user_id))

        log_audit_event("email_verified", actor_user_id=user_id, target_user_id=user_id, ip_address=client_ip, conn=db)

    return {"status": "success", "message": "Your email address has been verified successfully. You may now log in."}

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request):
    email_clean = payload.email.lower().strip()
    client_ip = request.client.host if request.client else None

    # Enforce basic rate limit on forgot password to avoid flooding
    check_rate_limit(f"pwd_reset:{email_clean}", max_attempts=3, window_seconds=300)

    reset_url = None
    with get_db() as db:
        user_row = db.execute("SELECT id, full_name, email FROM users WHERE email = ?", (email_clean,)).fetchone()
        if user_row:
            raw_token = generate_secure_token()
            token_hash = hash_token(raw_token)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

            db.execute(
                """
                INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (generate_id("rtok"), user_row["id"], token_hash, expires_at.isoformat())
            )
            log_audit_event("password_reset_requested", actor_user_id=user_row["id"], ip_address=client_ip, conn=db)
            reset_url = send_password_reset_email(user_row["email"], user_row["full_name"], raw_token)

    res_data = {
        "status": "success",
        "message": "If an account exists with that email address, a password reset link has been dispatched."
    }
    if EXPOSE_DEV_TOKENS and reset_url:
        res_data["dev_reset_url"] = reset_url

    return res_data

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    is_valid, msg = validate_password_strength(payload.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    client_ip = request.client.host if request.client else None
    token_hash = hash_token(payload.token.strip())
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        token_row = db.execute(
            """
            SELECT id, user_id, expires_at, used_at
            FROM password_reset_tokens
            WHERE token_hash = ?
            """,
            (token_hash,)
        ).fetchone()

        if not token_row:
            raise HTTPException(status_code=400, detail="Invalid password reset link.")

        if token_row["used_at"] is not None:
            raise HTTPException(status_code=400, detail="This password reset link has already been used.")

        if token_row["expires_at"] < now_iso:
            raise HTTPException(status_code=400, detail="This password reset link has expired.")

        user_id = token_row["user_id"]
        new_pw_hash = hash_password(payload.new_password)

        # Update password
        db.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", (new_pw_hash, now_iso, user_id))
        # Mark token used
        db.execute("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?", (now_iso, token_row["id"]))

        # Revoke all existing sessions for security
        revoke_all_user_sessions(user_id, conn=db)

        log_audit_event("password_reset_completed", actor_user_id=user_id, target_user_id=user_id, ip_address=client_ip, conn=db)

    return {"status": "success", "message": "Password reset successfully. Please log in with your new password."}

@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, current_user: dict = Depends(require_active_user)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match.")

    is_valid, msg = validate_password_strength(payload.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    user_id = current_user["id"]
    with get_db() as db:
        row = db.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row or not verify_password(payload.current_password, row["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")

        new_hash = hash_password(payload.new_password)
        now_iso = datetime.now(timezone.utc).isoformat()
        db.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", (new_hash, now_iso, user_id))

        log_audit_event("password_changed", actor_user_id=user_id, target_user_id=user_id, conn=db)

    return {"status": "success", "message": "Password updated successfully."}
