"use client";

import { useState, useEffect } from "react";
import { Cpu, MemoryStick, Container, Bot, DollarSign } from "lucide-react";
import KpiCard from "@/components/cards/KpiCard";
import ResourceTimeline from "@/components/charts/ResourceTimeline";
import RateLimitGauge from "@/components/charts/RateLimitGauge";
import CostBreakdownChart from "@/components/charts/CostBreakdownChart";
import { generateTimelineData, generateSparkline, generateCostData } from "@/lib/mock-data";
import { useHealth, useContainers, useAgents } from "@/lib/hooks";
import type { AgentData } from "@/lib/api";
import { cn, formatCurrency, formatUptime } from "@/lib/utils";
import { motion } from "framer-motion";

function summarizeAgent(agent: AgentData) {
  if (agent.current_task?.trim()) return agent.current_task.trim();
  if (agent.status === "unavailable") return "Telemetry unavailable";
  if (agent.status === "running" || agent.status === "active") return "No active task reported";
  if (agent.error) return agent.error;
  return "Idle";
}

export default function OverviewPage() {
  const { data: health } = useHealth();
  const { data: containers } = useContainers();
  const { data: agents } = useAgents();
  const [timeline, setTimeline] = useState<ReturnType<typeof generateTimelineData>>([]);
  const [costData, setCostData] = useState<ReturnType<typeof generateCostData>>([]);
  const [cpuSparkline, setCpuSparkline] = useState<number[]>([]);
  const [memSparkline, setMemSparkline] = useState<number[]>([]);

  useEffect(() => {
    setTimeline(generateTimelineData());
    setCostData(generateCostData(7));
    setCpuSparkline(generateSparkline());
    setMemSparkline(generateSparkline(20, 40, 10));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeline((prev) => {
        const next = [...prev.slice(1)];
        const now = new Date();
        next.push({
          time: now.toLocaleTimeString("en-US", {
            hour12: false,
            minute: "2-digit",
            second: "2-digit",
          }),
          cpu: health?.cpu_percent ?? 25 + Math.random() * 40,
          memory: health?.memory.percent ?? 35 + Math.random() * 15,
          netIn: Math.random() * 50,
          netOut: Math.random() * 30,
        });
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [health]);

  const runningContainers = containers?.filter((c) => c.status === "running").length ?? 0;
  const totalContainers = containers?.length ?? 0;
  const activeAgents = agents?.filter((a) => a.status === "running" || a.status === "active").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          title="CPU Usage"
          value={`${(health?.cpu_percent ?? 34.2).toFixed(1)}%`}
          icon={Cpu}
          color={
            (health?.cpu_percent ?? 34) > 90
              ? "danger"
              : (health?.cpu_percent ?? 34) > 70
              ? "warning"
              : "accent"
          }
          sparkline={cpuSparkline}
        />
        <KpiCard
          title="Memory"
          value={`${(health?.memory.used_gb ?? 6.2).toFixed(1)} GB`}
          subtitle={`/ ${(health?.memory.total_gb ?? 16).toFixed(0)} GB`}
          icon={MemoryStick}
          color="success"
          sparkline={memSparkline}
        />
        <KpiCard
          title="Containers"
          value={`${runningContainers} / ${totalContainers}`}
          subtitle="running"
          icon={Container}
          color={runningContainers === totalContainers ? "success" : "warning"}
        />
        <KpiCard
          title="Agents"
          value={`${activeAgents} active`}
          icon={Bot}
          color={activeAgents > 0 ? "accent" : "danger"}
        />
        <KpiCard
          title="Today's Cost"
          value={formatCurrency(24.40)}
          trend={{ value: -8.2, label: "vs yesterday" }}
          icon={DollarSign}
          color="accent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <ResourceTimeline data={timeline} />
        </div>
        <div className="lg:col-span-2">
          <div className="glass-card p-4 h-full">
            <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
              Agent Status
            </h3>
            <div className="space-y-3">
              {(agents ?? []).map((agent) => (
                <div key={agent.name} className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full animate-pulse-glow",
                          agent.status === "running" || agent.status === "active"
                            ? "bg-success"
                            : agent.status === "idle"
                              ? "bg-warning"
                              : "bg-danger"
                        )}
                      />
                      <span className="text-sm font-medium">{agent.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatUptime(agent.uptime_seconds)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {summarizeAgent(agent)}
                  </p>
                </div>
              ))}
              {(!agents || agents.length === 0) && (
                <div className="p-3 rounded-lg bg-white/5 border border-dashed border-white/10 text-xs text-muted-foreground">
                  No agent telemetry available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            API Rate Limits
          </h3>
          <div className="flex justify-around">
            <RateLimitGauge label="Anthropic" percent={42} sublabel="TPM" />
            <RateLimitGauge label="OpenAI" percent={18} sublabel="RPM" />
            <RateLimitGauge label="OpenRouter" percent={65} sublabel="TPM" />
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Cost Burn — 7 Day
          </h3>
          <CostBreakdownChart data={costData} />
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Recent Alerts
          </h3>
          <div className="space-y-2">
            {[
              { severity: "warning", message: "Anthropic TPM > 80%", time: "2m ago" },
              { severity: "critical", message: "Container openclaw restarted", time: "14m ago" },
              { severity: "warning", message: "Memory > 85%", time: "1h ago" },
              { severity: "info", message: "Daily cost report: $22.40", time: "6h ago" },
            ].map((alert, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 text-xs p-2 rounded bg-white/5"
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    alert.severity === "critical"
                      ? "bg-danger"
                      : alert.severity === "warning"
                      ? "bg-warning"
                      : "bg-accent"
                  )}
                />
                <span className="flex-1 truncate">{alert.message}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {alert.time}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
