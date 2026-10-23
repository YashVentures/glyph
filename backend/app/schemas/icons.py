from pydantic import BaseModel
from typing import Optional, List

class CustomIconCreate(BaseModel):
    name: str
    svgContent: str

class CustomIconRename(BaseModel):
    name: str

class CustomIconItem(BaseModel):
    id: str
    name: str
    svg_content: str
    workspace_id: str
    created_at: int

class CustomIconResponse(BaseModel):
    success: bool = True
    icon: CustomIconItem

class CustomIconListResponse(BaseModel):
    success: bool = True
    icons: List[CustomIconItem]
