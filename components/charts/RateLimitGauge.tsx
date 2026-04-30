"use client";

import { cn } from "@/lib/utils";

interface RateLimitGaugeProps {
  label: string;
  percent: number;
  sublabel?: string;
}

export default function RateLimitGauge({
  label,
  percent,
  sublabel,
}: RateLimitGaugeProps) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color =
    percent >= 95
      ? "#f43f5e"
      : percent >= 80
      ? "#f59e0b"
      : "#00d9ff";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg font-bold font-[family-name:var(--font-data)] tabular-nums"
            style={{ color }}
          >
            {percent.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {sublabel && (
        <span className="text-[10px] text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}
