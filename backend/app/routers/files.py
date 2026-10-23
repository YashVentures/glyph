from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import time
import json
import secrets
from ..core.db import get_database
from ..core.config import settings
from ..schemas.files import FileCreate, FileUpdate, FileResponse, FileListResponse, FileItem
from ..schemas.versions import (
    VersionCreate, 
    VersionListResponse, 
    VersionResponse, 
    VersionRestoreResponse,
    VersionItem
)
from ..schemas.common import SuccessResponse

router = APIRouter(prefix="/files", tags=["files"])

# Auto-snapshot throttling interval: 3 minutes (180,000 ms)
AUTO_SNAPSHOT_INTERVAL_MS = 180000

def generate_id() -> str:
    return secrets.token_urlsafe(10)

def sanitize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        del d["_id"]
    return d

@router.get("", response_model=FileListResponse)
async def list_files(
    folderId: Optional[str] = None,
    search: Optional[str] = None,
    recents: Optional[bool] = False,
    archived: Optional[bool] = False
):
    db = await get_database()
    query: Dict[str, Any] = {
        "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        "is_archived": 1 if archived else 0
    }

    if folderId is not None:
        if folderId == "" or folderId == "null":
            query["folder_id"] = None
        else:
            query["folder_id"] = folderId

    if search and search.strip():
        term = search.strip()
        query["$or"] = [
            {"title": {"$regex": term, "$options": "i"}},
            {"doc_content": {"$regex": term, "$options": "i"}},
            {"canvas_data": {"$regex": term, "$options": "i"}}
        ]

    cursor = db.files.find(query)

    if recents:
        cursor = cursor.sort("last_accessed_at", -1).limit(30)
    else:
        cursor = cursor.sort("updated_at", -1)

    files = []
    try:
        async for doc in cursor:
            s = sanitize_doc(doc)
            s["preview"] = (s.get("doc_content") or "")[:120]
            files.append(s)
    except TypeError:
        for doc in cursor:
            s = sanitize_doc(doc)
            s["preview"] = (s.get("doc_content") or "")[:120]
            files.append(s)

    return {"success": True, "files": files}

@router.post("", response_model=FileResponse, status_code=201)
async def create_file(body: FileCreate):
    db = await get_database()
    file_id = generate_id()
    now = int(time.time() * 1000)

    initial_canvas = body.canvasData or json.dumps({
        "camera": {"zoom": 1, "panX": 0, "panY": 0},
        "diagrams": [
            {
                "id": f"diag-{file_id[:6]}",
                "type": "diagram",
                "diagramType": "flowchart-diagram",
                "code": f"title {body.title}\n\nstart [shape: oval, color: blue]\nprocess [shape: rectangle, color: green]\nfinish [shape: oval, color: purple]\n\nstart > process: begin flow\nprocess > finish: complete",
                "x": 80,
                "y": 80
            }
        ]
    })

    initial_doc = body.docContent or f"# {body.title}\n\nStart typing notes or edit the diagram on the canvas.\n"

    target_folder = body.folderId if body.folderId is not None else body.folder_id
    new_file = {
        "id": file_id,
        "title": body.title,
        "folder_id": target_folder if (target_folder and target_folder != "null") else None,
        "doc_content": initial_doc,
        "canvas_data": initial_canvas,
        "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        "user_id": settings.DEFAULT_USER_ID,
        "is_archived": 0,
        "version": 1,
        "created_at": now,
        "updated_at": now,
        "last_accessed_at": now
    }

    res = db.files.insert_one(new_file)
    if hasattr(res, "__await__"):
        await res

    return {"success": True, "file": sanitize_doc(new_file)}

@router.get("/{file_id}", response_model=FileResponse)
async def get_file(file_id: str):
    db = await get_database()
    now = int(time.time() * 1000)

    res = db.files.find_one({"id": file_id})
    file_doc = await res if hasattr(res, "__await__") else res

    if not file_doc:
        raise HTTPException(status_code=404, detail=f"File with id '{file_id}' not found")

    upd = db.files.update_one({"id": file_id}, {"$set": {"last_accessed_at": now}})
    if hasattr(upd, "__await__"):
        await upd

    file_doc["last_accessed_at"] = now
    return {"success": True, "file": sanitize_doc(file_doc)}

@router.patch("/{file_id}", response_model=FileResponse)
async def update_file(file_id: str, body: FileUpdate):
    db = await get_database()
    now = int(time.time() * 1000)

    res = db.files.find_one({"id": file_id})
    current = await res if hasattr(res, "__await__") else res

    if not current:
        raise HTTPException(status_code=404, detail=f"File with id '{file_id}' not found")

    cur_version = current.get("version", 1)
    cur_updated_at = current.get("updated_at", 0)

    # Optimistic Concurrency Control (409 on stale write)
    if not body.force:
        if body.expected_version is not None and body.expected_version != cur_version:
            raise HTTPException(
                status_code=409,
                detail=f"Conflict: File version is {cur_version}, expected {body.expected_version}"
            )
        if body.expected_updated_at is not None and cur_updated_at > body.expected_updated_at:
            raise HTTPException(
                status_code=409,
                detail=f"Conflict: File was modified at {cur_updated_at}, after expected {body.expected_updated_at}"
            )

    updates: Dict[str, Any] = {
        "updated_at": now,
        "version": cur_version + 1
    }

    if body.title is not None:
        updates["title"] = body.title
    upd_folder = body.folderId if body.folderId is not None else body.folder_id
    if upd_folder is not None:
        updates["folder_id"] = upd_folder if upd_folder != "null" else None
    if body.docContent is not None:
        updates["doc_content"] = body.docContent
    if body.canvasData is not None:
        updates["canvas_data"] = body.canvasData
    if body.isArchived is not None:
        updates["is_archived"] = 1 if body.isArchived else 0

    # Auto-Snapshot Throttling:
    # Only if content changed (doc_content or canvas_data) and >= AUTO_SNAPSHOT_INTERVAL_MS passed
    content_changed = (
        (body.docContent is not None and body.docContent != current.get("doc_content")) or
        (body.canvasData is not None and body.canvasData != current.get("canvas_data"))
    )

    if content_changed:
        latest_cursor = db.file_versions.find({"file_id": file_id}).sort("created_at", -1).limit(1)
        latest_ver = None
        try:
            async for doc in latest_cursor:
                latest_ver = doc
                break
        except TypeError:
            for doc in latest_cursor:
                latest_ver = doc
                break

        should_snapshot = False
        if not latest_ver:
            should_snapshot = True
        elif (now - latest_ver.get("created_at", 0)) >= AUTO_SNAPSHOT_INTERVAL_MS:
            # Also ensure content differs from latest snapshot
            if (current.get("doc_content") != latest_ver.get("doc_content") or
                current.get("canvas_data") != latest_ver.get("canvas_data")):
                should_snapshot = True

        if should_snapshot:
            auto_snap = {
                "id": generate_id(),
                "file_id": file_id,
                "name": f"Auto-save",
                "doc_content": current.get("doc_content", ""),
                "canvas_data": current.get("canvas_data", "{}"),
                "is_auto": True,
                "created_at": now
            }
            ins_snap = db.file_versions.insert_one(auto_snap)
            if hasattr(ins_snap, "__await__"):
                await ins_snap

    upd = db.files.update_one({"id": file_id}, {"$set": updates})
    if hasattr(upd, "__await__"):
        await upd

    res_updated = db.files.find_one({"id": file_id})
    file_doc = await res_updated if hasattr(res_updated, "__await__") else res_updated

    return {"success": True, "file": sanitize_doc(file_doc)}

@router.delete("/{file_id}", response_model=SuccessResponse)
async def delete_file(file_id: str):
    db = await get_database()
    dele = db.files.delete_one({"id": file_id})
    if hasattr(dele, "__await__"):
        await dele
    # Also delete associated versions
    del_ver = db.file_versions.delete_many({"file_id": file_id})
    if hasattr(del_ver, "__await__"):
        await del_ver
    return {"success": True, "message": "File deleted successfully"}

@router.post("/{file_id}/duplicate", response_model=FileResponse, status_code=201)
async def duplicate_file(file_id: str):
    db = await get_database()
    now = int(time.time() * 1000)

    res = db.files.find_one({"id": file_id})
    original = await res if hasattr(res, "__await__") else res

    if not original:
        raise HTTPException(status_code=404, detail=f"File with id '{file_id}' not found")

    new_id = generate_id()
    new_file = {
        "id": new_id,
        "title": f"{original.get('title', 'Untitled')} (Copy)",
        "folder_id": original.get("folder_id"),
        "doc_content": original.get("doc_content", ""),
        "canvas_data": original.get("canvas_data", "{}"),
        "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        "user_id": settings.DEFAULT_USER_ID,
        "is_archived": 0,
        "version": 1,
        "created_at": now,
        "updated_at": now,
        "last_accessed_at": now
    }

    ins = db.files.insert_one(new_file)
    if hasattr(ins, "__await__"):
        await ins

    return {"success": True, "file": sanitize_doc(new_file)}

# ----------------------------------------------------
# VERSION HISTORY ENDPOINTS (STEP 6)
# ----------------------------------------------------

@router.get("/{file_id}/versions", response_model=VersionListResponse)
async def list_file_versions(
    file_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    db = await get_database()
    skip = (page - 1) * limit

    count_res = db.file_versions.count_documents({"file_id": file_id})
    total = await count_res if hasattr(count_res, "__await__") else count_res

    cursor = db.file_versions.find({"file_id": file_id}).sort("created_at", -1).skip(skip).limit(limit)
    versions = []
    try:
        async for doc in cursor:
            versions.append(sanitize_doc(doc))
    except TypeError:
        for doc in cursor:
            versions.append(sanitize_doc(doc))

    return {
        "success": True,
        "versions": versions,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.post("/{file_id}/versions", response_model=VersionResponse, status_code=201)
async def create_named_version(file_id: str, body: VersionCreate):
    db = await get_database()
    now = int(time.time() * 1000)

    res = db.files.find_one({"id": file_id})
    file_doc = await res if hasattr(res, "__await__") else res
    if not file_doc:
        raise HTTPException(status_code=404, detail=f"File with id '{file_id}' not found")

    count_res = db.file_versions.count_documents({"file_id": file_id})
    total = await count_res if hasattr(count_res, "__await__") else count_res

    version_name = body.name or f"Version {total + 1}"
    new_version = {
        "id": generate_id(),
        "file_id": file_id,
        "name": version_name,
        "note": body.note,
        "doc_content": file_doc.get("doc_content", ""),
        "canvas_data": file_doc.get("canvas_data", "{}"),
        "is_auto": False,
        "created_at": now
    }

    ins = db.file_versions.insert_one(new_version)
    if hasattr(ins, "__await__"):
        await ins

    return {"success": True, "version": sanitize_doc(new_version)}

@router.get("/{file_id}/versions/{version_id}", response_model=VersionResponse)
async def get_version(file_id: str, version_id: str):
    db = await get_database()
    res = db.file_versions.find_one({"id": version_id, "file_id": file_id})
    ver_doc = await res if hasattr(res, "__await__") else res

    if not ver_doc:
        raise HTTPException(status_code=404, detail=f"Version '{version_id}' not found for file '{file_id}'")

    return {"success": True, "version": sanitize_doc(ver_doc)}

@router.post("/{file_id}/versions/{version_id}/restore", response_model=VersionRestoreResponse)
async def restore_version(file_id: str, version_id: str):
    db = await get_database()
    now = int(time.time() * 1000)

    # 1. Fetch target version
    res_ver = db.file_versions.find_one({"id": version_id, "file_id": file_id})
    target_ver = await res_ver if hasattr(res_ver, "__await__") else res_ver
    if not target_ver:
        raise HTTPException(status_code=404, detail=f"Version '{version_id}' not found")

    # 2. Fetch current file
    res_file = db.files.find_one({"id": file_id})
    current_file = await res_file if hasattr(res_file, "__await__") else res_file
    if not current_file:
        raise HTTPException(status_code=404, detail=f"File '{file_id}' not found")

    # 3. Mandatory: Create pre-restore automatic snapshot backup
    pre_restore_backup = {
        "id": generate_id(),
        "file_id": file_id,
        "name": f"Backup before restoring {target_ver.get('name') or version_id}",
        "note": "Automatic snapshot created before restore",
        "doc_content": current_file.get("doc_content", ""),
        "canvas_data": current_file.get("canvas_data", "{}"),
        "is_auto": False,
        "created_at": now
    }
    ins_backup = db.file_versions.insert_one(pre_restore_backup)
    if hasattr(ins_backup, "__await__"):
        await ins_backup

    # 4. Overwrite file content with target version
    cur_ver = current_file.get("version", 1)
    updates = {
        "doc_content": target_ver.get("doc_content", ""),
        "canvas_data": target_ver.get("canvas_data", "{}"),
        "version": cur_ver + 1,
        "updated_at": now
    }

    upd = db.files.update_one({"id": file_id}, {"$set": updates})
    if hasattr(upd, "__await__"):
        await upd

    res_restored = db.files.find_one({"id": file_id})
    restored_doc = await res_restored if hasattr(res_restored, "__await__") else res_restored

    return {
        "success": True,
        "restored_version_id": version_id,
        "file": sanitize_doc(restored_doc)
    }
