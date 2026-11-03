import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

def _load_env_file():
    """Lightweight .env loader without third-party dependencies."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

_load_env_file()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
DEV_EMAIL_LOG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dev_emails.log")
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"

def send_email(to_email: str, subject: str, html_body: str, plain_text: str) -> bool:
    """
    Sends an email using configured SMTP (e.g. Gmail App Password).
    If SMTP credentials are missing or unreachable, safely logs the formatted
    email to dev_emails.log so that application workflows continue without interruption.
    """
    _load_env_file()
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "").strip()
    if not smtp_from:
        smtp_from = f"PARAKH Healthcare <{smtp_user}>" if smtp_user else "no-reply@parakh-health.org"

    if smtp_host and smtp_user and smtp_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = to_email

            part1 = MIMEText(plain_text, "plain")
            part2 = MIMEText(html_body, "html")
            msg.attach(part1)
            msg.attach(part2)

            if smtp_port == 465:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12) as server:
                    server.login(smtp_user, smtp_password)
                    server.sendmail(smtp_from, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.sendmail(smtp_from, [to_email], msg.as_string())

            print(f"[LIVE EMAIL DELIVERED] Real email dispatched to {to_email}: '{subject}'")
            return True
        except Exception as e:
            print(f"[EMAIL WARNING] Live SMTP delivery to {to_email} failed: {e}. Falling back to dev logger.")
            if IS_PRODUCTION:
                return False

    if IS_PRODUCTION:
        print(f"[EMAIL WARNING] Production mode active but SMTP is not configured. Email to {to_email} not dispatched.")
        return False

    # Development mode logging
    timestamp = datetime.now(timezone.utc).isoformat()
    log_entry = (
        f"\n{'='*70}\n"
        f"TIMESTAMP: {timestamp}\n"
        f"TO:        {to_email}\n"
        f"FROM:      {smtp_from}\n"
        f"SUBJECT:   {subject}\n"
        f"BODY:\n{plain_text}\n"
        f"{'='*70}\n"
    )
    try:
        with open(DEV_EMAIL_LOG, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception:
        pass

    print(f"[DEV EMAIL LOGGED] Email to {to_email}: {subject}")
    return True

def send_verification_email(to_email: str, user_name: str, raw_token: str) -> str:
    """Sends account verification link."""
    verify_url = f"{FRONTEND_URL}/verify-email?token={raw_token}"
    subject = "Verify your PARAKH account"
    plain_text = (
        f"Hello {user_name},\n\n"
        f"Thank you for registering on PARAKH (परख) — AI-Powered Dermatology Platform.\n\n"
        f"Please verify your email address by opening the following link:\n"
        f"{verify_url}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"Best regards,\n"
        f"The PARAKH Team"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0B1120; color: #E2E8F0; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background: #0F172A; border: 1px solid #1E293B; border-radius: 12px; padding: 32px;">
          <h2 style="color: #10B981; margin-top: 0;">PARAKH (परख)</h2>
          <p style="font-size: 16px;">Hello {user_name},</p>
          <p style="color: #94A3B8; font-size: 14px;">Welcome to PARAKH. Please verify your email address to activate your account:</p>
          <div style="margin: 28px 0; text-align: center;">
            <a href="{verify_url}" style="background-color: #10B981; color: #022C22; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #64748B; font-size: 12px;">Or copy and paste this URL into your browser:<br/><a href="{verify_url}" style="color: #38BDF8;">{verify_url}</a></p>
          <p style="color: #64748B; font-size: 12px; margin-top: 24px;">This link will expire in 24 hours.</p>
        </div>
      </body>
    </html>
    """
    send_email(to_email, subject, html_body, plain_text)
    return verify_url

def send_password_reset_email(to_email: str, user_name: str, raw_token: str) -> str:
    """Sends password reset link."""
    reset_url = f"{FRONTEND_URL}/reset-password?token={raw_token}"
    subject = "Reset your PARAKH password"
    plain_text = (
        f"Hello {user_name},\n\n"
        f"We received a request to reset your password for your PARAKH account.\n\n"
        f"Reset your password by visiting this link:\n"
        f"{reset_url}\n\n"
        f"This link expires in 1 hour. If you did not make this request, please ignore this email.\n\n"
        f"Best regards,\n"
        f"The PARAKH Security Team"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0B1120; color: #E2E8F0; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background: #0F172A; border: 1px solid #1E293B; border-radius: 12px; padding: 32px;">
          <h2 style="color: #10B981; margin-top: 0;">PARAKH (परख)</h2>
          <p style="font-size: 16px;">Hello {user_name},</p>
          <p style="color: #94A3B8; font-size: 14px;">We received a request to reset your password. Click below to choose a new password:</p>
          <div style="margin: 28px 0; text-align: center;">
            <a href="{reset_url}" style="background-color: #10B981; color: #022C22; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748B; font-size: 12px;">Or copy and paste this URL into your browser:<br/><a href="{reset_url}" style="color: #38BDF8;">{reset_url}</a></p>
          <p style="color: #64748B; font-size: 12px; margin-top: 24px;">This single-use link will expire in 1 hour.</p>
        </div>
      </body>
    </html>
    """
    send_email(to_email, subject, html_body, plain_text)
    return reset_url
