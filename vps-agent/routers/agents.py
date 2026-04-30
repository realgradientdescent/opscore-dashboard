from datetime import datetime, timezone

import docker
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["agents"])

AGENT_CONTAINERS = {
    "openclaw": {
        "container_name": "openclaw-1ovr",
        "display_name": "OpenClaw",
        "subagents": ["Researcher", "Writer", "Reviewer", "Publisher"],
    },
    "hermes": {
        "container_name": "hermes-agent-6aos",
        "display_name": "Hermes",
        "subagents": [],
    },
}


def get_client():
    try:
        client = docker.from_env()
        client.ping()
        return client
    except Exception:
        return None


def inspect_agent(client, agent_key: str):
    spec = AGENT_CONTAINERS[agent_key]
    result = {
        "name": spec["display_name"],
        "status": "unknown",
        "uptime_seconds": 0,
        "last_activity": None,
        "error": None,
        "subagents": [],
    }

    if client is None:
        result["status"] = "docker_unavailable"
        result["error"] = "Cannot connect to Docker"
        return result

    try:
        container = client.containers.get(spec["container_name"])
        result["status"] = container.status

        # Uptime
        state = container.attrs.get("State", {})
        started = state.get("StartedAt", "")
        if started and not started.startswith("0001"):
            try:
                started_clean = started.replace("Z", "+00:00")
                dt = datetime.fromisoformat(started_clean[:26] + "+00:00" if "+" not in started_clean[20:] else started_clean[:26] + started_clean[started_clean.rindex("+"):])
                result["uptime_seconds"] = max(0, int((datetime.now(timezone.utc) - dt).total_seconds()))
            except Exception:
                pass

        # Last log line as last activity
        try:
            logs = container.logs(tail=1, timestamps=True).decode("utf-8", errors="replace").strip()
            if logs:
                result["last_activity"] = logs[:80]
        except Exception:
            pass

        # Subagents
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
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)

    return result


@router.get("/agents")
async def list_agents():
    client = get_client()
    return {key: inspect_agent(client, key) for key in AGENT_CONTAINERS}
