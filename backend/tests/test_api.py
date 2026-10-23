import pytest
from fastapi.testclient import TestClient
from app.main import app
from tests.test_versions import MockDatabase

@pytest.fixture
def mock_db(monkeypatch):
    db = MockDatabase()
    async def get_test_db():
        return db

    monkeypatch.setattr("app.core.db.get_database", get_test_db)
    monkeypatch.setattr("app.routers.files.get_database", get_test_db)
    monkeypatch.setattr("app.routers.folders.get_database", get_test_db)
    monkeypatch.setattr("app.routers.icons.get_database", get_test_db)
    monkeypatch.setattr("app.routers.versions.get_database", get_test_db)
    return db

@pytest.fixture
def client(mock_db):
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["api_prefix"] == "/api/v1"

def test_files_crud_and_duplicate(client):
    # 1. Create file
    res = client.post("/api/v1/files", json={"title": "Test Diagram File"})
    assert res.status_code == 201
    created = res.json()
    assert created["success"] is True
    file_id = created["file"]["id"]
    assert created["file"]["title"] == "Test Diagram File"

    # 2. Get file
    res = client.get(f"/api/v1/files/{file_id}")
    assert res.status_code == 200
    assert res.json()["file"]["id"] == file_id

    # 3. Update file
    res = client.patch(f"/api/v1/files/{file_id}", json={"title": "Updated Test File"})
    assert res.status_code == 200
    assert res.json()["file"]["title"] == "Updated Test File"

    # 4. Duplicate file
    res = client.post(f"/api/v1/files/{file_id}/duplicate")
    assert res.status_code == 201
    dup_id = res.json()["file"]["id"]
    assert dup_id != file_id

    # 5. Delete files
    res_del1 = client.delete(f"/api/v1/files/{file_id}")
    assert res_del1.status_code == 200
    res_del2 = client.delete(f"/api/v1/files/{dup_id}")
    assert res_del2.status_code == 200

def test_folders_crud(client):
    # 1. Create folder
    res = client.post("/api/v1/folders", json={"name": "Architecture"})
    assert res.status_code == 201
    folder = res.json()["folder"]
    folder_id = folder["id"]

    # 2. Rename folder
    res = client.patch(f"/api/v1/folders/{folder_id}", json={"name": "System Architecture"})
    assert res.status_code == 200
    assert res.json()["folder"]["name"] == "System Architecture"

    # 3. Delete folder
    res = client.delete(f"/api/v1/folders/{folder_id}")
    assert res.status_code == 200

def test_icon_sanitization(client):
    # Valid SVG
    valid_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>'
    res = client.post("/api/v1/icons", json={"name": "valid-icon", "svgContent": valid_svg})
    assert res.status_code == 201

    # Malicious SVG with script tag - script should be stripped
    bad_svg = '<svg><script>alert("xss")</script><circle cx="5" cy="5" r="5"/></svg>'
    res = client.post("/api/v1/icons", json={"name": "bad-icon", "svgContent": bad_svg})
    assert res.status_code == 201
    assert "<script" not in res.json()["icon"]["svg_content"].lower()

    # Malicious SVG with javascript: URL - rejected with 400
    js_svg = '<svg><a href="javascript:alert(1)"><circle cx="5" cy="5" r="5"/></a></svg>'
    res_js = client.post("/api/v1/icons", json={"name": "bad-js-icon", "svgContent": js_svg})
    assert res_js.status_code == 400

def test_templates_endpoint(client):
    res = client.get("/api/v1/templates")
    assert res.status_code == 200
    data = res.json()
    assert len(data["templates"]) >= 4
