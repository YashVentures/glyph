from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class FileCreate(BaseModel):
    title: str = "Untitled"
    folderId: Optional[str] = None
    folder_id: Optional[str] = None
    docContent: Optional[str] = None
    canvasData: Optional[str] = None

class FileUpdate(BaseModel):
    title: Optional[str] = None
    folderId: Optional[str] = None
    folder_id: Optional[str] = None
    docContent: Optional[str] = None
    canvasData: Optional[str] = None
    isArchived: Optional[bool] = None
    expected_version: Optional[int] = None
    expected_updated_at: Optional[int] = None
    force: Optional[bool] = False

class FileItem(BaseModel):
    id: str
    title: str
    folder_id: Optional[str] = None
    doc_content: str
    canvas_data: str
    workspace_id: str
    user_id: str
    is_archived: int = 0
    version: int = 1
    created_at: int
    updated_at: int
    last_accessed_at: int
    preview: Optional[str] = None

class FileResponse(BaseModel):
    success: bool = True
    file: FileItem

class FileListResponse(BaseModel):
    success: bool = True
    files: List[FileItem]
