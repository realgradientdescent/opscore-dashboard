"use client";

import { useState, useEffect } from "react";
import { Cpu, MemoryStick, Container, Bot, DollarSign } from "lucide-react";
import KpiCard from "@/components/cards/KpiCard";
import ResourceTimeline from "@/components/charts/ResourceTimeline";
import RateLimitGauge from "@/components/charts/RateLimitGauge";
import CostBreakdownChart from "@/components/charts/CostBreakdownChart";
import { generateTimelineData, generateSparkline } from "@/lib/mock-data";
import { useHealth, useContainers, useAgents, useCosts, useAlerts, useTokens } from "@/lib/hooks";
import type { AgentData, CostData, AlertItem } from "@/lib/api";
import { cn, formatCurrency, formatUptime } from "@/lib/utils";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function summarizeAgent(agent: AgentData) {
  if (agent.current_task?.trim()) return agent.current_task.trim();
  if (agent.status === "unavailable") return "Telemetry unavailable";
  if (agent.status === "active" || agent.status === "running") return "No active task reported";
  if (agent.error) return agent.error;
  return "Idle";
}

function costChartData(cost: CostData | undefined, days: number) {
  if (!cost?.daily?.length) return [];
  return cost.daily.slice(-days);
}

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export default function OverviewPage() {
  const { data: health } = useHealth();
  const { data: containers } = useContainers();
  const { data: agents } = useAgents();
  const { data: costs } = useCosts();
  const { data: alerts } = useAlerts();
  const { data: anthropicTok } = useTokens("anthropic");
  const { data: openaiTok } = useTokens("openai-codex");
  const { data: openrouterTok } = useTokens("openrouter");

  const [timeline, setTimeline] = useState<ReturnType<typeof generateTimelineData>>([]);
  const [cpuSparkline, setCpuSparkline] = useState<number[]>([]);
  const [memSparkline, setMemSparkline] = useState<number[]>([]);

  /* ------------------------------------------------------------------ */
  /*  initial sparkline / timeline mock data (one-time fill)              */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    setTimeline(generateTimelineData());
    setCpuSparkline(generateSparkline());
    setMemSparkline(generateSparkline(20, 40, 10));
  }, []);

  /* ------------------------------------------------------------------ */
  /*  rolling timeline — live health data fed in every 5 s                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeline((prev) => {
        const next = [...prev.slice(1)];
        const now = new Date();
        next.push({
          time: now.toLocaleTimeString("en-US", { hour12: false, minute: "2-digit", second: "2-digit" }),
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

  /* ------------------------------------------------------------------ */
  /*  derived KPI values                                                  */
  /* ------------------------------------------------------------------ */
  const runningContainers = containers?.filter((c) => c.status === "running").length ?? 0;
  const totalContainers = containers?.length ?? 0;
  const activeAgents = agents?.filter((a) => a.status === "active" || a.status === "running").length ?? 0;

  const recentAlerts: AlertItem[] = alerts?.active?.slice(0, 4) ?? [];

  /* ------------------------------------------------------------------ */
  /*  rate-limit gauge data — compute from token data                     */
  /* ------------------------------------------------------------------ */
  function gauge(limit: number, used: number, known: boolean) {
    if (!known || limit <= 0) return { percent: 0, unknown: true };
    return { percent: Math.round((used / limit) * 100), unknown: false };
  }
  const aRL = anthropicTok?.rate_limit;
  const anthropicRate = gauge(aRL?.tpm ?? 0, aRL?.tpm_used ?? 0, aRL?.known === true);
  const oRL = openaiTok?.rate_limit;
  const openaiRate = gauge(oRL?.rpm ?? 0, oRL?.rpm_used ?? 0, oRL?.known === true);
  const orRL = openrouterTok?.rate_limit;
  const openrouterRate = gauge(orRL?.tpm ?? 0, orRL?.tpm_used ?? 0, orRL?.known === true);
  const anyRateUnknown = anthropicRate.unknown || openaiRate.unknown || openrouterRate.unknown;

  /* ------------------------------------------------------------------ */
  /*  render                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* ---- KPI row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          title="CPU Usage"
          value={`${(health?.cpu_percent ?? 34.2).toFixed(1)}%`}
          icon={Cpu}
          color={(health?.cpu_percent ?? 34) > 90 ? "danger" : (health?.cpu_percent ?? 34) > 70 ? "warning" : "accent"}
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
          value={costs?.available === false ? "—" : formatCurrency(costs?.today_total ?? 0)}
          icon={DollarSign}
          color="accent"
        />
      </div>

      {/* ---- Resources + Agent Status ---- */}
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
                      <div className={cn(
                        "w-2 h-2 rounded-full animate-pulse-glow",
                        agent.status === "active" || agent.status === "running" ? "bg-success"
                          : agent.status === "idle" ? "bg-warning"
                          : "bg-danger"
                      )} />
                      <span className="text-sm font-medium">{agent.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatUptime(agent.uptime_seconds)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{summarizeAgent(agent)}</p>
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

      {/* ---- Rate Limits + Cost Burn + Alerts ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Rate Limits */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            API Rate Limits
          </h3>
          <div className="flex justify-around">
            <RateLimitGauge label="Anthropic" percent={anthropicRate.percent} sublabel="TPM" unknown={anthropicRate.unknown} />
            <RateLimitGauge label="OpenAI" percent={openaiRate.percent} sublabel="RPM" unknown={openaiRate.unknown} />
            <RateLimitGauge label="OpenRouter" percent={openrouterRate.percent} sublabel="TPM" unknown={openrouterRate.unknown} />
          </div>
          {anyRateUnknown && (
            <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
              Rate-limit telemetry not wired from API providers yet.
            </p>
          )}
        </div>

        {/* Cost Burn — 7 Day */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Cost Burn — 7 Day
          </h3>
          {costs?.available === false ? (
            <p className="text-xs text-muted-foreground/60">Cost telemetry unavailable.</p>
          ) : (
            <CostBreakdownChart data={costChartData(costs, 7)} />
          )}
        </div>

        {/* Recent Alerts */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
            Recent Alerts
          </h3>
          <div className="space-y-2">
            {recentAlerts.map((alert, i) => (
              <motion.div
                key={`${alert.id ?? i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 text-xs p-2 rounded bg-white/5"
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  alert.severity === "critical" ? "bg-danger"
                    : alert.severity === "warning" ? "bg-warning"
                    : "bg-accent"
                )} />
                <span className="flex-1 truncate">{alert.message}</span>
                <span className="text-muted-foreground whitespace-nowrap">{alert.time}</span>
              </motion.div>
            ))}
            {recentAlerts.length === 0 && (
              <div className="text-xs text-muted-foreground/60 p-2">{alerts?.note ?? "No active alerts."}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
