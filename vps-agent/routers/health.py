import os
import platform
import time
from datetime import datetime, timezone

import psutil
from fastapi import APIRouter

router = APIRouter(tags=["health"])

SKIP_FSTYPES = {"tmpfs", "devtmpfs", "devfs", "overlay", "aufs", "squashfs", "nsfs", "cgroup", "cgroup2", "proc", "sysfs", "debugfs", "pstore"}
SKIP_MOUNT_PREFIXES = ("/etc/", "/proc/", "/sys/", "/dev/", "/run/")


@router.get("/health")
async def get_health():
    cpu_per_core = psutil.cpu_percent(interval=0.5, percpu=True)
    mem = psutil.virtual_memory()

    disks = []
    seen = set()
    for part in psutil.disk_partitions(all=True):
        if part.fstype in SKIP_FSTYPES:
            continue
        if any(part.mountpoint.startswith(p) for p in SKIP_MOUNT_PREFIXES):
            continue
        if part.device in seen:
            continue
        seen.add(part.device)
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "mount": part.mountpoint,
                "used_gb": round(usage.used / (1024 ** 3), 2),
                "total_gb": round(usage.total / (1024 ** 3), 2),
                "percent": usage.percent,
            })
        except (PermissionError, OSError):
            continue

    # Fallback: if no disks found (common in Docker), read /
    if not disks:
        try:
            usage = psutil.disk_usage("/")
            disks.append({"mount": "/", "used_gb": round(usage.used / (1024**3), 2), "total_gb": round(usage.total / (1024**3), 2), "percent": usage.percent})
        except Exception:
            pass

    net = psutil.net_io_counters()
    boot_time = psutil.boot_time()

    try:
        load = psutil.getloadavg()
        load_avg = {"1m": round(load[0], 2), "5m": round(load[1], 2), "15m": round(load[2], 2)}
    except (AttributeError, OSError):
        cpu = psutil.cpu_percent()
        load_avg = {"1m": cpu, "5m": cpu, "15m": cpu}

    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info", "status", "username"]):
        try:
            info = p.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"],
                "cpu_percent": info["cpu_percent"] or 0.0,
                "memory_percent": round((info["memory_info"].rss if info["memory_info"] else 0) / mem.total * 100, 1),
                "status": info.get("status", "unknown"),
                "username": info.get("username") or "—",
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    procs.sort(key=lambda x: x["cpu_percent"], reverse=True)

    uname = platform.uname()
    # Prefer HOSTNAME env var (set in docker-compose) over container ID
    hostname = os.environ.get("HOSTNAME_DISPLAY", os.environ.get("HOSTNAME", platform.node()))

    return {
        "cpu_percent": round(sum(cpu_per_core) / len(cpu_per_core), 1) if cpu_per_core else 0,
        "cpu_per_core": [round(c, 1) for c in cpu_per_core],
        "memory": {
            "used_gb": round(mem.used / (1024 ** 3), 2),
            "total_gb": round(mem.total / (1024 ** 3), 2),
            "percent": round(mem.percent, 1),
        },
        "disk": disks,
        "network": {
            "bytes_in": net.bytes_recv,
            "bytes_out": net.bytes_sent,
        },
        "load_avg": load_avg,
        "uptime_seconds": int(time.time() - boot_time),
        "hostname": hostname,
        "os": f"{uname.system} {uname.release}",
        "kernel": uname.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "top_processes": procs[:10],
    }
