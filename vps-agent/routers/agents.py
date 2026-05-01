import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

import docker
from fastapi import APIRouter

router = APIRouter(tags=["agents"])

AGENT_CONTAINERS = {
    "openclaw": {
        "container_name": os.environ.get("OPENCLAW_CONTAINER_NAME", "openclaw-1ovr"),
        "display_name": "OpenClaw",
        "subagents": ["Researcher", "Writer", "Reviewer", "Publisher"],
    },
    "hermes": {
        "container_name": os.environ.get("HERMES_CONTAINER_NAME", "hermes-agent-6aos"),
        "display_name": "Hermes",
        "subagents": [],
    },
}

STATE_DB_PATH = os.environ.get("HERMES_STATE_DB", "/opt/data/state.db")
AGENT_LOG_PATH = os.environ.get("HERMES_AGENT_LOG", "/opt/data/logs/agent.log")


def get_client():
    try:
        client = docker.from_env()
        client.ping()
        return client
    except Exception:
        return None


def _iso_from_timestamp(ts: float | int | None) -> str | None:
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(float(ts), timezone.utc).isoformat()
    except Exception:
        return None


def _excerpt(text: str | None, limit: int = 96) -> str | None:
    if not text:
        return None
    cleaned = " ".join(str(text).split())
    if not cleaned:
        return None
    return cleaned if len(cleaned) <= limit else cleaned[: limit - 1].rstrip() + "…"


def _safe_connect(path: str) -> sqlite3.Connection | None:
    if not os.path.exists(path):
        return None
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception:
        return None


def _load_recent_session_snapshot() -> dict[str, Any] | None:
    conn = _safe_connect(STATE_DB_PATH)
    if conn is None:
        return None

    query = """
    SELECT
      s.id,
      s.source,
      s.title,
      s.model,
      s.billing_provider,
      s.started_at,
      s.ended_at,
      s.end_reason,
      s.input_tokens,
      s.output_tokens,
      s.cache_read_tokens,
      s.cache_write_tokens,
      s.reasoning_tokens,
      s.api_call_count,
      (
        SELECT m.role
        FROM messages m
        WHERE m.session_id = s.id
        ORDER BY m.timestamp DESC
        LIMIT 1
      ) AS last_role,
      (
        SELECT m.content
        FROM messages m
        WHERE m.session_id = s.id
        ORDER BY m.timestamp DESC
        LIMIT 1
      ) AS last_content,
      (
        SELECT m.timestamp
        FROM messages m
        WHERE m.session_id = s.id
        ORDER BY m.timestamp DESC
        LIMIT 1
      ) AS last_timestamp,
      (
        SELECT m.content
        FROM messages m
        WHERE m.session_id = s.id AND m.role = 'user'
        ORDER BY m.timestamp DESC
        LIMIT 1
      ) AS last_user_content,
      (
        SELECT m.timestamp
        FROM messages m
        WHERE m.session_id = s.id AND m.role = 'user'
        ORDER BY m.timestamp DESC
        LIMIT 1
      ) AS last_user_timestamp
    FROM sessions s
    ORDER BY COALESCE(
      (
        SELECT MAX(m.timestamp)
        FROM messages m
        WHERE m.session_id = s.id
      ),
      s.started_at
    ) DESC
    LIMIT 1
    """

    try:
        row = conn.execute(query).fetchone()
        if row is None:
            return None
        snapshot = dict(row)
        snapshot["tokens_total"] = int(snapshot.get("input_tokens") or 0) + int(snapshot.get("output_tokens") or 0)
        snapshot["tokens_grand_total"] = (
            int(snapshot.get("input_tokens") or 0)
            + int(snapshot.get("output_tokens") or 0)
            + int(snapshot.get("cache_read_tokens") or 0)
            + int(snapshot.get("cache_write_tokens") or 0)
            + int(snapshot.get("reasoning_tokens") or 0)
        )
        return snapshot
    except Exception:
        return None
    finally:
        conn.close()


def _read_recent_inbound_message() -> tuple[str | None, str | None]:
    if not os.path.exists(AGENT_LOG_PATH):
        return None, None
    try:
        with open(AGENT_LOG_PATH, "r", encoding="utf-8", errors="replace") as handle:
            lines = handle.readlines()[-250:]
        for line in reversed(lines):
            if "gateway.run: inbound message:" in line:
                stamp = line.split(" INFO ", 1)[0].strip()
                msg = None
                if "msg='" in line:
                    msg = line.split("msg='", 1)[1].rsplit("'", 1)[0]
                return stamp, _excerpt(msg, 100)
    except Exception:
        return None, None
    return None, None


def _populate_hermes_telemetry(result: dict[str, Any], container_status: str) -> None:
    snapshot = _load_recent_session_snapshot()
    inbound_ts, inbound_excerpt = _read_recent_inbound_message()

    if snapshot is None:
        if inbound_ts and not result.get("last_activity"):
            result["last_activity"] = f"Inbound Telegram at {inbound_ts}"
        return

    last_ts = snapshot.get("last_timestamp") or snapshot.get("started_at")
    last_ts_iso = _iso_from_timestamp(last_ts)
    last_role = snapshot.get("last_role")
    last_user_excerpt = _excerpt(snapshot.get("last_user_content"), 110)
    title = _excerpt(snapshot.get("title"), 120)
    source = snapshot.get("source") or "session"
    session_is_open = snapshot.get("ended_at") is None

    if last_ts_iso:
        role_label = last_role or source
        result["last_activity"] = f"{last_ts_iso} · {source} {role_label}"
    elif inbound_ts:
        result["last_activity"] = f"Inbound Telegram at {inbound_ts}"

    if inbound_excerpt:
        result["last_inbound"] = inbound_excerpt
    if last_ts_iso:
        result["last_activity_at"] = last_ts_iso

    result["model"] = snapshot.get("model")
    result["provider"] = snapshot.get("billing_provider")
    result["tokens_session"] = snapshot.get("tokens_grand_total") or snapshot.get("tokens_total")
    result["api_calls_session"] = snapshot.get("api_call_count") or 0
    result["session_id"] = snapshot.get("id")
    result["session_source"] = source

    if session_is_open and last_user_excerpt:
        result["current_task"] = f"Responding to: {last_user_excerpt}"
    elif title:
        result["current_task"] = title
    elif last_user_excerpt:
        result["current_task"] = f"Last user ask: {last_user_excerpt}"
    elif inbound_excerpt:
        result["current_task"] = f"Handling message: {inbound_excerpt}"

    if container_status == "running":
        if session_is_open:
            result["status"] = "active"
        elif result.get("current_task"):
            result["status"] = "idle"


def inspect_agent(client, agent_key: str):
    spec = AGENT_CONTAINERS[agent_key]
    result = {
        "name": spec["display_name"],
        "container": spec["container_name"],
        "status": "unknown",
        "uptime_seconds": 0,
        "last_activity": None,
        "last_activity_at": None,
        "last_inbound": None,
        "error": None,
        "subagents": [],
        "current_task": None,
        "tokens_session": None,
        "model": None,
        "provider": None,
        "session_id": None,
        "session_source": None,
        "api_calls_session": None,
    }

    if client is None:
        result["status"] = "docker_unavailable"
        result["error"] = "Cannot connect to Docker"
        if agent_key == "hermes":
            _populate_hermes_telemetry(result, result["status"])
        return result

    try:
        container = client.containers.get(spec["container_name"])
        result["container"] = container.name
        result["status"] = container.status

        state = container.attrs.get("State", {})
        started = state.get("StartedAt", "")
        if started and not started.startswith("0001"):
            try:
                started_clean = started.replace("Z", "+00:00")
                if "+" not in started_clean[20:]:
                    dt = datetime.fromisoformat(started_clean[:26] + "+00:00")
                else:
                    plus_idx = started_clean.rindex("+")
                    dt = datetime.fromisoformat(started_clean[:26] + started_clean[plus_idx:])
                result["uptime_seconds"] = max(0, int((datetime.now(timezone.utc) - dt).total_seconds()))
            except Exception:
                pass

        if agent_key == "hermes":
            _populate_hermes_telemetry(result, container.status)
        else:
            try:
                logs = container.logs(tail=1, timestamps=True).decode("utf-8", errors="replace").strip()
                if logs:
                    result["last_activity"] = logs[:120]
            except Exception:
                pass

        for sa in spec["subagents"]:
            result["subagents"].append({
                "name": sa,
                "status": "active" if container.status == "running" else "inactive",
            })

    except docker.errors.NotFound:
        result["status"] = "not_found"
        result["error"] = f"Container '{spec['container_name']}' not found"
        for sa in spec["subagents"]:
            result["subagents"].append({"name": sa, "status": "inactive"})
        if agent_key == "hermes":
            _populate_hermes_telemetry(result, result["status"])
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        if agent_key == "hermes":
            _populate_hermes_telemetry(result, result["status"])

    return result


@router.get("/agents")
async def list_agents():
    client = get_client()
    return [inspect_agent(client, key) for key in AGENT_CONTAINERS]
