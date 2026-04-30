"use client";

import { useState } from "react";
import { generateCostData } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import CostBreakdownChart from "@/components/charts/CostBreakdownChart";
import KpiCard from "@/components/cards/KpiCard";
import { DollarSign, TrendingUp, Calendar, PiggyBank } from "lucide-react";

type Range = "7D" | "14D" | "30D";

export default function CostsPage() {
  const [range, setRange] = useState<Range>("30D");
  const allData = generateCostData(30);
  const shown = range === "7D" ? allData.slice(-7) : range === "14D" ? allData.slice(-14) : allData;

  const todayTotal = 24.40;
  const monthTotal = shown.reduce((s, d) => s + d.anthropic + d.openai + d.openrouter, 0);
  const projected = (monthTotal / shown.length) * 30;
  const budget = 800;

  const models = [
    { provider: "Anthropic", model: "claude-opus-4-6", input_tokens: 4_200_000, output_tokens: 890_000, requests: 1243, cost: 18.40 },
    { provider: "Anthropic", model: "claude-sonnet-4-6", input_tokens: 2_100_000, output_tokens: 440_000, requests: 892, cost: 6.20 },
    { provider: "OpenAI", model: "gpt-4o-mini", input_tokens: 2_100_000, output_tokens: 340_000, requests: 892, cost: 4.20 },
    { provider: "OpenRouter", model: "llama-3.1-70b", input_tokens: 8_400_000, output_tokens: 1_200_000, requests: 2100, cost: 1.80 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Today's Spend" value={formatCurrency(todayTotal)} icon={DollarSign} color="accent" trend={{ value: -8.2, label: "vs yesterday" }} />
        <KpiCard title="This Month" value={formatCurrency(monthTotal)} icon={Calendar} color="success" />
        <KpiCard title="Projected Month-End" value={formatCurrency(projected)} icon={TrendingUp} color={projected > budget * 0.9 ? "danger" : projected > budget * 0.75 ? "warning" : "accent"} />
        <KpiCard title="Budget Remaining" value={formatCurrency(budget - monthTotal)} subtitle={`/ $${budget}`} icon={PiggyBank} color={budget - monthTotal < budget * 0.1 ? "danger" : "success"} />
      </div>

      {monthTotal > budget * 0.75 && (
        <div className={cn("p-3 rounded-lg border text-sm flex items-center gap-2",
          monthTotal > budget * 0.9
            ? "border-danger/30 bg-danger/10 text-danger"
            : "border-warning/30 bg-warning/10 text-warning"
        )}>
          ⚠ Monthly spend is at {((monthTotal / budget) * 100).toFixed(0)}% of ${budget} budget
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
                className={cn("px-3 py-1 text-xs rounded border transition-all",
                  range === r
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "border-white/10 text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <CostBreakdownChart data={shown} />
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Cost Breakdown by Model
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
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
              {models.map((m, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 text-muted-foreground">{m.provider}</td>
                  <td className="py-2">{m.model}</td>
                  <td className="py-2 text-right">{(m.input_tokens / 1e6).toFixed(1)}M</td>
                  <td className="py-2 text-right">{(m.output_tokens / 1e3).toFixed(0)}K</td>
                  <td className="py-2 text-right">{m.requests.toLocaleString()}</td>
                  <td className="py-2 text-right text-accent font-bold">{formatCurrency(m.cost)}</td>
                </tr>
              ))}
              <tr className="border-t border-white/10 font-bold">
                <td colSpan={5} className="py-2">Total</td>
                <td className="py-2 text-right text-accent">{formatCurrency(models.reduce((s, m) => s + m.cost, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
