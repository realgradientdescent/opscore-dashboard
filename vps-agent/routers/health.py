import platform
import time
from datetime import datetime, timezone

import psutil
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def get_health():
    cpu_per_core = psutil.cpu_percent(interval=0.5, percpu=True)
    mem = psutil.virtual_memory()

    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "mount": part.mountpoint,
                "used_gb": round(usage.used / (1024 ** 3), 2),
                "total_gb": round(usage.total / (1024 ** 3), 2),
                "percent": usage.percent,
            })
        except PermissionError:
            continue

    net = psutil.net_io_counters()
    boot_time = psutil.boot_time()

    # load_avg: on Windows psutil doesn't support getloadavg, fall back to 0
    try:
        load = psutil.getloadavg()
        load_avg = {"1m": round(load[0], 2), "5m": round(load[1], 2), "15m": round(load[2], 2)}
    except (AttributeError, OSError):
        cpu = psutil.cpu_percent()
        load_avg = {"1m": cpu, "5m": cpu, "15m": cpu}

    # top 10 processes by CPU
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info"]):
        try:
            info = p.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"],
                "cpu_percent": info["cpu_percent"] or 0.0,
                "memory_mb": round((info["memory_info"].rss if info["memory_info"] else 0) / (1024 ** 2), 1),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    procs.sort(key=lambda x: x["cpu_percent"], reverse=True)
    top_processes = procs[:10]

    uname = platform.uname()

    return {
        "cpu_percent": sum(cpu_per_core) / len(cpu_per_core) if cpu_per_core else 0,
        "cpu_per_core": cpu_per_core,
        "memory": {
            "used_gb": round(mem.used / (1024 ** 3), 2),
            "total_gb": round(mem.total / (1024 ** 3), 2),
            "percent": mem.percent,
        },
        "disk": disks,
        "network": {
            "bytes_in": net.bytes_recv,
            "bytes_out": net.bytes_sent,
        },
        "load_avg": load_avg,
        "uptime_seconds": int(time.time() - boot_time),
        "hostname": platform.node(),
        "os": f"{uname.system} {uname.release}",
        "kernel": uname.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "top_processes": top_processes,
    }
