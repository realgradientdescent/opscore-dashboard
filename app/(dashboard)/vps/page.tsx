"use client";

import { useState, useEffect } from "react";
import { useHealth } from "@/lib/hooks";
import { formatUptime, cn } from "@/lib/utils";
import { generateTimelineData } from "@/lib/mock-data";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function VpsPage() {
  const { data: health } = useHealth();
  const [diskIo, setDiskIo] = useState<{ time: string; read: number; write: number }[]>([]);
  const [netData, setNetData] = useState<ReturnType<typeof generateTimelineData>>([]);

  useEffect(() => {
    setDiskIo(Array.from({ length: 30 }, (_, i) => ({
      time: `${i}`,
      read: Math.random() * 50,
      write: Math.random() * 30,
    })));
    setNetData(generateTimelineData(30));
  }, []);

  const h = health ?? {
    cpu_percent: 34.2,
    cpu_per_core: [12.1, 45.3, 28.0, 41.2],
    memory: { used_gb: 6.2, total_gb: 16, percent: 38.7 },
    disk: [{ mount: "/", used_gb: 42.1, total_gb: 160, percent: 26.3 }],
    network: { bytes_in: 1240000, bytes_out: 880000 },
    load_avg: { "1m": 0.84, "5m": 0.91, "15m": 0.78 },
    uptime_seconds: 1209600,
    hostname: "my-vps",
    os: "Ubuntu 22.04.3 LTS",
    kernel: "5.15.0-91-generic",
    timestamp: new Date().toISOString(),
    top_processes: [],
  };

  const tooltipStyle = {
    backgroundColor: "#0f172a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 12,
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Hostname: </span>
          <span className="font-[family-name:var(--font-data)] text-accent">{h.hostname}</span>
        </div>
        <div>
          <span className="text-muted-foreground">OS: </span>
          <span>{h.os}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Kernel: </span>
          <span className="font-[family-name:var(--font-data)]">{h.kernel}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Uptime: </span>
          <span className="text-success">{formatUptime(h.uptime_seconds)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* CPU Gauge */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            CPU
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={h.cpu_percent > 90 ? "#f43f5e" : h.cpu_percent > 70 ? "#f59e0b" : "#00d9ff"}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - h.cpu_percent / 100)}
                  style={{ transition: "stroke-dashoffset 0.5s" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold font-[family-name:var(--font-data)]">
                  {h.cpu_percent.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              {h.cpu_per_core.map((core, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-12">Core {i}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${core}%`,
                        backgroundColor: core > 80 ? "#f59e0b" : "#00d9ff",
                      }}
                    />
                  </div>
                  <span className="font-[family-name:var(--font-data)] w-10 text-right">
                    {core.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Memory
          </h3>
          <div className="space-y-3">
            <div className="text-3xl font-bold font-[family-name:var(--font-data)] text-accent">
              {h.memory.percent.toFixed(1)}%
            </div>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${(h.memory.used_gb / h.memory.total_gb) * 100}%` }}
              />
              <div
                className="h-full bg-accent/30"
                style={{ width: `${((h.memory.total_gb - h.memory.used_gb) * 0.3 / h.memory.total_gb) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Used: {h.memory.used_gb.toFixed(1)} GB</span>
              <span>Total: {h.memory.total_gb.toFixed(0)} GB</span>
            </div>
          </div>
        </div>

        {/* Disk I/O */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Disk I/O
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={diskIo}>
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="read" stroke="#00d9ff" fill="rgba(0,217,255,0.1)" strokeWidth={1.5} name="Read MB/s" />
                <Area type="monotone" dataKey="write" stroke="#f59e0b" fill="rgba(245,158,11,0.1)" strokeWidth={1.5} name="Write MB/s" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Disk Usage */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Disk Usage
          </h3>
          <div className="space-y-3">
            {h.disk.map((d) => (
              <div key={d.mount}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-[family-name:var(--font-data)]">{d.mount}</span>
                  <span className="text-muted-foreground">
                    {d.used_gb.toFixed(1)} / {d.total_gb.toFixed(0)} GB
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      d.percent > 90 ? "bg-danger" : d.percent > 70 ? "bg-warning" : "bg-accent"
                    )}
                    style={{ width: `${d.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Network */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Network
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netData}>
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="netIn" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={1.5} name="In Mbps" />
                <Area type="monotone" dataKey="netOut" stroke="#00d9ff" fill="rgba(0,217,255,0.1)" strokeWidth={1.5} name="Out Mbps" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Load Average */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Load Average
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {(["1m", "5m", "15m"] as const).map((key) => (
              <div key={key}>
                <div className="text-2xl font-bold font-[family-name:var(--font-data)] text-accent">
                  {h.load_avg[key].toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">{key}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Top Processes by CPU
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                <th className="text-left pb-2 font-medium">PID</th>
                <th className="text-left pb-2 font-medium">Name</th>
                <th className="text-right pb-2 font-medium">CPU%</th>
                <th className="text-right pb-2 font-medium">MEM%</th>
                <th className="text-left pb-2 font-medium">Status</th>
                <th className="text-left pb-2 font-medium">User</th>
              </tr>
            </thead>
            <tbody className="font-[family-name:var(--font-data)]">
              {(h.top_processes && h.top_processes.length > 0
                ? h.top_processes
                : [
                    { pid: 1234, name: "python3", cpu_percent: 24.5, memory_percent: 8.2, status: "running", username: "root" },
                    { pid: 5678, name: "node", cpu_percent: 12.1, memory_percent: 4.1, status: "running", username: "app" },
                    { pid: 9012, name: "nginx", cpu_percent: 3.2, memory_percent: 1.8, status: "sleeping", username: "www-data" },
                    { pid: 3456, name: "dockerd", cpu_percent: 2.8, memory_percent: 3.4, status: "running", username: "root" },
                    { pid: 7890, name: "postgres", cpu_percent: 1.9, memory_percent: 6.7, status: "running", username: "postgres" },
                  ]
              ).map((p) => (
                <tr key={p.pid} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 text-muted-foreground">{p.pid}</td>
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right text-accent">{p.cpu_percent.toFixed(1)}</td>
                  <td className="py-2 text-right">{p.memory_percent.toFixed(1)}</td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        p.status === "running"
                          ? "bg-success/10 text-success"
                          : "bg-white/5 text-muted-foreground"
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">{p.username}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
