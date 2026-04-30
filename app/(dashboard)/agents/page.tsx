"use client";

import { useAgents } from "@/lib/hooks";
import { cn, formatUptime, formatNumber } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const statusDot = (s: string) =>
  s === "running" || s === "active"
    ? "bg-success animate-pulse-glow"
    : s === "idle"
    ? "bg-warning"
    : "bg-danger";

function AgentPanel({ agent }: { agent: ReturnType<typeof mockAgents>[0] }) {
  const tokenHistory = Array.from({ length: 20 }, (_, i) => ({
    t: i,
    tokens: 200 + Math.random() * 800 + Math.sin(i / 3) * 200,
  }));

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full", statusDot(agent.status))} />
          <span className="font-[family-name:var(--font-display)] text-lg text-accent">{agent.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">{formatUptime(agent.uptime_seconds)} uptime</span>
      </div>

      {agent.subagents && (
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
              {agent.subagents.map((sub) => (
                <tr key={sub.name} className="border-b border-white/5">
                  <td className="py-2 font-medium">{sub.name}</td>
                  <td className="py-2">
                    <span className={cn("flex items-center gap-1.5 text-xs w-fit px-2 py-0.5 rounded border",
                      sub.status === "active" ? "bg-success/10 text-success border-success/20" :
                      sub.status === "idle" ? "bg-warning/10 text-warning border-warning/20" :
                      "bg-danger/10 text-danger border-danger/20"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(sub.status))} />
                      {sub.status}
                    </span>
                  </td>
                  <td className="py-2 text-sm text-muted-foreground max-w-[180px] truncate">{sub.current_task || "—"}</td>
                  <td className="py-2 text-right font-[family-name:var(--font-data)] text-accent">{formatNumber(sub.tokens_session)}</td>
                  <td className="py-2 text-right text-muted-foreground text-xs">{sub.last_active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!agent.subagents && (
        <div className="p-3 rounded-lg bg-white/5 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Task</span>
            <span>{agent.current_task ?? "Idle"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Model</span>
            <span className="font-[family-name:var(--font-data)] text-accent">{agent.model ?? "claude-3-5-sonnet"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Session Tokens</span>
            <span className="font-[family-name:var(--font-data)]">{formatNumber(agent.tokens_session ?? 0)}</span>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-[family-name:var(--font-display)]">Tokens / min</div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tokenHistory}>
              <defs>
                <linearGradient id={`grad-${agent.name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d9ff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00d9ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [typeof v === "number" ? v.toFixed(0) : v, "tokens"]}
              />
              <Area type="monotone" dataKey="tokens" stroke="#00d9ff" fill={`url(#grad-${agent.name})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function mockAgents() {
  return [
    {
      name: "OpenClaw",
      status: "running",
      uptime_seconds: 86400,
      current_task: "Analyzing repo...",
      tokens_session: 45320,
      model: undefined,
      last_activity: "3s ago",
      subagents: [
        { name: "Main", status: "active", current_task: "Analyzing repo...", tokens_session: 14230, last_active: "3s ago" },
        { name: "Sub-1", status: "active", current_task: "File search", tokens_session: 8100, last_active: "12s ago" },
        { name: "Sub-2", status: "idle", current_task: "", tokens_session: 3400, last_active: "4m ago" },
        { name: "Sub-3", status: "error", current_task: "Timeout", tokens_session: 920, last_active: "11m ago" },
      ],
    },
    {
      name: "Hermes",
      status: "running",
      uptime_seconds: 172800,
      current_task: "Processing message queue",
      tokens_session: 28900,
      model: "claude-opus-4-6",
      last_activity: "8s ago",
      subagents: undefined,
    },
  ];
}

export default function AgentsPage() {
  const { data: agentsData } = useAgents();
  const agents = mockAgents();

  const activityFeed = [
    { agent: "OpenClaw/Main", event: "Task started", detail: "Analyzing repository structure", time: "3s ago", type: "start" },
    { agent: "OpenClaw/Sub-1", event: "File search", detail: "Scanning 342 files", time: "12s ago", type: "task" },
    { agent: "Hermes", event: "Queue item processed", detail: "Message #4421", time: "8s ago", type: "task" },
    { agent: "OpenClaw/Sub-3", event: "Error", detail: "Tool call timeout after 60s", time: "11m ago", type: "error" },
    { agent: "Hermes", event: "Model switch", detail: "→ claude-opus-4-6", time: "42m ago", type: "info" },
    { agent: "OpenClaw", event: "Token milestone", detail: "50K tokens this session", time: "1h ago", type: "info" },
  ];

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
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 text-sm"
            >
              <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0",
                item.type === "error" ? "bg-danger" :
                item.type === "start" ? "bg-success" :
                item.type === "info" ? "bg-accent" : "bg-muted-foreground"
              )} />
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
