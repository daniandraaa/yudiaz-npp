"""
FastAPI Server for No Pusing Pusing (NPP) - Gold Capital Reconciliation Engine.
Author: Devera (CTO & Lead Accountant)
"""

import os
import time
from typing import Optional
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.database import init_db
from backend.models import (
    PartnerUpdateRequest,
    TransactionCreateRequest,
    TogglePayoutRequest,
    ReceiptOcrResponse,
)
from backend import crud
from backend.ai_ocr import process_receipt_image, RECEIPTS_DIR

START_TIME = time.time()
FRONTEND_DIR = Path("/home/daniilham/yudiaz-npp/frontend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database on startup
    init_db()
    yield

app = FastAPI(
    title="No Pusing Pusing (NPP) - Gold Capital Tracker",
    description="Dedicated Gold Trading Capital Reconciliation Engine for Bang Fauzan & Consortium.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Health Endpoint
@app.get("/api/v1/health")
def get_health():
    uptime = round(time.time() - START_TIME, 1)
    return {
        "status": "healthy",
        "service": "no-pusing-pusing",
        "system": "Yudiaz Creative Studio",
        "project": "No Pusing Pusing (NPP)",
        "cto_accountant": "Devera",
        "dedicated_to": "Bang Fauzan",
        "domain": "npp.daniandraaa.my.id",
        "uptime_seconds": uptime,
        "database": "sqlite_wal_active",
    }

# 2. Partners Endpoints
@app.get("/api/v1/partners")
def list_partners():
    return {"success": True, "data": crud.get_all_partners()}

@app.put("/api/v1/partners/{partner_id}")
def update_partner_profile(partner_id: int, req: PartnerUpdateRequest):
    res = crud.update_partner(partner_id, req)
    if not res:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"success": True, "data": res}

# 3. Daily Board Endpoint
@app.get("/api/v1/board")
def get_board(date: Optional[str] = Query(None, description="Format YYYY-MM-DD")):
    board = crud.get_daily_board(target_date=date)
    return {"success": True, "data": board}

# 4. Transactions Endpoints
@app.get("/api/v1/transactions")
def list_transactions(date: Optional[str] = Query(None, description="Format YYYY-MM-DD")):
    target_date = date or crud.get_current_wib_date()
    items = crud.get_day_transactions(target_date)
    return {"success": True, "data": items, "count": len(items)}

@app.post("/api/v1/transactions", status_code=status.HTTP_201_CREATED)
def create_buy_transaction(req: TransactionCreateRequest, date: Optional[str] = Query(None)):
    try:
        trx = crud.create_transaction(req, target_date=date)
        return {"success": True, "data": trx}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mencatat transaksi: {str(e)}")

@app.delete("/api/v1/transactions/{transaction_id}")
def delete_buy_transaction(transaction_id: str):
    ok = crud.delete_transaction(transaction_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    return {"success": True, "message": "Transaksi berhasil dihapus"}

# 5. Receipt Image Upload & AI OCR Endpoint
@app.post("/api/v1/ocr-receipt", response_model=ReceiptOcrResponse)
async def upload_and_parse_receipt(file: UploadFile = File(...)):
    """
    Upload a receipt/proof photo and extract gold buy data via Multimodal AI Vision.
    """
    try:
        content = await file.read()
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Ukuran foto maksimal 15 MB")
        
        result = process_receipt_image(content, original_filename=file.filename or "receipt.jpg")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses struk: {str(e)}")

@app.get("/api/v1/receipts/{filename}")
def get_receipt_image(filename: str):
    """Serve uploaded receipt image file."""
    # Basic path traversal protection
    safe_filename = Path(filename).name
    receipt_path = RECEIPTS_DIR / safe_filename
    if not receipt_path.exists() or not receipt_path.is_file():
        raise HTTPException(status_code=404, detail="File struk tidak ditemukan")
    
    ext = receipt_path.suffix.lower()
    media_type = "image/jpeg"
    if ext == ".png":
        media_type = "image/png"
    elif ext == ".webp":
        media_type = "image/webp"
        
    return FileResponse(receipt_path, media_type=media_type)

# 6. Payout Toggle Endpoint (Cash taken checklist)
@app.post("/api/v1/payout/toggle")
def toggle_payout(req: TogglePayoutRequest, date: Optional[str] = Query(None)):
    target_date = date or crud.get_current_wib_date()
    crud.toggle_payout_status(target_date, req.partner_id, req.is_taken)
    return {"success": True, "message": "Status penarikan cash berhasil diperbarui"}

# 6. Session Lifecycle Endpoints
@app.post("/api/v1/day/close")
def close_session(date: Optional[str] = Query(None)):
    target_date = date or crud.get_current_wib_date()
    crud.close_day_session(target_date)
    return {"success": True, "message": f"Sesi buku tanggal {target_date} berhasil ditutup"}

@app.post("/api/v1/day/reopen")
def reopen_session(date: Optional[str] = Query(None)):
    target_date = date or crud.get_current_wib_date()
    crud.reopen_day_session(target_date)
    return {"success": True, "message": f"Sesi buku tanggal {target_date} berhasil dibuka kembali"}

# 7. History Endpoint
@app.get("/api/v1/history")
def list_history():
    hist = crud.get_history_summary()
    return {"success": True, "data": hist}

# 8. Frontend Static Serving
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.head("/")
@app.get("/{full_path:path}")
@app.head("/{full_path:path}")
def serve_spa(full_path: str = ""):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")
    
    file_path = FRONTEND_DIR / full_path
    if file_path.is_file():
        return FileResponse(file_path)
    
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    
    return JSONResponse({"status": "Frontend loading..."})
