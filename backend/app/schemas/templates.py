from pydantic import BaseModel
from typing import Optional, List

class TemplateItem(BaseModel):
    id: str
    name: str
    diagramType: str
    category: str
    description: str
    code: str

class TemplateListResponse(BaseModel):
    success: bool = True
    templates: List[TemplateItem]

class TemplateResponse(BaseModel):
    success: bool = True
    template: TemplateItem
