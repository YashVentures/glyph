from pydantic import BaseModel
from typing import Optional

class AIGenerateRequest(BaseModel):
    prompt: str
    diagramType: Optional[str] = None
    code: Optional[str] = None
    fingerprint: Optional[str] = None
    workspaceId: Optional[str] = "default-workspace"
    retry_error: Optional[str] = None
