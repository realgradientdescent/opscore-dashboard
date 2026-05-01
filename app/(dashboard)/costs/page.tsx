"use client";

import { useState } from "react";
import { useCosts } from "@/lib/hooks";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import CostBreakdownChart from "@/components/charts/CostBreakdownChart";
import KpiCard from "@/components/cards/KpiCard";
import { DollarSign, TrendingUp, Calendar, PiggyBank, Database, Loader2, AlertTriangle } from "lucide-react";

type Range = "7D" | "14D" | "30D";

export default function CostsPage() {
  const [range, setRange] = useState<Range>("30D");
  const { data, isLoading } = useCosts();

  const allData = data?.daily ?? [];
  const shown =
    range === "7D" ? allData.slice(-7) : range === "14D" ? allData.slice(-14) : allData;

  const budget = data?.budget_monthly ?? null;
  const available = data?.available !== false;
  const budgetRemaining = budget != null ? budget - (data?.month_total ?? 0) : null;
  const budgetPct = budget && budget > 0 ? ((data?.month_total ?? 0) / budget) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Database className="w-4 h-4 text-accent" />
          Cost telemetry source
        </div>
        <div className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : data?.source ?? "unknown"}
          {data?.note ? ` — ${data.note}` : ""}
        </div>
      </div>

      {!available && !isLoading && (
        <div className="glass-card p-4 border border-warning/30 bg-warning/5 text-sm text-warning flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No structured cost telemetry is available yet.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Today's Spend" value={formatCurrency(data?.today_total ?? 0)} icon={DollarSign} color="accent" />
        <KpiCard title="This Month" value={formatCurrency(data?.month_total ?? 0)} icon={Calendar} color="success" />
        <KpiCard
          title="Projected Month-End"
          value={formatCurrency(data?.projected_month ?? 0)}
          icon={TrendingUp}
          color={budget != null && (data?.projected_month ?? 0) > budget * 0.9 ? "danger" : budget != null && (data?.projected_month ?? 0) > budget * 0.75 ? "warning" : "accent"}
        />
        <KpiCard
          title="Budget Remaining"
          value={budgetRemaining == null ? "Not set" : formatCurrency(budgetRemaining)}
          subtitle={budget == null ? "Set MONTHLY_BUDGET_USD to enable" : `/ ${formatCurrency(budget)}`}
          icon={PiggyBank}
          color={budgetRemaining == null ? "warning" : budgetRemaining < 0 ? "danger" : budget != null && budgetRemaining < budget * 0.1 ? "warning" : "success"}
        />
      </div>

      {budgetPct != null && budgetPct >= 75 && (
        <div
          className={cn(
            "p-3 rounded-lg border text-sm flex items-center gap-2",
            budgetPct >= 90 ? "border-danger/30 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-warning"
          )}
        >
          ⚠ Monthly spend is at {budgetPct.toFixed(0)}% of {formatCurrency(budget ?? 0)} budget
        </div>
      )}

      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider">
            Cost Timeline
          </h3>
          <div className="flex gap-1">
            {(["7D", "14D", "30D"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1 text-xs rounded border transition-all",
                  range === r ? "bg-accent/10 border-accent/30 text-accent" : "border-white/10 text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading cost telemetry…
          </div>
        ) : shown.length > 0 ? (
          <CostBreakdownChart data={shown} />
        ) : (
          <div className="h-64 rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground flex items-center justify-center">
            No daily cost rows available yet.
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Cost Breakdown by Model
        </h3>
        {data?.models?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                  <th className="text-left pb-2">Provider</th>
                  <th className="text-left pb-2">Model</th>
                  <th className="text-right pb-2">Input Tokens</th>
                  <th className="text-right pb-2">Output Tokens</th>
                  <th className="text-right pb-2">Requests</th>
                  <th className="text-right pb-2">Cost</th>
                </tr>
              </thead>
              <tbody className="font-[family-name:var(--font-data)]">
                {data.models.map((m) => (
                  <tr key={`${m.provider}-${m.model}`} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 text-muted-foreground">{m.provider}</td>
                    <td className="py-2">{m.model}</td>
                    <td className="py-2 text-right">{formatNumber(m.input_tokens)}</td>
                    <td className="py-2 text-right">{formatNumber(m.output_tokens)}</td>
                    <td className="py-2 text-right">{formatNumber(m.requests)}</td>
                    <td className="py-2 text-right text-accent font-bold">{formatCurrency(m.cost)}</td>
                  </tr>
                ))}
                <tr className="border-t border-white/10 font-bold">
                  <td colSpan={5} className="py-2">Total</td>
                  <td className="py-2 text-right text-accent">{formatCurrency(data.models.reduce((s, m) => s + m.cost, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            No per-model cost data available.
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Cost Status Breakdown
        </h3>
        {data?.cost_status_breakdown && Object.keys(data.cost_status_breakdown).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {Object.entries(data.cost_status_breakdown).map(([status, count]) => (
              <div key={status} className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-muted-foreground uppercase">{status}</div>
                <div className="text-lg font-bold font-[family-name:var(--font-data)]">{formatNumber(count)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            No cost status metadata available.
          </div>
        )}
      </div>
    </div>
  );
}
