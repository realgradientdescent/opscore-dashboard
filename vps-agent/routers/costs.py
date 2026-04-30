import random
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter

router = APIRouter(tags=["costs"])

PROVIDER_RATES = {
    "anthropic": {"daily_range": (2.50, 12.00), "models": {
        "claude-sonnet-4-20250514": 0.45,
        "claude-opus-4-20250514": 0.35,
        "claude-haiku-3-20250307": 0.20,
    }},
    "openai": {"daily_range": (1.00, 8.00), "models": {
        "gpt-4o": 0.50,
        "gpt-4o-mini": 0.30,
        "o3-mini": 0.20,
    }},
    "openrouter": {"daily_range": (0.50, 4.00), "models": {
        "deepseek/deepseek-r1": 0.40,
        "meta-llama/llama-4-maverick": 0.35,
        "google/gemini-2.5-pro": 0.25,
    }},
}


@router.get("/costs")
async def get_costs():
    today = datetime.now(timezone.utc).date()
    daily = []
    month_totals = {}

    for day_offset in range(30):
        date = today - timedelta(days=day_offset)
        entry = {"date": date.isoformat()}
        for provider, cfg in PROVIDER_RATES.items():
            lo, hi = cfg["daily_range"]
            cost = round(random.uniform(lo, hi), 2)
            entry[provider] = cost
            month_totals[provider] = round(month_totals.get(provider, 0) + cost, 2)
        daily.append(entry)

    daily.reverse()

    model_breakdown = {}
    for provider, cfg in PROVIDER_RATES.items():
        provider_total = month_totals[provider]
        for model, share in cfg["models"].items():
            model_breakdown[model] = round(provider_total * share, 2)

    today_entry = daily[-1] if daily else {}
    today_total = round(sum(v for k, v in today_entry.items() if k != "date"), 2)
    month_total = round(sum(month_totals.values()), 2)

    return {
        "daily": daily,
        "month_totals_by_provider": month_totals,
        "model_breakdown": model_breakdown,
        "today_total": today_total,
        "month_total": month_total,
        "currency": "USD",
    }
