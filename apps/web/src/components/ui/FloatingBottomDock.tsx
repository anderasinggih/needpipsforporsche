"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  BrainCircuit,
  Key,
  BookOpen,
  Layers,
  Activity,
  ShieldCheck,
} from "lucide-react";

export const FloatingBottomDock: React.FC = () => {
  const pathname = usePathname();

  const NAV_ITEMS = [
    {
      label: "Terminal",
      href: "/",
      icon: BarChart3,
      badge: null,
      activeColor: "text-white bg-zinc-800 shadow-md",
    },
    {
      label: "Forecast Lab",
      href: "/possibility",
      icon: TrendingUp,
      badge: "AI 3-Path",
      activeColor: "text-cyan-300 bg-cyan-950/80 border border-cyan-800 shadow-md",
    },
    {
      label: "Neural Hive",
      href: "/neural-mind",
      icon: BrainCircuit,
      badge: "20 Nodes",
      activeColor: "text-purple-300 bg-purple-950/80 border border-purple-800 shadow-md",
    },
    {
      label: "API Vault",
      href: "/owner/key",
      icon: Key,
      badge: null,
      activeColor: "text-amber-300 bg-amber-950/80 border border-amber-800 shadow-md",
    },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      {/* iOS Liquid Glass Floating Dock Container */}
      <div className="flex items-center gap-1 sm:gap-2 px-3 py-2 rounded-full bg-black/85 backdrop-blur-xl border border-zinc-700/60 shadow-[0_10px_35px_rgba(0,0,0,0.85)] ring-1 ring-white/10 transition-all duration-300 hover:border-zinc-500/80">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-200 ${
                isActive
                  ? item.activeColor
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "scale-110" : ""}`} />
              <span className="hidden sm:inline tracking-tight">{item.label}</span>

              {item.badge && !isActive && (
                <span className="hidden md:inline text-[9px] px-1.5 py-0 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {item.badge}
                </span>
              )}

              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
