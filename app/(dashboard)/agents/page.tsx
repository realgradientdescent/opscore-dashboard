"use client";

import { useAgents } from "@/lib/hooks";
import type { AgentData } from "@/lib/api";
import { cn, formatUptime, formatNumber } from "@/lib/utils";
import { motion } from "framer-motion";

const FALLBACK_AGENTS: AgentData[] = [
  {
    name: "OpenClaw",
    container: "openclaw-1ovr",
    status: "unavailable",
    uptime_seconds: 0,
    current_task: null,
    last_activity: null,
    error: "Agent telemetry unavailable",
    subagents: [],
  },
  {
    name: "Hermes",
    container: "hermes-agent-6aos",
    status: "unavailable",
    uptime_seconds: 0,
    current_task: null,
    last_activity: null,
    error: "Agent telemetry unavailable",
    subagents: [],
  },
];

const statusDot = (s: string) =>
  s === "running" || s === "active"
    ? "bg-success animate-pulse-glow"
    : s === "idle"
      ? "bg-warning"
      : "bg-danger";

function normalizeAgents(agents: AgentData[] | undefined) {
  return Array.isArray(agents) && agents.length > 0 ? agents : FALLBACK_AGENTS;
}

function cleanLogLine(text?: string | null) {
  if (!text) return null;
  return text
    .replace(/^\d{4}-\d{2}-\d{2}T[^\s]+\s*/, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .trim() || null;
}

function getTaskSummary(agent: AgentData) {
  if (agent.current_task?.trim()) return agent.current_task.trim();
  if (agent.status === "unavailable") return "Telemetry unavailable";
  if (agent.status === "running" || agent.status === "active") return "No active task reported";
  if (agent.error) return agent.error;
  return "Idle";
}

function buildActivityFeed(agents: AgentData[]) {
  return agents.flatMap((agent) => {
    const items = [
      {
        agent: agent.name,
        event: "Status",
        detail: `${agent.status}${agent.container ? ` · ${agent.container}` : ""}`,
        time: `${formatUptime(agent.uptime_seconds)} uptime`,
        type: agent.status === "running" || agent.status === "active" ? "info" : "error",
      },
    ];

    const logLine = cleanLogLine(agent.last_activity);
    if (logLine) {
      items.push({
        agent: agent.name,
        event: "Last activity",
        detail: logLine,
        time: "container log",
        type: "task",
      });
    }

    if (agent.error) {
      items.push({
        agent: agent.name,
        event: "Telemetry",
        detail: agent.error,
        time: "now",
        type: "error",
      });
    }

    return items;
  });
}

function AgentPanel({ agent }: { agent: AgentData }) {
  const lastLog = cleanLogLine(agent.last_activity);
  const hasSubagents = Boolean(agent.subagents?.length);

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full", statusDot(agent.status))} />
          <span className="font-[family-name:var(--font-display)] text-lg text-accent">{agent.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">{formatUptime(agent.uptime_seconds)} uptime</span>
      </div>

      {hasSubagents ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                <th className="text-left pb-2 font-medium">Agent</th>
                <th className="text-left pb-2 font-medium">Status</th>
                <th className="text-left pb-2 font-medium">Current Task</th>
                <th className="text-right pb-2 font-medium">Tokens</th>
                <th className="text-right pb-2 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {agent.subagents?.map((sub) => (
                <tr key={sub.name} className="border-b border-white/5">
                  <td className="py-2 font-medium">{sub.name}</td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs w-fit px-2 py-0.5 rounded border",
                        sub.status === "active"
                          ? "bg-success/10 text-success border-success/20"
                          : sub.status === "idle"
                            ? "bg-warning/10 text-warning border-warning/20"
                            : "bg-danger/10 text-danger border-danger/20"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(sub.status))} />
                      {sub.status}
                    </span>
                  </td>
                  <td className="py-2 text-sm text-muted-foreground max-w-[180px] truncate">{sub.current_task || "—"}</td>
                  <td className="py-2 text-right font-[family-name:var(--font-data)] text-accent">
                    {typeof sub.tokens_session === "number" ? formatNumber(sub.tokens_session) : "—"}
                  </td>
                  <td className="py-2 text-right text-muted-foreground text-xs">{sub.last_active || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-white/5 space-y-1">
          <div className="flex justify-between text-sm gap-4">
            <span className="text-muted-foreground">Current Task</span>
            <span className="text-right">{getTaskSummary(agent)}</span>
          </div>
          <div className="flex justify-between text-sm gap-4">
            <span className="text-muted-foreground">Model</span>
            <span className="text-right font-[family-name:var(--font-data)] text-accent">{agent.model ?? "Not reported"}</span>
          </div>
          <div className="flex justify-between text-sm gap-4">
            <span className="text-muted-foreground">Session Tokens</span>
            <span className="text-right font-[family-name:var(--font-data)]">
              {typeof agent.tokens_session === "number" ? formatNumber(agent.tokens_session) : "Not wired"}
            </span>
          </div>
          <div className="flex justify-between text-sm gap-4">
            <span className="text-muted-foreground">Container</span>
            <span className="text-right font-[family-name:var(--font-data)] text-xs">{agent.container ?? "Unknown"}</span>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-[family-name:var(--font-display)]">
          Telemetry Notes
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="text-right capitalize">{agent.status.replaceAll("_", " ")}</span>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Last log</span>
          <span className="text-right max-w-[70%] truncate">{lastLog ?? "No recent container log captured"}</span>
        </div>
        {agent.error && (
          <div className="text-sm text-danger">{agent.error}</div>
        )}
        {!agent.error && typeof agent.tokens_session !== "number" && (
          <div className="text-xs text-muted-foreground">
            Token/session telemetry is not currently exposed by the VPS agent, so this panel avoids fabricating it.
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { data: agentsData } = useAgents();
  const agents = normalizeAgents(agentsData);
  const activityFeed = buildActivityFeed(agents);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <AgentPanel key={agent.name} agent={agent} />
        ))}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Combined Activity Feed
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {activityFeed.map((item, i) => (
            <motion.div
              key={`${item.agent}-${item.event}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 text-sm"
            >
              <span
                className={cn(
                  "mt-1 w-2 h-2 rounded-full shrink-0",
                  item.type === "error"
                    ? "bg-danger"
                    : item.type === "task"
                      ? "bg-success"
                      : "bg-accent"
                )}
              />
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground text-xs">{item.agent}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="font-medium">{item.event}</span>
                <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
