"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  BrainCircuit,
  Layers,
} from "lucide-react";

export const FloatingBottomDock: React.FC = () => {
  const pathname = usePathname();
  const [activeCockpitMode, setActiveCockpitMode] = useState<string>("standard");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("view");
      if (p) setActiveCockpitMode(p);
    }

    const handler = (e: any) => {
      if (e.detail) setActiveCockpitMode(e.detail);
    };
    window.addEventListener("needpips:switch-view", handler);
    return () => window.removeEventListener("needpips:switch-view", handler);
  }, []);

  const handleNavClick = (view: string, e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      setActiveCockpitMode(view);
      window.dispatchEvent(new CustomEvent("needpips:switch-view", { detail: view }));
      const newUrl = view === "standard" ? "/" : `/?view=${view}`;
      window.history.pushState({}, "", newUrl);
    }
  };

  const NAV_ITEMS = [
    {
      label: "Terminal",
      href: "/",
      view: "standard",
      icon: BarChart3,
      activeColor: "text-white bg-zinc-800",
    },
    {
      label: "3D Torus HUD",
      href: "/?view=torus",
      view: "torus",
      icon: BrainCircuit,
      activeColor: "text-purple-300 bg-purple-950/80 border border-purple-800",
    },
    {
      label: "Forecast Lab",
      href: "/?view=forecast",
      view: "forecast",
      icon: TrendingUp,
      activeColor: "text-cyan-300 bg-cyan-950/80 border border-cyan-800",
    },
    {
      label: "All-in-One",
      href: "/?view=all-in-one",
      view: "all-in-one",
      icon: Layers,
      activeColor: "text-emerald-300 bg-emerald-950/80 border border-emerald-800",
    },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      {/* iOS Clean Floating Dock Container */}
      <div className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-xl border border-zinc-800 shadow-[0_10px_35px_rgba(0,0,0,0.85)] ring-1 ring-white/10 transition-all duration-300">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === "/"
              ? activeCockpitMode === item.view
              : pathname.includes(item.view);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={(e) => handleNavClick(item.view, e)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-colors ${
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
