import os
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

router = APIRouter(tags=["tokens"])

STATE_DB_PATH = os.environ.get("HERMES_STATE_DB", "/opt/data/state.db")

PROVIDER_ALIASES = {
    "anthropic": "anthropic",
    "openai": "openai-codex",
    "codex": "openai-codex",
    "openai-codex": "openai-codex",
    "openrouter": "openrouter",
    "custom": "custom",
}

PROVIDER_LABELS = {
    "anthropic": "Anthropic",
    "openai-codex": "Codex",
    "openrouter": "OpenRouter",
    "custom": "Custom",
}


def _safe_connect(path: str) -> sqlite3.Connection | None:
    if not os.path.exists(path):
        return None
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception:
        return None


def _provider_key(raw_provider: str) -> str:
    return PROVIDER_ALIASES.get(raw_provider, raw_provider)


def _default_payload(provider: str, reason: str) -> dict[str, Any]:
    return {
        "provider": provider,
        "label": PROVIDER_LABELS.get(provider, provider),
        "available": False,
        "source": "unavailable",
        "note": reason,
        "rate_limit": {
            "rpm": 0,
            "tpm": 0,
            "rpm_used": 0,
            "tpm_used": 0,
            "known": False,
        },
        "today": {"input_tokens": 0, "output_tokens": 0, "requests": 0},
        "month": {"input_tokens": 0, "output_tokens": 0, "requests": 0},
        "models": [],
        "recent_requests": [],
        "hourly": [],
    }


def _period_starts() -> tuple[float, float, float]:
    now = datetime.now(timezone.utc)
    today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    last_24h = now.timestamp() - 24 * 3600
    return today.timestamp(), month.timestamp(), last_24h


def _totals_row(conn: sqlite3.Connection, provider: str, started_after: float) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(api_call_count), 0) AS requests
        FROM sessions
        WHERE billing_provider = ? AND started_at >= ?
        """,
        (provider, started_after),
    ).fetchone()


def _model_rows(conn: sqlite3.Connection, provider: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT
          COALESCE(model, '<unknown>') AS model,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(api_call_count), 0) AS requests
        FROM sessions
        WHERE billing_provider = ?
        GROUP BY COALESCE(model, '<unknown>')
        ORDER BY (COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0)) DESC
        LIMIT 12
        """,
        (provider,),
    ).fetchall()
    return [dict(row) for row in rows]


def _recent_session_rows(conn: sqlite3.Connection, provider: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT
          id,
          source,
          COALESCE(model, '<unknown>') AS model,
          title,
          started_at,
          ended_at,
          input_tokens,
          output_tokens,
          api_call_count
        FROM sessions
        WHERE billing_provider = ?
        ORDER BY started_at DESC
        LIMIT 25
        """,
        (provider,),
    ).fetchall()


def _hourly_from_rows(rows: list[sqlite3.Row], since_ts: float) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = defaultdict(lambda: {"input": 0, "output": 0, "requests": 0})
    for row in rows:
        started_at = float(row["started_at"] or 0)
        if started_at < since_ts:
            continue
        hour_key = datetime.fromtimestamp(started_at, timezone.utc).replace(minute=0, second=0, microsecond=0).isoformat()
        buckets[hour_key]["input"] += int(row["input_tokens"] or 0)
        buckets[hour_key]["output"] += int(row["output_tokens"] or 0)
        buckets[hour_key]["requests"] += int(row["api_call_count"] or 0)

    points = []
    for hour_key in sorted(buckets.keys()):
        points.append({"hour": hour_key, **buckets[hour_key]})
    return points


def _recent_requests(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    out = []
    for row in rows[:10]:
        started_at = float(row["started_at"] or 0)
        ended_at = row["ended_at"]
        latency_ms = 0
        status = "active" if ended_at is None else "completed"
        if ended_at:
            try:
                latency_ms = max(0, int((float(ended_at) - started_at) * 1000))
            except Exception:
                latency_ms = 0
        out.append(
            {
                "timestamp": datetime.fromtimestamp(started_at, timezone.utc).isoformat(),
                "model": row["model"],
                "input_tokens": int(row["input_tokens"] or 0),
                "output_tokens": int(row["output_tokens"] or 0),
                "total_tokens": int(row["input_tokens"] or 0) + int(row["output_tokens"] or 0),
                "latency_ms": latency_ms,
                "status": status,
                "source": row["source"],
                "title": row["title"],
                "session_id": row["id"],
                "request_count": int(row["api_call_count"] or 0),
            }
        )
    return out


def _build_provider_payload(provider: str) -> dict[str, Any]:
    conn = _safe_connect(STATE_DB_PATH)
    if conn is None:
        return _default_payload(provider, f"State DB not available at {STATE_DB_PATH}")

    try:
        today_start, month_start, last_24h_start = _period_starts()
        today = _totals_row(conn, provider, today_start)
        month = _totals_row(conn, provider, month_start)
        model_rows = _model_rows(conn, provider)
        recent_rows = _recent_session_rows(conn, provider)

        payload = {
            "provider": provider,
            "label": PROVIDER_LABELS.get(provider, provider),
            "available": True,
            "source": "hermes-state-db",
            "note": "Aggregated from Hermes session database.",
            "rate_limit": {
                "rpm": 0,
                "tpm": 0,
                "rpm_used": 0,
                "tpm_used": 0,
                "known": False,
            },
            "today": {
                "input_tokens": int(today["input_tokens"] if today else 0),
                "output_tokens": int(today["output_tokens"] if today else 0),
                "requests": int(today["requests"] if today else 0),
            },
            "month": {
                "input_tokens": int(month["input_tokens"] if month else 0),
                "output_tokens": int(month["output_tokens"] if month else 0),
                "requests": int(month["requests"] if month else 0),
            },
            "models": model_rows,
            "recent_requests": _recent_requests(recent_rows),
            "hourly": _hourly_from_rows(recent_rows, last_24h_start),
        }

        if not model_rows and not payload["recent_requests"] and payload["today"]["requests"] == 0:
            payload["available"] = False
            payload["note"] = f"No Hermes sessions found for provider '{provider}'."

        return payload
    except Exception as exc:
        return _default_payload(provider, f"Telemetry query failed: {exc}")
    finally:
        conn.close()


@router.get("/tokens/{provider}")
async def provider_tokens(provider: str):
    normalized = _provider_key(provider)
    return _build_provider_payload(normalized)
