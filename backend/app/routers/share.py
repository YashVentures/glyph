from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any
import time
import secrets
from ..core.db import get_database
from ..schemas.share import ShareLinkCreate, ShareLinkResponse, ShareLinkItem

router = APIRouter(prefix="/share", tags=["share"])

def generate_id() -> str:
    return secrets.token_urlsafe(8)

def sanitize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        del d["_id"]
    return d

@router.post("", response_model=ShareLinkResponse, status_code=201)
async def create_share_link(body: ShareLinkCreate):
    db = await get_database()
    share_id = generate_id()
    now = int(time.time() * 1000)

    new_share = {
        "id": share_id,
        "file_id": body.fileId,
        "target_diagram_id": body.targetDiagramId,
        "target_figure_id": body.targetFigureId,
        "target_elements": body.targetElements or [],
        "is_public": True,
        "created_at": now
    }

    ins = db.share_links.insert_one(new_share)
    if hasattr(ins, "__await__"):
        await ins

    share_url = f"/share/{share_id}"
    if body.targetDiagramId:
        share_url += f"?diagram={body.targetDiagramId}"

    return {
        "success": True,
        "share": sanitize_doc(new_share),
        "shareUrl": share_url
    }

@router.get("/{share_id}")
async def get_share_target(share_id: str):
    db = await get_database()
    res = db.share_links.find_one({"id": share_id})
    share_doc = await res if hasattr(res, "__await__") else res

    if not share_doc:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    # Fetch referenced file
    f_res = db.files.find_one({"id": share_doc["file_id"]})
    file_doc = await f_res if hasattr(f_res, "__await__") else f_res

    if not file_doc:
        raise HTTPException(status_code=404, detail="Shared file no longer exists")

    return {
        "success": True,
        "share": sanitize_doc(share_doc),
        "file": sanitize_doc(file_doc)
    }
