"use client";

import { useState, useEffect } from "react";
import { RefreshCw, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TopBar() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 5 : c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-card-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden sm:inline font-[family-name:var(--font-display)] text-foreground">
          OpsCore
        </span>
        <span className="hidden sm:inline">/</span>
        <span className="hidden sm:inline">Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw
            className={cn(
              "w-3.5 h-3.5",
              countdown <= 1 && "animate-spin text-accent"
            )}
          />
          <span className="font-[family-name:var(--font-data)] tabular-nums">
            {countdown}s
          </span>
        </div>

        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-card-border">
          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
            <User className="w-4 h-4 text-accent" />
          </div>
          <span className="hidden sm:inline text-sm">Admin</span>
        </div>
      </div>
    </header>
  );
}
