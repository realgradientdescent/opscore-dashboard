import json
import os
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter

router = APIRouter(tags=["tokens"])

STATE_DB_PATH = os.environ.get("HERMES_STATE_DB", "/opt/data/state.db")
OPENCLAW_STATE_DIR = Path(os.environ.get("OPENCLAW_STATE_DIR", "/data/.openclaw"))
OPENCLAW_AGENTS_DIR = OPENCLAW_STATE_DIR / "agents"

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


def _safe_connect(path: str | Path) -> sqlite3.Connection | None:
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


def _hourly_from_rows(rows: list[dict[str, Any]], since_ts: float, *, milliseconds: bool = False) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = defaultdict(lambda: {"input": 0, "output": 0, "requests": 0})
    for row in rows:
        raw_ts = row.get("updatedAt") if milliseconds else row.get("started_at")
        started_at = float(raw_ts or 0)
        if milliseconds:
            started_at /= 1000.0
        if started_at < since_ts:
            continue
        hour_key = datetime.fromtimestamp(started_at, timezone.utc).replace(minute=0, second=0, microsecond=0).isoformat()
        buckets[hour_key]["input"] += int(row.get("input_tokens") or 0)
        buckets[hour_key]["output"] += int(row.get("output_tokens") or 0)
        buckets[hour_key]["requests"] += int(row.get("api_call_count") or row.get("request_count") or 0)

    return [{"hour": hour_key, **buckets[hour_key]} for hour_key in sorted(buckets.keys())]


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


def _build_provider_payload_from_hermes(provider: str) -> dict[str, Any]:
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
            "hourly": _hourly_from_rows([dict(r) for r in recent_rows], last_24h_start),
        }

        if not model_rows and not payload["recent_requests"] and payload["today"]["requests"] == 0:
            payload["available"] = False
            payload["note"] = f"No Hermes sessions found for provider '{provider}'."

        return payload
    except Exception as exc:
        return _default_payload(provider, f"Telemetry query failed: {exc}")
    finally:
        conn.close()


def _load_openclaw_sessions() -> list[dict[str, Any]]:
    sessions: list[dict[str, Any]] = []
    if not OPENCLAW_AGENTS_DIR.exists():
        return sessions

    def classify_session_key(session_key: str) -> str:
        if ":heartbeat" in session_key:
            return "heartbeat"
        if ":run:" in session_key:
            return "run"
        if ":subagent:" in session_key:
            return "subagent"
        if ":cron:" in session_key:
            return "cron"
        if ":telegram:" in session_key:
            return "chat"
        if session_key.endswith(":main"):
            return "main"
        return "other"

    def dedupe(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_identity: dict[str, dict[str, Any]] = {}

        def rank(row: dict[str, Any]) -> tuple[int, float]:
            kind = str(row.get("sessionKind") or "")
            session_id = row.get("sessionId")
            canonical_bonus = 0 if kind != "run" else -1
            heartbeat_penalty = -2 if kind == "heartbeat" else 0
            has_session_bonus = 1 if session_id else 0
            updated = float(row.get("updatedAt") or 0)
            return (canonical_bonus + heartbeat_penalty + has_session_bonus, updated)

        for row in rows:
            identity = str(row.get("sessionId") or row.get("key") or "")
            if not identity:
                continue
            current = by_identity.get(identity)
            if current is None or rank(row) > rank(current):
                by_identity[identity] = row

        deduped = list(by_identity.values())
        deduped.sort(key=lambda item: float(item.get("updatedAt") or 0), reverse=True)
        return deduped

    for store_path in OPENCLAW_AGENTS_DIR.glob("*/sessions/sessions.json"):
        try:
            data = json.loads(store_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        for session_key, payload in data.items():
            if not isinstance(payload, dict):
                continue
            row = dict(payload)
            row["key"] = session_key
            row["sessionKind"] = classify_session_key(session_key)
            row["provider"] = row.get("modelProvider")
            row["input_tokens"] = int(row.get("inputTokens") or 0)
            row["output_tokens"] = int(row.get("outputTokens") or 0)
            row["api_call_count"] = int(row.get("requestCount") or 1)
            sessions.append(row)
    return dedupe(sessions)


def _build_provider_payload_from_openclaw(provider: str) -> dict[str, Any] | None:
    sessions = [row for row in _load_openclaw_sessions() if row.get("provider") == provider]
    if not sessions:
        return None

    today_start, month_start, last_24h_start = _period_starts()

    def in_period(row: dict[str, Any], start_ts: float) -> bool:
        updated_at = float(row.get("updatedAt") or 0) / 1000.0
        return updated_at >= start_ts

    def summarize(rows: list[dict[str, Any]]) -> dict[str, int]:
        return {
            "input_tokens": sum(int(row.get("input_tokens") or 0) for row in rows),
            "output_tokens": sum(int(row.get("output_tokens") or 0) for row in rows),
            "requests": sum(max(1, int(row.get("api_call_count") or 0)) for row in rows),
        }

    model_buckets: dict[str, dict[str, Any]] = defaultdict(lambda: {"input_tokens": 0, "output_tokens": 0, "requests": 0})
    for row in sessions:
        model = row.get("model") or "<unknown>"
        model_buckets[model]["input_tokens"] += int(row.get("input_tokens") or 0)
        model_buckets[model]["output_tokens"] += int(row.get("output_tokens") or 0)
        model_buckets[model]["requests"] += max(1, int(row.get("api_call_count") or 0))

    recent_requests = []
    for row in sessions[:10]:
        updated_at = float(row.get("updatedAt") or 0) / 1000.0
        recent_requests.append(
            {
                "timestamp": datetime.fromtimestamp(updated_at, timezone.utc).isoformat(),
                "model": row.get("model") or "<unknown>",
                "input_tokens": int(row.get("input_tokens") or 0),
                "output_tokens": int(row.get("output_tokens") or 0),
                "total_tokens": int(row.get("totalTokens") or 0),
                "latency_ms": 0,
                "status": "active" if not row.get("abortedLastRun") else "aborted",
                "source": row.get("key"),
                "title": row.get("origin", {}).get("label") if isinstance(row.get("origin"), dict) else None,
                "session_id": row.get("sessionId"),
                "request_count": max(1, int(row.get("api_call_count") or 0)),
            }
        )

    models = [
        {"model": model, **values}
        for model, values in sorted(
            model_buckets.items(),
            key=lambda item: item[1]["input_tokens"] + item[1]["output_tokens"],
            reverse=True,
        )[:12]
    ]

    return {
        "provider": provider,
        "label": PROVIDER_LABELS.get(provider, provider),
        "available": True,
        "source": "openclaw-session-stores",
        "note": "Aggregated from live OpenClaw session stores; date buckets use each session's last update time.",
        "rate_limit": {
            "rpm": 0,
            "tpm": 0,
            "rpm_used": 0,
            "tpm_used": 0,
            "known": False,
        },
        "today": summarize([row for row in sessions if in_period(row, today_start)]),
        "month": summarize([row for row in sessions if in_period(row, month_start)]),
        "models": models,
        "recent_requests": recent_requests,
        "hourly": _hourly_from_rows(sessions, last_24h_start, milliseconds=True),
    }


def _build_provider_payload(provider: str) -> dict[str, Any]:
    openclaw_payload = _build_provider_payload_from_openclaw(provider)
    if openclaw_payload is not None:
        return openclaw_payload
    return _build_provider_payload_from_hermes(provider)


@router.get("/tokens/{provider}")
async def provider_tokens(provider: str):
    normalized = _provider_key(provider)
    return _build_provider_payload(normalized)
