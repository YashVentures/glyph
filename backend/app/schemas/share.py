from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ShareLinkCreate(BaseModel):
    fileId: str
    targetDiagramId: Optional[str] = None
    targetFigureId: Optional[str] = None
    targetElements: Optional[List[str]] = None

class ShareLinkItem(BaseModel):
    id: str
    file_id: str
    target_diagram_id: Optional[str] = None
    target_figure_id: Optional[str] = None
    target_elements: Optional[List[str]] = None
    is_public: bool = True
    created_at: int

class ShareLinkResponse(BaseModel):
    success: bool = True
    share: ShareLinkItem
    shareUrl: str
