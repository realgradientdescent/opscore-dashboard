import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import docker
from fastapi import APIRouter

router = APIRouter(tags=["agents"])

OPENCLAW_STATE_DIR = Path(os.environ.get("OPENCLAW_STATE_DIR", "/data/.openclaw"))
OPENCLAW_CONFIG_PATH = OPENCLAW_STATE_DIR / "openclaw.json"
OPENCLAW_TASKS_DB_PATH = OPENCLAW_STATE_DIR / "tasks" / "runs.sqlite"
OPENCLAW_SUBAGENTS_PATH = OPENCLAW_STATE_DIR / "subagents" / "runs.json"
OPENCLAW_AGENTS_DIR = OPENCLAW_STATE_DIR / "agents"

AGENT_CONTAINERS = {
    "openclaw": {
        "container_name": os.environ.get("OPENCLAW_CONTAINER_NAME", "openclaw-1ovr"),
        "display_name": "OpenClaw",
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


def _iso_from_timestamp(ts: float | int | None, *, milliseconds: bool = False) -> str | None:
    if ts in (None, ""):
        return None
    try:
        value = float(ts)
        if milliseconds:
            value /= 1000.0
        return datetime.fromtimestamp(value, timezone.utc).isoformat()
    except Exception:
        return None


def _excerpt(text: str | None, limit: int = 96) -> str | None:
    if not text:
        return None
    cleaned = " ".join(str(text).split())
    if not cleaned:
        return None
    return cleaned if len(cleaned) <= limit else cleaned[: limit - 1].rstrip() + "…"


def _safe_connect(path: str | Path) -> sqlite3.Connection | None:
    if not os.path.exists(path):
        return None
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception:
        return None


def _load_json(path: Path) -> Any:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _classify_openclaw_session_key(session_key: str) -> str:
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


def _dedupe_openclaw_sessions(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
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


def _load_openclaw_sessions() -> list[dict[str, Any]]:
    sessions: list[dict[str, Any]] = []
    if not OPENCLAW_AGENTS_DIR.exists():
        return sessions

    for store_path in OPENCLAW_AGENTS_DIR.glob("*/sessions/sessions.json"):
        data = _load_json(store_path)
        if not isinstance(data, dict):
            continue
        for session_key, payload in data.items():
            if not isinstance(payload, dict):
                continue
            row = dict(payload)
            row["key"] = session_key
            row["sessionKind"] = _classify_openclaw_session_key(session_key)
            agent_id = session_key.split(":", 2)[1] if session_key.startswith("agent:") and ":" in session_key else None
            row.setdefault("agentId", agent_id)
            sessions.append(row)
    return _dedupe_openclaw_sessions(sessions)


def _load_openclaw_task_snapshot() -> dict[str, Any] | None:
    conn = _safe_connect(OPENCLAW_TASKS_DB_PATH)
    if conn is None:
        return None
    try:
        row = conn.execute(
            """
            SELECT *
            FROM task_runs
            ORDER BY
              CASE WHEN status = 'running' THEN 0 ELSE 1 END,
              COALESCE(last_event_at, started_at, created_at) DESC
            LIMIT 1
            """
        ).fetchone()
        return dict(row) if row else None
    except Exception:
        return None
    finally:
        conn.close()


def _openclaw_configured_providers() -> list[str]:
    data = _load_json(OPENCLAW_CONFIG_PATH)
    providers = data.get("models", {}).get("providers", {}) if isinstance(data, dict) else {}
    if not isinstance(providers, dict):
        return []
    return sorted([key for key, value in providers.items() if isinstance(value, dict) and value.get("enabled", True)])


def _build_openclaw_subagents(sessions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    data = _load_json(OPENCLAW_SUBAGENTS_PATH)
    runs = data.get("runs") if isinstance(data, dict) else None
    if not isinstance(runs, list):
        runs = []

    session_by_key = {row.get("key"): row for row in sessions if row.get("key")}
    conn = _safe_connect(OPENCLAW_TASKS_DB_PATH)
    task_by_run_id: dict[str, dict[str, Any]] = {}
    if conn is not None:
        try:
            rows = conn.execute(
                """
                SELECT *
                FROM task_runs
                WHERE runtime = 'subagent' OR runtime = 'cli'
                ORDER BY COALESCE(last_event_at, started_at, created_at) DESC
                """
            ).fetchall()
            for row in rows:
                payload = dict(row)
                for key in (payload.get("run_id"), payload.get("source_id")):
                    if key:
                        task_by_run_id.setdefault(str(key), payload)
        except Exception:
            pass
        finally:
            conn.close()

    subagents: list[dict[str, Any]] = []
    for run in sorted(runs, key=lambda item: float(item.get("startedAt") or item.get("createdAt") or 0), reverse=True):
        child_session_key = run.get("childSessionKey")
        task_row = task_by_run_id.get(str(run.get("runId") or ""), {})
        session = session_by_key.get(child_session_key, {})
        status = task_row.get("status") or ("running" if run.get("startedAt") and not run.get("completedAt") else "unknown")
        agent_id = (child_session_key or "").split(":", 2)[1] if child_session_key and child_session_key.startswith("agent:") else None
        short_id = str(run.get("runId") or "")[:8] or "subagent"
        current_task = _excerpt(task_row.get("task") or run.get("task"), 110)
        last_active_iso = _iso_from_timestamp(
            task_row.get("last_event_at") or run.get("startedAt") or run.get("createdAt"),
            milliseconds=True,
        )
        subagents.append(
            {
                "name": f"{agent_id or 'subagent'}:{short_id}",
                "status": "active" if status == "running" else status,
                "current_task": current_task,
                "tokens_session": session.get("totalTokens"),
                "last_active": last_active_iso,
            }
        )

    seen_names = {item["name"] for item in subagents if item.get("name")}
    fallback_candidates = [row for row in sessions if row.get("sessionKind") == "subagent"]
    now_ms = datetime.now(timezone.utc).timestamp() * 1000.0
    recent_cutoff_ms = now_ms - (14 * 24 * 60 * 60 * 1000)
    recent_candidates = [row for row in fallback_candidates if float(row.get("updatedAt") or 0) >= recent_cutoff_ms]
    source_rows = recent_candidates or fallback_candidates

    for session in source_rows:
        if session.get("sessionKind") != "subagent":
            continue
        session_key = str(session.get("key") or "")
        agent_id = session.get("agentId") or (session_key.split(":", 2)[1] if session_key.startswith("agent:") else None)
        short_id = session_key.rsplit(":", 1)[-1][:8] if session_key else "subagent"
        name = f"{agent_id or 'subagent'}:{short_id}"
        if name in seen_names:
            continue
        subagents.append(
            {
                "name": name,
                "status": "idle",
                "current_task": _excerpt(session.get("title") or session.get("summary") or session_key, 110),
                "tokens_session": session.get("totalTokens"),
                "last_active": _iso_from_timestamp(session.get("updatedAt"), milliseconds=True),
            }
        )
        seen_names.add(name)

    subagents.sort(
        key=lambda item: item.get("last_active") or "",
        reverse=True,
    )
    return subagents[:8]


def _populate_openclaw_telemetry(result: dict[str, Any], container_status: str) -> None:
    sessions = _load_openclaw_sessions()
    task = _load_openclaw_task_snapshot()
    primary_kinds = {"chat", "main"}
    latest_session = next((row for row in sessions if row.get("sessionKind") in primary_kinds), None)
    if latest_session is None:
        latest_session = next((row for row in sessions if row.get("sessionKind") not in {"heartbeat", "run"}), sessions[0] if sessions else None)

    subagents = _build_openclaw_subagents(sessions)
    result["subagents"] = subagents

    if latest_session:
        updated_at_iso = _iso_from_timestamp(latest_session.get("updatedAt"), milliseconds=True)
        result["last_activity_at"] = updated_at_iso
        session_key = latest_session.get("key")
        if updated_at_iso and session_key:
            result["last_activity"] = f"{updated_at_iso} · {session_key}"
        result["tokens_session"] = latest_session.get("totalTokens")
        result["model"] = latest_session.get("model")
        result["provider"] = latest_session.get("modelProvider")
        result["session_id"] = latest_session.get("sessionId")
        result["session_source"] = latest_session.get("key")

    if task:
        task_excerpt = _excerpt(task.get("task") or task.get("label"), 140)
        result["current_task"] = task_excerpt
        if not result.get("session_source") and task.get("child_session_key"):
            result["session_source"] = task.get("child_session_key")
        if not result.get("last_activity_at"):
            result["last_activity_at"] = _iso_from_timestamp(
                task.get("last_event_at") or task.get("started_at") or task.get("created_at"),
                milliseconds=True,
            )
        if result.get("last_activity_at") and not result.get("last_activity"):
            result["last_activity"] = f"{result['last_activity_at']} · {task.get('status') or task.get('runtime') or 'task'}"
        if task.get("status") == "running":
            result["status"] = "active"
        elif container_status == "running":
            result["status"] = "idle"
        if task.get("error"):
            result["error"] = _excerpt(task.get("error"), 140)

    if result.get("status") == "unknown" and container_status == "running":
        result["status"] = "idle"

    if not result.get("provider"):
        providers = _openclaw_configured_providers()
        if providers:
            result["provider"] = providers[0]

    if not result.get("model"):
        config = _load_json(OPENCLAW_CONFIG_PATH)
        defaults = config.get("agents", {}).get("defaults", {}) if isinstance(config, dict) else {}
        model = defaults.get("model")
        if isinstance(model, str):
            result["model"] = model


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
        elif agent_key == "openclaw":
            _populate_openclaw_telemetry(result, result["status"])
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
        elif agent_key == "openclaw":
            _populate_openclaw_telemetry(result, container.status)
        else:
            try:
                logs = container.logs(tail=1, timestamps=True).decode("utf-8", errors="replace").strip()
                if logs:
                    result["last_activity"] = logs[:120]
            except Exception:
                pass

    except docker.errors.NotFound:
        result["status"] = "not_found"
        result["error"] = f"Container '{spec['container_name']}' not found"
        if agent_key == "hermes":
            _populate_hermes_telemetry(result, result["status"])
        elif agent_key == "openclaw":
            _populate_openclaw_telemetry(result, result["status"])
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        if agent_key == "hermes":
            _populate_hermes_telemetry(result, result["status"])
        elif agent_key == "openclaw":
            _populate_openclaw_telemetry(result, result["status"])

    return result


@router.get("/agents")
async def list_agents():
    client = get_client()
    return [inspect_agent(client, key) for key in AGENT_CONTAINERS]
