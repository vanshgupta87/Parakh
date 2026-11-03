import os
import sys
from datetime import datetime, timezone
from database.db import get_db, init_db
from auth.hasher import hash_password, verify_password
from auth.tokens import generate_id
from services.audit_service import log_audit_event

DEFAULT_ADMIN_EMAIL = "admin@parakh.org"
DEFAULT_ADMIN_PASSWORD = "Admin@Parakh2026!"

def seed_admin(
    email: str = None,
    password: str = None,
    full_name: str = "System Administrator",
    phone: str = "+91 9999999999",
    force: bool = False
):
    """
    Seeds or maintains the primary system administrator account.
    Reads credentials from environment variables if not passed explicitly:
    - ADMIN_EMAIL (default: admin@parakh.org)
    - ADMIN_PASSWORD (default: Admin@Parakh2026!)
    - FORCE_ADMIN_RESET=1 (required to overwrite an existing admin password)
    """
    admin_email = (email or os.getenv("ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL)).lower().strip()
    admin_password = password or os.getenv("ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)
    should_force = force or os.getenv("FORCE_ADMIN_RESET") == "1"

    init_db()

    with get_db() as db:
        existing = db.execute("SELECT id, role, password_hash FROM users WHERE email = ?", (admin_email,)).fetchone()
        now_iso = datetime.now(timezone.utc).isoformat()

        if existing:
            # Check if default password is in use
            is_default = verify_password(DEFAULT_ADMIN_PASSWORD, existing["password_hash"])
            if is_default:
                print(f"[SECURITY WARNING] Administrator {admin_email} is using the DEFAULT password. Rotate immediately in production.")

            if should_force:
                pw_hash = hash_password(admin_password)
                db.execute(
                    """
                    UPDATE users
                    SET full_name = ?, password_hash = ?, role = 'admin', email_verified = 1,
                        account_status = 'active', updated_at = ?
                    WHERE id = ?
                    """,
                    (full_name, pw_hash, now_iso, existing["id"])
                )
                print(f"[OK] Administrator credentials forcibly rotated: {admin_email}")
                log_audit_event("admin_updated", actor_user_id=existing["id"], target_user_id=existing["id"], conn=db)
            else:
                # Safe mode: preserve existing administrator credentials
                print(f"[INFO] Administrator {admin_email} already exists. Existing credentials preserved (use --force or FORCE_ADMIN_RESET=1 to rotate).")

            return existing["id"]
        else:
            if admin_password == DEFAULT_ADMIN_PASSWORD:
                print(f"[SECURITY WARNING] Creating administrator with DEFAULT password. Rotate before production deployment.")

            pw_hash = hash_password(admin_password)
            admin_id = generate_id("adm")
            db.execute(
                """
                INSERT INTO users (id, full_name, email, phone, password_hash, role, email_verified, account_status)
                VALUES (?, ?, ?, ?, ?, 'admin', 1, 'active')
                """,
                (admin_id, full_name, admin_email, phone, pw_hash)
            )
            print(f"[OK] Initial administrator account created successfully: {admin_email}")
            log_audit_event("admin_seeded", actor_user_id=admin_id, target_user_id=admin_id, conn=db)
            return admin_id

if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    clean_args = [a for a in sys.argv[1:] if a != "--force"]
    email_arg = clean_args[0] if len(clean_args) > 0 else None
    pass_arg = clean_args[1] if len(clean_args) > 1 else None
    seed_admin(email=email_arg, password=pass_arg, force=force_flag)
