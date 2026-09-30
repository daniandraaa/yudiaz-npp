"""
AI OCR Receipt Engine for No Pusing Pusing (NPP).
Powered by 9Router Multimodal Gemini Vision.
Author: Devera (CTO & Lead Accountant)
"""

import os
import io
import re
import json
import uuid
import base64
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, Optional

RECEIPTS_DIR = Path(__file__).parent.parent / "data" / "receipts"
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)

def get_9router_api_key() -> Optional[str]:
    """Retrieve 9Router API Key from environment or .hermes/.env."""
    key = os.environ.get("HERMES_9ROUTER_API_KEY")
    if key:
        return key.strip().strip('"\'')
    
    # Try .hermes/.env
    env_file = Path.home() / ".hermes" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("HERMES_9ROUTER_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"\'')
                
    # Try profile .env
    profile_env = Path.home() / ".hermes" / "profiles" / "devera-accountant" / ".env"
    if profile_env.exists():
        for line in profile_env.read_text().splitlines():
            if line.startswith("HERMES_9ROUTER_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"\'')
                
    return None

def process_receipt_image(image_bytes: bytes, original_filename: str = "receipt.jpg") -> Dict[str, Any]:
    """
    Save receipt image and invoke Multimodal AI Vision to extract
    total_amount, item_name, and notes.
    """
    ext = Path(original_filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".jpg"
        
    receipt_filename = f"rcpt_{uuid.uuid4().hex[:12]}{ext}"
    receipt_path = RECEIPTS_DIR / receipt_filename
    
    # Save original image to disk
    with open(receipt_path, "wb") as f:
        f.write(image_bytes)
        
    api_key = get_9router_api_key()
    if not api_key:
        return {
            "success": True,
            "receipt_filename": receipt_filename,
            "receipt_url": f"/api/v1/receipts/{receipt_filename}",
            "total_amount": 0,
            "item_name": "Emas (Input Manual)",
            "notes": "API Key 9Router tidak terdeteksi, silakan isi manual.",
            "ocr_status": "no_key"
        }
        
    # Prepare base64 image
    mime_type = "image/jpeg"
    if ext == ".png":
        mime_type = "image/png"
    elif ext == ".webp":
        mime_type = "image/webp"
        
    b64_img = base64.b64encode(image_bytes).decode("utf-8")
    
    prompt = """Kamu adalah Devera, Lead Accountant dan AI OCR akuntan toko emas No Pusing Pusing.
Tugasmu adalah menganalisis foto bukti transaksi/nota/struk/faktur pembelian emas atau bukti transfer permodalan emas.
Ekstrak informasi penting secara teliti:
1. total_amount: Nominal total pembelian emas dalam Rupiah (angka murni integer/float tanpa titik atau simbol Rp). Jika ada harga total, ambil total bayar.
2. item_name: Keterangan singkat barang emas yang dibeli (misal: "Kalung Emas 24K 20g", "Gelang Rantai 15.2g", "Logam Mulia Antam 50g"). Jika tidak tertera jelas, buat ringkasan gramatur atau nama perhiasan/koin yang tampak.
3. notes: Keterangan tambahan bermanfaat dari nota (nama toko/penjual, harga per gram, metode transfer/cash, tanggal transaksi nota).

KEMBALIKAN HANYA JSON MURNI TANPA MARKDOWN ATAU PENJELASAN LAIN:
{
  "total_amount": 25000000,
  "item_name": "Kalung Emas 24K 20 Gram",
  "notes": "Toko Emas Berkah, Transfer BCA, Rp 1.250.000/gr"
}
"""

    payload = {
        "model": "ag/gemini-3.8-flash-high",
        "stream": False,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{b64_img}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0.1
    }
    
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:20128/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw_content = data["choices"][0]["message"]["content"].strip()
            
            # Clean markdown codeblocks if model wrapped in ```json
            if raw_content.startswith("```"):
                raw_content = re.sub(r"^```(?:json)?\s*", "", raw_content)
                raw_content = re.sub(r"\s*```$", "", raw_content)
                
            parsed = json.loads(raw_content)
            
            total_amount = float(parsed.get("total_amount", 0))
            item_name = str(parsed.get("item_name", "Emas")).strip()
            notes = str(parsed.get("notes", "")).strip()
            
            return {
                "success": True,
                "receipt_filename": receipt_filename,
                "receipt_url": f"/api/v1/receipts/{receipt_filename}",
                "total_amount": total_amount,
                "item_name": item_name,
                "notes": notes,
                "ocr_status": "ai_parsed"
            }
    except Exception as e:
        return {
            "success": True,
            "receipt_filename": receipt_filename,
            "receipt_url": f"/api/v1/receipts/{receipt_filename}",
            "total_amount": 0,
            "item_name": "Emas (Foto Terlampir)",
            "notes": f"Foto berhasil disimpan. Deteksi otomatis terkendala: {str(e)[:100]}. Silakan input nominal manual.",
            "ocr_status": "error_fallback"
        }
