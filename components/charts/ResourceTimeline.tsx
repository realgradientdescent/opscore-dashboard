"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  time: string;
  cpu: number;
  memory: number;
  netIn: number;
  netOut: number;
}

export default function ResourceTimeline({ data }: { data: DataPoint[] }) {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
        System Resources — Last 30 min
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d9ff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00d9ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
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
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="cpu"
              stroke="#00d9ff"
              fill="url(#cpuGrad)"
              strokeWidth={2}
              name="CPU %"
            />
            <Area
              type="monotone"
              dataKey="memory"
              stroke="#10b981"
              fill="url(#memGrad)"
              strokeWidth={2}
              name="Memory %"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
