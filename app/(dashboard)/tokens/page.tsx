"use client";

import { useMemo, useState } from "react";
import { useTokens } from "@/lib/hooks";
import { cn, formatNumber } from "@/lib/utils";
import RateLimitGauge from "@/components/charts/RateLimitGauge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Database, Loader2 } from "lucide-react";

const PROVIDERS = ["openai-codex", "openrouter", "custom", "anthropic"] as const;
type Provider = typeof PROVIDERS[number];

const providerMeta: Record<Provider, { label: string; color: string }> = {
  "openai-codex": { label: "Codex", color: "#10b981" },
  openrouter: { label: "OpenRouter", color: "#f59e0b" },
  custom: { label: "Custom", color: "#8b5cf6" },
  anthropic: { label: "Anthropic", color: "#00d9ff" },
};

export default function TokensPage() {
  const [activeProvider, setActiveProvider] = useState<Provider>("openai-codex");
  const { data, isLoading } = useTokens(activeProvider);
  const color = providerMeta[activeProvider].color;

  const hourly = data?.hourly ?? [];
  const rpmPct = data?.rate_limit.rpm ? (data.rate_limit.rpm_used / data.rate_limit.rpm) * 100 : 0;
  const tpmPct = data?.rate_limit.tpm ? (data.rate_limit.tpm_used / data.rate_limit.tpm) * 100 : 0;
  const hasRateLimits = Boolean(data?.rate_limit.known && (data.rate_limit.rpm || data.rate_limit.tpm));

  const tooltipStyle = {
    backgroundColor: "#0f172a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 12,
  };

  const recentRequests = useMemo(() => data?.recent_requests ?? [], [data]);
  const models = useMemo(() => data?.models ?? [], [data]);
  const available = data?.available !== false;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {PROVIDERS.map((p) => (
          <button
            key={p}
            onClick={() => setActiveProvider(p)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm border transition-all",
              activeProvider === p
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {providerMeta[p].label}
          </button>
        ))}
      </div>

      <div className="glass-card p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Database className="w-4 h-4 text-accent" />
          {data?.label ?? providerMeta[activeProvider].label} telemetry source
        </div>
        <div className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : data?.source ?? "unknown"}
          {data?.note ? ` — ${data.note}` : ""}
        </div>
      </div>

      {!available && !isLoading && (
        <div className="glass-card p-4 border border-warning/30 bg-warning/5 text-sm text-warning flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No structured usage found for this provider yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-4 flex flex-col items-center justify-center gap-6">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider self-start">Rate Limits</h3>
          {hasRateLimits ? (
            <div className="flex gap-8">
              <RateLimitGauge
                label="RPM"
                percent={rpmPct}
                sublabel={`${data?.rate_limit.rpm_used ?? 0} / ${data?.rate_limit.rpm ?? 0}`}
              />
              <RateLimitGauge
                label="TPM"
                percent={tpmPct}
                sublabel={`${formatNumber(data?.rate_limit.tpm_used ?? 0)} / ${formatNumber(data?.rate_limit.tpm ?? 0)}`}
              />
            </div>
          ) : (
            <div className="w-full rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground text-center">
              Rate-limit telemetry is not wired from Hermes yet.
            </div>
          )}
        </div>

        <div className="glass-card p-4 col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
          {[
            { label: "Today — Input", value: formatNumber(data?.today.input_tokens ?? 0) },
            { label: "Today — Output", value: formatNumber(data?.today.output_tokens ?? 0) },
            { label: "Month — Input", value: formatNumber(data?.month.input_tokens ?? 0) },
            { label: "Month — Requests", value: formatNumber(data?.month.requests ?? 0) },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-lg bg-white/5">
              <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
              <div className="text-xl font-bold font-[family-name:var(--font-data)]" style={{ color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Token Usage — Last 24h
        </h3>
        {hourly.length > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly}>
                <defs>
                  <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  stroke="#475569"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                />
                <YAxis stroke="#475569" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [typeof v === "number" ? formatNumber(v) : v, undefined]} />
                <Area type="monotone" dataKey="input" stroke={color} fill="url(#inputGrad)" strokeWidth={2} name="Input Tokens" />
                <Area type="monotone" dataKey="output" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2} name="Output Tokens" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            No 24h token activity captured for this provider yet.
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Model Breakdown
        </h3>
        {models.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                <th className="text-left pb-2">Model</th>
                <th className="text-right pb-2">Input</th>
                <th className="text-right pb-2">Output</th>
                <th className="text-right pb-2">Requests</th>
              </tr>
            </thead>
            <tbody className="font-[family-name:var(--font-data)]">
              {models.map((m) => (
                <tr key={m.model} className="border-b border-white/5">
                  <td className="py-2">{m.model}</td>
                  <td className="py-2 text-right" style={{ color }}>{formatNumber(m.input_tokens)}</td>
                  <td className="py-2 text-right text-success">{formatNumber(m.output_tokens)}</td>
                  <td className="py-2 text-right text-muted-foreground">{formatNumber(m.requests)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            No per-model usage data available.
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Recent Sessions
        </h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading token telemetry…
          </div>
        ) : recentRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                  <th className="text-left pb-2">Time</th>
                  <th className="text-left pb-2">Model</th>
                  <th className="text-left pb-2">Session</th>
                  <th className="text-right pb-2">Input</th>
                  <th className="text-right pb-2">Output</th>
                  <th className="text-right pb-2">Calls</th>
                  <th className="text-left pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="font-[family-name:var(--font-data)]">
                {recentRequests.map((r, i) => (
                  <tr key={`${r.session_id ?? r.timestamp}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-1.5 text-muted-foreground text-xs">{new Date(r.timestamp).toLocaleString()}</td>
                    <td className="py-1.5">{r.model}</td>
                    <td className="py-1.5 max-w-[280px] truncate text-muted-foreground">{r.title || r.source || "—"}</td>
                    <td className="py-1.5 text-right">{formatNumber(r.input_tokens)}</td>
                    <td className="py-1.5 text-right">{formatNumber(r.output_tokens)}</td>
                    <td className="py-1.5 text-right">{formatNumber(r.request_count ?? 0)}</td>
                    <td className="py-1.5">
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        r.status === "active" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                      )}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            No recent sessions for this provider.
          </div>
        )}
      </div>
    </div>
  );
}
