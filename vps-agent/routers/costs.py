import calendar
import os
import sqlite3
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter

router = APIRouter(tags=["costs"])

STATE_DB_PATH = os.environ.get("HERMES_STATE_DB", "/opt/data/state.db")
BUDGET_ENV = "MONTHLY_BUDGET_USD"

PROVIDER_TO_DAILY_KEY = {
    "anthropic": "anthropic",
    "openai-codex": "openai",
    "openrouter": "openrouter",
    "custom": "custom",
}

PROVIDER_LABELS = {
    "anthropic": "Anthropic",
    "openai-codex": "Codex",
    "openrouter": "OpenRouter",
    "custom": "Custom",
}

SESSION_QUERY = """
SELECT
  date(started_at, 'unixepoch') AS session_date,
  COALESCE(billing_provider, 'unknown') AS billing_provider,
  COALESCE(model, '<unknown>') AS model,
  COALESCE(input_tokens, 0) AS input_tokens,
  COALESCE(output_tokens, 0) AS output_tokens,
  COALESCE(api_call_count, 0) AS requests,
  COALESCE(actual_cost_usd, estimated_cost_usd, 0) AS cost_usd,
  COALESCE(cost_status, 'unknown') AS cost_status,
  COALESCE(cost_source, 'unknown') AS cost_source,
  started_at
FROM sessions
WHERE started_at >= ?
ORDER BY started_at ASC
"""


def _safe_connect(path: str) -> sqlite3.Connection | None:
    if not os.path.exists(path):
        return None
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception:
        return None


def _budget_value() -> float | None:
    raw = os.environ.get(BUDGET_ENV)
    if not raw:
        return None
    try:
        value = float(raw)
        return round(value, 2) if value >= 0 else None
    except Exception:
        return None


def _empty_payload(note: str, *, status: str = "unavailable") -> dict[str, Any]:
    return {
        "available": False,
        "source": status,
        "note": note,
        "today_total": 0.0,
        "month_total": 0.0,
        "projected_month": 0.0,
        "currency": "USD",
        "budget_monthly": _budget_value(),
        "daily": [],
        "models": [],
        "month_totals_by_provider": {},
        "cost_status_breakdown": {},
    }


def build_cost_payload() -> dict[str, Any]:
    conn = _safe_connect(STATE_DB_PATH)
    if conn is None:
        return _empty_payload(f"State DB not available at {STATE_DB_PATH}")

    now = datetime.now(timezone.utc)
    today = now.date()
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    elapsed_days = max(1, now.day)
    lookback_start = now - timedelta(days=29)

    try:
        daily_rows = [dict(row) for row in conn.execute(SESSION_QUERY, (lookback_start.timestamp(),))]
        month_rows = [dict(row) for row in conn.execute(SESSION_QUERY, (month_start.timestamp(),))]

        if not daily_rows and not month_rows:
            return _empty_payload("No Hermes session cost rows found yet.", status="hermes-state-db")

        daily_map: dict[str, dict[str, float | str]] = {}
        for offset in range(29, -1, -1):
            day = today - timedelta(days=offset)
            daily_map[day.isoformat()] = {
                "date": day.isoformat(),
                "anthropic": 0.0,
                "openai": 0.0,
                "openrouter": 0.0,
                "custom": 0.0,
            }

        cost_status_breakdown: dict[str, int] = defaultdict(int)
        for row in daily_rows:
            provider = str(row.get("billing_provider") or "unknown")
            daily_key = PROVIDER_TO_DAILY_KEY.get(provider)
            session_date = str(row.get("session_date") or "")
            cost_value = round(float(row.get("cost_usd") or 0.0), 10)
            cost_status_breakdown[str(row.get("cost_status") or "unknown")] += 1
            if daily_key and session_date in daily_map:
                daily_map[session_date][daily_key] = round(float(daily_map[session_date][daily_key]) + cost_value, 6)

        month_totals_by_provider: dict[str, float] = defaultdict(float)
        model_buckets: dict[tuple[str, str], dict[str, float | int | str]] = {}
        month_total = 0.0
        today_total = 0.0

        for row in month_rows:
            provider = str(row.get("billing_provider") or "unknown")
            model = str(row.get("model") or "<unknown>")
            cost_value = round(float(row.get("cost_usd") or 0.0), 10)
            started_at = float(row.get("started_at") or 0)
            started_day = datetime.fromtimestamp(started_at, timezone.utc).date()

            month_totals_by_provider[provider] += cost_value
            month_total += cost_value
            if started_day == today:
                today_total += cost_value

            bucket_key = (provider, model)
            bucket = model_buckets.setdefault(
                bucket_key,
                {
                    "provider": PROVIDER_LABELS.get(provider, provider),
                    "model": model,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "requests": 0,
                    "cost": 0.0,
                },
            )
            bucket["input_tokens"] = int(bucket["input_tokens"]) + int(row.get("input_tokens") or 0)
            bucket["output_tokens"] = int(bucket["output_tokens"]) + int(row.get("output_tokens") or 0)
            bucket["requests"] = int(bucket["requests"]) + int(row.get("requests") or 0)
            bucket["cost"] = round(float(bucket["cost"]) + cost_value, 6)

        projected_month = round((month_total / elapsed_days) * days_in_month, 2) if elapsed_days else 0.0
        daily = [
            {
                "date": entry["date"],
                "anthropic": round(float(entry["anthropic"]), 4),
                "openai": round(float(entry["openai"]), 4),
                "openrouter": round(float(entry["openrouter"]), 4),
                "custom": round(float(entry["custom"]), 4),
            }
            for entry in daily_map.values()
        ]
        models = sorted(
            model_buckets.values(),
            key=lambda item: (float(item["cost"]), int(item["input_tokens"]) + int(item["output_tokens"])),
            reverse=True,
        )[:20]

        return {
            "available": True,
            "source": "hermes-state-db",
            "note": "Aggregated from Hermes session cost columns (actual_cost_usd, falling back to estimated_cost_usd). Current-month totals and model breakdowns are month-scoped; the chart shows the last 30 days. OpenClaw sessions do not currently emit cost columns here.",
            "today_total": round(today_total, 4),
            "month_total": round(month_total, 4),
            "projected_month": projected_month,
            "currency": "USD",
            "budget_monthly": _budget_value(),
            "daily": daily,
            "models": models,
            "month_totals_by_provider": {key: round(value, 4) for key, value in sorted(month_totals_by_provider.items())},
            "cost_status_breakdown": dict(sorted(cost_status_breakdown.items())),
        }
    except Exception as exc:
        return _empty_payload(f"Cost telemetry query failed: {exc}", status="error")
    finally:
        conn.close()


@router.get("/costs")
async def get_costs():
    return build_cost_payload()
