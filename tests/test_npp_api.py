"""
Unit and Integration Tests for No Pusing Pusing (NPP).
Using isolated test database.
Author: Devera (CTO & Lead Accountant)
"""

import os
from pathlib import Path
import pytest
from starlette.testclient import TestClient

# Set isolated test database
TEST_DB = Path("/tmp/test_npp_isolated.db")
if TEST_DB.exists():
    TEST_DB.unlink()

import backend.database
backend.database.DB_PATH = TEST_DB

from backend.main import app
from backend.database import init_db

@pytest.fixture(scope="module", autouse=True)
def setup_isolated_db():
    init_db()
    yield
    if TEST_DB.exists():
        TEST_DB.unlink()

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["project"] == "No Pusing Pusing (NPP)"

def test_seven_partners_exist(client):
    res = client.get("/api/v1/partners")
    assert res.status_code == 200
    partners = res.json()["data"]
    assert len(partners) == 7

def test_solo_transaction_and_payout(client):
    test_date = "2026-10-01"
    payload = {
        "item_name": "Gelang Emas 25g",
        "total_amount": 30000000.0,
        "shares": [
            {"partner_id": 1, "amount": 30000000.0}
        ],
        "notes": "Beli dari langganan"
    }
    create_res = client.post(f"/api/v1/transactions?date={test_date}", json=payload)
    assert create_res.status_code == 201
    trx = create_res.json()["data"]
    assert trx["total_amount"] == 30000000.0
    assert len(trx["shares"]) == 1

    board_res = client.get(f"/api/v1/board?date={test_date}")
    assert board_res.status_code == 200
    board = board_res.json()["data"]
    assert board["total_capital"] == 30000000.0
    assert board["total_transactions"] == 1

    p1 = next(p for p in board["payouts"] if p["partner_id"] == 1)
    assert p1["total_modal"] == 30000000.0
    assert p1["is_taken"] is False

    # Toggle Taken
    toggle_res = client.post(f"/api/v1/payout/toggle?date={test_date}", json={"partner_id": 1, "is_taken": True})
    assert toggle_res.status_code == 200

    board_res2 = client.get(f"/api/v1/board?date={test_date}")
    board2 = board_res2.json()["data"]
    p1_after = next(p for p in board2["payouts"] if p["partner_id"] == 1)
    assert p1_after["is_taken"] is True

def test_patungan_transaction_math_and_validation(client):
    test_date = "2026-10-02"
    invalid_payload = {
        "item_name": "Batangan 100g",
        "total_amount": 130000000.0,
        "shares": [
            {"partner_id": 1, "amount": 50000000.0},
            {"partner_id": 2, "amount": 50000000.0}
        ]
    }
    fail_res = client.post(f"/api/v1/transactions?date={test_date}", json=invalid_payload)
    assert fail_res.status_code == 400

    valid_payload = {
        "item_name": "Batangan 100g",
        "total_amount": 130000000.0,
        "shares": [
            {"partner_id": 1, "amount": 60000000.0},
            {"partner_id": 2, "amount": 40000000.0},
            {"partner_id": 3, "amount": 30000000.0}
        ]
    }
    ok_res = client.post(f"/api/v1/transactions?date={test_date}", json=valid_payload)
    assert ok_res.status_code == 201

    board_res = client.get(f"/api/v1/board?date={test_date}")
    board = board_res.json()["data"]
    assert board["total_capital"] == 130000000.0

    p_map = {p["partner_id"]: p["total_modal"] for p in board["payouts"]}
    assert p_map[1] == 60000000.0
    assert p_map[2] == 40000000.0
    assert p_map[3] == 30000000.0
    assert p_map[4] == 0.0

def test_close_and_reopen_session(client):
    test_date = "2026-10-03"
    client.get(f"/api/v1/board?date={test_date}")
    
    close_res = client.post(f"/api/v1/day/close?date={test_date}")
    assert close_res.status_code == 200
    b1 = client.get(f"/api/v1/board?date={test_date}").json()["data"]
    assert b1["status"] == "CLOSED"

    reopen_res = client.post(f"/api/v1/day/reopen?date={test_date}")
    assert reopen_res.status_code == 200
    b2 = client.get(f"/api/v1/board?date={test_date}").json()["data"]
    assert b2["status"] == "ACTIVE"
