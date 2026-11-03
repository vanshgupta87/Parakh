"""
PARAKH (परख) - Notifications Router
Handles user in-app notifications and unread badges.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from database.db import get_db
from auth.dependencies import require_active_user

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])

@router.get("")
def get_user_notifications(current_user: dict = Depends(require_active_user)):
    """Fetches notifications for logged-in user, along with unread count."""
    user_id = current_user["id"]
    with get_db() as db:
        rows = db.execute(
            """
            SELECT id, title, message, type, link, is_read, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (user_id,)
        ).fetchall()

        unread_count = db.execute(
            "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0",
            (user_id,)
        ).fetchone()["count"]

    return {
        "status": "success",
        "unread_count": unread_count,
        "notifications": [dict(r) for r in rows]
    }

@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: str, current_user: dict = Depends(require_active_user)):
    """Marks a single notification as read if owned by logged-in user."""
    user_id = current_user["id"]
    with get_db() as db:
        res = db.execute(
            "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
            (notification_id, user_id)
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notification not found.")

    return {"status": "success", "message": "Notification marked as read."}

@router.post("/read-all")
def mark_all_notifications_read(current_user: dict = Depends(require_active_user)):
    """Marks all notifications as read for logged-in user."""
    user_id = current_user["id"]
    with get_db() as db:
        db.execute(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
            (user_id,)
        )

    return {"status": "success", "message": "All notifications marked as read."}
