from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from ..schemas.ai import AIGenerateRequest
from ..services.ai_service import stream_ai_generation

router = APIRouter(prefix="/ai", tags=["ai"])

@router.post("/generate/stream")
async def generate_diagram_stream(request: Request, body: AIGenerateRequest):
    return StreamingResponse(
        stream_ai_generation(
            prompt=body.prompt,
            diagram_type=body.diagramType,
            code=body.code,
            retry_error=body.retry_error,
            disconnect_check=request.is_disconnected
        ),
        media_type="application/x-ndjson"
    )
