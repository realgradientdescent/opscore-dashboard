"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, CheckCircle, Wifi } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="text-sm font-[family-name:var(--font-display)] text-accent uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-all font-[family-name:var(--font-data)]";

function MaskedInput({ value, placeholder }: { value: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} defaultValue={value} placeholder={placeholder} className={cn(inputCls, "pr-10")} />
      <button onClick={() => setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [refresh, setRefresh] = useState("5s");
  const [accent, setAccent] = useState("cyan");
  const [tested, setTested] = useState(false);

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="VPS Connection">
        <Field label="Agent API URL">
          <input defaultValue="https://your-vps.com/opscore-agent" className={inputCls} />
        </Field>
        <Field label="API Secret Key">
          <MaskedInput value="sk-opscore-xxxxxxxxxxxx" />
        </Field>
        <Field label="">
          <button
            onClick={() => setTested(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 text-sm transition-colors"
          >
            {tested ? <CheckCircle className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            {tested ? "Connection OK" : "Test Connection"}
          </button>
        </Field>
      </Section>

      <Section title="API Keys">
        <Field label="Anthropic">
          <MaskedInput value="sk-ant-xxxxxxxxxxxxxx" placeholder="sk-ant-..." />
        </Field>
        <Field label="OpenAI">
          <MaskedInput value="sk-xxxxxxxxxxxxxx" placeholder="sk-..." />
        </Field>
        <Field label="OpenRouter">
          <MaskedInput value="sk-or-xxxxxxxxxxxxxx" placeholder="sk-or-..." />
        </Field>
      </Section>

      <Section title="Budget Limits">
        {["Anthropic", "OpenAI", "OpenRouter"].map((p) => (
          <Field key={p} label={p}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <input type="number" defaultValue={p === "Anthropic" ? 500 : p === "OpenAI" ? 200 : 100} className={cn(inputCls, "w-32")} />
              <span className="text-xs text-muted-foreground">/ month</span>
            </div>
          </Field>
        ))}
      </Section>

      <Section title="Email Notifications">
        <Field label="From Address (Resend)">
          <input defaultValue="alerts@yourdomain.com" className={inputCls} />
        </Field>
        <Field label="To Address">
          <input defaultValue="you@youremail.com" className={inputCls} />
        </Field>
        <Field label="">
          <button className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm transition-colors">
            Send Test Email
          </button>
        </Field>
      </Section>

      <Section title="Refresh Rate">
        <Field label="Poll Interval">
          <div className="flex gap-2 flex-wrap">
            {["5s", "15s", "30s", "60s"].map((r) => (
              <button
                key={r}
                onClick={() => setRefresh(r)}
                className={cn("px-3 py-1.5 rounded-lg text-sm border transition-all",
                  refresh === r
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "border-white/10 text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Appearance">
        <Field label="Accent Color">
          <div className="flex gap-3">
            {[
              { name: "cyan", color: "#00d9ff" },
              { name: "purple", color: "#a855f7" },
              { name: "green", color: "#10b981" },
            ].map((c) => (
              <button
                key={c.name}
                onClick={() => setAccent(c.name)}
                className={cn("w-8 h-8 rounded-full border-2 transition-all",
                  accent === c.name ? "border-white scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Danger Zone">
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-lg bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30 text-sm transition-colors">
            Clear Cached Data
          </button>
          <button className="px-4 py-2 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 text-sm transition-colors">
            Reset Alert Rules
          </button>
        </div>
      </Section>

      <div className="flex justify-end">
        <button className="px-6 py-2.5 rounded-lg bg-accent text-background font-medium text-sm hover:bg-accent/90 transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
}
