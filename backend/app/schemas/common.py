from pydantic import BaseModel, Field
from typing import Optional, Any, Dict

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail

class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
