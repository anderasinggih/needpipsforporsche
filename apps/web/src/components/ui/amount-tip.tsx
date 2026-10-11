"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/* Amount Tip: the formula behind a figure, shown when the figure is pointed at, focused or
   tapped (2026-10-02 audit: every number stays derivable, and a line that is not read first
   keeps its formula here instead of printing it). The card is the library popover of spec
   14.6: radius 12, an 8% hairline, the ground 6% foreground over the background and the
   popover shadow; the text 11px at /90. It opens after 320ms so a pass across a row does
   not flash it, closes on leave, blur and Escape, and a tap toggles it on touch.
   Shipped beside the components that import it (the tickets, the swaps, Crypto Fiat).
   2026-10-02 round 2: the card comes in instead of appearing: 150ms, opacity and a 3px rise
   toward its figure (opacity alone with reduced motion), through the Web Animations API so the
   file still ships with no motion dependency. Amount now uses it for its hover card. */

/** the card's entrance, run once when it mounts; on transform, so a centred card's own
 *  translate (Tailwind's -translate-x-1/2) is left alone */
const enter = (side: "top" | "bottom") => (el: HTMLSpanElement | null) => {
  if (!el || el.dataset.in || typeof el.animate !== "function") return
  el.dataset.in = "1"
  const still = el.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  const from = side === "top" ? "3px" : "-3px"
  el.animate(still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateY(${from})` }, { opacity: 1, transform: "none" }], {
    duration: 150,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  })
}

export function Tip({
  tip,
  children,
  className,
  side = "top",
  align = "end",
}: {
  tip: ReactNode
  children: ReactNode
  className?: string
  side?: "top" | "bottom"
  /** which edge of the figure the card lines up with */
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const id = useId()
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), 320)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
  }
  return (
    <span
      aria-describedby={open ? id : undefined}
      className={cn("relative", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape") hide()
      }}
      onPointerUp={(e) => {
        if (e.pointerType === "touch") setOpen((o) => !o)
      }}
    >
      {children}
      {open && (
        <span
          id={id}
          role="status"
          ref={enter(side)}
          className={cn(
            "pointer-events-none absolute z-50 w-max max-w-[260px] rounded-[12px] border border-foreground/[0.08] px-2.5 py-1.5 text-left text-[11px] font-normal leading-[1.45] text-foreground/90",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2",
          )}
          style={{
            background: "var(--tip-fill, color-mix(in srgb, var(--foreground) 6%, var(--background)))",
            boxShadow: "0 8px 24px var(--card-shadow, rgba(0,0,0,0.35))",
          }}
        >
          {tip}
        </span>
      )}
    </span>
  )
}
