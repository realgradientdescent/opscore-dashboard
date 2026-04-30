import time
from datetime import datetime, timezone

import docker
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["containers"])


def get_client():
    try:
        client = docker.from_env()
        client.ping()
        return client
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Docker not available: {e}")


def parse_container_stats(container):
    """Extract CPU/memory/network stats from a container."""
    try:
        stats = container.stats(stream=False)
    except Exception:
        return {"cpu_percent": 0, "memory_mb": 0, "memory_limit_mb": 0, "network_in_mb": 0, "network_out_mb": 0}

    # CPU percent
    cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - stats["precpu_stats"]["cpu_usage"]["total_usage"]
    system_delta = stats["cpu_stats"].get("system_cpu_usage", 0) - stats["precpu_stats"].get("system_cpu_usage", 0)
    num_cpus = stats["cpu_stats"].get("online_cpus", 1) or 1
    cpu_percent = round((cpu_delta / system_delta) * num_cpus * 100, 2) if system_delta > 0 else 0.0

    # Memory
    mem_usage = stats.get("memory_stats", {}).get("usage", 0)
    mem_limit = stats.get("memory_stats", {}).get("limit", 0)

    # Network
    net_in = 0
    net_out = 0
    for iface in stats.get("networks", {}).values():
        net_in += iface.get("rx_bytes", 0)
        net_out += iface.get("tx_bytes", 0)

    return {
        "cpu_percent": cpu_percent,
        "memory_mb": round(mem_usage / (1024 ** 2), 1),
        "memory_limit_mb": round(mem_limit / (1024 ** 2), 1),
        "network_in_mb": round(net_in / (1024 ** 2), 2),
        "network_out_mb": round(net_out / (1024 ** 2), 2),
    }


def parse_uptime(container):
    """Get uptime in seconds from container start time."""
    state = container.attrs.get("State", {})
    started = state.get("StartedAt", "")
    if not started or started.startswith("0001"):
        return 0
    try:
        # Docker timestamps can have nanosecond precision; truncate to microseconds
        started = started.replace("Z", "+00:00")
        if "." in started:
            parts = started.split(".")
            frac = parts[1].split("+")[0].split("-")[0][:6]
            tz = started[started.index(".") + 1 + len(parts[1].split("+")[0].split("-")[0]):]
            started = f"{parts[0]}.{frac}{tz}"
        dt = datetime.fromisoformat(started)
        return max(0, int((datetime.now(timezone.utc) - dt).total_seconds()))
    except Exception:
        return 0


@router.get("/containers")
async def list_containers():
    client = get_client()
    results = []
    for c in client.containers.list(all=True):
        info = {
            "id": c.short_id,
            "name": c.name,
            "image": ",".join(c.image.tags) if c.image and c.image.tags else str(c.image),
            "status": c.status,
            "ports": c.ports,
            "uptime_seconds": parse_uptime(c),
            "restart_count": c.attrs.get("RestartCount", 0),
        }
        if c.status == "running":
            info.update(parse_container_stats(c))
        else:
            info.update({"cpu_percent": 0, "memory_mb": 0, "memory_limit_mb": 0, "network_in_mb": 0, "network_out_mb": 0})
        results.append(info)
    return results


@router.get("/containers/{container_id}/logs")
async def container_logs(container_id: str):
    client = get_client()
    try:
        container = client.containers.get(container_id)
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    logs = container.logs(tail=200, timestamps=True).decode("utf-8", errors="replace")
    return {"container_id": container_id, "name": container.name, "logs": logs.split("\n")}
