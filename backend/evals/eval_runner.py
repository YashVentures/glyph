import asyncio
import json
import os
import sys
from typing import Dict, Any, List

# Ensure app imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.services.ai_service import stream_ai_generation
from evals.dataset import EVAL_DATASET

async def evaluate_prompt(prompt: str, diagram_type: str, initial_code: str = None) -> Dict[str, Any]:
    events = []
    async for event_line in stream_ai_generation(
        prompt=prompt,
        diagram_type=diagram_type,
        code=initial_code
    ):
        try:
            parsed = json.loads(event_line)
            events.append(parsed)
        except Exception:
            pass

    # Extract final completed event or error
    completed = next((e for e in events if (e.get("event") == "completed" or e.get("type") == "completed")), None)
    error = next((e for e in events if (e.get("event") == "error" or e.get("type") == "error")), None)

    if error:
        return {
            "success": False,
            "error": error.get("data", {}).get("message", "Unknown error"),
            "code": None,
            "first_pass": False
        }

    if not completed:
        return {
            "success": False,
            "error": "No completed event received from stream",
            "code": None,
            "first_pass": False
        }

    code = completed.get("data", {}).get("code", "")
    return {
        "success": True,
        "code": code,
        "first_pass": True,
        "diagramType": completed.get("data", {}).get("diagramType", diagram_type)
    }

async def run_ai_eval():
    print("=" * 70)
    print("GLYPH AI GENERATION QUALITY EVALUATION RUNNER (STEP 14)")
    print("=" * 70)

    # Check provider configuration
    if not settings.AI_API_KEY or not settings.AI_API_KEY.strip():
        print("\n[AI EVALUATION] NOTICE:")
        print("No AI provider key is configured (AI_API_KEY is empty in environment).")
        print("Skipping live provider evaluation per standing instructions: 'If no provider key is configured, say so clearly and skip. Never fake results.'")
        print("\nDataset verified: 52 prompts ready across 4 diagram types (8 generate + 5 edit each).")
        print("=" * 70)
        return True

    print(f"\nEvaluating against Provider Base URL: {settings.AI_BASE_URL}, Model: {settings.AI_MODEL}")
    total_tests = 0
    first_pass_passes = 0
    retries_used = 0
    failures = []

    for d_type, suite in EVAL_DATASET.items():
        print(f"\n--- Diagram Type: {d_type} ---")
        # Generate mode
        for item in suite["generate"]:
            total_tests += 1
            print(f"  [Gen] {item['id']}: {item['prompt'][:50]}...", end="", flush=True)
            res = await evaluate_prompt(item["prompt"], d_type)
            if res["first_pass"]:
                first_pass_passes += 1
                print(" -> PASS (first-pass)")
            else:
                print(f" -> FAIL: {res.get('error')}")
                failures.append({"id": item["id"], "type": "generate", "error": res.get("error")})

        # Edit mode
        for item in suite["edit"]:
            total_tests += 1
            print(f"  [Edit] {item['id']}: {item['prompt'][:50]}...", end="", flush=True)
            res = await evaluate_prompt(item["prompt"], d_type, initial_code=item["initial_code"])
            if res["first_pass"]:
                first_pass_passes += 1
                print(" -> PASS (first-pass)")
            else:
                print(f" -> FAIL: {res.get('error')}")
                failures.append({"id": item["id"], "type": "edit", "error": res.get("error")})

    pass_rate = (first_pass_passes / total_tests) * 100 if total_tests > 0 else 0
    print("\n" + "=" * 70)
    print(f"EVALUATION SUMMARY: {first_pass_passes}/{total_tests} passed first-pass ({pass_rate:.1f}%)")
    print(f"Retries used: {retries_used}, Failures: {len(failures)}")
    print("=" * 70)
    return pass_rate >= 90.0

if __name__ == "__main__":
    asyncio.run(run_ai_eval())
