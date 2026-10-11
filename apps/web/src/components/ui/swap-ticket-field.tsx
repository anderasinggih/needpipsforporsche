"use client"

import { useId, useState, type CSSProperties, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowDown } from "lucide-react"

import { BUTTON, BUTTON_PRIMARY, SEGMENT_OFF, SURFACE, THUMB, TRACK } from "@/components/ui/control-classes"
import { Tip } from "@/components/ui/amount-tip"
import { cn } from "@/lib/utils"

/* Ticket parts (2026-10-02 audit, pattern 7): the one field, switch, flip, line and primary
   that the order tickets (Leverage, Order, Quick) and the swaps (Swap Ticket, Cross Chain
   Swap, Swap Confirm) are cut from, so the six forms read as two families of one product at
   one width. Before this the fields ran 8, 20, 22, 24 and 26px corners, the primaries were
   hand written at 44px and every form drew its own pills. The look follows the dashboards'
   SwapPanel (src/components/lab/screen/SwapPanel.tsx): fields on the surface step, a round
   flip on the seam with a ring of the ground, the 48px primary.
   Corners nest (spec 13.10):
   · AmountBox holds a 32px chip (radius 16) 12px in from its top right corner: 28
   · RowField is a 48px control: fully round, and what sits in its end is a 32px pill 8px in
   · Segments is the switch material: TRACK, THUMB, SEGMENT_OFF, a 28px pill in a 2px track
   2026-10-02 round 2: his notes after the side by side. Segments takes a `hue` per option: the
   chosen side's thumb is tinted in it (14%) and its label set in it, the other stays in ink; the
   6px dot is gone (an old `dot` is read as the hue and no longer drawn). AmountBox takes `seam`:
   the row that meets the flip keeps a 60px lane clear in its middle, so a balance or a chip
   never runs under the arrow. Focus sits on the field's own edge: a field's ground brightens
   its inset line to 20% while it holds focus, and every input here drops the page's blue
   outline (outline-none!, important because the site's :focus-visible rule is unlayered).
   PrimaryButton takes `hue` and `onHue` so a form whose action has a direction can wear it. */

const TAB_EASE = [0.22, 1, 0.36, 1] as const
const EASE = [0.16, 1, 0.3, 1] as const

/** the family width: every ticket and swap is this wide (spec 13.9) */
export const TICKET_WIDTH = "w-[320px] max-w-full"

/** a field's ground: the surface step, a touch deeper while something in it has focus */
const GROUND = cn(SURFACE, "transition-[background-color,box-shadow] duration-150 focus-within:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_20%,transparent)]")

/** an input inside a field: no outline of its own, the field's edge shows the focus. The
 *  important mark beats an unlayered page rule such as `:focus-visible { outline }` */
export const BARE_INPUT = "outline-none! no-focus-ring"

/** the lane kept clear over the flip: the 44px disc and its ring, plus 8px each side */
const SEAM_ROW = "grid grid-cols-[minmax(0,1fr)_60px_minmax(0,1fr)] items-center"

/** A hue as text: its lightness is capped in the light theme so small figures stay readable. */
export const ink = (c: string) => `oklch(from ${c} min(l, var(--ink-l, 1)) c h)`

/**
 * The amount field: a label top left and a chip top right (the token, or Max), the typed or
 * quoted amount under them, and a foot line (its worth on the left, the balance on the right).
 */
export function AmountBox({
  label,
  aside,
  children,
  foot,
  footAside,
  seam,
  className,
}: {
  label: ReactNode
  aside?: ReactNode
  children: ReactNode
  foot?: ReactNode
  footAside?: ReactNode
  /** which edge meets the flip: "bottom" for the field above it (its foot keeps the middle
   *  clear), "top" for the field under it (its label row keeps the middle clear) */
  seam?: "top" | "bottom"
  className?: string
}) {
  const top = seam === "top"
  const bottom = seam === "bottom"
  return (
    <div className={cn("flex flex-col gap-2 rounded-[28px] p-3", GROUND, className)}>
      <div className={cn("min-h-8", top ? cn(SEAM_ROW, "px-1") : "flex items-center justify-between gap-2 pl-1")}>
        <span className="min-w-0 truncate text-[12px] text-foreground/60">{label}</span>
        {top && <span aria-hidden />}
        {top ? <span className="flex min-w-0 justify-end">{aside}</span> : aside}
      </div>
      {/* one height for a 22px and a 17px figure, so two fields match and the flip sits on the seam */}
      <div className="flex h-7 min-w-0 items-center gap-2 px-1">{children}</div>
      {(foot || footAside) && (
        <div className={cn("min-h-6 px-1 text-[12px] text-foreground/60", bottom ? SEAM_ROW : "flex items-center justify-between gap-2")}>
          <span className="min-w-0 truncate">{foot}</span>
          {bottom && <span aria-hidden />}
          {footAside ? <span className={cn("flex items-center gap-1.5", bottom ? "min-w-0 justify-end" : "shrink-0")}>{footAside}</span> : bottom && <span />}
        </div>
      )}
    </div>
  )
}

/** the big figure in an AmountBox: typed (an input) or quoted (a span) at 22px or 17px */
export const amountText = (size: "lead" | "second", empty: boolean) =>
  cn(
    "w-full min-w-0 bg-transparent font-semibold leading-none tracking-[-0.02em] caret-foreground placeholder:text-foreground/35",
    BARE_INPUT,
    size === "lead" ? "text-[22px]" : "text-[17px]",
    empty ? "text-foreground/35" : "text-foreground/90",
  )

/**
 * A one line field: a 48px pill on the surface, its label on the left, the value typed on the
 * right, a unit or a small button (32px) at its end.
 */
export function RowField({
  label,
  value,
  onChange,
  places,
  unit,
  end,
  placeholder = "0",
  inputMode = "decimal",
  pattern,
  ariaLabel,
  align = "right",
  className,
}: {
  label: string
  value: string
  /** leave out for a field that only shows a figure */
  onChange?: (v: string) => void
  /** decimal places a typed number may carry; leave out with `pattern` for free text */
  places?: number
  unit?: string
  end?: ReactNode
  placeholder?: string
  inputMode?: "decimal" | "numeric" | "text"
  /** a custom test for what may be typed */
  pattern?: RegExp
  ariaLabel?: string
  align?: "left" | "right"
  className?: string
}) {
  const test = pattern ?? (places === undefined ? undefined : places === 0 ? /^\d{0,9}$/ : new RegExp(`^\\d*\\.?\\d{0,${places}}$`))
  return (
    <label className={cn("flex h-12 items-center gap-2 rounded-full pl-5", end ? "pr-2" : "pr-5", GROUND, className)}>
      <span className="shrink-0 text-[12px] text-foreground/60">{label}</span>
      <input
        value={value}
        onChange={(e) => {
          if (!test || test.test(e.target.value)) onChange?.(e.target.value)
        }}
        readOnly={!onChange}
        tabIndex={onChange ? 0 : -1}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-label={ariaLabel ?? (unit ? `${label} in ${unit}` : label)}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-[14px] font-semibold caret-foreground placeholder:text-foreground/35",
          BARE_INPUT,
          align === "right" ? "text-right" : "text-left",
          onChange ? "text-foreground/90" : "text-foreground/60",
        )}
      />
      {unit && <span className="shrink-0 text-[12px] text-foreground/60">{unit}</span>}
      {end}
    </label>
  )
}

/** a small pill inside a field or a foot line: Max, Half, Use last, a stepper */
export const PILL = cn("h-6 px-2.5 text-[11px] font-medium", BUTTON)
export const PILL_32 = cn("h-8 px-3 text-[12px]", BUTTON)

export type SegmentOption<T extends string> = {
  value: T
  label: string
  /** the side's hue: the chosen pill is tinted in it and its label set in it (Buy green, Sell red) */
  hue?: string
  /** before round 2 a 6px dot; now read as `hue` when no hue is given, and never drawn */
  dot?: string
}

/**
 * The switch: the library's segmented material (TRACK, THUMB, SEGMENT_OFF) at full width,
 * 11.5px. An option with a hue shows it on the chosen state itself: the thumb tinted 14% in
 * it and the label in it; the option that is off stays in ink (brief rule 3, no dots).
 */
export function Segments<T extends string>({
  name,
  options,
  value,
  onChange,
  className,
}: {
  name: string
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, "")
  return (
    <div role="radiogroup" aria-label={name} className={cn("grid gap-0.5", TRACK, className)} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const on = o.value === value
        const hue = o.hue ?? o.dot
        /* dark: 14% of the hue over the thumb. Light (2026-10-02: "grey and desaturated on the grey
           ground"): the hue mixed into WHITE, lighter and clearer than a tint over grey */
        /* 2026-10-06: light-dark() picked the light side in any app that does not declare
           color-scheme: dark, so a dark app showed a mint pill. The hue rides a variable and the
           two sides are classes, which follow the .dark class every shadcn app sets */
        const tint = on && hue ? ({ "--seg-hue": hue } as CSSProperties) : undefined
        const tintClass = tint ? "bg-[color-mix(in_srgb,var(--seg-hue)_16%,#ffffff)] dark:bg-[color-mix(in_srgb,var(--seg-hue)_14%,transparent)]" : ""
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "group relative flex h-7 items-center justify-center gap-1.5 rounded-full text-[11.5px] font-medium outline-none transition-colors duration-200",
              on ? "text-foreground/90" : SEGMENT_OFF,
            )}
            style={on && hue ? { color: ink(hue) } : undefined}
          >
            {on &&
              (reduced ? (
                <span aria-hidden className={cn("absolute inset-0 rounded-full", THUMB, tintClass)} style={tint} />
              ) : (
                <motion.span aria-hidden layoutId={`${uid}-thumb`} className={cn("absolute inset-0 rounded-full", THUMB, tintClass)} style={tint} transition={{ duration: 0.25, ease: TAB_EASE }} />
              ))}
            {/* the press answers on the label, so the thumb's glide measures an unscaled button */}
            <span className="relative inline-block transition-transform duration-150 group-active:scale-[0.97] motion-reduce:transition-none motion-reduce:group-active:scale-100">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The flip on the seam between two fields (the dashboards' SwapPanel): a 36px disc one step
 * raised, cut out of both fields by a 4px ring of the ground, turning half a turn per press.
 */
/* light (his call, 2026-10-02): a lighter grey, 6% ink (10% on hover), and no white ring
   (the 4px border stays as a transparent gap so the size and centring are unchanged); dark
   keeps 12% / 18% and the ring in the page colour */
export function FlipButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  const reduced = useReducedMotion()
  const [turns, setTurns] = useState(0)
  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        setTurns((t) => t + 1)
        onClick()
      }}
      animate={{ rotate: turns * 180 }}
      whileTap={reduced ? undefined : { scale: 0.94 }}
      transition={reduced ? { duration: 0 } : { rotate: { duration: 0.3, ease: EASE }, scale: { type: "spring", stiffness: 500, damping: 30 } }}
      className="absolute left-1/2 top-1/2 z-10 -ml-[22px] -mt-[22px] grid h-9 w-9 place-items-center rounded-full border-4 border-transparent bg-clip-padding dark:border-background dark:bg-clip-border bg-[color-mix(in_srgb,var(--foreground)_6%,var(--background))] text-foreground/85 outline-none transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--foreground)_10%,var(--background))] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_10%,var(--background))] dark:bg-[color-mix(in_srgb,var(--foreground)_12%,var(--background))] dark:hover:bg-[color-mix(in_srgb,var(--foreground)_18%,var(--background))] dark:focus-visible:bg-[color-mix(in_srgb,var(--foreground)_18%,var(--background))] disabled:text-foreground/40"
      style={{ boxSizing: "content-box" }}
    >
      <ArrowDown size={16} aria-hidden />
    </motion.button>
  )
}

/** a label and value line under the fields; with `tip` the value shows its formula on hover */
export function Line({ label, value, tip, strong = false, hue }: { label: string; value: ReactNode; tip?: ReactNode; strong?: boolean; hue?: string }) {
  const v = (
    <span className={cn("text-foreground/90", strong && "font-semibold", tip && "cursor-default underline decoration-foreground/20 decoration-dotted underline-offset-[3px] outline-none! transition-[text-decoration-color] duration-150 focus-visible:decoration-foreground/70")} style={hue ? { color: ink(hue) } : undefined} tabIndex={tip ? 0 : undefined}>
      {value}
    </span>
  )
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-foreground/60">{label}</span>
      {tip ? <Tip tip={tip}>{v}</Tip> : v}
    </div>
  )
}

/**
 * The one loud button of a ticket: BUTTON_PRIMARY, 48px, white. Its label is the state of the
 * ticket and swaps in place (4px, 2px blur, 150ms) only when the state changes, so typing a
 * figure never replays it. With `hue` (and the ink for it, `onHue`) it is filled in that hue
 * instead, for an action that has a direction.
 */
export function PrimaryButton({
  state,
  label,
  disabled,
  busy,
  onClick,
  hue,
  onHue = "var(--on-accent, var(--background))",
  className,
}: {
  /** what the label is keyed on: change it only on a change of state */
  state: string
  label: ReactNode
  disabled?: boolean
  busy?: boolean
  onClick?: () => void
  /** a fill in place of the white (e.g. var(--chart-up) for a buy); leave out for white */
  hue?: string
  /** the label's ink on that fill */
  onHue?: string
  className?: string
}) {
  const reduced = useReducedMotion()
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={onClick}
      className={cn(BUTTON_PRIMARY, "disabled:opacity-35", hue && "hover:brightness-[1.06] focus-visible:brightness-[1.06]", className)}
      style={hue ? { background: hue, color: onHue, transition: "filter 150ms, scale 150ms, opacity 150ms" } : undefined}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          className="inline-flex items-center gap-2"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
          transition={{ duration: 0.15, ease: EASE }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
