"""
Core Business Logic & Data Access Layer for No Pusing Pusing (NPP).
Author: Devera (CTO & Lead Accountant)
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from backend.database import get_connection, db_session, db_readonly
from backend.models import (
    PartnerItem, PartnerUpdateRequest, PartnerCreateRequest, TransactionCreateRequest,
    TransactionResponse, ShareDetail, PartnerPayout, DailyBoardResponse, RecordSaleRequest
)

WIB = timezone(timedelta(hours=7))

PARTNER_COLOR_PALETTE = [
    "#EAB308",  # Amber / Gold
    "#38BDF8",  # Sky Blue
    "#A855F7",  # Purple
    "#10B981",  # Emerald
    "#F97316",  # Orange
    "#EC4899",  # Pink
    "#6366F1",  # Indigo
    "#14B8A6",  # Teal
    "#F43F5E",  # Rose
    "#8B5CF6",  # Violet
    "#06B6D4",  # Cyan
    "#84CC16",  # Lime
]

def format_rupiah(num: float) -> str:
    """Format float to Rupiah string: 45000000 -> Rp 45.000.000"""
    return f"Rp {int(round(num)):,}".replace(",", ".")

def format_session_display_name(date_str: str, opened_at_iso: Optional[str] = None) -> str:
    """
    Format a session identifier like '2026-10-01' or '2026-10-01_S2'
    into an Indonesian display title:
    'Kamis, 1 Oktober 2026 • Dibuka 14:35 WIB' or
    'Kamis, 1 Oktober 2026 (Sesi 2) • Dibuka 18:10 WIB'
    """
    if not date_str:
        return "Buku Kasir Ditutup"
        
    parts = date_str.split("_")
    base_date = parts[0]
    session_suffix = f" (Sesi {parts[1][1:]})" if len(parts) > 1 and parts[1].startswith("S") else ""
    
    days_indo = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    months_indo = [
        "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ]
    
    open_time_str = ""
    if opened_at_iso:
        try:
            dt_open = datetime.fromisoformat(opened_at_iso)
            open_time_str = f" • Dibuka {dt_open.strftime('%H:%M')} WIB"
        except Exception:
            pass

    try:
        dt = datetime.strptime(base_date, "%Y-%m-%d")
        day_name = days_indo[dt.weekday()]
        month_name = months_indo[dt.month]
        formatted = f"{day_name}, {dt.day} {month_name} {dt.year}"
        return f"{formatted}{session_suffix}{open_time_str}"
    except Exception:
        return f"{date_str}{session_suffix}{open_time_str}"

def get_all_partners() -> List[PartnerItem]:
    with db_readonly() as conn:
        rows = conn.execute("SELECT id, name, initials, color, is_active FROM partners WHERE is_active = 1 ORDER BY id ASC;").fetchall()
    return [
        PartnerItem(
            id=r["id"],
            name=r["name"],
            initials=r["initials"],
            color=r["color"],
            is_active=bool(r["is_active"]),
        )
        for r in rows
    ]

def create_partner(req: PartnerCreateRequest) -> PartnerItem:
    clean_name = req.name.strip()
    if not clean_name:
        raise ValueError("Nama pemodal tidak boleh kosong.")
        
    # Generate initials if not provided
    if req.initials and req.initials.strip():
        initials = req.initials.strip().upper()[:3]
    else:
        words = [w for w in clean_name.split() if w]
        if len(words) >= 2:
            initials = (words[0][0] + words[1][0]).upper()
        elif len(words) == 1:
            initials = words[0][:2].upper()
        else:
            initials = "EM"

    with db_session() as conn:
        cursor = conn.cursor()
        # Count partners to assign color
        count = cursor.execute("SELECT COUNT(*) FROM partners;").fetchone()[0]
        color = req.color.strip() if req.color and req.color.strip() else PARTNER_COLOR_PALETTE[count % len(PARTNER_COLOR_PALETTE)]

        now_iso = datetime.now(WIB).isoformat()
        cursor.execute(
            "INSERT INTO partners (name, initials, color, is_active, created_at) VALUES (?, ?, ?, 1, ?);",
            (clean_name, initials, color, now_iso)
        )
        new_id = int(cursor.lastrowid or 0)

        # Seed into active session if one exists
        active = cursor.execute("SELECT date_str FROM days WHERE status = 'ACTIVE' LIMIT 1;").fetchone()
        if active:
            cursor.execute(
                "INSERT OR IGNORE INTO daily_payouts (day_date, partner_id, is_taken) VALUES (?, ?, 0);",
                (active["date_str"], new_id)
            )

    return PartnerItem(id=new_id, name=clean_name, initials=initials, color=color, is_active=True)

def update_partner(partner_id: int, req: PartnerUpdateRequest) -> Optional[PartnerItem]:
    with db_session() as conn:
        cursor = conn.cursor()
        existing = cursor.execute("SELECT id, name, initials, color, is_active FROM partners WHERE id = ?;", (partner_id,)).fetchone()
        if not existing:
            return None

        new_name = req.name.strip()
        new_initials = req.initials.strip() if req.initials else existing["initials"]
        new_color = req.color.strip() if req.color else existing["color"]

        cursor.execute(
            "UPDATE partners SET name = ?, initials = ?, color = ? WHERE id = ?;",
            (new_name, new_initials, new_color, partner_id)
        )

    return PartnerItem(id=partner_id, name=new_name, initials=new_initials, color=new_color, is_active=True)

def delete_partner(partner_id: int) -> Dict[str, Any]:
    with db_session() as conn:
        cursor = conn.cursor()
        # Check if partner has any transactions
        usage = cursor.execute("SELECT COUNT(*) FROM transaction_shares WHERE partner_id = ?;", (partner_id,)).fetchone()[0]
        if usage > 0:
            cursor.execute("UPDATE partners SET is_active = 0 WHERE id = ?;", (partner_id,))
            return {
                "success": True, 
                "soft_deleted": True,
                "message": "Pemodal dinonaktifkan (tersimpan dalam arsip audit transaksi lampau)."
            }
        else:
            cursor.execute("DELETE FROM daily_payouts WHERE partner_id = ?;", (partner_id,))
            cursor.execute("DELETE FROM partners WHERE id = ?;", (partner_id,))
            return {
                "success": True, 
                "soft_deleted": False,
                "message": "Pemodal berhasil dihapus secara permanen."
            }

def get_active_session() -> Optional[Dict[str, Any]]:
    """Return the currently ACTIVE session if one exists. Never auto-creates."""
    with db_readonly() as conn:
        row = conn.execute(
            "SELECT date_str, status, opened_at, closed_at, sales_revenue, sales_revenue_lm, sales_revenue_non_lm, sales_notes, sold_at FROM days WHERE status = 'ACTIVE' ORDER BY opened_at DESC, date_str DESC LIMIT 1;"
        ).fetchone()
        return dict(row) if row else None

def get_latest_session() -> Optional[Dict[str, Any]]:
    """Return the most recently created session (ACTIVE or CLOSED)."""
    with db_readonly() as conn:
        row = conn.execute(
            "SELECT date_str, status, opened_at, closed_at, sales_revenue, sales_revenue_lm, sales_revenue_non_lm, sales_notes, sold_at FROM days ORDER BY opened_at DESC, date_str DESC LIMIT 1;"
        ).fetchone()
        return dict(row) if row else None

def record_session_sale(
    day_date: Optional[str],
    sales_revenue: Optional[float] = None,
    sales_revenue_lm: float = 0.0,
    sales_revenue_non_lm: float = 0.0,
    sales_notes: Optional[str] = None
) -> Dict[str, Any]:
    """Record gold bulk sales proceeds (LM & Non-LM) and calculate net profit vs capital."""
    target = day_date
    if not target:
        active = get_active_session()
        if active:
            target = active["date_str"]
        else:
            latest = get_latest_session()
            if latest:
                target = latest["date_str"]
    
    if not target:
        raise ValueError("Tidak ada sesi buku yang dapat dicatat hasil penjualannya.")

    rev_lm = float(sales_revenue_lm or 0.0)
    rev_non_lm = float(sales_revenue_non_lm or 0.0)
    
    if rev_lm > 0 or rev_non_lm > 0:
        total_rev = rev_lm + rev_non_lm
    elif sales_revenue is not None:
        total_rev = float(sales_revenue)
    else:
        total_rev = 0.0

    now_iso = datetime.now(WIB).isoformat()
    with db_session() as conn:
        conn.execute(
            """
            UPDATE days 
            SET sales_revenue = ?, sales_revenue_lm = ?, sales_revenue_non_lm = ?, sales_notes = ?, sold_at = ? 
            WHERE date_str = ?;
            """,
            (total_rev, rev_lm, rev_non_lm, sales_notes, now_iso, target)
        )

    board = get_daily_board(target)
    return {
        "success": True,
        "date_str": target,
        "sales_revenue": total_rev,
        "sales_revenue_lm": rev_lm,
        "sales_revenue_non_lm": rev_non_lm,
        "total_capital": board.total_capital,
        "net_profit": board.net_profit,
        "profit_percentage": board.profit_percentage,
        "profit_lm": board.profit_lm,
        "profit_non_lm": board.profit_non_lm,
        "message": f"Hasil penjualan {format_rupiah(total_rev)} berhasil disimpan. Total laba bersih: {format_rupiah(board.net_profit)}"
    }

def open_day_session() -> Dict[str, Any]:
    """
    Explicitly called when Bang Fauzan / Kasir clicks 'Buka Buku'.
    Captures the EXACT current day and time (WIB), starts with clean 0 modal.
    """
    active = get_active_session()
    if active:
        disp = format_session_display_name(active["date_str"], active.get("opened_at"))
        return {
            "already_active": True,
            "date_str": active["date_str"],
            "display_name": disp,
            "message": f"Sesi {disp} sudah aktif."
        }

    now = datetime.now(WIB)
    today = now.strftime("%Y-%m-%d")
    now_iso = now.isoformat()

    with db_session() as conn:
        cursor = conn.cursor()

        # Check how many sessions exist for today's date
        today_sessions = cursor.execute(
            "SELECT date_str FROM days WHERE date_str = ? OR date_str LIKE ? ORDER BY date_str ASC;",
            (today, f"{today}_%")
        ).fetchall()

        if not today_sessions:
            new_date_str = today
        else:
            next_idx = len(today_sessions) + 1
            new_date_str = f"{today}_S{next_idx}"

        cursor.execute(
            "INSERT INTO days (date_str, status, opened_at, closed_at, sales_revenue) VALUES (?, 'ACTIVE', ?, NULL, 0.0);",
            (new_date_str, now_iso)
        )

        # Seed daily_payouts for all active partners with clean is_taken = 0
        partners = cursor.execute("SELECT id FROM partners WHERE is_active = 1;").fetchall()
        for p in partners:
            cursor.execute(
                "INSERT OR IGNORE INTO daily_payouts (day_date, partner_id, is_taken) VALUES (?, ?, 0);",
                (new_date_str, p["id"])
            )

    disp_name = format_session_display_name(new_date_str, now_iso)
    return {
        "date_str": new_date_str,
        "status": "ACTIVE",
        "opened_at": now_iso,
        "display_name": disp_name,
        "message": f"Buku berhasil dibuka: {disp_name}"
    }

def close_day_session(day_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Explicitly called when Bang Fauzan / Kasir clicks 'Tutup Buku'.
    Stamps closed_at timestamp, moves session to history, and LEAVES BOOK CLOSED.
    DOES NOT automatically open a new session.
    """
    target = day_date
    if not target:
        active = get_active_session()
        if not active:
            return {"error": "Tidak ada sesi buku yang sedang aktif."}
        target = active["date_str"]

    now_iso = datetime.now(WIB).isoformat()
    with db_session() as conn:
        conn.execute("UPDATE days SET status = 'CLOSED', closed_at = ? WHERE date_str = ?;", (now_iso, target))

    return {
        "closed_session": target,
        "message": f"Sesi {target} berhasil ditutup & diarsipkan. Status buku sekarang DITUTUP."
    }

def reopen_day_session(day_date: Optional[str] = None) -> bool:
    target = day_date
    if not target:
        latest = get_latest_session()
        if not latest:
            return False
        target = latest["date_str"]

    with db_session() as conn:
        conn.execute("UPDATE days SET status = 'ACTIVE', closed_at = NULL WHERE date_str = ?;", (target,))
    return True

def create_transaction(req: TransactionCreateRequest, target_date: Optional[str] = None) -> TransactionResponse:
    if target_date:
        with db_readonly() as conn:
            row = conn.execute("SELECT date_str, status FROM days WHERE date_str = ?;", (target_date,)).fetchone()
        if not row:
            raise ValueError(f"Sesi {target_date} tidak ditemukan.")
        if row["status"] != "ACTIVE":
            raise ValueError(f"Sesi {target_date} sudah ditutup.")
        day_date = target_date
    else:
        active = get_active_session()
        if not active:
            raise ValueError("Buku transaksi sedang ditutup. Silakan klik 'Buka Buku Baru' terlebih dahulu sebelum mencatat pembelian.")
        day_date = active["date_str"]

    # Validate sum of shares matches total_amount
    total_shares = sum(s.amount for s in req.shares)
    if abs(total_shares - req.total_amount) > 1.0:
        raise ValueError(
            f"Total nominal patungan ({format_rupiah(total_shares)}) tidak sama dengan total harga beli ({format_rupiah(req.total_amount)})."
        )

    trx_id = f"TRX-{uuid.uuid4().hex[:8].upper()}"
    now_iso = datetime.now(WIB).isoformat()
    now_time = datetime.now(WIB).strftime("%H:%M")
    item_name = req.item_name.strip() if req.item_name and req.item_name.strip() else f"Emas {now_time}"

    gold_category = "NON_LM" if getattr(req, "gold_category", "").upper() == "NON_LM" else "LM"

    shares_details: List[ShareDetail] = []
    with db_session() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO transactions (id, day_date, item_name, gold_category, total_amount, notes, receipt_image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
            (trx_id, day_date, item_name, gold_category, req.total_amount, req.notes, req.receipt_image, now_iso)
        )

        partners_map = {
            p["id"]: p for p in cursor.execute("SELECT id, name, initials, color FROM partners;").fetchall()
        }

        for s in req.shares:
            if s.amount <= 0:
                continue
            pct = round((s.amount / req.total_amount) * 100.0, 2)
            cursor.execute(
                "INSERT INTO transaction_shares (transaction_id, partner_id, amount, percentage) VALUES (?, ?, ?, ?);",
                (trx_id, s.partner_id, s.amount, pct)
            )
            p_info = partners_map.get(s.partner_id)
            if p_info:
                shares_details.append(
                    ShareDetail(
                        partner_id=s.partner_id,
                        partner_name=p_info["name"],
                        partner_initials=p_info["initials"],
                        partner_color=p_info["color"],
                        amount=s.amount,
                        percentage=pct,
                    )
                )

    return TransactionResponse(
        id=trx_id,
        day_date=day_date,
        item_name=item_name,
        gold_category=gold_category,
        total_amount=req.total_amount,
        shares=shares_details,
        notes=req.notes,
        receipt_image=req.receipt_image,
        created_at=now_iso,
    )

def delete_transaction(transaction_id: str) -> bool:
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM transactions WHERE id = ?;", (transaction_id,))
        return cursor.rowcount > 0

def toggle_payout_status(day_date: str, partner_id: int, is_taken: bool) -> bool:
    now_iso = datetime.now(WIB).isoformat() if is_taken else None
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO daily_payouts (day_date, partner_id, is_taken, taken_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(day_date, partner_id) DO UPDATE SET
                is_taken = excluded.is_taken,
                taken_at = excluded.taken_at;
            """,
            (day_date, partner_id, 1 if is_taken else 0, now_iso)
        )
    return True

def get_day_transactions(day_date: Optional[str] = None) -> List[TransactionResponse]:
    target = day_date
    if not target:
        active = get_active_session()
        if not active:
            return []
        target = active["date_str"]

    with db_readonly() as conn:
        t_rows = conn.execute(
            "SELECT id, day_date, item_name, gold_category, total_amount, notes, receipt_image, created_at FROM transactions WHERE day_date = ? ORDER BY created_at DESC;",
            (target,)
        ).fetchall()

        if not t_rows:
            return []

        partners_map = {
            p["id"]: p for p in conn.execute("SELECT id, name, initials, color FROM partners;").fetchall()
        }

        result = []
        for tr in t_rows:
            tid = tr["id"]
            s_rows = conn.execute(
                "SELECT partner_id, amount, percentage FROM transaction_shares WHERE transaction_id = ? ORDER BY partner_id ASC;",
                (tid,)
            ).fetchall()

            shares = []
            for sr in s_rows:
                p_info = partners_map.get(sr["partner_id"])
                if p_info:
                    shares.append(
                        ShareDetail(
                            partner_id=sr["partner_id"],
                            partner_name=p_info["name"],
                            partner_initials=p_info["initials"],
                            partner_color=p_info["color"],
                            amount=sr["amount"],
                            percentage=sr["percentage"],
                        )
                    )

            result.append(
                TransactionResponse(
                    id=tr["id"],
                    day_date=tr["day_date"],
                    item_name=tr["item_name"],
                    gold_category=tr["gold_category"] or "LM",
                    total_amount=tr["total_amount"],
                    shares=shares,
                    notes=tr["notes"],
                    receipt_image=tr["receipt_image"],
                    created_at=tr["created_at"],
                )
            )

    return result

def get_daily_board(target_date: Optional[str] = None) -> DailyBoardResponse:
    if target_date:
        with db_readonly() as conn:
            row = conn.execute("SELECT date_str, status, opened_at, closed_at, sales_revenue, sales_revenue_lm, sales_revenue_non_lm, sales_notes, sold_at FROM days WHERE date_str = ?;", (target_date,)).fetchone()
            if not row:
                return _get_empty_closed_board()
            day_info = dict(row)
    else:
        active = get_active_session()
        if active:
            day_info = active
        else:
            # Book is currently CLOSED!
            latest = get_latest_session()
            closed_note = ""
            if latest and latest.get("closed_at"):
                try:
                    dt_c = datetime.fromisoformat(latest["closed_at"])
                    days_indo = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
                    dname = days_indo[dt_c.weekday()]
                    closed_note = f"{dname}, {dt_c.day}/{dt_c.month} • {dt_c.strftime('%H:%M WIB')}"
                except Exception:
                    closed_note = latest["closed_at"]

            with db_readonly() as conn:
                partners = conn.execute("SELECT id, name, initials, color FROM partners WHERE is_active = 1 ORDER BY id ASC;").fetchall()

            payouts_list = [
                PartnerPayout(
                    partner_id=p["id"],
                    name=p["name"],
                    initials=p["initials"],
                    color=p["color"],
                    total_modal=0.0,
                    transaction_count=0,
                    is_taken=False,
                    taken_at=None,
                    items_breakdown=[],
                )
                for p in partners
            ]
            return DailyBoardResponse(
                day_date=latest["date_str"] if latest else "",
                display_name=f"Buku Kasir Sedang Ditutup (Terakhir: {closed_note})" if closed_note else "Buku Kasir Sedang Ditutup",
                status="CLOSED",
                opened_at="",
                closed_at=latest["closed_at"] if latest else None,
                total_capital=0.0,
                total_transactions=0,
                sales_revenue=0.0,
                sales_revenue_lm=0.0,
                sales_revenue_non_lm=0.0,
                total_capital_lm=0.0,
                total_capital_non_lm=0.0,
                total_trx_lm=0,
                total_trx_non_lm=0,
                profit_lm=0.0,
                profit_pct_lm=0.0,
                profit_non_lm=0.0,
                profit_pct_non_lm=0.0,
                net_profit=0.0,
                profit_percentage=0.0,
                sales_notes=None,
                sold_at=None,
                payouts=payouts_list,
                all_settled=True,
                whatsapp_rekap="Buku kasir sedang ditutup.",
            )

    day_date = day_info["date_str"]

    with db_readonly() as conn:
        # 1. Total capital & transactions
        tot_row = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM transactions WHERE day_date = ?;",
            (day_date,)
        ).fetchone()
        total_trx = tot_row[0]
        total_capital = float(tot_row[1])

        # Breakdown by category
        cat_rows = conn.execute(
            "SELECT gold_category, COUNT(*), COALESCE(SUM(total_amount), 0) FROM transactions WHERE day_date = ? GROUP BY gold_category;",
            (day_date,)
        ).fetchall()
        total_capital_lm = 0.0
        total_trx_lm = 0
        total_capital_non_lm = 0.0
        total_trx_non_lm = 0
        for cr in cat_rows:
            gcat = cr[0]
            cnt = cr[1]
            amt = float(cr[2])
            if gcat == "NON_LM":
                total_capital_non_lm += amt
                total_trx_non_lm += cnt
            else:
                total_capital_lm += amt
                total_trx_lm += cnt

        # 2. Bulk Sales & Net Profit (LM, Non-LM, & Total)
        sales_rev = float(day_info.get("sales_revenue") or 0.0)
        sales_rev_lm = float(day_info.get("sales_revenue_lm") or 0.0)
        sales_rev_non_lm = float(day_info.get("sales_revenue_non_lm") or 0.0)
        if sales_rev_lm > 0 or sales_rev_non_lm > 0:
            sales_rev = sales_rev_lm + sales_rev_non_lm

        sales_notes = day_info.get("sales_notes")
        sold_at = day_info.get("sold_at")

        profit_lm = sales_rev_lm - total_capital_lm if sales_rev_lm > 0 else 0.0
        profit_pct_lm = round((profit_lm / total_capital_lm) * 100.0, 2) if total_capital_lm > 0 and sales_rev_lm > 0 else 0.0

        profit_non_lm = sales_rev_non_lm - total_capital_non_lm if sales_rev_non_lm > 0 else 0.0
        profit_pct_non_lm = round((profit_non_lm / total_capital_non_lm) * 100.0, 2) if total_capital_non_lm > 0 and sales_rev_non_lm > 0 else 0.0

        net_profit = sales_rev - total_capital if sales_rev > 0 else 0.0
        profit_pct = round((net_profit / total_capital) * 100.0, 2) if total_capital > 0 and sales_rev > 0 else 0.0

        # 3. Partners and their shares
        partners = conn.execute("SELECT id, name, initials, color FROM partners WHERE is_active = 1 ORDER BY id ASC;").fetchall()

        # Get payout statuses
        payout_rows = conn.execute(
            "SELECT partner_id, is_taken, taken_at FROM daily_payouts WHERE day_date = ?;",
            (day_date,)
        ).fetchall()
        payout_map = {r["partner_id"]: (bool(r["is_taken"]), r["taken_at"]) for r in payout_rows}

        payouts_list: List[PartnerPayout] = []
        all_settled = True

        for p in partners:
            pid = p["id"]
            calc_row = conn.execute(
                """
                SELECT 
                    COUNT(ts.id), 
                    COALESCE(SUM(ts.amount), 0)
                FROM transaction_shares ts
                JOIN transactions t ON ts.transaction_id = t.id
                WHERE t.day_date = ? AND ts.partner_id = ?;
                """,
                (day_date, pid)
            ).fetchone()

            trx_cnt = calc_row[0]
            tot_modal = float(calc_row[1])

            items_cursor = conn.execute(
                """
                SELECT t.id, t.item_name, ts.amount, ts.percentage, t.created_at
                FROM transaction_shares ts
                JOIN transactions t ON ts.transaction_id = t.id
                WHERE t.day_date = ? AND ts.partner_id = ?
                ORDER BY t.created_at ASC;
                """,
                (day_date, pid)
            ).fetchall()

            items_list = [
                {
                    "transaction_id": it["id"],
                    "item_name": it["item_name"],
                    "amount": float(it["amount"]),
                    "amount_formatted": format_rupiah(it["amount"]),
                    "percentage": float(it["percentage"]),
                    "created_at": it["created_at"],
                }
                for it in items_cursor
            ]

            is_taken, taken_at = payout_map.get(pid, (False, None))
            if tot_modal > 0 and not is_taken:
                all_settled = False

            payouts_list.append(
                PartnerPayout(
                    partner_id=pid,
                    name=p["name"],
                    initials=p["initials"],
                    color=p["color"],
                    total_modal=tot_modal,
                    transaction_count=trx_cnt,
                    is_taken=is_taken,
                    taken_at=taken_at,
                    items_breakdown=items_list,
                )
            )

    formatted_date_indo = format_session_display_name(day_date, day_info.get("opened_at"))

    wa_lines = [
        "👑 *BELI EMAS MAKASSAR*",
        "🪙 *REKAP KASIR & PENJUALAN EMAS (NPP)*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"📅 Sesi : {formatted_date_indo}",
        f"💰 Total Modal Beli : *{format_rupiah(total_capital)}* ({total_trx} transaksi)",
        "",
        "📊 *RINCIAN KATEGORI EMAS:*",
        f"• 🪙 *Logam Mulia (LM)* :",
        f"  - Modal Beli : {format_rupiah(total_capital_lm)} ({total_trx_lm} trx)",
    ]

    if sales_rev_lm > 0:
        p_sign_lm = "+" if profit_lm >= 0 else ""
        wa_lines.extend([
            f"  - Hasil Jual : *{format_rupiah(sales_rev_lm)}*",
            f"  - Laba LM    : *{p_sign_lm}{format_rupiah(profit_lm)} ({p_sign_lm}{profit_pct_lm}%)*",
        ])
    else:
        wa_lines.append("  - Hasil Jual : _[Belum Diinput]_")

    wa_lines.extend([
        "",
        f"• 💍 *Non-LM (Perhiasan)* :",
        f"  - Modal Beli : {format_rupiah(total_capital_non_lm)} ({total_trx_non_lm} trx)",
    ])

    if sales_rev_non_lm > 0:
        p_sign_nlm = "+" if profit_non_lm >= 0 else ""
        wa_lines.extend([
            f"  - Hasil Jual : *{format_rupiah(sales_rev_non_lm)}*",
            f"  - Laba Non-LM: *{p_sign_nlm}{format_rupiah(profit_non_lm)} ({p_sign_nlm}{profit_pct_non_lm}%)*",
        ])
    else:
        wa_lines.append("  - Hasil Jual : _[Belum Diinput]_")

    wa_lines.extend([
        "━━━━━━━━━━━━━━━━━━━━━━",
        "💎 *TOTAL KONSOLIDASI:*",
    ])

    if sales_rev > 0:
        profit_sign = "+" if net_profit >= 0 else ""
        wa_lines.extend([
            f"• Total Modal Keluar : *{format_rupiah(total_capital)}*",
            f"• Total Hasil Jual   : *{format_rupiah(sales_rev)}*",
            f"• *TOTAL LABA BERSIH  : {format_rupiah(net_profit)} ({profit_sign}{profit_pct}%)*",
        ])
    else:
        wa_lines.append(f"• Total Modal Keluar : *{format_rupiah(total_capital)}*")
        wa_lines.append("• Total Hasil Jual   : _[Belum Diinput]_")

    wa_lines.extend([
        "━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "📋 *PENGEMBALIAN MODAL POKOK (100% UTUH):*",
    ])

    for idx, po in enumerate(payouts_list, 1):
        status_tag = "✅ [LUNAS / CASH DIAMBIL]" if po.is_taken else "⏳ [BELUM DIAMBIL]"
        wa_lines.append(f"{idx}. *{po.name}* : {format_rupiah(po.total_modal)} {status_tag}")

    wa_lines.extend([
        "",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🔒 *STATUS AKHIR MEJA KASIR:*",
        f"• Modal seluruh pemodal ditarik kembali 100% utuh ({format_rupiah(total_capital)}).",
    ])

    if sales_rev > 0:
        wa_lines.append(f"• Sisa tumpukan uang tunai di meja adalah Keuntungan Bersih: *{format_rupiah(net_profit)}*.")
    else:
        wa_lines.append("• Sisa tumpukan uang tunai di meja setelah modal ditarik adalah keuntungan/kas internal.")

    wa_lines.append("• Sistem pencatatan: *npp.daniandraaa.my.id*")
    whatsapp_rekap = "\n".join(wa_lines)

    return DailyBoardResponse(
        day_date=day_date,
        display_name=formatted_date_indo,
        status=day_info["status"],
        opened_at=day_info["opened_at"],
        closed_at=day_info.get("closed_at"),
        total_capital=total_capital,
        total_transactions=total_trx,
        sales_revenue=sales_rev,
        sales_revenue_lm=sales_rev_lm,
        sales_revenue_non_lm=sales_rev_non_lm,
        total_capital_lm=total_capital_lm,
        total_capital_non_lm=total_capital_non_lm,
        total_trx_lm=total_trx_lm,
        total_trx_non_lm=total_trx_non_lm,
        profit_lm=profit_lm,
        profit_pct_lm=profit_pct_lm,
        profit_non_lm=profit_non_lm,
        profit_pct_non_lm=profit_pct_non_lm,
        net_profit=net_profit,
        profit_percentage=profit_pct,
        sales_notes=sales_notes,
        sold_at=sold_at,
        payouts=payouts_list,
        all_settled=all_settled and total_capital > 0,
        whatsapp_rekap=whatsapp_rekap,
    )

def _get_empty_closed_board() -> DailyBoardResponse:
    return DailyBoardResponse(
        day_date="",
        display_name="Buku Kasir Ditutup",
        status="CLOSED",
        opened_at="",
        closed_at=None,
        total_capital=0.0,
        total_transactions=0,
        sales_revenue=0.0,
        sales_revenue_lm=0.0,
        sales_revenue_non_lm=0.0,
        total_capital_lm=0.0,
        total_capital_non_lm=0.0,
        total_trx_lm=0,
        total_trx_non_lm=0,
        profit_lm=0.0,
        profit_pct_lm=0.0,
        profit_non_lm=0.0,
        profit_pct_non_lm=0.0,
        net_profit=0.0,
        profit_percentage=0.0,
        sales_notes=None,
        sold_at=None,
        payouts=[],
        all_settled=True,
        whatsapp_rekap="Buku kasir sedang ditutup.",
    )

def get_history_summary() -> List[Dict[str, Any]]:
    with db_readonly() as conn:
        rows = conn.execute("""
            SELECT 
                d.date_str,
                d.status,
                d.opened_at,
                d.closed_at,
                d.sales_revenue,
                d.sales_revenue_lm,
                d.sales_revenue_non_lm,
                d.sales_notes,
                d.sold_at,
                COUNT(t.id) as total_trx,
                COALESCE(SUM(t.total_amount), 0) as total_capital,
                COALESCE(SUM(CASE WHEN t.gold_category = 'NON_LM' THEN t.total_amount ELSE 0 END), 0) as total_capital_non_lm,
                COALESCE(SUM(CASE WHEN t.gold_category != 'NON_LM' THEN t.total_amount ELSE 0 END), 0) as total_capital_lm
            FROM days d
            LEFT JOIN transactions t ON d.date_str = t.day_date
            GROUP BY d.date_str
            ORDER BY d.opened_at DESC, d.date_str DESC;
        """).fetchall()

    result = []
    for r in rows:
        d_str = r["date_str"]
        c_at = r["closed_at"]
        c_str = ""
        if c_at:
            try:
                c_dt = datetime.fromisoformat(c_at)
                c_str = c_dt.strftime("%H:%M WIB")
            except Exception:
                c_str = c_at

        sales_r = float(r["sales_revenue"] or 0.0)
        sales_r_lm = float(r["sales_revenue_lm"] or 0.0)
        sales_r_non_lm = float(r["sales_revenue_non_lm"] or 0.0)
        if sales_r_lm > 0 or sales_r_non_lm > 0:
            sales_r = sales_r_lm + sales_r_non_lm

        tot_cap = float(r["total_capital"] or 0.0)
        tot_cap_lm = float(r["total_capital_lm"] or 0.0)
        tot_cap_non_lm = float(r["total_capital_non_lm"] or 0.0)

        n_prof = sales_r - tot_cap if sales_r > 0 else 0.0
        p_pct = round((n_prof / tot_cap) * 100.0, 2) if tot_cap > 0 and sales_r > 0 else 0.0

        p_lm = sales_r_lm - tot_cap_lm if sales_r_lm > 0 else 0.0
        p_pct_lm = round((p_lm / tot_cap_lm) * 100.0, 2) if tot_cap_lm > 0 and sales_r_lm > 0 else 0.0

        p_nlm = sales_r_non_lm - tot_cap_non_lm if sales_r_non_lm > 0 else 0.0
        p_pct_nlm = round((p_nlm / tot_cap_non_lm) * 100.0, 2) if tot_cap_non_lm > 0 and sales_r_non_lm > 0 else 0.0

        result.append({
            "date_str": d_str,
            "display_name": format_session_display_name(d_str, r["opened_at"]),
            "status": r["status"],
            "opened_at": r["opened_at"],
            "closed_at": c_at,
            "closed_at_formatted": c_str,
            "total_transactions": r["total_trx"],
            "total_capital": tot_cap,
            "total_capital_formatted": format_rupiah(tot_cap),
            "total_capital_lm": tot_cap_lm,
            "total_capital_lm_formatted": format_rupiah(tot_cap_lm),
            "total_capital_non_lm": tot_cap_non_lm,
            "total_capital_non_lm_formatted": format_rupiah(tot_cap_non_lm),
            "sales_revenue": sales_r,
            "sales_revenue_formatted": format_rupiah(sales_r),
            "sales_revenue_lm": sales_r_lm,
            "sales_revenue_lm_formatted": format_rupiah(sales_r_lm),
            "sales_revenue_non_lm": sales_r_non_lm,
            "sales_revenue_non_lm_formatted": format_rupiah(sales_r_non_lm),
            "net_profit": n_prof,
            "net_profit_formatted": format_rupiah(n_prof),
            "profit_percentage": p_pct,
            "profit_lm": p_lm,
            "profit_pct_lm": p_pct_lm,
            "profit_non_lm": p_nlm,
            "profit_pct_non_lm": p_pct_nlm,
            "sales_notes": r["sales_notes"],
            "sold_at": r["sold_at"],
        })
    return result
