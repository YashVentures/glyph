from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any
import time
import secrets
from ..core.db import get_database
from ..core.config import settings
from ..schemas.folders import FolderCreate, FolderRename, FolderResponse, FolderListResponse
from ..schemas.common import SuccessResponse

router = APIRouter(prefix="/folders", tags=["folders"])

def generate_id() -> str:
    return secrets.token_urlsafe(10)

def sanitize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        del d["_id"]
    return d

@router.get("", response_model=FolderListResponse)
async def list_folders():
    db = await get_database()
    cursor = db.folders.find({"workspace_id": settings.DEFAULT_WORKSPACE_ID}).sort("name", 1)
    folders = []
    try:
        async for doc in cursor:
            folders.append(sanitize_doc(doc))
    except TypeError:
        for doc in cursor:
            folders.append(sanitize_doc(doc))
    return {"success": True, "folders": folders}

@router.post("", response_model=FolderResponse, status_code=201)
async def create_folder(body: FolderCreate):
    db = await get_database()
    now = int(time.time() * 1000)
    folder_id = generate_id()

    new_folder = {
        "id": folder_id,
        "name": body.name.strip(),
        "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        "user_id": settings.DEFAULT_USER_ID,
        "created_at": now,
        "updated_at": now
    }

    ins = db.folders.insert_one(new_folder)
    if hasattr(ins, "__await__"):
        await ins

    return {"success": True, "folder": sanitize_doc(new_folder)}

@router.patch("/{folder_id}", response_model=FolderResponse)
async def rename_folder(folder_id: str, body: FolderRename):
    db = await get_database()
    now = int(time.time() * 1000)

    upd = db.folders.update_one({"id": folder_id}, {"$set": {"name": body.name.strip(), "updated_at": now}})
    if hasattr(upd, "__await__"):
        await upd

    res = db.folders.find_one({"id": folder_id})
    folder_doc = await res if hasattr(res, "__await__") else res

    if not folder_doc:
        raise HTTPException(status_code=404, detail=f"Folder with id '{folder_id}' not found")

    return {"success": True, "folder": sanitize_doc(folder_doc)}

@router.delete("/{folder_id}", response_model=SuccessResponse)
async def delete_folder(folder_id: str):
    db = await get_database()

    # Unset folder_id on files belonging to this folder
    upd_files = db.files.update_many({"folder_id": folder_id}, {"$set": {"folder_id": None}})
    if hasattr(upd_files, "__await__"):
        await upd_files

    dele = db.folders.delete_one({"id": folder_id})
    if hasattr(dele, "__await__"):
        await dele

    return {"success": True, "message": "Folder deleted successfully"}
