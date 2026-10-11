"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Newspaper,
  ExternalLink,
  Flame,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EconomicEvent, NewsArticle } from "@/app/api/market/news/route";

interface MarketNewsTerminalProps {
  activeSymbol: string;
}

export const MarketNewsTerminal: React.FC<MarketNewsTerminalProps> = ({ activeSymbol }) => {
  const [subTab, setSubTab] = useState<"calendar" | "news">("calendar");
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterImpact, setFilterImpact] = useState<"ALL" | "High" | "Medium">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [newsFilterCategory, setNewsFilterCategory] = useState<"ALL" | "CRYPTO" | "MACRO">("ALL");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market/news");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.calendar || []);
        setNewsList(data.news || []);
      }
    } catch (err) {
      console.error("Failed to load news/calendar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000 * 5); // auto refresh 5 min
    return () => clearInterval(interval);
  }, []);

  // Filter Calendar events
  const filteredEvents = events.filter((e) => {
    if (filterImpact !== "ALL" && e.impact !== filterImpact) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter News
  const filteredNews = newsList.filter((n) => {
    if (newsFilterCategory !== "ALL" && n.category !== newsFilterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // High impact upcoming count
  const highImpactCount = events.filter((e) => e.impact === "High").length;

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black border border-zinc-800 rounded-lg p-0.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setSubTab("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                subTab === "calendar"
                  ? "bg-zinc-800 text-white font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>MACRO CALENDAR</span>
              {highImpactCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-red-950 text-red-400 border border-red-900/60">
                  {highImpactCount} HIGH
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubTab("news")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                subTab === "news"
                  ? "bg-zinc-800 text-white font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Newspaper className="h-3.5 w-3.5 text-cyan-400" />
              <span>MARKET HEADLINES ({newsList.length})</span>
            </button>
          </div>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search release / news..."
              className="bg-black border border-zinc-800 rounded-md pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 w-44 sm:w-56"
            />
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 bg-black hover:bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
            title="Refresh Feed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* 1. ECONOMIC CALENDAR SUBTAB */}
      {subTab === "calendar" && (
        <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-850 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Flame className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-zinc-200">FOREXFACTORY ECONOMIC RELEASES</span>
              <span className="text-[10px] text-zinc-500">• Filter Dampak Makro:</span>
            </div>

            <div className="flex items-center gap-1 bg-black p-0.5 rounded border border-zinc-800 font-mono text-[10px]">
              {(["ALL", "High", "Medium"] as const).map((imp) => (
                <button
                  key={imp}
                  type="button"
                  onClick={() => setFilterImpact(imp)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    filterImpact === imp
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {imp === "High" ? "🔥 High Impact" : imp === "Medium" ? "⚡ Medium" : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">DATE / TIME</TableHead>
                <TableHead className="w-[80px]">CURRENCY</TableHead>
                <TableHead className="w-[90px]">IMPACT</TableHead>
                <TableHead>EVENT / RELEASE</TableHead>
                <TableHead className="text-right w-[100px]">FORECAST</TableHead>
                <TableHead className="text-right w-[100px]">PREVIOUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-zinc-500 font-sans">
                    {loading ? "Loading economic releases..." : "Tidak ada jadwal event makro."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((evt) => {
                  const evtDate = new Date(evt.date);
                  const timeStr = isNaN(evtDate.getTime())
                    ? evt.date
                    : evtDate.toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                  return (
                    <TableRow
                      key={evt.id}
                      className={evt.impact === "High" ? "bg-red-500/5 hover:bg-red-500/10" : ""}
                    >
                      <TableCell className="text-zinc-400 text-[11px] whitespace-nowrap">
                        {timeStr}
                      </TableCell>
                      <TableCell className="font-bold">
                        <Badge
                          variant="secondary"
                          className={
                            evt.country === "USD"
                              ? "text-emerald-400 border-emerald-500/20"
                              : evt.country === "EUR"
                              ? "text-blue-400 border-blue-500/20"
                              : evt.country === "GBP"
                              ? "text-purple-400 border-purple-500/20"
                              : "text-zinc-400 border-zinc-800"
                          }
                        >
                          {evt.country}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant={
                            evt.impact === "High"
                              ? "destructive"
                              : evt.impact === "Medium"
                              ? "warning"
                              : "secondary"
                          }
                        >
                          {evt.impact.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-100 font-sans font-medium text-xs">
                        {evt.title}
                      </TableCell>
                      <TableCell className="text-right text-zinc-300 font-mono text-[11px] tabular-nums">
                        {evt.forecast || "-"}
                      </TableCell>
                      <TableCell className="text-right text-zinc-500 font-mono text-[11px] tabular-nums">
                        {evt.previous || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 2. MARKET HEADLINES SUBTAB */}
      {subTab === "news" && (
        <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-850 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Globe className="h-4 w-4 text-cyan-400" />
              <span className="font-semibold text-zinc-200">LIVE FINANCIAL RSS WIRE</span>
              <span className="text-[10px] text-zinc-500">• CoinDesk, Cointelegraph &amp; MarketWatch</span>
            </div>

            <div className="flex items-center gap-1 bg-black p-0.5 rounded border border-zinc-800 font-mono text-[10px]">
              {(["ALL", "CRYPTO", "MACRO"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewsFilterCategory(cat)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    newsFilterCategory === cat
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredNews.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-zinc-500">
                {loading ? "Fetching market news headlines..." : "Tidak ada berita ditemukan."}
              </div>
            ) : (
              filteredNews.map((art) => {
                const dateObj = new Date(art.publishedAt);
                const timeAgo = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Recent";

                return (
                  <a
                    key={art.id}
                    href={art.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-lg border border-zinc-800/80 bg-black p-3 hover:border-zinc-700 hover:bg-zinc-900/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold ${
                            art.source === "CoinDesk"
                              ? "bg-blue-950/60 text-blue-400 border border-blue-900/60"
                              : art.source === "Cointelegraph"
                              ? "bg-amber-950/60 text-amber-400 border border-amber-900/60"
                              : "bg-emerald-950/60 text-emerald-400 border border-emerald-900/60"
                          }`}
                        >
                          {art.source}
                        </span>
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo}
                        </span>
                      </div>
                      <h4 className="text-xs font-medium text-zinc-200 group-hover:text-cyan-300 transition-colors line-clamp-2 leading-relaxed">
                        {art.title}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-2 border-t border-zinc-900 mt-2">
                      <span className="text-zinc-600 uppercase">{art.category}</span>
                      <span className="flex items-center gap-1 group-hover:text-zinc-300 transition-colors">
                        Read Story <ExternalLink className="h-3 w-3" />
                      </span>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
