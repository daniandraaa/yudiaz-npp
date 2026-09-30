"""
Pydantic Schemas for No Pusing Pusing (NPP).
Author: Devera (CTO & Lead Accountant)
"""

from typing import List, Optional
from pydantic import BaseModel, Field

class PartnerItem(BaseModel):
    id: int
    name: str
    initials: str
    color: str
    is_active: bool = True

class PartnerUpdateRequest(BaseModel):
    name: str
    initials: Optional[str] = None
    color: Optional[str] = None

class ShareInput(BaseModel):
    partner_id: int
    amount: float

class TransactionCreateRequest(BaseModel):
    item_name: Optional[str] = Field(default="Emas")
    total_amount: float
    shares: List[ShareInput]
    notes: Optional[str] = None

class ShareDetail(BaseModel):
    partner_id: int
    partner_name: str
    partner_initials: str
    partner_color: str
    amount: float
    percentage: float

class TransactionResponse(BaseModel):
    id: str
    day_date: str
    item_name: str
    total_amount: float
    shares: List[ShareDetail]
    notes: Optional[str] = None
    created_at: str

class PartnerPayout(BaseModel):
    partner_id: int
    name: str
    initials: str
    color: str
    total_modal: float
    transaction_count: int
    is_taken: bool
    taken_at: Optional[str] = None
    items_breakdown: List[dict]

class DailyBoardResponse(BaseModel):
    day_date: str
    status: str  # ACTIVE or CLOSED
    opened_at: str
    closed_at: Optional[str] = None
    total_capital: float
    total_transactions: int
    payouts: List[PartnerPayout]
    all_settled: bool
    whatsapp_rekap: str

class TogglePayoutRequest(BaseModel):
    partner_id: int
    is_taken: bool
