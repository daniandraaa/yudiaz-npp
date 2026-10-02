"""
Database schema and SQLite engine for No Pusing Pusing (NPP).
Author: Devera (CTO & Lead Accountant)
"""

import sqlite3
from pathlib import Path
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))
DB_PATH = Path("/home/daniilham/yudiaz-npp/data/npp.db")

DEFAULT_PARTNERS = [
    (1, "Bang Fauzan", "FZ", "#EAB308"),   # Gold / Lead
    (2, "Daniandra", "DN", "#38BDF8"),     # Sky Blue
    (3, "Partner 3", "P3", "#A855F7"),     # Purple
    (4, "Partner 4", "P4", "#10B981"),     # Emerald
    (5, "Partner 5", "P5", "#F97316"),     # Orange
    (6, "Partner 6", "P6", "#EC4899"),     # Pink
    (7, "Partner 7", "P7", "#6366F1"),     # Indigo
]

def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db() -> None:
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Partners table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS partners (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        initials TEXT NOT NULL,
        color TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
    );
    """)

    # Seed default 7 partners if empty
    cursor.execute("SELECT COUNT(*) FROM partners;")
    if cursor.fetchone()[0] == 0:
        now_iso = datetime.now(WIB).isoformat()
        for pid, name, initials, color in DEFAULT_PARTNERS:
            cursor.execute(
                "INSERT INTO partners (id, name, initials, color, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
                (pid, name, initials, color, now_iso)
            )

    # 2. Days / Sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS days (
        date_str TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE or CLOSED
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        sales_revenue REAL DEFAULT 0.0,
        sales_notes TEXT,
        sold_at TEXT
    );
    """)

    # Safe migration: ensure sales columns exist in days
    cursor.execute("PRAGMA table_info(days);")
    day_cols = [row[1] for row in cursor.fetchall()]
    if "sales_revenue" not in day_cols:
        cursor.execute("ALTER TABLE days ADD COLUMN sales_revenue REAL DEFAULT 0.0;")
    if "sales_revenue_lm" not in day_cols:
        cursor.execute("ALTER TABLE days ADD COLUMN sales_revenue_lm REAL DEFAULT 0.0;")
    if "sales_revenue_non_lm" not in day_cols:
        cursor.execute("ALTER TABLE days ADD COLUMN sales_revenue_non_lm REAL DEFAULT 0.0;")
    if "sales_notes" not in day_cols:
        cursor.execute("ALTER TABLE days ADD COLUMN sales_notes TEXT;")
    if "sold_at" not in day_cols:
        cursor.execute("ALTER TABLE days ADD COLUMN sold_at TEXT;")

    # 3. Transactions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        day_date TEXT NOT NULL,
        item_name TEXT NOT NULL,
        total_amount REAL NOT NULL,
        notes TEXT,
        receipt_image TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (day_date) REFERENCES days(date_str) ON DELETE CASCADE
    );
    """)

    # Safe migration: ensure receipt_image & gold_category columns exist
    cursor.execute("PRAGMA table_info(transactions);")
    cols = [row[1] for row in cursor.fetchall()]
    if "receipt_image" not in cols:
        cursor.execute("ALTER TABLE transactions ADD COLUMN receipt_image TEXT;")
    if "gold_category" not in cols:
        cursor.execute("ALTER TABLE transactions ADD COLUMN gold_category TEXT NOT NULL DEFAULT 'LM';")

    # 4. Transaction Shares (Pemodal per transaksi)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transaction_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL,
        partner_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        percentage REAL NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
    );
    """)

    # 5. Daily Payout Checklists (Siapa saja yang sudah ambil cash di meja)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_payouts (
        day_date TEXT NOT NULL,
        partner_id INTEGER NOT NULL,
        is_taken INTEGER DEFAULT 0,
        taken_at TEXT,
        PRIMARY KEY (day_date, partner_id),
        FOREIGN KEY (day_date) REFERENCES days(date_str) ON DELETE CASCADE,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
