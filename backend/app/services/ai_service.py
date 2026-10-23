import asyncio
import json
import os
from typing import AsyncGenerator, Callable, Awaitable, Optional
from ..core.config import settings
from .ai_provider import (
    AIProvider,
    OpenAICompatibleProvider,
    strip_markdown_fences,
    detect_diagram_type
)

# Cache the system prompt in memory
_SYSTEM_PROMPT: Optional[str] = None

def get_system_prompt() -> str:
    global _SYSTEM_PROMPT
    if _SYSTEM_PROMPT is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        prompt_path = os.path.join(base_dir, "prompts", "diagram_system_prompt_v1.txt")
        if os.path.exists(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                _SYSTEM_PROMPT = f.read()
        else:
            _SYSTEM_PROMPT = "You are the diagram generator for Glyph. Output only valid diagram DSL code with no markdown fences."
    return _SYSTEM_PROMPT

def get_ai_provider() -> AIProvider:
    return OpenAICompatibleProvider(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        model=settings.AI_MODEL
    )

async def stream_ai_generation(
    prompt: str,
    diagram_type: Optional[str] = None,
    code: Optional[str] = None,
    retry_error: Optional[str] = None,
    disconnect_check: Optional[Callable[[], Awaitable[bool]]] = None,
    provider: Optional[AIProvider] = None
) -> AsyncGenerator[str, None]:
    """
    Orchestrates streaming AI diagram generation and editing.
    Emits NDJSON events: 'progress', 'completed', 'error'.
    """
    # 1. Enforce max prompt length
    if len(prompt or "") > settings.AI_MAX_PROMPT_LENGTH:
        err_event = {
            "event": "error",
            "type": "error",
            "data": {
                "status": "error",
                "message": f"Prompt exceeds maximum length of {settings.AI_MAX_PROMPT_LENGTH} characters."
            }
        }
        yield f"{json.dumps(err_event)}\n"
        return

    # 2. Check API key configuration (never return fake output)
    if not settings.AI_API_KEY or not settings.AI_API_KEY.strip():
        err_event = {
            "event": "error",
            "type": "error",
            "data": {
                "status": "error",
                "message": "AI API key is missing. Please configure AI_API_KEY in the backend environment."
            }
        }
        yield f"{json.dumps(err_event)}\n"
        return

    # 3. Build prompt and messages
    system_prompt = get_system_prompt()
    target_type = diagram_type if (diagram_type and diagram_type.lower() != "auto") else None

    if code and code.strip():
        # EDIT MODE
        user_content = (
            f"You are in edit mode. Apply the following modifications to the existing diagram code:\n"
            f"User Request: {prompt}\n\n"
            f"EXISTING DIAGRAM CODE:\n"
            f"{code}\n\n"
            f"Return the full updated code. Modify only what was requested, and keep unrelated lines, comments, and ordering intact."
        )
    else:
        # GENERATE MODE
        type_hint = f" ({target_type})" if target_type else ""
        user_content = f"Create a diagram{type_hint} for the following requirement:\n{prompt}"

    if retry_error:
        user_content += (
            f"\n\nATTENTION: The previously generated diagram code had a syntax error when parsed by the client engine:\n"
            f"{retry_error}\n"
            f"Please fix the syntax error and ensure all code strictly adheres to the grammar."
        )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]

    # 4. Initial progress event
    init_progress = {
        "event": "progress",
        "type": "progress",
        "data": {
            "status": "in_progress",
            "delta": "",
            "message": "Generating diagram specification..."
        }
    }
    yield f"{json.dumps(init_progress)}\n"

    # 5. Stream from provider
    llm_provider = provider or get_ai_provider()
    full_code = ""

    try:
        async for token in llm_provider.stream_chat(
            messages=messages,
            timeout=float(settings.AI_TIMEOUT_SECONDS),
            disconnect_check=disconnect_check
        ):
            if disconnect_check and await disconnect_check():
                break

            full_code += token
            progress_event = {
                "event": "progress",
                "type": "progress",
                "data": {
                    "status": "in_progress",
                    "delta": token
                }
            }
            yield f"{json.dumps(progress_event)}\n"

        # 6. Safety net: Strip markdown fences server-side
        cleaned_code = strip_markdown_fences(full_code)

        # 7. Resolve final diagram type
        final_type = target_type or detect_diagram_type(cleaned_code)

        # 8. Emit completed event
        completed_event = {
            "event": "completed",
            "type": "completed",
            "data": {
                "status": "completed",
                "code": cleaned_code,
                "diagramType": final_type
            }
        }
        yield f"{json.dumps(completed_event)}\n"

    except Exception as exc:
        err_event = {
            "event": "error",
            "type": "error",
            "data": {
                "status": "error",
                "message": str(exc)
            }
        }
        yield f"{json.dumps(err_event)}\n"
