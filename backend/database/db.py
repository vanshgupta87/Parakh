import sqlite3
import os
import contextlib
from typing import Generator

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "parakh.db")
SCHEMA_PATH = os.path.join(DB_DIR, "schema.sql")

def get_db_connection() -> sqlite3.Connection:
    """
    Creates and returns a SQLite connection configured with WAL mode
    and foreign key enforcement.
    """
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

@contextlib.contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager yielding a database connection and auto-closing it.
    """
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

SCHEMA_APPOINTMENTS_PATH = os.path.join(DB_DIR, "schema_appointments.sql")
SCHEMA_PHASE4_PATH = os.path.join(DB_DIR, "schema_phase4.sql")
SCHEMA_STEP3_PATH = os.path.join(DB_DIR, "schema_step3.sql")

def init_db():
    """
    Initializes the database using schema.sql, schema_appointments.sql, schema_phase4.sql, and schema_step3.sql
    if tables do not exist. Safe to re-run — all statements use IF NOT EXISTS.
    """
    os.makedirs(DB_DIR, exist_ok=True)
    with get_db() as conn:
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        if os.path.exists(SCHEMA_APPOINTMENTS_PATH):
            with open(SCHEMA_APPOINTMENTS_PATH, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
        if os.path.exists(SCHEMA_PHASE4_PATH):
            with open(SCHEMA_PHASE4_PATH, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
        if os.path.exists(SCHEMA_STEP3_PATH):
            with open(SCHEMA_STEP3_PATH, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
    print(f"[OK] PARAKH database initialized successfully at: {DB_PATH}")

if __name__ == "__main__":
    init_db()
