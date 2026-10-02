"""
Core Business Logic & Data Access Layer for No Pusing Pusing (NPP).
Author: Devera (CTO & Lead Accountant)
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from backend.database import get_connection
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

def get_current_wib_date() -> str:
    return datetime.now(WIB).strftime("%Y-%m-%d")

def format_rupiah(amount: float) -> str:
    return f"Rp {int(amount):,}".replace(",", ".")

def format_session_display_name(date_str: str, opened_at: Optional[str] = None) -> str:
    if not date_str:
        return "Buku Kasir Sedang Ditutup"

    parts = date_str.split("_")
    base_date = parts[0]
    session_suffix = ""
    if len(parts) > 1 and parts[1].startswith("S"):
        session_num = parts[1].replace("S", "")
        session_suffix = f" (Sesi {session_num})"
    elif len(parts) > 1:
        session_suffix = f" ({parts[1]})"

    open_time_str = ""
    if opened_at:
        try:
            dt_open = datetime.fromisoformat(opened_at)
            open_time_str = dt_open.strftime(" • Dibuka %H:%M WIB")
        except Exception:
            pass

    try:
        dt_obj = datetime.strptime(base_date, "%Y-%m-%d")
        days_indo = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
        day_name = days_indo[dt_obj.weekday()]
        months_indo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
        formatted = f"{day_name}, {dt_obj.day} {months_indo[dt_obj.month - 1]} {dt_obj.year}"
        return f"{formatted}{session_suffix}{open_time_str}"
    except Exception:
        return f"{date_str}{session_suffix}{open_time_str}"

def get_all_partners() -> List[PartnerItem]:
    conn = get_connection()
    rows = conn.execute("SELECT id, name, initials, color, is_active FROM partners WHERE is_active = 1 ORDER BY id ASC;").fetchall()
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

def create_partner(req: PartnerCreateRequest) -> PartnerItem:
    conn = get_connection()
    cursor = conn.cursor()
    
    clean_name = req.name.strip()
    if not clean_name:
        conn.close()
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

    # Color assignment
    if req.color and req.color.strip():
        color = req.color.strip()
    else:
        existing_count = cursor.execute("SELECT COUNT(*) FROM partners;").fetchone()[0]
        color = PARTNER_COLOR_PALETTE[existing_count % len(PARTNER_COLOR_PALETTE)]

    now_iso = datetime.now(WIB).isoformat()
    cursor.execute(
        "INSERT INTO partners (name, initials, color, is_active, created_at) VALUES (?, ?, ?, 1, ?);",
        (clean_name, initials, color, now_iso)
    )
    new_id = int(cursor.lastrowid or 0)

    # Seed daily_payouts for all days that are ACTIVE
    active_days = cursor.execute("SELECT date_str FROM days WHERE status = 'ACTIVE';").fetchall()
    for ad in active_days:
        cursor.execute(
            "INSERT OR IGNORE INTO daily_payouts (day_date, partner_id, is_taken) VALUES (?, ?, 0);",
            (ad["date_str"], new_id)
        )

    conn.commit()
    conn.close()
    return PartnerItem(id=new_id, name=clean_name, initials=initials, color=color, is_active=True)

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

def delete_partner(partner_id: int) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if partner has any transactions
    usage = cursor.execute("SELECT COUNT(*) FROM transaction_shares WHERE partner_id = ?;", (partner_id,)).fetchone()[0]
    if usage > 0:
        cursor.execute("UPDATE partners SET is_active = 0 WHERE id = ?;", (partner_id,))
        conn.commit()
        conn.close()
        return {
            "success": True, 
            "soft_deleted": True,
            "message": "Pemodal dinonaktifkan (tersimpan dalam arsip audit transaksi lampau)."
        }
    else:
        cursor.execute("DELETE FROM daily_payouts WHERE partner_id = ?;", (partner_id,))
        cursor.execute("DELETE FROM partners WHERE id = ?;", (partner_id,))
        conn.commit()
        conn.close()
        return {
            "success": True, 
            "soft_deleted": False,
            "message": "Pemodal berhasil dihapus secara permanen."
        }

def get_active_session() -> Optional[Dict[str, Any]]:
    """Return the currently ACTIVE session if one exists. Never auto-creates."""
    conn = get_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT date_str, status, opened_at, closed_at, sales_revenue, sales_notes, sold_at FROM days WHERE status = 'ACTIVE' ORDER BY opened_at DESC, date_str DESC LIMIT 1;"
    ).fetchone()
    conn.close()
    return dict(row) if row else None

def get_latest_session() -> Optional[Dict[str, Any]]:
    """Return the most recently created session (ACTIVE or CLOSED)."""
    conn = get_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT date_str, status, opened_at, closed_at, sales_revenue, sales_notes, sold_at FROM days ORDER BY opened_at DESC, date_str DESC LIMIT 1;"
    ).fetchone()
    conn.close()
    return dict(row) if row else None

def record_session_sale(day_date: Optional[str], sales_revenue: float, sales_notes: Optional[str] = None) -> Dict[str, Any]:
    """Record gold bulk sales proceeds and calculate net profit vs capital."""
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

    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(WIB).isoformat()
    cursor.execute(
        "UPDATE days SET sales_revenue = ?, sales_notes = ?, sold_at = ? WHERE date_str = ?;",
        (float(sales_revenue), sales_notes, now_iso, target)
    )
    conn.commit()
    conn.close()

    board = get_daily_board(target)
    return {
        "success": True,
        "date_str": target,
        "sales_revenue": sales_revenue,
        "total_capital": board.total_capital,
        "net_profit": board.net_profit,
        "profit_percentage": board.profit_percentage,
        "message": f"Hasil penjualan {format_rupiah(sales_revenue)} berhasil disimpan. Keuntungan bersih: {format_rupiah(board.net_profit)}"
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

    conn = get_connection()
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

    conn.commit()
    conn.close()

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

    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(WIB).isoformat()
    cursor.execute("UPDATE days SET status = 'CLOSED', closed_at = ? WHERE date_str = ?;", (now_iso, target))
    conn.commit()
    conn.close()

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

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE days SET status = 'ACTIVE', closed_at = NULL WHERE date_str = ?;", (target,))
    conn.commit()
    conn.close()
    return True

def create_transaction(req: TransactionCreateRequest, target_date: Optional[str] = None) -> TransactionResponse:
    if target_date:
        conn = get_connection()
        cursor = conn.cursor()
        row = cursor.execute("SELECT date_str, status FROM days WHERE date_str = ?;", (target_date,)).fetchone()
        conn.close()
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

def get_day_transactions(day_date: Optional[str] = None) -> List[TransactionResponse]:
    target = day_date
    if not target:
        active = get_active_session()
        if not active:
            return []
        target = active["date_str"]

    conn = get_connection()
    cursor = conn.cursor()

    t_rows = cursor.execute(
        "SELECT id, day_date, item_name, total_amount, notes, receipt_image, created_at FROM transactions WHERE day_date = ? ORDER BY created_at DESC;",
        (target,)
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
    conn = get_connection()
    cursor = conn.cursor()

    if target_date:
        cursor.execute("SELECT date_str, status, opened_at, closed_at, sales_revenue, sales_notes, sold_at FROM days WHERE date_str = ?;", (target_date,))
        row = cursor.fetchone()
        if not row:
            conn.close()
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

            partners = cursor.execute("SELECT id, name, initials, color FROM partners WHERE is_active = 1 ORDER BY id ASC;").fetchall()
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
            conn.close()
            return DailyBoardResponse(
                day_date=latest["date_str"] if latest else "",
                display_name=f"Buku Kasir Sedang Ditutup (Terakhir: {closed_note})" if closed_note else "Buku Kasir Sedang Ditutup",
                status="CLOSED",
                opened_at="",
                closed_at=latest["closed_at"] if latest else None,
                total_capital=0.0,
                total_transactions=0,
                sales_revenue=0.0,
                net_profit=0.0,
                profit_percentage=0.0,
                sales_notes=None,
                sold_at=None,
                payouts=payouts_list,
                all_settled=True,
                whatsapp_rekap="Buku kasir sedang ditutup.",
            )

    day_date = day_info["date_str"]

    # 1. Total capital & transactions
    tot_row = cursor.execute(
        "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM transactions WHERE day_date = ?;",
        (day_date,)
    ).fetchone()
    total_trx = tot_row[0]
    total_capital = float(tot_row[1])

    # 2. Bulk Sales & Net Profit
    sales_rev = float(day_info.get("sales_revenue") or 0.0)
    sales_notes = day_info.get("sales_notes")
    sold_at = day_info.get("sold_at")
    net_profit = sales_rev - total_capital if sales_rev > 0 else 0.0
    profit_pct = round((net_profit / total_capital) * 100.0, 2) if total_capital > 0 and sales_rev > 0 else 0.0

    # 3. Partners and their shares
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

    formatted_date_indo = format_session_display_name(day_date, day_info.get("opened_at"))

    wa_lines = [
        "👑 *BELI EMAS MAKASSAR*",
        "🪙 *REKAP KASIR & PENJUALAN EMAS (NPP)*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"📅 Sesi : {formatted_date_indo}",
        f"💰 Total Modal Keluar : *{format_rupiah(total_capital)}*",
    ]

    if sales_rev > 0:
        profit_sign = "+" if net_profit >= 0 else ""
        wa_lines.extend([
            f"💵 Hasil Penjualan Sore : *{format_rupiah(sales_rev)}*",
            f"💎 *KEUNTUNGAN BERSIH : {format_rupiah(net_profit)} ({profit_sign}{profit_pct}%)*",
        ])
    else:
        wa_lines.append("💵 Hasil Penjualan Sore : _[Belum Diinput]_")

    wa_lines.extend([
        f"📦 Total Transaksi Beli : {total_trx} transaksi",
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

    conn.close()

    return DailyBoardResponse(
        day_date=day_date,
        display_name=formatted_date_indo,
        status=day_info["status"],
        opened_at=day_info["opened_at"],
        closed_at=day_info.get("closed_at"),
        total_capital=total_capital,
        total_transactions=total_trx,
        sales_revenue=sales_rev,
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
        net_profit=0.0,
        profit_percentage=0.0,
        sales_notes=None,
        sold_at=None,
        payouts=[],
        all_settled=True,
        whatsapp_rekap="Buku kasir sedang ditutup.",
    )

def get_history_summary() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute("""
        SELECT 
            d.date_str,
            d.status,
            d.opened_at,
            d.closed_at,
            d.sales_revenue,
            d.sales_notes,
            d.sold_at,
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

        sales_r = float(r["sales_revenue"] or 0.0)
        tot_cap = float(r["total_capital"] or 0.0)
        n_prof = sales_r - tot_cap if sales_r > 0 else 0.0
        p_pct = round((n_prof / tot_cap) * 100.0, 2) if tot_cap > 0 and sales_r > 0 else 0.0

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
            "sales_revenue": sales_r,
            "sales_revenue_formatted": format_rupiah(sales_r),
            "net_profit": n_prof,
            "net_profit_formatted": format_rupiah(n_prof),
            "profit_percentage": p_pct,
            "sales_notes": r["sales_notes"],
            "sold_at": r["sold_at"],
        })
    return result
