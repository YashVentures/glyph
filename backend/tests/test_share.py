import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_share_workflow_and_security():
    # 1. Create a test file
    now = int(time.time() * 1000)
    file_payload = {
        "title": "Secret Project Specs",
        "docContent": "# Confidential Specs\nDetails here.",
        "canvasData": '{"diagrams": [{"id": "diag-1", "code": "A > B", "type": "diagram"}]}'
    }
    create_res = client.post("/api/v1/files", json=file_payload)
    assert create_res.status_code == 201
    file_id = create_res.json()["file"]["id"]

    # Create a second private file to ensure share token cannot read other files
    second_file_res = client.post("/api/v1/files", json={
        "title": "Another Private Document",
        "docContent": "# Top Secret 2",
        "canvasData": '{"diagrams": []}'
    })
    assert second_file_res.status_code == 201
    second_file_id = second_file_res.json()["file"]["id"]

    # 2. Create view-only share link with targeting parameters
    share_payload = {
        "fileId": file_id,
        "targetDiagramId": "diag-1",
        "targetElements": ["node-A", "node-B"]
    }
    share_res = client.post("/api/v1/share", json=share_payload)
    assert share_res.status_code == 201
    share_data = share_res.json()
    assert share_data["success"] is True
    share_id = share_data["share"]["id"]
    
    # Token must be cryptographically random and unguessable (len >= 32)
    assert len(share_id) >= 32
    assert "diagram=diag-1" in share_data["shareUrl"]
    assert "elements=node-A,node-B" in share_data["shareUrl"]

    # 3. Retrieve share link for file
    file_share_res = client.get(f"/api/v1/share/file/{file_id}")
    assert file_share_res.status_code == 200
    assert file_share_res.json()["share"]["id"] == share_id

    # 4. Access shared file via public endpoint without authentication
    public_res = client.get(f"/api/v1/share/{share_id}")
    assert public_res.status_code == 200
    public_data = public_res.json()
    assert public_data["success"] is True
    assert public_data["file"]["id"] == file_id
    assert public_data["file"]["title"] == "Secret Project Specs"
    assert public_data["share"]["target_diagram_id"] == "diag-1"

    # 5. Verify query parameter overrides (?diagram=..., ?figure=..., ?elements=...)
    targeted_res = client.get(f"/api/v1/share/{share_id}?diagram=custom-diag&figure=fig-99&elements=e1,e2")
    assert targeted_res.status_code == 200
    targeted_share = targeted_res.json()["share"]
    assert targeted_share["target_diagram_id"] == "custom-diag"
    assert targeted_share["target_figure_id"] == "fig-99"
    assert targeted_share["target_elements"] == ["e1", "e2"]

    # 6. Security test: Share token CANNOT be used to read any other file
    # Direct access to second_file_id via share endpoint with invalid token or second id returns 404
    assert client.get(f"/api/v1/share/{second_file_id}").status_code == 404

    # 7. Security test: Share endpoint exposes NO write routes (POST/PUT/PATCH to /share/{id} do not exist)
    assert client.post(f"/api/v1/share/{share_id}", json={"docContent": "Hacked"}).status_code in (404, 405)
    assert client.put(f"/api/v1/share/{share_id}", json={"docContent": "Hacked"}).status_code in (404, 405)
    assert client.patch(f"/api/v1/share/{share_id}", json={"docContent": "Hacked"}).status_code in (404, 405)

    # 8. Revoke share link
    revoke_res = client.delete(f"/api/v1/share/{share_id}")
    assert revoke_res.status_code == 200
    assert revoke_res.json()["success"] is True

    # 9. Verifying that revoking immediately makes subsequent GET return 404
    expired_res = client.get(f"/api/v1/share/{share_id}")
    assert expired_res.status_code == 404
    assert "not found or expired" in expired_res.json()["error"]["message"]

    # Checking file share status now shows inactive
    check_file_share = client.get(f"/api/v1/share/file/{file_id}")
    assert check_file_share.status_code == 200
    assert check_file_share.json()["share"] is None
