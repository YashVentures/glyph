from fastapi import APIRouter, HTTPException, Response
from typing import Optional, List, Dict, Any
import time
import secrets
from ..core.db import get_database
from ..core.config import settings
from ..schemas.icons import CustomIconCreate, CustomIconRename, CustomIconResponse, CustomIconListResponse
from ..services.icon_service import sanitize_svg

router = APIRouter(prefix="/icons", tags=["icons"])

def generate_id() -> str:
    return secrets.token_urlsafe(8)

def sanitize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        del d["_id"]
    return d

@router.get("", response_model=CustomIconListResponse)
async def list_icons():
    db = await get_database()
    cursor = db.icons.find({"workspace_id": settings.DEFAULT_WORKSPACE_ID}).sort("name", 1)
    icons = []
    try:
        async for doc in cursor:
            icons.append(sanitize_doc(doc))
    except TypeError:
        for doc in cursor:
            icons.append(sanitize_doc(doc))
    return {"success": True, "icons": icons}

@router.post("", response_model=CustomIconResponse, status_code=201)
async def upload_custom_icon(body: CustomIconCreate):
    db = await get_database()
    
    # 1. Sanitize and enforce SVG 1MB rules and strip malicious tags
    sanitized_svg = sanitize_svg(body.svgContent)

    icon_id = generate_id()
    now = int(time.time() * 1000)

    clean_name = body.name.strip().lower().replace(" ", "-")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Icon name cannot be empty")

    new_icon = {
        "id": icon_id,
        "name": clean_name,
        "svg_content": sanitized_svg,
        "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        "created_at": now
    }

    # Upsert or insert icon by name in workspace (collision handling: replace or add)
    ins = db.icons.update_one(
        {"workspace_id": settings.DEFAULT_WORKSPACE_ID, "name": clean_name},
        {"$set": new_icon},
        upsert=True
    )
    if hasattr(ins, "__await__"):
        await ins

    return {"success": True, "icon": sanitize_doc(new_icon)}

@router.get("/{identifier}/raw")
async def get_raw_icon(identifier: str):
    """
    Serve SVG icons directly with strict security headers:
    - Content-Type: image/svg+xml
    - X-Content-Type-Options: nosniff
    - Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox
    """
    db = await get_database()
    # Find by ID or name
    res = db.icons.find_one({
        "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        "$or": [{"id": identifier}, {"name": identifier}]
    })
    icon_doc = await res if hasattr(res, "__await__") else res

    if not icon_doc:
        raise HTTPException(status_code=404, detail="Icon not found")

    svg_data = icon_doc["svg_content"]

    return Response(
        content=svg_data,
        media_type="image/svg+xml",
        headers={
            "Content-Type": "image/svg+xml",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            "Cache-Control": "public, max-age=3600"
        }
    )

@router.patch("/{icon_id}", response_model=CustomIconResponse)
async def rename_custom_icon(icon_id: str, body: CustomIconRename):
    db = await get_database()
    clean_name = body.name.strip().lower().replace(" ", "-")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Icon name cannot be empty")

    res = db.icons.find_one({"id": icon_id, "workspace_id": settings.DEFAULT_WORKSPACE_ID})
    icon_doc = await res if hasattr(res, "__await__") else res

    if not icon_doc:
        raise HTTPException(status_code=404, detail="Icon not found")

    upd = db.icons.update_one(
        {"id": icon_id, "workspace_id": settings.DEFAULT_WORKSPACE_ID},
        {"$set": {"name": clean_name}}
    )
    if hasattr(upd, "__await__"):
        await upd

    icon_doc["name"] = clean_name
    return {"success": True, "icon": sanitize_doc(icon_doc)}

@router.delete("/{icon_id}")
async def delete_custom_icon(icon_id: str):
    db = await get_database()
    res = db.icons.delete_one({"id": icon_id, "workspace_id": settings.DEFAULT_WORKSPACE_ID})
    if hasattr(res, "__await__"):
        del_res = await res
    else:
        del_res = res

    if del_res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Icon not found")

    return {"success": True, "message": "Icon deleted successfully"}
