import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routers.templates import SEED_TEMPLATES

client = TestClient(app)

def test_template_gallery_endpoints():
    # 1. Fetch all templates
    res = client.get("/api/v1/templates")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    templates = data["templates"]

    # Verify a handful for each diagram type (Flowchart, Sequence, ERD, Cloud Architecture)
    categories = {t["category"] for t in templates}
    assert "Flowchart" in categories
    assert "Sequence" in categories
    assert "ERD" in categories
    assert "Cloud Architecture" in categories

    assert len(templates) >= 8

    # 2. Test category filter
    seq_res = client.get("/api/v1/templates?category=Sequence")
    assert seq_res.status_code == 200
    seq_templates = seq_res.json()["templates"]
    assert all(t["category"] == "Sequence" for t in seq_templates)
    assert len(seq_templates) >= 2

    # 3. Test get specific template by ID
    first_id = templates[0]["id"]
    single_res = client.get(f"/api/v1/templates/{first_id}")
    assert single_res.status_code == 200
    assert single_res.json()["template"]["id"] == first_id

    # 4. Non-existent template returns 404
    not_found = client.get("/api/v1/templates/nonexistent-template-id")
    assert not_found.status_code == 404
