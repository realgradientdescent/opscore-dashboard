"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CostDataPoint {
  date: string;
  anthropic: number;
  openai: number;
  openrouter: number;
  custom?: number;
}

export default function CostBreakdownChart({
  data,
}: {
  data: CostDataPoint[];
}) {
  const hasCustom = data.some((point) => (point.custom ?? 0) > 0);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="date"
            stroke="#475569"
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#475569"
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 12,
            }}
            formatter={(value) => [typeof value === "number" ? `$${value.toFixed(2)}` : value, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
          <Bar dataKey="anthropic" fill="#00d9ff" radius={[2, 2, 0, 0]} name="Anthropic" />
          <Bar dataKey="openai" fill="#10b981" radius={[2, 2, 0, 0]} name="OpenAI/Codex" />
          <Bar dataKey="openrouter" fill="#f59e0b" radius={[2, 2, 0, 0]} name="OpenRouter" />
          {hasCustom ? <Bar dataKey="custom" fill="#8b5cf6" radius={[2, 2, 0, 0]} name="Custom" /> : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
