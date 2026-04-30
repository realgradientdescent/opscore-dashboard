"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertTriangle, Bell, BellOff, X } from "lucide-react";

const defaultRules = [
  { id: 1, condition: "CPU > 90% for 2 min", threshold: "90%", channel: "Email", severity: "critical", enabled: true },
  { id: 2, condition: "Memory > 85%", threshold: "85%", channel: "Dashboard", severity: "warning", enabled: true },
  { id: 3, condition: "Container exited unexpectedly", threshold: "—", channel: "Email", severity: "critical", enabled: true },
  { id: 4, condition: "Agent error / crash", threshold: "—", channel: "Email", severity: "critical", enabled: true },
  { id: 5, condition: "Anthropic TPM > 80%", threshold: "80%", channel: "Dashboard", severity: "warning", enabled: true },
  { id: 6, condition: "Monthly cost > 75% of budget", threshold: "75%", channel: "Email", severity: "warning", enabled: true },
  { id: 7, condition: "Monthly cost > 90% of budget", threshold: "90%", channel: "Email", severity: "critical", enabled: false },
  { id: 8, condition: "API error rate > 5% in 5 min", threshold: "5%", channel: "Email", severity: "warning", enabled: true },
];

const activeAlerts = [
  { id: 1, severity: "warning", message: "Anthropic TPM > 80%", detail: "Current: 84% of 100K TPM limit", time: "2m ago" },
  { id: 2, severity: "critical", message: "Container openclaw restarted", detail: "Container exited with code 1, auto-restarted", time: "14m ago" },
];

const alertHistory = [
  { severity: "warning", message: "Memory > 85%", detail: "RAM at 87.2%", time: "1h ago", resolved: true },
  { severity: "critical", message: "API error rate spiked", detail: "OpenRouter: 12% error rate over 5min", time: "3h ago", resolved: true },
  { severity: "warning", message: "Anthropic TPM > 80%", detail: "84% of limit", time: "6h ago", resolved: true },
  { severity: "info", message: "Daily cost report", detail: "Total: $24.40", time: "9h ago", resolved: true },
  { severity: "critical", message: "Agent Sub-3 timeout", detail: "Tool call exceeded 60s limit", time: "11h ago", resolved: true },
];

function SeverityBadge({ s }: { s: string }) {
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded border",
      s === "critical" ? "bg-danger/10 text-danger border-danger/20" :
      s === "warning" ? "bg-warning/10 text-warning border-warning/20" :
      "bg-accent/10 text-accent border-accent/20"
    )}>
      {s}
    </span>
  );
}

export default function AlertsPage() {
  const [rules, setRules] = useState(defaultRules);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const visibleAlerts = activeAlerts.filter((a) => !dismissed.includes(a.id));

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Active Alerts ({visibleAlerts.length})
        </h3>
        {visibleAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No active alerts</p>
        ) : (
          <div className="space-y-2">
            {visibleAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn("flex items-start gap-3 p-3 rounded-lg border",
                  alert.severity === "critical" ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"
                )}
              >
                <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0 animate-pulse-glow",
                  alert.severity === "critical" ? "bg-danger" : "bg-warning"
                )} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{alert.message}</div>
                  <div className="text-xs text-muted-foreground">{alert.detail}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{alert.time}</div>
                </div>
                <button onClick={() => setDismissed((d) => [...d, alert.id])} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Alert Rules */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Alert Rules
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                <th className="text-left pb-2">Condition</th>
                <th className="text-left pb-2">Severity</th>
                <th className="text-left pb-2">Channel</th>
                <th className="text-center pb-2">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-white/5">
                  <td className="py-2.5">{rule.condition}</td>
                  <td className="py-2.5"><SeverityBadge s={rule.severity} /></td>
                  <td className="py-2.5 text-muted-foreground">{rule.channel}</td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={() =>
                        setRules((r) =>
                          r.map((x) => x.id === rule.id ? { ...x, enabled: !x.enabled } : x)
                        )
                      }
                      className={cn("transition-colors",
                        rule.enabled ? "text-accent" : "text-muted-foreground"
                      )}
                    >
                      {rule.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert History */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider mb-4">
          Alert History
        </h3>
        <div className="space-y-2">
          {alertHistory.map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-sm">
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
      </div>
    </div>
  );
}
