"use client";

import { useState } from "react";
import { useContainers } from "@/lib/hooks";
import { cn, formatUptime } from "@/lib/utils";
import { motion } from "framer-motion";
import { RefreshCw, Square, FileText, Layers } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; dot: string }> = {
    running: { label: "Running", color: "bg-success/10 text-success border-success/20", dot: "bg-success" },
    paused: { label: "Paused", color: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning" },
    exited: { label: "Exited", color: "bg-danger/10 text-danger border-danger/20", dot: "bg-danger" },
    restarting: { label: "Restarting", color: "bg-accent/10 text-accent border-accent/20", dot: "bg-accent animate-spin" },
  };
  const s = map[status] ?? { label: status, color: "bg-white/5 text-muted-foreground border-white/10", dot: "bg-muted-foreground" };
  return (
    <span className={cn("flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border", s.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function LogModal({ name, onClose }: { name: string; onClose: () => void }) {
  const fakeLines = Array.from({ length: 20 }, (_, i) =>
    `[2026-04-29 ${String(14 + Math.floor(i / 4)).padStart(2, "0")}:${String(i * 3 % 60).padStart(2, "0")}:00] INFO  Container ${name} — line ${i + 1}: Processing task...`
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl glass-card overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-[family-name:var(--font-display)] text-accent text-sm">
            {name} — logs
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>
        <div className="bg-black/40 p-4 h-80 overflow-y-auto font-[family-name:var(--font-data)] text-xs space-y-1">
          {fakeLines.map((line, i) => (
            <div key={i} className="text-green-400/80">{line}</div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function ContainersPage() {
  const { data: containers, mutate } = useContainers();
  const [logModal, setLogModal] = useState<string | null>(null);

  const fallback = [
    { id: "abc1", name: "openclaw", image: "openclaw:latest", status: "running", cpu_percent: 12.4, memory_mb: 512, memory_limit_mb: 2048, network_in_mb: 14.2, network_out_mb: 8.1, ports: ["8080:8080"], uptime_seconds: 86400, restart_count: 0 },
    { id: "abc2", name: "hermes", image: "hermes:latest", status: "running", cpu_percent: 8.1, memory_mb: 380, memory_limit_mb: 1024, network_in_mb: 9.4, network_out_mb: 5.2, ports: ["9090:9090"], uptime_seconds: 172800, restart_count: 1 },
    { id: "abc3", name: "opscore-agent", image: "opscore-agent:latest", status: "running", cpu_percent: 2.3, memory_mb: 128, memory_limit_mb: 512, network_in_mb: 2.1, network_out_mb: 1.8, ports: ["8765:8765"], uptime_seconds: 86400, restart_count: 0 },
    { id: "abc4", name: "nginx", image: "nginx:alpine", status: "running", cpu_percent: 0.8, memory_mb: 48, memory_limit_mb: 256, network_in_mb: 40.2, network_out_mb: 38.1, ports: ["80:80", "443:443"], uptime_seconds: 604800, restart_count: 0 },
    { id: "abc5", name: "redis", image: "redis:7-alpine", status: "running", cpu_percent: 1.2, memory_mb: 32, memory_limit_mb: 128, network_in_mb: 1.1, network_out_mb: 0.9, ports: ["6379:6379"], uptime_seconds: 604800, restart_count: 0 },
    { id: "abc6", name: "old-worker", image: "worker:v1.2", status: "exited", cpu_percent: 0, memory_mb: 0, memory_limit_mb: 512, network_in_mb: 0, network_out_mb: 0, ports: [], uptime_seconds: 0, restart_count: 3 },
  ];

  const data = containers ?? fallback;

  return (
    <div className="space-y-6">
      {logModal && <LogModal name={logModal} onClose={() => setLogModal(null)} />}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="text-success font-[family-name:var(--font-data)]">{data.filter(c => c.status === "running").length}</span>
          <span> running / </span>
          <span className="font-[family-name:var(--font-data)]">{data.length}</span>
          <span> total</span>
        </div>
        <button onClick={() => mutate()} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground font-[family-name:var(--font-data)]">{c.image}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground mb-1">CPU</div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${c.cpu_percent}%` }} />
                </div>
                <div className="font-[family-name:var(--font-data)] mt-0.5">{c.cpu_percent.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Memory</div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${(c.memory_mb / c.memory_limit_mb) * 100}%` }} />
                </div>
                <div className="font-[family-name:var(--font-data)] mt-0.5">{c.memory_mb} / {c.memory_limit_mb} MB</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <div className="mb-0.5">Net In</div>
                <div className="font-[family-name:var(--font-data)] text-foreground">{c.network_in_mb.toFixed(1)} MB</div>
              </div>
              <div>
                <div className="mb-0.5">Net Out</div>
                <div className="font-[family-name:var(--font-data)] text-foreground">{c.network_out_mb.toFixed(1)} MB</div>
              </div>
              <div>
                <div className="mb-0.5">Uptime</div>
                <div className="font-[family-name:var(--font-data)] text-foreground">{formatUptime(c.uptime_seconds)}</div>
              </div>
            </div>

            {c.ports.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {c.ports.map((p) => (
                  <span key={p} className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded font-[family-name:var(--font-data)]">{p}</span>
                ))}
              </div>
            )}

            {c.restart_count > 0 && (
              <div className="text-xs text-warning">↺ {c.restart_count} restart{c.restart_count > 1 ? "s" : ""}</div>
            )}

            <div className="flex gap-2 pt-1">
              <button className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded bg-white/5 hover:bg-accent/10 hover:text-accent border border-white/10 hover:border-accent/30 transition-colors">
                <RefreshCw className="w-3 h-3" /> Restart
              </button>
              <button className="flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded bg-white/5 hover:bg-danger/10 hover:text-danger border border-white/10 hover:border-danger/30 transition-colors">
                <Square className="w-3 h-3" /> Stop
              </button>
              <button
                onClick={() => setLogModal(c.name)}
                className="flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <FileText className="w-3 h-3" /> Logs
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
