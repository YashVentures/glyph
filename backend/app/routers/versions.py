from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import time
import secrets
from ..core.db import get_database
from ..schemas.versions import (
    VersionSnapshotCreate, 
    VersionCreate,
    VersionResponse, 
    VersionListResponse, 
    VersionRestoreResponse,
    VersionItem
)

router = APIRouter(prefix="/versions", tags=["versions"])

def generate_id() -> str:
    return secrets.token_urlsafe(10)

def sanitize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        del d["_id"]
    return d

@router.get("/{file_id}", response_model=VersionListResponse)
async def list_versions(
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

@router.post("", response_model=VersionResponse, status_code=201)
async def create_version_snapshot(body: VersionSnapshotCreate):
    db = await get_database()
    version_id = generate_id()
    now = int(time.time() * 1000)

    count_res = db.file_versions.count_documents({"file_id": body.fileId})
    total = await count_res if hasattr(count_res, "__await__") else count_res

    version_name = body.name or f"Version {total + 1}"
    new_version = {
        "id": version_id,
        "file_id": body.fileId,
        "name": version_name,
        "doc_content": body.docContent or "",
        "canvas_data": body.canvasData or "{}",
        "note": body.note or "Manual snapshot",
        "is_auto": False,
        "created_at": now
    }

    ins = db.file_versions.insert_one(new_version)
    if hasattr(ins, "__await__"):
        await ins

    return {"success": True, "version": sanitize_doc(new_version)}

@router.get("/{file_id}/{version_id}", response_model=VersionResponse)
async def get_version_by_id(file_id: str, version_id: str):
    db = await get_database()
    res = db.file_versions.find_one({"id": version_id, "file_id": file_id})
    ver_doc = await res if hasattr(res, "__await__") else res

    if not ver_doc:
        raise HTTPException(status_code=404, detail=f"Version '{version_id}' not found")

    return {"success": True, "version": sanitize_doc(ver_doc)}

@router.post("/{file_id}/{version_id}/restore", response_model=VersionRestoreResponse)
async def restore_version_by_id(file_id: str, version_id: str):
    db = await get_database()
    now = int(time.time() * 1000)

    res_ver = db.file_versions.find_one({"id": version_id, "file_id": file_id})
    target_ver = await res_ver if hasattr(res_ver, "__await__") else res_ver
    if not target_ver:
        raise HTTPException(status_code=404, detail=f"Version '{version_id}' not found")

    res_file = db.files.find_one({"id": file_id})
    current_file = await res_file if hasattr(res_file, "__await__") else res_file
    if not current_file:
        raise HTTPException(status_code=404, detail=f"File '{file_id}' not found")

    # Pre-restore backup
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
