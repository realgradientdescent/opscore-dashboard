from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

from .agents import list_agents
from .containers import list_containers
from .costs import build_cost_payload
from .health import get_health

router = APIRouter(tags=["alerts"])


IMPORTANT_CONTAINERS = {
    "opscore-agent": "OpsCore agent",
    "openclaw-1ovr-openclaw-1": "OpenClaw",
    "hermes-agent-6aos-hermes-agent-1": "Hermes",
    "traefik": "Traefik",
}


def _alert(alert_id: str, severity: str, message: str, detail: str, source: str) -> dict[str, Any]:
    return {
        "id": alert_id,
        "severity": severity,
        "message": message,
        "detail": detail,
        "time": "now",
        "source": source,
    }


@router.get("/alerts")
async def get_alerts():
    generated_at = datetime.now(timezone.utc).isoformat()
    active: list[dict[str, Any]] = []
    rules: list[dict[str, Any]] = []

    try:
        health = await get_health()
    except Exception as exc:
        health = None
        active.append(_alert("health-unavailable", "critical", "Health telemetry unavailable", str(exc), "health"))

    try:
        containers = await list_containers()
    except Exception as exc:
        containers = []
        active.append(_alert("containers-unavailable", "critical", "Container telemetry unavailable", str(exc), "containers"))

    try:
        agents = await list_agents()
    except Exception as exc:
        agents = []
        active.append(_alert("agents-unavailable", "critical", "Agent telemetry unavailable", str(exc), "agents"))

    costs = build_cost_payload()

    if health is not None:
        cpu_percent = float(health.get("cpu_percent") or 0)
        memory_percent = float((health.get("memory") or {}).get("percent") or 0)
        disk_entries = health.get("disk") or []
        worst_disk = max(disk_entries, key=lambda d: float(d.get("percent") or 0), default=None)

        cpu_triggered = cpu_percent >= 90
        rules.append({
            "id": "cpu-90",
            "condition": "CPU > 90%",
            "severity": "critical",
            "channel": "Dashboard",
            "enabled": True,
            "triggered": cpu_triggered,
            "detail": f"Current CPU: {cpu_percent:.1f}%",
        })
        if cpu_triggered:
            active.append(_alert("cpu-90", "critical", "CPU usage is above 90%", f"Current CPU is {cpu_percent:.1f}%.", "health"))

        mem_triggered = memory_percent >= 85
        rules.append({
            "id": "memory-85",
            "condition": "Memory > 85%",
            "severity": "warning",
            "channel": "Dashboard",
            "enabled": True,
            "triggered": mem_triggered,
            "detail": f"Current memory: {memory_percent:.1f}%",
        })
        if mem_triggered:
            active.append(_alert("memory-85", "warning", "Memory pressure is high", f"RAM usage is {memory_percent:.1f}%.", "health"))

        disk_triggered = bool(worst_disk and float(worst_disk.get("percent") or 0) >= 90)
        rules.append({
            "id": "disk-90",
            "condition": "Any disk > 90%",
            "severity": "warning",
            "channel": "Dashboard",
            "enabled": True,
            "triggered": disk_triggered,
            "detail": (
                f"Worst mount {worst_disk.get('mount')} at {float(worst_disk.get('percent') or 0):.1f}%"
                if worst_disk
                else "No disk telemetry"
            ),
        })
        if disk_triggered and worst_disk:
            active.append(
                _alert(
                    "disk-90",
                    "warning",
                    "Disk usage is above 90%",
                    f"Mount {worst_disk.get('mount')} is at {float(worst_disk.get('percent') or 0):.1f}%.",
                    "health",
                )
            )

    container_map = {str(item.get("name")): item for item in containers}
    for container_name, label in IMPORTANT_CONTAINERS.items():
        info = container_map.get(container_name)
        triggered = info is None or str(info.get("status")) != "running"
        detail = "Container not found in Docker telemetry." if info is None else f"Current status: {info.get('status')}"
        rules.append({
            "id": f"container-{container_name}",
            "condition": f"{label} container not running",
            "severity": "critical",
            "channel": "Dashboard",
            "enabled": True,
            "triggered": triggered,
            "detail": detail,
        })
        if triggered:
            active.append(_alert(f"container-{container_name}", "critical", f"{label} container is not running", detail, "containers"))

    recent_restart_events = [
        c for c in containers if int(c.get("restart_count") or 0) > 0 and int(c.get("uptime_seconds") or 0) <= 3600
    ]
    rules.append({
        "id": "container-restarts",
        "condition": "Container restarted within the last hour",
        "severity": "warning",
        "channel": "Dashboard",
        "enabled": True,
        "triggered": bool(recent_restart_events),
        "detail": ", ".join(
            f"{c.get('name')} ({c.get('restart_count')} restart(s), uptime {int(c.get('uptime_seconds') or 0)}s)"
            for c in recent_restart_events
        ) if recent_restart_events else "No recent container restarts reported.",
    })
    for container in recent_restart_events[:3]:
        active.append(
            _alert(
                f"restart-{container.get('name')}",
                "warning",
                f"Container {container.get('name')} restarted recently",
                f"Restart count: {container.get('restart_count')}; current uptime: {int(container.get('uptime_seconds') or 0)}s",
                "containers",
            )
        )

    unhealthy_agents = [
        a
        for a in agents
        if str(a.get("status")) in {"error", "docker_unavailable", "not_found", "unavailable"} or a.get("error")
    ]
    rules.append({
        "id": "agent-health",
        "condition": "Agent error / missing telemetry",
        "severity": "critical",
        "channel": "Dashboard",
        "enabled": True,
        "triggered": bool(unhealthy_agents),
        "detail": ", ".join(f"{a.get('name')}: {a.get('error') or a.get('status')}" for a in unhealthy_agents) if unhealthy_agents else "No agent errors reported.",
    })
    for agent in unhealthy_agents[:4]:
        active.append(
            _alert(
                f"agent-{agent.get('name')}",
                "critical",
                f"{agent.get('name')} telemetry issue",
                str(agent.get("error") or agent.get("status")),
                "agents",
            )
        )

    budget = costs.get("budget_monthly")
    month_total = float(costs.get("month_total") or 0)
    if budget is not None and budget > 0:
        pct = (month_total / budget) * 100 if budget else 0
        for threshold, severity in ((75, "warning"), (90, "critical")):
            triggered = pct >= threshold
            rules.append({
                "id": f"cost-{threshold}",
                "condition": f"Monthly cost > {threshold}% of budget",
                "severity": severity,
                "channel": "Dashboard",
                "enabled": True,
                "triggered": triggered,
                "detail": f"Current spend is ${month_total:.2f} / ${budget:.2f} ({pct:.1f}%).",
            })
            if triggered:
                active.append(
                    _alert(
                        f"cost-{threshold}",
                        severity,
                        f"Monthly cost is above {threshold}% of budget",
                        f"Current spend is ${month_total:.2f} / ${budget:.2f} ({pct:.1f}%).",
                        "costs",
                    )
                )
    else:
        rules.append({
            "id": "cost-budget",
            "condition": "Monthly budget configured",
            "severity": "info",
            "channel": "Dashboard",
            "enabled": False,
            "triggered": False,
            "detail": "MONTHLY_BUDGET_USD is not configured, so budget alerts are disabled.",
        })

    severity_rank = {"critical": 0, "warning": 1, "info": 2}
    active.sort(key=lambda item: severity_rank.get(str(item.get("severity")), 99))

    summary = {
        "active_count": len(active),
        "critical_count": sum(1 for item in active if item.get("severity") == "critical"),
        "warning_count": sum(1 for item in active if item.get("severity") == "warning"),
        "info_count": sum(1 for item in active if item.get("severity") == "info"),
    }

    return {
        "source": "live-ops-evaluator",
        "note": "Active alerts are evaluated from current health, containers, agents, and live cost telemetry. Historical alert persistence is not wired yet.",
        "generated_at": generated_at,
        "summary": summary,
        "active": active,
        "history": [],
        "rules": rules,
    }
