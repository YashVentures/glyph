from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any
import time
import secrets
from ..core.db import get_database
from ..core.config import settings
from ..schemas.icons import CustomIconCreate, CustomIconResponse, CustomIconListResponse
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
    # 1. Sanitize and enforce SVG 1MB rules
    sanitized_svg = sanitize_svg(body.svgContent)

    icon_id = generate_id()
    now = int(time.time() * 1000)

    clean_name = body.name.strip().lower().replace(" ", "-")

    new_icon = {
        "id": icon_id,
        "name": clean_name,
        "svg_content": sanitized_svg,
        "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        "created_at": now
    }

    ins = db.icons.insert_one(new_icon)
    if hasattr(ins, "__await__"):
        await ins

    return {"success": True, "icon": sanitize_doc(new_icon)}
