import random
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter

router = APIRouter(tags=["tokens"])


def _recent_requests(models, count=10):
    now = datetime.now(timezone.utc)
    reqs = []
    for i in range(count):
        model = random.choice(models)
        input_tokens = random.randint(200, 4000)
        output_tokens = random.randint(50, 2000)
        reqs.append({
            "timestamp": (now - timedelta(minutes=i * random.randint(1, 15))).isoformat(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "latency_ms": random.randint(200, 3000),
        })
    return reqs


@router.get("/tokens/anthropic")
async def anthropic_tokens():
    models = ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-3-20250307"]
    return {
        "provider": "anthropic",
        "rate_limit": {"requests_per_minute": 1000, "tokens_per_minute": 400000, "tokens_per_day": 10000000},
        "usage": {
            "today": {"input_tokens": 184320, "output_tokens": 62100, "total_tokens": 246420, "requests": 142},
            "this_month": {"input_tokens": 4812000, "output_tokens": 1520000, "total_tokens": 6332000, "requests": 3891},
        },
        "per_model": {m: {"input_tokens": random.randint(50000, 2000000), "output_tokens": random.randint(20000, 800000)} for m in models},
        "recent_requests": _recent_requests(models),
    }


@router.get("/tokens/openai")
async def openai_tokens():
    models = ["gpt-4o", "gpt-4o-mini", "o3-mini"]
    return {
        "provider": "openai",
        "rate_limit": {"requests_per_minute": 500, "tokens_per_minute": 300000, "tokens_per_day": 5000000},
        "usage": {
            "today": {"input_tokens": 95200, "output_tokens": 31400, "total_tokens": 126600, "requests": 78},
            "this_month": {"input_tokens": 2410000, "output_tokens": 890000, "total_tokens": 3300000, "requests": 2104},
        },
        "per_model": {m: {"input_tokens": random.randint(30000, 1000000), "output_tokens": random.randint(10000, 400000)} for m in models},
        "recent_requests": _recent_requests(models),
    }


@router.get("/tokens/openrouter")
async def openrouter_tokens():
    models = ["deepseek/deepseek-r1", "meta-llama/llama-4-maverick", "google/gemini-2.5-pro"]
    return {
        "provider": "openrouter",
        "rate_limit": {"requests_per_minute": 200, "tokens_per_minute": 200000, "tokens_per_day": 3000000},
        "usage": {
            "today": {"input_tokens": 42100, "output_tokens": 18300, "total_tokens": 60400, "requests": 34},
            "this_month": {"input_tokens": 1180000, "output_tokens": 490000, "total_tokens": 1670000, "requests": 980},
        },
        "per_model": {m: {"input_tokens": random.randint(20000, 500000), "output_tokens": random.randint(10000, 200000)} for m in models},
        "recent_requests": _recent_requests(models),
    }
