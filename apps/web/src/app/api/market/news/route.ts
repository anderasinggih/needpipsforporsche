import { NextResponse } from "next/server";

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  impact: "High" | "Medium" | "Low" | "Holiday";
  forecast: string;
  previous: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  link: string;
  publishedAt: string;
  category: "CRYPTO" | "MACRO" | "GOLD";
}

let cachedCalendar: { data: EconomicEvent[]; timestamp: number } | null = null;
let cachedNews: { data: NewsArticle[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000 * 5; // 5 minutes cache

function parseRssItems(xmlText: string, sourceName: string, category: "CRYPTO" | "MACRO" | "GOLD"): NewsArticle[] {
  const items: NewsArticle[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const matches = xmlText.match(itemRegex) || [];

  for (const itemXml of matches.slice(0, 15)) {
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    if (titleMatch && titleMatch[1]) {
      const cleanTitle = titleMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#160;/g, " ")
        .trim();

      const link = linkMatch ? linkMatch[1].trim() : "#";
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();

      items.push({
        id: `${sourceName}_${Math.random().toString(36).substring(2, 9)}`,
        title: cleanTitle,
        source: sourceName,
        link,
        publishedAt: pubDate,
        category,
      });
    }
  }

  return items;
}

export async function GET(req: Request) {
  const now = Date.now();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "all";

  let events: EconomicEvent[] = [];
  let news: NewsArticle[] = [];

  // 1. Fetch ForexFactory Economic Calendar
  if (type === "all" || type === "calendar") {
    if (cachedCalendar && now - cachedCalendar.timestamp < CACHE_TTL_MS) {
      events = cachedCalendar.data;
    } else {
      try {
        const ffRes = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
          next: { revalidate: 300 },
          headers: { "User-Agent": "NeedPipsForPorsche-Terminal/1.0" },
        });

        if (ffRes.ok) {
          const rawEvents = await ffRes.json();
          if (Array.isArray(rawEvents)) {
            events = rawEvents.map((e: any, idx: number) => ({
              id: `ff_${idx}_${e.date}`,
              title: e.title || "Economic Release",
              country: e.country || "USD",
              date: e.date,
              impact: e.impact === "High" ? "High" : e.impact === "Medium" ? "Medium" : "Low",
              forecast: e.forecast || "-",
              previous: e.previous || "-",
            }));
            cachedCalendar = { data: events, timestamp: now };
          }
        }
      } catch (err) {
        console.error("Failed to fetch ForexFactory calendar:", err);
        if (cachedCalendar) events = cachedCalendar.data;
      }
    }
  }

  // 2. Fetch Live Financial & Crypto News (CoinDesk + Cointelegraph + MarketWatch)
  if (type === "all" || type === "news") {
    if (cachedNews && now - cachedNews.timestamp < CACHE_TTL_MS) {
      news = cachedNews.data;
    } else {
      const feedPromises = [
        fetch("https://cointelegraph.com/rss", {
          next: { revalidate: 300 },
          headers: { "User-Agent": "Mozilla/5.0" },
        })
          .then((r) => r.text())
          .then((xml) => parseRssItems(xml, "Cointelegraph", "CRYPTO"))
          .catch(() => []),

        fetch("https://feeds.feedburner.com/CoinDesk", {
          next: { revalidate: 300 },
          headers: { "User-Agent": "Mozilla/5.0" },
        })
          .then((r) => r.text())
          .then((xml) => parseRssItems(xml, "CoinDesk", "CRYPTO"))
          .catch(() => []),

        fetch("https://feeds.content.dowjones.io/public/rss/mw_topstories", {
          next: { revalidate: 300 },
          headers: { "User-Agent": "Mozilla/5.0" },
        })
          .then((r) => r.text())
          .then((xml) => parseRssItems(xml, "MarketWatch", "MACRO"))
          .catch(() => []),
      ];

      try {
        const results = await Promise.all(feedPromises);
        news = results.flat().sort((a, b) => {
          const tA = new Date(a.publishedAt).getTime() || 0;
          const tB = new Date(b.publishedAt).getTime() || 0;
          return tB - tA;
        });

        if (news.length > 0) {
          cachedNews = { data: news, timestamp: now };
        }
      } catch (err) {
        console.error("Failed to fetch RSS news:", err);
        if (cachedNews) news = cachedNews.data;
      }
    }
  }

  return NextResponse.json({
    calendar: events,
    news,
    timestamp: now,
  });
}
