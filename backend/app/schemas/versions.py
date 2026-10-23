from pydantic import BaseModel
from typing import Optional, List, Any

class VersionCreate(BaseModel):
    name: Optional[str] = None
    note: Optional[str] = None

class VersionSnapshotCreate(BaseModel):
    fileId: Optional[str] = None
    docContent: Optional[str] = None
    canvasData: Optional[str] = None
    name: Optional[str] = None
    note: Optional[str] = None

class VersionItem(BaseModel):
    id: str
    file_id: str
    doc_content: str
    canvas_data: str
    name: Optional[str] = None
    note: Optional[str] = None
    is_auto: Optional[bool] = False
    created_at: int

class VersionListResponse(BaseModel):
    success: bool = True
    versions: List[VersionItem]
    total: Optional[int] = None
    page: Optional[int] = 1
    limit: Optional[int] = 20

class VersionResponse(BaseModel):
    success: bool = True
    version: VersionItem

class VersionRestoreResponse(BaseModel):
    success: bool = True
    restored_version_id: str
    file: Any
