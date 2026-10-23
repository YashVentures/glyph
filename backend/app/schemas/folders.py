from pydantic import BaseModel
from typing import Optional, List

class FolderCreate(BaseModel):
    name: str

class FolderRename(BaseModel):
    name: str

class FolderItem(BaseModel):
    id: str
    name: str
    workspace_id: str
    user_id: str
    created_at: int
    updated_at: int

class FolderResponse(BaseModel):
    success: bool = True
    folder: FolderItem

class FolderListResponse(BaseModel):
    success: bool = True
    folders: List[FolderItem]
