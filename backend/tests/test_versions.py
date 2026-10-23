import pytest
from fastapi.testclient import TestClient
from app.main import app
import time

class MockCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, field, direction=-1):
        reverse = (direction == -1)
        self.items.sort(key=lambda x: x.get(field, 0), reverse=reverse)
        return self

    def skip(self, n):
        self.items = self.items[n:]
        return self

    def limit(self, n):
        self.items = self.items[:n]
        return self

    def __iter__(self):
        return iter(self.items)

    async def __aiter__(self):
        for item in self.items:
            yield item

class MockCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        d = dict(doc)
        self.docs.append(d)
        return type("Result", (), {"inserted_id": d.get("id")})()

    async def find_one(self, query, sort=None):
        matched = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                matched.append(d)
        if not matched:
            return None
        if sort:
            field, direction = sort[0]
            matched.sort(key=lambda x: x.get(field, 0), reverse=(direction == -1))
        return dict(matched[0])

    def find(self, query=None):
        if not query:
            return MockCursor([dict(d) for d in self.docs])
        matched = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                matched.append(dict(d))
        return MockCursor(matched)

    async def update_one(self, query, update):
        set_vals = update.get("$set", {})
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                d.update(set_vals)
                return type("Result", (), {"modified_count": 1})()
        return type("Result", (), {"modified_count": 0})()

    async def update_many(self, query, update):
        set_vals = update.get("$set", {})
        count = 0
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                d.update(set_vals)
                count += 1
        return type("Result", (), {"modified_count": count})()

    async def delete_one(self, query):
        for i, d in enumerate(self.docs):
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                del self.docs[i]
                return type("Result", (), {"deleted_count": 1})()
        return type("Result", (), {"deleted_count": 0})()

    async def delete_many(self, query):
        initial = len(self.docs)
        self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in query.items())]
        return type("Result", (), {"deleted_count": initial - len(self.docs)})()

    async def count_documents(self, query):
        count = 0
        for d in self.docs:
            if all(d.get(k) == v for k, v in query.items()):
                count += 1
        return count

class MockDatabase:
    def __init__(self):
        self.files = MockCollection()
        self.file_versions = MockCollection()
        self.folders = MockCollection()
        self.icons = MockCollection()
        self.templates = MockCollection()
        self.share_links = MockCollection()

@pytest.fixture
def mock_db(monkeypatch):
    db = MockDatabase()
    async def get_test_db():
        return db

    monkeypatch.setattr("app.routers.files.get_database", get_test_db)
    monkeypatch.setattr("app.routers.versions.get_database", get_test_db)
    return db

@pytest.fixture
def client(mock_db):
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

def test_optimistic_concurrency_409(client):
    # 1. Create file (initial version = 1)
    res = client.post("/api/v1/files", json={"title": "Concurrency Doc"})
    assert res.status_code == 201
    file_id = res.json()["file"]["id"]
    assert res.json()["file"]["version"] == 1

    # 2. Update with expected_version = 1 -> succeeds, version becomes 2
    res_a = client.patch(
        f"/api/v1/files/{file_id}", 
        json={"docContent": "Update by Session A", "expected_version": 1}
    )
    assert res_a.status_code == 200
    assert res_a.json()["file"]["version"] == 2

    # 3. Update with stale expected_version = 1 -> rejects with 409 Conflict
    res_stale = client.patch(
        f"/api/v1/files/{file_id}", 
        json={"docContent": "Stale Update by Session B", "expected_version": 1}
    )
    assert res_stale.status_code == 409
    assert "Conflict" in str(res_stale.json())

    # 4. Overwrite with force = True -> succeeds regardless of stale version
    res_force = client.patch(
        f"/api/v1/files/{file_id}", 
        json={"docContent": "Forced Overwrite", "force": True}
    )
    assert res_force.status_code == 200
    assert res_force.json()["file"]["doc_content"] == "Forced Overwrite"
    assert res_force.json()["file"]["version"] == 3

def test_version_listing_and_manual_naming(client):
    # 1. Create file
    res = client.post("/api/v1/files", json={"title": "Versioned Document"})
    file_id = res.json()["file"]["id"]

    # 2. Create named manual versions
    v1_res = client.post(
        f"/api/v1/files/{file_id}/versions", 
        json={"name": "Release 1.0", "note": "Production baseline"}
    )
    assert v1_res.status_code == 201
    assert v1_res.json()["version"]["name"] == "Release 1.0"
    v1_id = v1_res.json()["version"]["id"]

    v2_res = client.post(
        f"/api/v1/files/{file_id}/versions", 
        json={"name": "Release 2.0", "note": "Second release"}
    )
    assert v2_res.status_code == 201
    assert v2_res.json()["version"]["name"] == "Release 2.0"

    # 3. Paginated listing
    list_res = client.get(f"/api/v1/files/{file_id}/versions?page=1&limit=10")
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["total"] == 2
    assert len(data["versions"]) == 2
    assert data["page"] == 1
    assert data["limit"] == 10

    # 4. Get specific version
    get_res = client.get(f"/api/v1/files/{file_id}/versions/{v1_id}")
    assert get_res.status_code == 200
    assert get_res.json()["version"]["name"] == "Release 1.0"

def test_version_restore_and_prerestore_snapshot(client):
    # 1. Create file and initial named version
    res = client.post("/api/v1/files", json={"title": "Design Specs", "docContent": "# Original Spec\nVersion 1 text."})
    file_id = res.json()["file"]["id"]

    v1_res = client.post(f"/api/v1/files/{file_id}/versions", json={"name": "v1.0"})
    v1_id = v1_res.json()["version"]["id"]

    # 2. Mutate file with drastic edits
    client.patch(f"/api/v1/files/{file_id}", json={"docContent": "# Drastic Changes\nOverwritten content."})

    # 3. Restore to v1.0
    restore_res = client.post(f"/api/v1/files/{file_id}/versions/{v1_id}/restore")
    assert restore_res.status_code == 200
    restored_file = restore_res.json()["file"]
    assert restored_file["doc_content"] == "# Original Spec\nVersion 1 text."

    # 4. Verify automatic pre-restore backup snapshot was created before restoring
    list_res = client.get(f"/api/v1/files/{file_id}/versions")
    versions = list_res.json()["versions"]
    # There should now be at least 2 versions: v1.0 and the pre-restore backup
    assert len(versions) >= 2
    assert any("Backup before restoring" in v["name"] for v in versions)

def test_auto_snapshot_throttling(client, mock_db):
    # 1. Create file
    res = client.post("/api/v1/files", json={"title": "Throttled File"})
    file_id = res.json()["file"]["id"]

    # 2. First content edit triggers an initial auto-snapshot
    client.patch(f"/api/v1/files/{file_id}", json={"docContent": "Edit 1"})
    vers_after_edit1 = client.get(f"/api/v1/files/{file_id}/versions").json()["versions"]
    assert len(vers_after_edit1) == 1
    assert vers_after_edit1[0]["is_auto"] is True

    # 3. Immediate second content edit within throttling window (under 3 min) -> throttled (no new auto-snapshot)
    client.patch(f"/api/v1/files/{file_id}", json={"docContent": "Edit 2 (rapid)"})
    vers_after_edit2 = client.get(f"/api/v1/files/{file_id}/versions").json()["versions"]
    assert len(vers_after_edit2) == 1

    # 4. Advance time past throttling window (e.g. 4 minutes in past)
    old_time = int(time.time() * 1000) - (240 * 1000)
    for v in mock_db.file_versions.docs:
        v["created_at"] = old_time

    # Edit 3 after throttle window -> new auto-snapshot created
    client.patch(f"/api/v1/files/{file_id}", json={"docContent": "Edit 3 (after window)"})
    vers_after_edit3 = client.get(f"/api/v1/files/{file_id}/versions").json()["versions"]
    assert len(vers_after_edit3) == 2

def test_destructive_edit_after_idle_preserves_and_recovers_previous_content(client, mock_db):
    """
    Follow-up 2: make sure any content state older than the throttle window is recoverable.
    If an auto snapshot only captures the new state after an edit, a destructive edit after
    a long idle period would overwrite the only copy.
    The previous content MUST be captured when the interval has elapsed.
    """
    # 1. Create file with precious content
    precious_doc = "# Architecture Roadmap\n1. Core Engine\n2. Real-time Canvas\n3. Export & AI"
    res = client.post("/api/v1/files", json={"title": "Important Document", "docContent": precious_doc})
    file_id = res.json()["file"]["id"]

    # 2. First edit within throttle window
    client.patch(f"/api/v1/files/{file_id}", json={"docContent": precious_doc + "\n4. Cloud Sync"})
    # The file currently has 4 items
    file_data = client.get(f"/api/v1/files/{file_id}").json()["file"]
    assert "4. Cloud Sync" in file_data["doc_content"]

    # 3. Long idle period passes (> 3 minutes throttle interval)
    four_minutes_ago = int(time.time() * 1000) - (240 * 1000)
    for v in mock_db.file_versions.docs:
        v["created_at"] = four_minutes_ago

    # 4. Destructive edit occurs after idle period (e.g. accidental wipeout / empty doc)
    destructive_doc = "Oops, accidentally deleted everything."
    client.patch(f"/api/v1/files/{file_id}", json={"docContent": destructive_doc})

    # The current file is indeed the destructive version
    current_file = client.get(f"/api/v1/files/{file_id}").json()["file"]
    assert current_file["doc_content"] == destructive_doc

    # 5. Check version history:
    # A snapshot MUST have been captured containing the PREVIOUS content (precious_doc + 4. Cloud Sync),
    # NOT the destructive edit!
    versions_res = client.get(f"/api/v1/files/{file_id}/versions")
    versions = versions_res.json()["versions"]
    assert len(versions) >= 2

    # Latest auto snapshot before the destructive write must contain the previous content
    latest_auto_snap = versions[0]
    assert "4. Cloud Sync" in latest_auto_snap["doc_content"]
    assert destructive_doc not in latest_auto_snap["doc_content"]

    # 6. Restore from that snapshot and verify complete recovery
    restore_res = client.post(f"/api/v1/files/{file_id}/versions/{latest_auto_snap['id']}/restore")
    assert restore_res.status_code == 200
    restored_file = restore_res.json()["file"]
    assert "4. Cloud Sync" in restored_file["doc_content"]
    assert "Architecture Roadmap" in restored_file["doc_content"]
