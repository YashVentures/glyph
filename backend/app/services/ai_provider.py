import asyncio
import json
import os
import re
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Callable, Awaitable, Dict, List, Optional
import httpx

class AIProvider(ABC):
    """Abstract interface for LLM diagram generation providers."""
    
    @abstractmethod
    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        timeout: float = 60.0,
        disconnect_check: Optional[Callable[[], Awaitable[bool]]] = None
    ) -> AsyncGenerator[str, None]:
        """Stream token deltas from chat completion endpoint."""
        pass


class OpenAICompatibleProvider(AIProvider):
    """
    OpenAI-compatible chat completion provider.
    Works seamlessly with OpenAI, Groq, OpenRouter, Gemini (v1beta/openai), Ollama, and LocalAI.
    """
    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        timeout: float = 60.0,
        disconnect_check: Optional[Callable[[], Awaitable[bool]]] = None
    ) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "temperature": 0.2
        }

        client_timeout = httpx.Timeout(timeout, connect=10.0)

        async with httpx.AsyncClient(timeout=client_timeout) as client:
            try:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        error_body = await response.aread()
                        error_text = error_body.decode("utf-8", errors="replace")
                        raise RuntimeError(f"AI Provider error (HTTP {response.status_code}): {error_text}")

                    async for line in response.aiter_lines():
                        if disconnect_check and await disconnect_check():
                            # Client disconnected; abort upstream streaming request
                            break

                        if not line:
                            continue

                        line_str = line.strip()
                        if not line_str.startswith("data:"):
                            continue

                        data_content = line_str[len("data:"):].strip()
                        if data_content == "[DONE]":
                            break

                        try:
                            chunk = json.loads(data_content)
                            choices = chunk.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
            except httpx.TimeoutException:
                raise TimeoutError(f"AI Provider timed out after {timeout} seconds.")
            except httpx.RequestError as exc:
                raise RuntimeError(f"AI Provider network error: {str(exc)}")


def strip_markdown_fences(code: str) -> str:
    """
    Server-side safety net: strips leading ```eraserdsl / ``` and trailing ```
    along with any leading/trailing whitespace.
    """
    if not code:
        return ""
    
    cleaned = code.strip()
    
    # Strip leading code fences (e.g. ```eraserdsl, ```dsl, ```)
    if cleaned.startswith("```"):
        newline_idx = cleaned.find("\n")
        if newline_idx != -1:
            cleaned = cleaned[newline_idx + 1:]
        else:
            cleaned = ""
            
    # Strip trailing code fences
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
        
    return cleaned.strip()


def detect_diagram_type(code: str, fallback: Optional[str] = "flowchart-diagram") -> str:
    """Detects diagram type from syntax keywords if not explicitly specified."""
    lower = code.lower()
    if any(k in lower for k in ["autonumber", "activate ", "deactivate ", "order "]):
        return "sequence-diagram"
    if any(k in lower for k in ["notation", "pk", "fk", "crows-foot", "chen"]) and ("{" in lower):
        return "entity-relationship-diagram"
    if any(k in lower for k in ["aws-", "cloud", "vpc", "subnet", "alb", "rds", "s3"]):
        return "cloud-architecture-diagram"
    return fallback or "flowchart-diagram"
