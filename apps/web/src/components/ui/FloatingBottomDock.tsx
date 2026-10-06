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
      activeColor: "text-white bg-zinc-800",
    },
    {
      label: "Forecast Lab",
      href: "/possibility",
      icon: TrendingUp,
      activeColor: "text-cyan-300 bg-cyan-950/80 border border-cyan-800",
    },
    {
      label: "Neural Hive",
      href: "/neural-mind",
      icon: BrainCircuit,
      activeColor: "text-purple-300 bg-purple-950/80 border border-purple-800",
    },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      {/* iOS Clean Floating Dock Container */}
      <div className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-xl border border-zinc-800 shadow-[0_10px_35px_rgba(0,0,0,0.85)] ring-1 ring-white/10 transition-all duration-300">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-colors ${
                isActive
                  ? item.activeColor
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
