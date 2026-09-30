"""
Unit and Integration Tests for No Pusing Pusing (NPP).
Author: Devera (CTO & Lead Accountant)
"""

import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.database import init_db

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["project"] == "No Pusing Pusing (NPP)"
    assert data["dedicated_to"] == "Bang Fauzan"
    assert data["cto_accountant"] == "Devera"

def test_seven_partners_exist(client):
    res = client.get("/api/v1/partners")
    assert res.status_code == 200
    partners = res.json()["data"]
    assert len(partners) == 7
    names = [p["name"] for p in partners]
    assert "Bang Fauzan" in names
    assert "Daniandra" in names

def test_solo_transaction_and_payout(client):
    test_date = "2026-10-01"
    # Create Solo transaction for Bang Fauzan (id: 1)
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
    assert trx["shares"][0]["partner_name"] == "Bang Fauzan"
    assert trx["shares"][0]["percentage"] == 100.0

    # Verify Board
    board_res = client.get(f"/api/v1/board?date={test_date}")
    assert board_res.status_code == 200
    board = board_res.json()["data"]
    assert board["total_capital"] == 30000000.0
    assert board["total_transactions"] == 1
    fauzan_payout = [p for p in board["payouts"] if p["name"] == "Bang Fauzan"][0]
    assert fauzan_payout["total_modal"] == 30000000.0
    assert fauzan_payout["is_taken"] is False

    # Toggle Taken
    toggle_res = client.post(f"/api/v1/payout/toggle?date={test_date}", json={"partner_id": 1, "is_taken": True})
    assert toggle_res.status_code == 200

    board_res2 = client.get(f"/api/v1/board?date={test_date}")
    board2 = board_res2.json()["data"]
    fauzan_payout2 = [p for p in board2["payouts"] if p["name"] == "Bang Fauzan"][0]
    assert fauzan_payout2["is_taken"] is True
    assert board2["all_settled"] is True

def test_patungan_transaction_math_and_validation(client):
    test_date = "2026-10-02"
    # 1. Invalid sum: fails validation
    invalid_payload = {
        "item_name": "Batangan 100g",
        "total_amount": 130000000.0,
        "shares": [
            {"partner_id": 1, "amount": 50000000.0},
            {"partner_id": 2, "amount": 50000000.0} # Missing 30 jt
        ]
    }
    fail_res = client.post(f"/api/v1/transactions?date={test_date}", json=invalid_payload)
    assert fail_res.status_code == 400

    # 2. Valid Patungan (3 people: Bang Fauzan 60 jt, Daniandra 40 jt, Partner 3 30 jt)
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

    # Check WA format output
    wa = board["whatsapp_rekap"]
    assert "Bang Fauzan" in wa
    assert "Rp 60.000.000" in wa
    assert "Daniandra" in wa
    assert "Rp 40.000.000" in wa
    assert "Total Modal Ditarik : *Rp 130.000.000*" in wa

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
