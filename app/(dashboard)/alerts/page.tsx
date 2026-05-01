"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BellRing, BellOff, Loader2 } from "lucide-react";
import { useAlerts } from "@/lib/hooks";
import { cn } from "@/lib/utils";

function SeverityBadge({ s }: { s: string }) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded border",
        s === "critical"
          ? "bg-danger/10 text-danger border-danger/20"
          : s === "warning"
            ? "bg-warning/10 text-warning border-warning/20"
            : "bg-accent/10 text-accent border-accent/20"
      )}
    >
      {s}
    </span>
  );
}

export default function AlertsPage() {
  const { data, isLoading } = useAlerts();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visibleAlerts = useMemo(
    () => (data?.active ?? []).filter((alert) => !dismissed.includes(alert.id)),
    [data?.active, dismissed]
  );

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BellRing className="w-4 h-4 text-accent" />
          Alert source
        </div>
        <div className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : data?.source ?? "unknown"}
          {data?.note ? ` — ${data.note}` : ""}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active", value: data?.summary.active_count ?? 0, color: "text-foreground" },
          { label: "Critical", value: data?.summary.critical_count ?? 0, color: "text-danger" },
          { label: "Warnings", value: data?.summary.warning_count ?? 0, color: "text-warning" },
          { label: "Info", value: data?.summary.info_count ?? 0, color: "text-accent" },
        ].map((item) => (
          <div key={item.label} className="glass-card p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{item.label}</div>
            <div className={`text-2xl font-bold font-[family-name:var(--font-data)] ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Active Alerts ({visibleAlerts.length})
        </h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Evaluating live alerts…
          </div>
        ) : visibleAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No active alerts in the current live snapshot.</p>
        ) : (
          <div className="space-y-2">
            {visibleAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  alert.severity === "critical" ? "border-danger/30 bg-danger/5" : alert.severity === "warning" ? "border-warning/30 bg-warning/5" : "border-accent/30 bg-accent/5"
                )}
              >
                <span
                  className={cn(
                    "mt-1 w-2 h-2 rounded-full shrink-0 animate-pulse-glow",
                    alert.severity === "critical" ? "bg-danger" : alert.severity === "warning" ? "bg-warning" : "bg-accent"
                  )}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{alert.message}</div>
                  <div className="text-xs text-muted-foreground">{alert.detail}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{alert.time}{alert.source ? ` · ${alert.source}` : ""}</div>
                </div>
                <button onClick={() => setDismissed((items) => [...items, alert.id])} className="text-muted-foreground hover:text-foreground">
                  <BellOff className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Evaluated Rules
        </h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading rules…
          </div>
        ) : data?.rules?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[580px]">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                  <th className="text-left pb-2">Condition</th>
                  <th className="text-left pb-2">Severity</th>
                  <th className="text-left pb-2">Channel</th>
                  <th className="text-left pb-2">State</th>
                </tr>
              </thead>
              <tbody>
                {data.rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-white/5 align-top">
                    <td className="py-2.5">
                      <div>{rule.condition}</div>
                      {rule.detail && <div className="text-xs text-muted-foreground mt-1">{rule.detail}</div>}
                    </td>
                    <td className="py-2.5"><SeverityBadge s={rule.severity} /></td>
                    <td className="py-2.5 text-muted-foreground">{rule.channel}</td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded border",
                          !rule.enabled
                            ? "border-white/10 text-muted-foreground"
                            : rule.triggered
                              ? "border-danger/20 bg-danger/10 text-danger"
                              : "border-success/20 bg-success/10 text-success"
                        )}
                      >
                        {!rule.enabled ? "disabled" : rule.triggered ? "triggered" : "clear"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            No alert rules available.
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Alert History
        </h3>
        {data?.history?.length ? (
          <div className="space-y-2">
            {data.history.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-sm">
                <SeverityBadge s={a.severity} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{a.message}</span>
                  <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">{a.time}</div>
                  {a.resolved && <div className="text-xs text-success">resolved</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            Historical alert persistence is not wired yet. This page currently evaluates the live snapshot only.
          </div>
        )}
      </div>
    </div>
  );
}
