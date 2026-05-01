"use client";

import { cn } from "@/lib/utils";

interface RateLimitGaugeProps {
  label: string;
  percent: number;
  sublabel?: string;
  unknown?: boolean;
}

export default function RateLimitGauge({
  label,
  percent,
  sublabel,
  unknown = false,
}: RateLimitGaugeProps) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const displayPct = unknown ? 0 : Math.min(100, Math.max(0, percent));
  const offset = circumference - (displayPct / 100) * circumference;
  const color = unknown
    ? "#475569"
    : percent >= 95
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
          {!unknown && (
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
          )}
          {unknown && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray="4 8"
              strokeDashoffset={0}
              style={{ opacity: 0.3 }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg font-bold font-[family-name:var(--font-data)] tabular-nums"
            style={{ color: unknown ? "#475569" : color }}
          >
            {unknown ? "?" : `${displayPct}%`}
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
