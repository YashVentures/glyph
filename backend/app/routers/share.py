from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import time
import secrets
from ..core.db import get_database
from ..schemas.share import ShareLinkCreate, ShareLinkResponse, ShareLinkItem

router = APIRouter(prefix="/share", tags=["share"])

def generate_secure_token() -> str:
    # Cryptographically random and unguessable token (256-bit entropy, 43 characters)
    return secrets.token_urlsafe(32)

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
    
    # Verify the target file exists
    f_res = db.files.find_one({"id": body.fileId})
    file_doc = await f_res if hasattr(f_res, "__await__") else f_res
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    # Generate secure unguessable token
    share_id = generate_secure_token()
    now = int(time.time() * 1000)

    new_share = {
        "id": share_id,
        "file_id": body.fileId,
        "target_diagram_id": body.targetDiagramId,
        "target_figure_id": body.targetFigureId,
        "target_elements": body.targetElements or [],
        "is_public": True,
        "is_active": True,
        "created_at": now
    }

    ins = db.share_links.insert_one(new_share)
    if hasattr(ins, "__await__"):
        await ins

    share_url = f"/share/{share_id}"
    params = []
    if body.targetDiagramId:
        params.append(f"diagram={body.targetDiagramId}")
    if body.targetFigureId:
        params.append(f"figure={body.targetFigureId}")
    if body.targetElements:
        params.append(f"elements={','.join(body.targetElements)}")
    if params:
        share_url += f"?{'&'.join(params)}"

    return {
        "success": True,
        "share": sanitize_doc(new_share),
        "shareUrl": share_url
    }

@router.get("/file/{file_id}")
async def get_share_link_for_file(file_id: str):
    db = await get_database()
    # Find most recently created active share link for this file
    res = db.share_links.find({"file_id": file_id, "is_active": True}).sort("created_at", -1).limit(1)
    share_doc = None
    try:
        async for doc in res:
            share_doc = doc
            break
    except TypeError:
        for doc in res:
            share_doc = doc
            break

    if not share_doc:
        return {"success": True, "share": None, "shareUrl": None}

    share_url = f"/share/{share_doc['id']}"
    params = []
    if share_doc.get("target_diagram_id"):
        params.append(f"diagram={share_doc['target_diagram_id']}")
    if share_doc.get("target_figure_id"):
        params.append(f"figure={share_doc['target_figure_id']}")
    if share_doc.get("target_elements"):
        params.append(f"elements={','.join(share_doc['target_elements'])}")
    if params:
        share_url += f"?{'&'.join(params)}"

    return {
        "success": True,
        "share": sanitize_doc(share_doc),
        "shareUrl": share_url
    }

@router.delete("/{share_id}")
async def revoke_share_link(share_id: str):
    db = await get_database()
    res = db.share_links.find_one({"id": share_id})
    share_doc = await res if hasattr(res, "__await__") else res

    if not share_doc:
        raise HTTPException(status_code=404, detail="Share link not found")

    # Revoke immediately so it returns 404 on all subsequent GETs
    upd = db.share_links.update_one({"id": share_id}, {"$set": {"is_active": False}})
    if hasattr(upd, "__await__"):
        await upd

    return {
        "success": True,
        "message": "Share link successfully revoked"
    }

@router.get("/{share_id}")
async def get_share_target(
    share_id: str,
    diagram: Optional[str] = Query(None),
    figure: Optional[str] = Query(None),
    elements: Optional[str] = Query(None)
):
    db = await get_database()
    res = db.share_links.find_one({"id": share_id})
    share_doc = await res if hasattr(res, "__await__") else res

    # Revoking or disabling immediately returns 404
    if not share_doc or not share_doc.get("is_active", True) or not share_doc.get("is_public", True):
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    # Fetch referenced file strictly
    f_res = db.files.find_one({"id": share_doc["file_id"]})
    file_doc = await f_res if hasattr(f_res, "__await__") else f_res

    if not file_doc:
        raise HTTPException(status_code=404, detail="Shared file no longer exists")

    # Attach any query targeting overrides from the request
    share_info = sanitize_doc(share_doc)
    if diagram:
        share_info["target_diagram_id"] = diagram
    if figure:
        share_info["target_figure_id"] = figure
    if elements:
        share_info["target_elements"] = [e.strip() for e in elements.split(",") if e.strip()]

    # Strictly return only public read-only representation: no write credentials or tokens
    return {
        "success": True,
        "share": share_info,
        "file": sanitize_doc(file_doc)
    }
