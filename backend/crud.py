"""
Core Business Logic & Data Access Layer for No Pusing Pusing (NPP).
Author: Devera (CTO & Lead Accountant)
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from backend.database import get_connection
from backend.models import (
    PartnerItem, PartnerUpdateRequest, TransactionCreateRequest,
    TransactionResponse, ShareDetail, PartnerPayout, DailyBoardResponse
)

WIB = timezone(timedelta(hours=7))

def get_current_wib_date() -> str:
    return datetime.now(WIB).strftime("%Y-%m-%d")

def format_rupiah(amount: float) -> str:
    return f"Rp {int(amount):,}".replace(",", ".")

def format_session_display_name(date_str: str) -> str:
    parts = date_str.split("_")
    base_date = parts[0]
    session_suffix = ""
    if len(parts) > 1 and parts[1].startswith("S"):
        session_num = parts[1].replace("S", "")
        session_suffix = f" (Sesi {session_num})"
    elif len(parts) > 1:
        session_suffix = f" ({parts[1]})"
    else:
        session_suffix = " (Sesi 1)"

    try:
        dt_obj = datetime.strptime(base_date, "%Y-%m-%d")
        days_indo = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
        day_name = days_indo[dt_obj.weekday()]
        months_indo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
        return f"{day_name}, {dt_obj.day} {months_indo[dt_obj.month - 1]} {dt_obj.year}{session_suffix}"
    except Exception:
        return f"{date_str}{session_suffix}"

def get_all_partners() -> List[PartnerItem]:
    conn = get_connection()
    rows = conn.execute("SELECT id, name, initials, color, is_active FROM partners ORDER BY id ASC;").fetchall()
    conn.close()
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

def update_partner(partner_id: int, req: PartnerUpdateRequest) -> Optional[PartnerItem]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, initials, color, is_active FROM partners WHERE id = ?;", (partner_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return None

    new_name = req.name.strip()
    new_initials = req.initials.strip() if req.initials else existing["initials"]
    new_color = req.color.strip() if req.color else existing["color"]

    cursor.execute(
        "UPDATE partners SET name = ?, initials = ?, color = ? WHERE id = ?;",
        (new_name, new_initials, new_color, partner_id)
    )
    conn.commit()
    conn.close()
    return PartnerItem(id=partner_id, name=new_name, initials=new_initials, color=new_color, is_active=True)

def get_or_create_day(target_date: Optional[str] = None) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    if target_date:
        day_date = target_date
        cursor.execute("SELECT date_str, status, opened_at, closed_at FROM days WHERE date_str = ?;", (day_date,))
        row = cursor.fetchone()
        if not row:
            now_iso = datetime.now(WIB).isoformat()
            cursor.execute(
                "INSERT INTO days (date_str, status, opened_at) VALUES (?, 'ACTIVE', ?);",
                (day_date, now_iso)
            )
            # Seed daily_payouts for all partners
            partners = cursor.execute("SELECT id FROM partners WHERE is_active = 1;").fetchall()
            for p in partners:
                cursor.execute(
                    "INSERT OR IGNORE INTO daily_payouts (day_date, partner_id, is_taken) VALUES (?, ?, 0);",
                    (day_date, p["id"])
                )
            conn.commit()
            cursor.execute("SELECT date_str, status, opened_at, closed_at FROM days WHERE date_str = ?;", (day_date,))
            row = cursor.fetchone()

        data = dict(row)
        conn.close()
        return data

    # When target_date is None, resolve the currently ACTIVE session for today!
    today = get_current_wib_date()

    active_row = cursor.execute(
        "SELECT date_str, status, opened_at, closed_at FROM days WHERE (date_str = ? OR date_str LIKE ?) AND status = 'ACTIVE' ORDER BY opened_at DESC, date_str DESC LIMIT 1;",
        (today, f"{today}_%")
    ).fetchone()

    if active_row:
        data = dict(active_row)
        conn.close()
        return data

    # If no ACTIVE session exists for today:
    today_sessions = cursor.execute(
        "SELECT date_str, status FROM days WHERE (date_str = ? OR date_str LIKE ?) ORDER BY date_str ASC;",
        (today, f"{today}_%")
    ).fetchall()

    now_iso = datetime.now(WIB).isoformat()
    if not today_sessions:
        new_date_str = today
    else:
        # All existing sessions for today were CLOSED.
        # Advance to the next session (e.g. 2026-09-30_S2) starting clean from 0!
        next_idx = len(today_sessions) + 1
        new_date_str = f"{today}_S{next_idx}"

    cursor.execute(
        "INSERT INTO days (date_str, status, opened_at) VALUES (?, 'ACTIVE', ?);",
        (new_date_str, now_iso)
    )
    partners = cursor.execute("SELECT id FROM partners WHERE is_active = 1;").fetchall()
    for p in partners:
        cursor.execute(
            "INSERT OR IGNORE INTO daily_payouts (day_date, partner_id, is_taken) VALUES (?, ?, 0);",
            (new_date_str, p["id"])
        )
    conn.commit()
    cursor.execute("SELECT date_str, status, opened_at, closed_at FROM days WHERE date_str = ?;", (new_date_str,))
    row = cursor.fetchone()
    data = dict(row)
    conn.close()
    return data

def create_transaction(req: TransactionCreateRequest, target_date: Optional[str] = None) -> TransactionResponse:
    day_info = get_or_create_day(target_date)
    day_date = day_info["date_str"]

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

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO transactions (id, day_date, item_name, total_amount, notes, receipt_image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);",
        (trx_id, day_date, item_name, req.total_amount, req.notes, req.receipt_image, now_iso)
    )

    shares_details: List[ShareDetail] = []
    # Cache partners
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

    conn.commit()
    conn.close()

    return TransactionResponse(
        id=trx_id,
        day_date=day_date,
        item_name=item_name,
        total_amount=req.total_amount,
        shares=shares_details,
        notes=req.notes,
        receipt_image=req.receipt_image,
        created_at=now_iso,
    )

def delete_transaction(transaction_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions WHERE id = ?;", (transaction_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected

def toggle_payout_status(day_date: str, partner_id: int, is_taken: bool) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(WIB).isoformat() if is_taken else None
    cursor.execute(
        """
        INSERT INTO daily_payouts (day_date, partner_id, is_taken, taken_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(day_date, partner_id) DO UPDATE SET
            is_taken = excluded.is_taken,
            taken_at = excluded.taken_at;
        """,
        (day_date, partner_id, 1 if is_taken else 0, now_iso)
    )
    conn.commit()
    conn.close()
    return True

def get_day_transactions(day_date: str) -> List[TransactionResponse]:
    conn = get_connection()
    cursor = conn.cursor()

    t_rows = cursor.execute(
        "SELECT id, day_date, item_name, total_amount, notes, receipt_image, created_at FROM transactions WHERE day_date = ? ORDER BY created_at DESC;",
        (day_date,)
    ).fetchall()

    if not t_rows:
        conn.close()
        return []

    partners_map = {
        p["id"]: p for p in cursor.execute("SELECT id, name, initials, color FROM partners;").fetchall()
    }

    result = []
    for tr in t_rows:
        tid = tr["id"]
        s_rows = cursor.execute(
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
                total_amount=tr["total_amount"],
                shares=shares,
                notes=tr["notes"],
                receipt_image=tr["receipt_image"],
                created_at=tr["created_at"],
            )
        )

    conn.close()
    return result

def get_daily_board(target_date: Optional[str] = None) -> DailyBoardResponse:
    day_info = get_or_create_day(target_date)
    day_date = day_info["date_str"]

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Total capital & transactions
    tot_row = cursor.execute(
        "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM transactions WHERE day_date = ?;",
        (day_date,)
    ).fetchone()
    total_trx = tot_row[0]
    total_capital = float(tot_row[1])

    # 2. Partners and their shares today
    partners = cursor.execute("SELECT id, name, initials, color FROM partners WHERE is_active = 1 ORDER BY id ASC;").fetchall()

    # Get payout statuses
    payout_rows = cursor.execute(
        "SELECT partner_id, is_taken, taken_at FROM daily_payouts WHERE day_date = ?;",
        (day_date,)
    ).fetchall()
    payout_map = {r["partner_id"]: (bool(r["is_taken"]), r["taken_at"]) for r in payout_rows}

    payouts_list: List[PartnerPayout] = []
    all_settled = True

    for p in partners:
        pid = p["id"]
        # Calculate sum of shares for this partner today
        calc_row = cursor.execute(
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

        # Get item breakdown for details
        items_cursor = cursor.execute(
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

    # 3. Generate structured WhatsApp report string
    formatted_date_indo = format_session_display_name(day_date)

    wa_lines = [
        "👑 *BELI EMAS MAKASSAR*",
        "🪙 *REKAP PENGEMBALIAN MODAL (NPP)*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"📅 Sesi : {formatted_date_indo}",
        f"💰 Total Modal Ditarik : *{format_rupiah(total_capital)}*",
        f"📦 Total Transaksi : {total_trx} transaksi",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "📋 *DAFTAR PENGEMBALIAN MODAL POKOK:*",
    ]

    for idx, po in enumerate(payouts_list, 1):
        status_tag = "✅ [LUNAS / CASH DIAMBIL]" if po.is_taken else "⏳ [BELUM DIAMBIL]"
        wa_lines.append(f"{idx}. *{po.name}* : {format_rupiah(po.total_modal)} {status_tag}")

    wa_lines.extend([
        "",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🔒 *STATUS AKHIR MEJA:*",
        "• Modal ke-7 pemodal ditarik kembali 100% tanpa selisih.",
        "• Sisa tumpukan uang tunai di meja adalah keuntungan/kas internal.",
        "• Sistem pencatatan: *npp.daniandraaa.my.id*",
    ])
    whatsapp_rekap = "\n".join(wa_lines)

    conn.close()

    return DailyBoardResponse(
        day_date=day_date,
        display_name=formatted_date_indo,
        status=day_info["status"],
        opened_at=day_info["opened_at"],
        closed_at=day_info.get("closed_at"),
        total_capital=total_capital,
        total_transactions=total_trx,
        payouts=payouts_list,
        all_settled=all_settled and total_capital > 0,
        whatsapp_rekap=whatsapp_rekap,
    )

def close_day_session(day_date: str) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(WIB).isoformat()
    cursor.execute("UPDATE days SET status = 'CLOSED', closed_at = ? WHERE date_str = ?;", (now_iso, day_date))
    conn.commit()

    # Automatically initialize the next active session for today starting from 0!
    base_date = day_date.split("_")[0]
    today_sessions = cursor.execute(
        "SELECT date_str FROM days WHERE (date_str = ? OR date_str LIKE ?) ORDER BY date_str ASC;",
        (base_date, f"{base_date}_%")
    ).fetchall()
    next_idx = len(today_sessions) + 1
    new_date_str = f"{base_date}_S{next_idx}"

    cursor.execute(
        "INSERT INTO days (date_str, status, opened_at) VALUES (?, 'ACTIVE', ?);",
        (new_date_str, now_iso)
    )
    partners = cursor.execute("SELECT id FROM partners WHERE is_active = 1;").fetchall()
    for p in partners:
        cursor.execute(
            "INSERT OR IGNORE INTO daily_payouts (day_date, partner_id, is_taken) VALUES (?, ?, 0);",
            (new_date_str, p["id"])
        )
    conn.commit()
    conn.close()

    return {
        "closed_session": day_date,
        "new_session": new_date_str,
        "message": f"Sesi {day_date} berhasil ditutup & diarsipkan ke Riwayat. Sesi baru ({new_date_str}) dimulai dari Rp 0."
    }

def reopen_day_session(day_date: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE days SET status = 'ACTIVE', closed_at = NULL WHERE date_str = ?;", (day_date,))
    conn.commit()
    conn.close()
    return True

def create_manual_new_session() -> Dict[str, Any]:
    today = get_current_wib_date()
    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(WIB).isoformat()

    today_sessions = cursor.execute(
        "SELECT date_str FROM days WHERE (date_str = ? OR date_str LIKE ?) ORDER BY date_str ASC;",
        (today, f"{today}_%")
    ).fetchall()
    next_idx = len(today_sessions) + 1
    new_date_str = f"{today}_S{next_idx}"

    cursor.execute(
        "INSERT INTO days (date_str, status, opened_at) VALUES (?, 'ACTIVE', ?);",
        (new_date_str, now_iso)
    )
    partners = cursor.execute("SELECT id FROM partners WHERE is_active = 1;").fetchall()
    for p in partners:
        cursor.execute(
            "INSERT OR IGNORE INTO daily_payouts (day_date, partner_id, is_taken) VALUES (?, ?, 0);",
            (new_date_str, p["id"])
        )
    conn.commit()
    conn.close()
    return {"new_session": new_date_str, "display_name": format_session_display_name(new_date_str)}

def get_history_summary() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute("""
        SELECT 
            d.date_str,
            d.status,
            d.opened_at,
            d.closed_at,
            COUNT(t.id) as total_trx,
            COALESCE(SUM(t.total_amount), 0) as total_capital
        FROM days d
        LEFT JOIN transactions t ON d.date_str = t.day_date
        GROUP BY d.date_str
        ORDER BY d.opened_at DESC, d.date_str DESC;
    """).fetchall()
    conn.close()

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

        result.append({
            "date_str": d_str,
            "display_name": format_session_display_name(d_str),
            "status": r["status"],
            "opened_at": r["opened_at"],
            "closed_at": c_at,
            "closed_at_formatted": c_str,
            "total_transactions": r["total_trx"],
            "total_capital": float(r["total_capital"]),
            "total_capital_formatted": format_rupiah(float(r["total_capital"])),
        })
    return result
