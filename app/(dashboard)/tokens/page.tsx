"use client";

import { useState } from "react";
import { useTokens } from "@/lib/hooks";
import { cn, formatNumber } from "@/lib/utils";
import RateLimitGauge from "@/components/charts/RateLimitGauge";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle } from "lucide-react";

const PROVIDERS = ["anthropic", "openai", "openrouter"] as const;
type Provider = typeof PROVIDERS[number];

const providerMeta: Record<Provider, { label: string; color: string }> = {
  anthropic: { label: "Anthropic", color: "#00d9ff" },
  openai: { label: "OpenAI", color: "#10b981" },
  openrouter: { label: "OpenRouter", color: "#f59e0b" },
};

function mockTokenData(provider: Provider) {
  const rpmMax = provider === "anthropic" ? 50 : provider === "openai" ? 100 : 200;
  const tpmMax = provider === "anthropic" ? 100000 : provider === "openai" ? 80000 : 200000;
  const rpmUsed = Math.floor(Math.random() * rpmMax * 0.7);
  const tpmUsed = Math.floor(Math.random() * tpmMax * 0.65);
  return {
    provider,
    rate_limit: { rpm: rpmMax, tpm: tpmMax, rpm_used: rpmUsed, tpm_used: tpmUsed },
    today: { input_tokens: 1_420_000, output_tokens: 340_000, requests: 1243 },
    month: { input_tokens: 28_400_000, output_tokens: 6_800_000, requests: 18_240 },
    models: [
      { model: provider === "anthropic" ? "claude-opus-4-6" : provider === "openai" ? "gpt-4o" : "llama-3.1-70b", input_tokens: 800000, output_tokens: 200000, requests: 620 },
      { model: provider === "anthropic" ? "claude-sonnet-4-6" : provider === "openai" ? "gpt-4o-mini" : "mistral-7b", input_tokens: 620000, output_tokens: 140000, requests: 623 },
    ],
    recent_requests: Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 45000).toLocaleTimeString(),
      model: provider === "anthropic" ? "claude-opus-4-6" : provider === "openai" ? "gpt-4o" : "llama-3.1-70b",
      input_tokens: 800 + Math.floor(Math.random() * 3000),
      output_tokens: 200 + Math.floor(Math.random() * 1000),
      latency_ms: 800 + Math.floor(Math.random() * 2000),
      status: i === 4 ? "error" : "success",
    })),
  };
}

function hourlyTokenData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    input: Math.floor(50000 + Math.random() * 200000),
    output: Math.floor(10000 + Math.random() * 80000),
  }));
}

export default function TokensPage() {
  const [activeProvider, setActiveProvider] = useState<Provider>("anthropic");
  const tokenData = mockTokenData(activeProvider);
  const hourly = hourlyTokenData();
  const color = providerMeta[activeProvider].color;

  const rpmPct = (tokenData.rate_limit.rpm_used / tokenData.rate_limit.rpm) * 100;
  const tpmPct = (tokenData.rate_limit.tpm_used / tokenData.rate_limit.tpm) * 100;
  const headroom = Math.min(rpmPct, tpmPct);

  const tooltipStyle = {
    backgroundColor: "#0f172a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 12,
  };

  return (
    <div className="space-y-6">
      {/* Provider Tabs */}
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

      {/* Predictive warning */}
      {headroom > 75 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border text-sm",
            headroom > 90
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-warning/30 bg-warning/10 text-warning"
          )}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          At current pace, {providerMeta[activeProvider].label} rate limit reached in ~
          {headroom > 90 ? "3" : "14"} minutes
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Rate limit gauges */}
        <div className="glass-card p-4 flex flex-col items-center justify-center gap-6">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider self-start">Rate Limits</h3>
          <div className="flex gap-8">
            <RateLimitGauge
              label="RPM"
              percent={rpmPct}
              sublabel={`${tokenData.rate_limit.rpm_used} / ${tokenData.rate_limit.rpm}`}
            />
            <RateLimitGauge
              label="TPM"
              percent={tpmPct}
              sublabel={`${formatNumber(tokenData.rate_limit.tpm_used)} / ${formatNumber(tokenData.rate_limit.tpm)}`}
            />
          </div>
        </div>

        {/* Today / Month stats */}
        <div className="glass-card p-4 col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
          {[
            { label: "Today — Input", value: formatNumber(tokenData.today.input_tokens) },
            { label: "Today — Output", value: formatNumber(tokenData.today.output_tokens) },
            { label: "Month — Input", value: formatNumber(tokenData.month.input_tokens) },
            { label: "Month — Requests", value: formatNumber(tokenData.month.requests) },
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

      {/* Hourly chart */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Token Usage — Last 24h
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourly}>
              <defs>
                <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" stroke="#475569" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#475569" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [typeof v === "number" ? formatNumber(v) : v, undefined]} />
              <Area type="monotone" dataKey="input" stroke={color} fill="url(#inputGrad)" strokeWidth={2} name="Input Tokens" />
              <Area type="monotone" dataKey="output" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2} name="Output Tokens" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model breakdown */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Model Breakdown
        </h3>
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
            {tokenData.models.map((m) => (
              <tr key={m.model} className="border-b border-white/5">
                <td className="py-2">{m.model}</td>
                <td className="py-2 text-right" style={{ color }}>{formatNumber(m.input_tokens)}</td>
                <td className="py-2 text-right text-success">{formatNumber(m.output_tokens)}</td>
                <td className="py-2 text-right text-muted-foreground">{m.requests.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent requests */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Recent Requests
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                <th className="text-left pb-2">Time</th>
                <th className="text-left pb-2">Model</th>
                <th className="text-right pb-2">Input</th>
                <th className="text-right pb-2">Output</th>
                <th className="text-right pb-2">Latency</th>
                <th className="text-left pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="font-[family-name:var(--font-data)]">
              {tokenData.recent_requests.map((r, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-1.5 text-muted-foreground text-xs">{r.timestamp}</td>
                  <td className="py-1.5">{r.model}</td>
                  <td className="py-1.5 text-right">{r.input_tokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{r.output_tokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{r.latency_ms}ms</td>
                  <td className="py-1.5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded",
                      r.status === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    )}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
