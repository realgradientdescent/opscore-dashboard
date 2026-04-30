"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "accent" | "success" | "warning" | "danger";
  sparkline?: number[];
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "accent",
  sparkline,
}: KpiCardProps) {
  const colorMap = {
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-[family-name:var(--font-display)]">
          {title}
        </span>
        <Icon className={cn("w-4 h-4", colorMap[color])} />
      </div>
      <div className="flex items-end gap-2">
        <span
          className={cn(
            "text-2xl font-bold font-[family-name:var(--font-data)] tabular-nums",
            colorMap[color]
          )}
        >
          {value}
        </span>
        {subtitle && (
          <span className="text-xs text-muted-foreground mb-1">
            {subtitle}
          </span>
        )}
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs">
          <span
            className={cn(
              trend.value >= 0 ? "text-success" : "text-danger"
            )}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="flex items-end gap-px h-8 mt-1">
          {sparkline.map((v, i) => (
            <div
              key={i}
              className={cn("flex-1 rounded-sm min-w-[2px]", `bg-${color}/40`)}
              style={{
                height: `${Math.max(4, (v / Math.max(...sparkline)) * 100)}%`,
                backgroundColor:
                  color === "accent"
                    ? "rgba(0,217,255,0.4)"
                    : color === "success"
                    ? "rgba(16,185,129,0.4)"
                    : color === "warning"
                    ? "rgba(245,158,11,0.4)"
                    : "rgba(244,63,94,0.4)",
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
