"use client"

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { popupHost, toHost, hostSize, hostView, scrimStyle } from "@/components/ui/popup-host"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check, ChevronDown, Search, X } from "lucide-react"

import { BUTTON, BUTTON_PRIMARY, FIELD, ICON_BUTTON } from "@/components/ui/control-classes"
import { cn } from "@/lib/utils"

/* Ticket Modal and Ticket Select (2026-10-02 audit): the dashboards' popup and dropdown
   (src/components/lab/screen/Modal.tsx and Select.tsx) cut for components that ship alone,
   so the tickets, the swaps, Payment Card and Wallet Drawer open the same parts the
   dashboards do. A library file cannot import lab files, so the look and the behaviour are
   copied here, with three changes:
   · both portal into the document that holds the trigger (its ownerDocument), not the page's
     own, so they open inside the library's preview frame and anywhere a host renders them;
   · their keys and outside presses are heard on that document too (a window listener in the
     parent never hears a press inside the frame);
   · the grounds are tokens: the popup is white in light and 6% foreground over the ground in
     dark (the dashboards wrote fixed white and near-black), the menu one step lighter.
   Corners nest (spec 13.10): the popup holds 48px pills (radius 24) 12px in, so it is 36;
   the menu holds 36px rows (radius 12) 6px in, so it is 18.
   2026-10-02 round 2: focus sits on the field's own edge (his standing rule, from the Payment
   Card popup, where a focused field showed the page's blue outline 3px out). A popup field, the
   dropdown's field trigger and its search pill now brighten their own hairline to 20% on focus
   and carry outline-none! (important, since the site's :focus-visible rule is unlayered and beat
   the plain utility); the token chip shows keyboard focus as an inset 1px line at its edge. */

const EASE = [0.16, 1, 0.3, 1] as const

/** focus on the field's own edge: its hairline brightens, no outline of its own, no gap */
const FOCUS_EDGE = "outline-none! no-focus-ring focus:border-foreground/[0.2] focus-within:border-foreground/[0.2]"
/** a pill control: keyboard focus as a 1px inset line at its own edge */
const FOCUS_INSET = "outline-none! no-focus-ring focus-visible:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_20%,transparent)]"

/** the popup's parts: a 48px field, the 48px primary and a 48px secondary */
export const modalField = cn("h-12 w-full px-5 text-[16px] tabular-nums sm:text-[14px]", FIELD, FOCUS_EDGE)
export const modalPrimary = `${BUTTON_PRIMARY} disabled:opacity-30`
export const modalSecondary = `h-12 px-5 text-[14px] ${BUTTON}`

/** where a node's popups go: the body of the document it lives in (the preview frame's, a
    host's, or the page's), or the [data-popup-root] box it is drawn in (the library's Browse
    all card), so a popup opens inside the component area (ui/popup-host.ts) */
function useHostBody() {
  const [body, setBody] = useState<HTMLElement | null>(null)
  const anchor = (el: HTMLElement | null) => {
    const host = popupHost(el)
    if (host && host !== body) setBody(host)
  }
  return [body, anchor] as const
}

/**
 * A centred popup over a softened screen: title and a round close top right, the content
 * under it. Escape, the close and a press on the backdrop close it; focus moves to the first
 * field on open and back to the opener on close, and Tab stays inside.
 */
export function TicketModal({
  open,
  title,
  onClose,
  children,
  width = 360,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  const reduced = useReducedMotion()
  const [body, anchor] = useHostBody()
  const box = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const keyboard = useRef(false)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open || !body) return
    const doc = body.ownerDocument
    opener.current = doc.activeElement as HTMLElement | null
    keyboard.current = !!opener.current?.matches?.(":focus-visible")
    const id = setTimeout(() => box.current?.querySelector<HTMLElement>("input, textarea, button:not([data-close])")?.focus({ preventScroll: true }), 30)
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current()
      if (e.key !== "Tab" || !box.current) return
      const f = [...box.current.querySelectorAll<HTMLElement>("button, input, textarea, a[href]")].filter((el) => !el.hasAttribute("disabled"))
      if (!f.length) return
      if (e.shiftKey && doc.activeElement === f[0]) {
        e.preventDefault()
        f[f.length - 1].focus()
      } else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) {
        e.preventDefault()
        f[0].focus()
      }
    }
    doc.addEventListener("keydown", key)
    return () => {
      clearTimeout(id)
      doc.removeEventListener("keydown", key)
      /* focus goes home only for a keyboard user: after a click it would light the opener */
      if (keyboard.current) opener.current?.focus?.({ preventScroll: true })
    }
  }, [open, body])

  return (
    <>
      <span ref={anchor} hidden />
      {body &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="backdrop"
                /* blur: the screen behind the popup shows through, softened, so the popup reads as on top */
                className="fixed inset-0 z-[70] grid place-items-center bg-[color-mix(in_srgb,var(--background)_55%,transparent)] p-4 backdrop-blur-sm"
                /* in a Browse all card the scrim covers the part of the card that shows
                   (ui/popup-host.ts); elsewhere undefined, the plain inset-0 */
                style={scrimStyle(body)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.15 }}
                onPointerDown={(e) => e.target === e.currentTarget && close.current()}
              >
                <motion.div
                  ref={box}
                  role="dialog"
                  aria-modal="true"
                  aria-label={title}
                  className="max-h-[calc(100dvh-32px)] w-full overflow-y-auto rounded-[36px] border border-foreground/[0.08] bg-background p-3 text-foreground tabular-nums dark:bg-[color-mix(in_srgb,var(--foreground)_6%,var(--background))]"
                  style={{ maxWidth: width }}
                  initial={{ opacity: 0, y: reduced ? 0 : 10, scale: reduced ? 1 : 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduced ? 0 : 6, scale: reduced ? 1 : 0.98, transition: { duration: 0.15 } }}
                  transition={reduced ? { duration: 0.15 } : { duration: 0.25, ease: EASE }}
                >
                  <div className="mb-3 flex items-center justify-between pl-3 pt-1">
                    <h2 className="text-[15px] font-medium text-foreground/90">{title}</h2>
                    <button type="button" aria-label="Close" data-close="" onClick={onClose} className={cn("h-9 w-9", ICON_BUTTON)}>
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  {children}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          body,
        )}
    </>
  )
}

/** one label and value row inside a popup: label /60, value /90 */
export function ModalLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-[12.5px]">
      <span className="text-foreground/60">{label}</span>
      <span className="tabular-nums text-foreground/90">{value}</span>
    </div>
  )
}

export type TicketOption = { value: string; label: string; icon?: ReactNode; hint?: string }

/**
 * The custom dropdown: a trigger that opens a solid menu under it, never the browser's own
 * list. `field` is the 48px FIELD pill of a popup, `chip` the token pill of a ticket (the
 * control material, mark, symbol and a chevron). Keyboard: the arrows move, Enter picks,
 * Escape closes, a letter jumps to the first match; past 8 options a search field leads.
 */
export function TicketSelect({
  value,
  options,
  onChange,
  label,
  look = "field",
  className,
  trigger,
}: {
  value: string
  options: TicketOption[]
  onChange: (v: string) => void
  /** the accessible name */
  label: string
  look?: "field" | "chip"
  className?: string
  /** what the chip shows in place of the chosen option's icon and label */
  trigger?: ReactNode
}) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [hi, setHi] = useState(0)
  const [box, setBox] = useState<{ left: number; top: number; above: number; width: number; up: boolean } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)
  const searchable = options.length > 8
  const list = q.trim() ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) : options

  const place = () => {
    const el = btn.current
    if (!el) return
    /* placed and flipped in the popup host's room: the window, or the Browse all card's box,
       in its unscaled units (ui/popup-host.ts) */
    const host = popupHost(el)
    const r = toHost(el.getBoundingClientRect(), host)
    const { height: vh } = hostSize(host)
    /* v: the part of the host that shows (the window, or the card's frame) */
    const v = hostView(host)
    const width = Math.max(r.width, 220)
    const room = v.top + v.height - r.bottom
    setBox({ left: Math.max(v.left + 8, Math.min(r.left, v.left + v.width - width - 8)), top: r.bottom + 6, above: vh - r.top + 6, width, up: room < 260 && r.top - v.top > room })
  }
  useLayoutEffect(() => {
    if (open) place()
  }, [open])
  useEffect(() => {
    if (!open || !btn.current) return
    setHi(Math.max(0, list.findIndex((o) => o.value === value)))
    const doc = btn.current.ownerDocument
    const view = doc.defaultView
    const away = (e: PointerEvent) => !menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node) && setOpen(false)
    doc.addEventListener("pointerdown", away)
    view?.addEventListener("resize", place)
    doc.addEventListener("scroll", place, true)
    return () => {
      doc.removeEventListener("pointerdown", away)
      view?.removeEventListener("resize", place)
      doc.removeEventListener("scroll", place, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" })
  }, [hi])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setQ("")
    btn.current?.focus({ preventScroll: true })
  }
  const onKey = (e: ReactKeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setHi((h) => Math.min(list.length - 1, h + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHi((h) => Math.max(0, h - 1))
    } else if (e.key === "Enter" && list[hi]) {
      e.preventDefault()
      pick(list[hi].value)
    } else if (!searchable && e.key.length === 1) {
      const i = list.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()))
      if (i >= 0) setHi(i)
    }
  }

  const chevron = <ChevronDown size={14} aria-hidden className={cn("shrink-0 text-foreground/60 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
  /* the menu portals where the trigger's popups go (ui/popup-host.ts) */
  const body = popupHost(btn.current)

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? "none"}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={cn(
          look === "chip"
            ? cn("h-8 shrink-0 gap-1.5 pl-1 pr-2.5 text-[13px] font-medium", BUTTON, FOCUS_INSET)
            : cn("flex h-12 w-full items-center gap-2 pl-5 pr-4 text-left text-[14px]", FIELD, FOCUS_EDGE),
          className,
        )}
      >
        {trigger ?? (
          <>
            {current?.icon}
            <span className={cn("min-w-0 truncate text-foreground/90", look === "field" && "flex-1")}>{current?.label ?? "None"}</span>
          </>
        )}
        {chevron}
      </button>
      {open &&
        box &&
        body &&
        createPortal(
          <motion.div
            ref={menu}
            onKeyDown={onKey}
            initial={{ opacity: 0, y: reduced ? 0 : box.up ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="fixed z-[90] rounded-[18px] border border-foreground/[0.08] bg-background p-1.5 text-foreground tabular-nums dark:bg-[color-mix(in_srgb,var(--foreground)_9%,var(--background))]"
            style={{ left: box.left, width: box.width, ...(box.up ? { bottom: box.above } : { top: box.top }), boxShadow: "0 8px 24px var(--card-shadow, rgba(0,0,0,0.35))" }}
          >
            {searchable && (
              <label className={cn("mb-1 flex h-9 items-center gap-2 px-3", FIELD, FOCUS_EDGE)}>
                <Search size={14} aria-hidden className="text-foreground/60" />
                <input
                  autoFocus
                  aria-label={`Search ${label.toLowerCase()}`}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setHi(0)
                  }}
                  placeholder="Search"
                  className="no-focus-ring w-full bg-transparent text-[12.5px] outline-none! placeholder:text-foreground/45"
                />
              </label>
            )}
            <div role="listbox" aria-label={label} className="max-h-[260px] overflow-y-auto [scrollbar-width:none]">
              {list.map((o, i) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  data-i={i}
                  onClick={() => pick(o.value)}
                  onPointerEnter={() => setHi(i)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 rounded-[12px] px-2.5 text-left text-[12.5px] outline-none transition-colors duration-150 hover:bg-foreground/[0.06]",
                    i === hi && "bg-foreground/[0.06]",
                  )}
                >
                  {o.icon}
                  <span className="min-w-0 flex-1 truncate text-foreground/90">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-foreground/60">{o.hint}</span>}
                  <span className="grid w-4 shrink-0 place-items-center">{o.value === value && <Check size={14} aria-hidden className="text-foreground/70" />}</span>
                </button>
              ))}
              {list.length === 0 && <p className="py-3 text-center text-[12px] text-foreground/60">Nothing matches.</p>}
            </div>
          </motion.div>,
          body,
        )}
    </>
  )
}
