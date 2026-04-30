"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Server,
  Container,
  Bot,
  Key,
  DollarSign,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Hexagon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/vps", label: "VPS Health", icon: Server },
  { href: "/containers", label: "Containers", icon: Container },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/tokens", label: "API & Tokens", icon: Key },
  { href: "/costs", label: "Costs", icon: DollarSign },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 border-r border-card-border bg-background/80 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b border-card-border">
          <Hexagon className="w-7 h-7 text-accent shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-[family-name:var(--font-display)] font-bold text-accent text-lg whitespace-nowrap overflow-hidden"
              >
                OpsCore
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-3 space-y-1 px-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group relative",
                  isActive
                    ? "bg-accent-dim text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r"
                  />
                )}
                <item.icon className="w-5 h-5 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 mx-2 mb-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </motion.aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14 bg-background/90 backdrop-blur-xl border-t border-card-border">
        {navItems.slice(0, 5).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[10px] py-1 px-2",
                isActive ? "text-accent" : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
