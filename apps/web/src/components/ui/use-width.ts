"use client";

// The width a chart is given (2026-10-06, the Tradeboard case study). The charts used to lay
// out in a fixed box and stretch as a picture in a wider column, so their text grew with it;
// measured, they lay out at the real width and the text keeps its size. A chart left at its
// default class measures its own default width, so nothing changes where it is not stretched.
import { useEffect, useRef, useState } from "react";

export function useWidth<T extends HTMLElement>(fallback: number, min = 280) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(min, Math.round(e.contentRect.width)) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback, min]);
  return [ref, w] as const;
}
