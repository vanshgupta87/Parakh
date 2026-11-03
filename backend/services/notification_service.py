"""
PARAKH (परख) - In-App & Email Notification Service
Manages real-time platform notifications without leaking sensitive PHI in previews.
"""

import sqlite3
from datetime import datetime, timezone
from typing import Optional
from database.db import get_db
from auth.tokens import generate_id
from services.email_service import send_email

def create_notification(
    user_id: str,
    title: str,
    message: str,
    notif_type: str,
    link: Optional[str] = None,
    send_email_alert: bool = True,
    conn: Optional[sqlite3.Connection] = None
) -> str:
    """
    Creates an in-app notification for user_id and optionally dispatches an email alert.
    Can reuse an existing database connection/transaction via `conn`.
    """
    notif_id = generate_id("ntf")
    now_iso = datetime.now(timezone.utc).isoformat()

    def _execute(db):
        db.execute(
            """
            INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (notif_id, user_id, title, message, notif_type, link, now_iso)
        )

        if send_email_alert:
            user = db.execute("SELECT email, full_name FROM users WHERE id = ?", (user_id,)).fetchone()
            if user:
                subject = f"PARAKH: {title}"
                action_url = link or "http://localhost:5173"
                if action_url.startswith("/"):
                    action_url = f"http://localhost:5173{action_url}"

                plain_body = (
                    f"Hello {user['full_name']},\n\n"
                    f"{message}\n\n"
                    f"View & Take Action: {action_url}\n\n"
                    f"Best regards,\n"
                    f"PARAKH Healthcare Team\n"
                    f"AI-Powered Dermatology & Clinical System"
                )
                html_body = f"""
                <html>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B1120; color: #E2E8F0; padding: 24px;">
                    <div style="max-width: 580px; margin: 0 auto; background: #0F172A; border: 1px solid #1E293B; border-radius: 12px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                      <div style="border-bottom: 1px solid #1E293B; padding-bottom: 16px; margin-bottom: 20px;">
                        <h2 style="color: #10B981; margin: 0; font-size: 22px; letter-spacing: -0.5px;">PARAKH (परख)</h2>
                        <span style="color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Clinical Alert System</span>
                      </div>
                      <h3 style="color: #F8FAFC; margin-top: 0; margin-bottom: 12px; font-size: 18px;">{title}</h3>
                      <p style="color: #CBD5E1; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">{message}</p>
                      <div style="margin: 28px 0; text-align: left;">
                        <a href="{action_url}" style="background-color: #10B981; color: #022C22; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 24px; border-radius: 8px; display: inline-block;">
                          Open PARAKH Portal &rarr;
                        </a>
                      </div>
                      <p style="color: #64748B; font-size: 12px; margin-top: 24px; border-top: 1px solid #1E293B; padding-top: 16px;">
                        Or copy and paste this URL into your browser:<br/>
                        <a href="{action_url}" style="color: #38BDF8; word-break: break-all;">{action_url}</a>
                      </p>
                      <p style="color: #475569; font-size: 11px; margin-top: 12px;">This is an automated notification from the PARAKH healthcare platform.</p>
                    </div>
                  </body>
                </html>
                """
                send_email(user["email"], subject, html_body, plain_body)

    if conn is not None:
        _execute(conn)
    else:
        with get_db() as db:
            _execute(db)

    return notif_id
