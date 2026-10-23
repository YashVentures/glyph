import pytest
import json
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.ai_provider import AIProvider, strip_markdown_fences, detect_diagram_type
from app.services.ai_service import stream_ai_generation

class MockAIProvider(AIProvider):
    def __init__(self, chunks=None, error_to_raise=None, record_messages=None):
        self.chunks = chunks or ["title Test Flow\n", "start > finish\n"]
        self.error_to_raise = error_to_raise
        self.record_messages = record_messages

    async def stream_chat(self, messages, timeout=60.0, disconnect_check=None):
        if self.record_messages is not None:
            self.record_messages.extend(messages)

        if self.error_to_raise:
            raise self.error_to_raise

        for chunk in self.chunks:
            if disconnect_check and await disconnect_check():
                break
            yield chunk

@pytest.fixture
def client():
    return TestClient(app)

def test_missing_api_key_returns_clear_error(client, monkeypatch):
    monkeypatch.setattr(settings, "AI_API_KEY", "")
    
    response = client.post(
        "/api/v1/ai/generate/stream",
        json={"prompt": "Create an architecture diagram"}
    )
    assert response.status_code == 200
    lines = [json.loads(line) for line in response.text.strip().split("\n") if line.strip()]
    assert len(lines) == 1
    assert lines[0]["event"] == "error"
    assert "AI API key is missing" in lines[0]["data"]["message"]

def test_prompt_length_limit_exceeded(client, monkeypatch):
    monkeypatch.setattr(settings, "AI_API_KEY", "test-key-xyz")
    monkeypatch.setattr(settings, "AI_MAX_PROMPT_LENGTH", 50)
    
    long_prompt = "A" * 100
    response = client.post(
        "/api/v1/ai/generate/stream",
        json={"prompt": long_prompt}
    )
    assert response.status_code == 200
    lines = [json.loads(line) for line in response.text.strip().split("\n") if line.strip()]
    assert len(lines) == 1
    assert lines[0]["event"] == "error"
    assert "exceeds maximum length" in lines[0]["data"]["message"]

def test_ai_event_order_progress_then_completed(monkeypatch):
    monkeypatch.setattr(settings, "AI_API_KEY", "valid-key")
    provider = MockAIProvider(chunks=["title Checkout\n", "Cart > Payment: checkout\n"])
    
    async def run():
        events = []
        async for line in stream_ai_generation(
            prompt="Design a checkout flow",
            diagram_type="flowchart-diagram",
            provider=provider
        ):
            events.append(json.loads(line.strip()))
        return events

    events = asyncio.run(run())

    # Event order: initial progress, chunk progress events, then completed event
    assert len(events) >= 3
    assert events[0]["event"] == "progress"
    assert events[1]["event"] == "progress"
    assert events[-1]["event"] == "completed"

    completed_data = events[-1]["data"]
    assert completed_data["status"] == "completed"
    assert "Cart > Payment: checkout" in completed_data["code"]
    assert completed_data["diagramType"] == "flowchart-diagram"

def test_server_side_fence_stripping(monkeypatch):
    monkeypatch.setattr(settings, "AI_API_KEY", "valid-key")
    # Simulate an LLM returning markdown fences despite system instructions
    fenced_code = "```eraserdsl\ntitle Robust Service\nServiceA > ServiceB\n```"
    provider = MockAIProvider(chunks=[fenced_code])

    async def run():
        events = []
        async for line in stream_ai_generation(
            prompt="Create service connection",
            provider=provider
        ):
            events.append(json.loads(line.strip()))
        return events

    events = asyncio.run(run())
    last_event = events[-1]
    assert last_event["event"] == "completed"
    clean_code = last_event["data"]["code"]
    assert "```" not in clean_code
    assert clean_code.startswith("title Robust Service")
    assert clean_code.endswith("ServiceA > ServiceB")

def test_edit_mode_sends_existing_code(monkeypatch):
    monkeypatch.setattr(settings, "AI_API_KEY", "valid-key")
    captured_messages = []
    provider = MockAIProvider(
        chunks=["title Updated\nA > B\nB > C"],
        record_messages=captured_messages
    )

    existing_code = "title Initial\nA > B"
    async def run():
        events = []
        async for line in stream_ai_generation(
            prompt="Add node C connected to B",
            code=existing_code,
            provider=provider
        ):
            events.append(json.loads(line.strip()))
        return events

    events = asyncio.run(run())
    assert len(captured_messages) == 2
    user_prompt = captured_messages[1]["content"]
    assert "You are in edit mode" in user_prompt
    assert "EXISTING DIAGRAM CODE:" in user_prompt
    assert existing_code in user_prompt

def test_provider_failure_returns_error_event(monkeypatch):
    monkeypatch.setattr(settings, "AI_API_KEY", "valid-key")
    provider = MockAIProvider(error_to_raise=RuntimeError("OpenAI API 500 Internal Server Error"))

    async def run():
        events = []
        async for line in stream_ai_generation(
            prompt="Test error handling",
            provider=provider
        ):
            events.append(json.loads(line.strip()))
        return events

    events = asyncio.run(run())
    last_event = events[-1]
    assert last_event["event"] == "error"
    assert "500 Internal Server Error" in last_event["data"]["message"]

def test_timeout_handling(monkeypatch):
    monkeypatch.setattr(settings, "AI_API_KEY", "valid-key")
    provider = MockAIProvider(error_to_raise=TimeoutError("AI Provider timed out after 60 seconds."))

    async def run():
        events = []
        async for line in stream_ai_generation(
            prompt="Test timeout",
            provider=provider
        ):
            events.append(json.loads(line.strip()))
        return events

    events = asyncio.run(run())
    last_event = events[-1]
    assert last_event["event"] == "error"
    assert "timed out" in last_event["data"]["message"]

def test_client_disconnect_cancels_upstream(monkeypatch):
    monkeypatch.setattr(settings, "AI_API_KEY", "valid-key")
    
    call_count = 0
    async def is_disconnected():
        nonlocal call_count
        call_count += 1
        # Disconnect after first token
        return call_count > 1

    provider = MockAIProvider(chunks=["chunk1\n", "chunk2\n", "chunk3\n", "chunk4\n"])
    async def run():
        events = []
        async for line in stream_ai_generation(
            prompt="Test disconnect",
            disconnect_check=is_disconnected,
            provider=provider
        ):
            events.append(json.loads(line.strip()))
        return events

    events = asyncio.run(run())
    # Should have stopped early before all chunks
    progress_tokens = [e["data"].get("delta") for e in events if e.get("event") == "progress"]
    assert "chunk4\n" not in progress_tokens
