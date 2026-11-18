import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_data_stats_endpoint(client):
    response = client.get("/api/data/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == 73
    assert data["suppliers"] == 48
    assert data["plants"] == 2
    assert data["contracts"] >= 12

def test_rankings_endpoint(client):
    response = client.get("/api/rankings?item_code=ITM-1048&as_of_date=2026-11-01&top_n=3")
    assert response.status_code == 200
    data = response.json()
    assert data["item_code"] == "ITM-1048"
    assert len(data["rankings"]) > 0

def test_active_policy_endpoint(client):
    response = client.get("/api/policies/active")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ACTIVE"

def test_contracts_list_endpoint(client):
    response = client.get("/api/contracts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 12

def test_buyer_requirements_endpoint(client):
    response = client.get("/api/buyer/requirements")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 20
    assert "X-Total-Count" in response.headers
    assert "X-Has-More" in response.headers

    # Test second page offset=20
    p2_res = client.get("/api/buyer/requirements?limit=20&offset=20")
    assert p2_res.status_code == 200
    p2_data = p2_res.json()
    assert isinstance(p2_data, list)

def test_buyer_requirements_envelope(client):
    response = client.get("/api/buyer/requirements?limit=20&envelope=true")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total_count" in data
    assert "has_more" in data
    assert "stats" in data
    assert isinstance(data["items"], list)

def test_buyer_stats_endpoint(client):
    response = client.get("/api/buyer/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "pending" in data
    assert "approved" in data
    assert "overridden" in data
    assert data["total"] >= 0
