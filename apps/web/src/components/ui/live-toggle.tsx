"use client"

import { createContext, useContext, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { THUMB } from "@/components/ui/control-classes"

/* Live Toggle: the one play and pause control of the streaming components (Tape Flow,
   Trade Tape, Fills Blotter, New Items Pill).
   2026-10-02 round 2: his call, "I don't like the green dot in there, I feel like it should
   be better design ... still minimal. Give me a couple of options". Four options, all in
   ink on the control material, none with a dot, each a fixed width so the control never
   resizes between its two states:
   · a  Bars   a 28px pill; while live three thin bars rise and fall out of phase
              like an equaliser beside "Live"; paused, a filled play mark beside "Paused"
   · b  Line   a 28px pill; a hairline under the label carries a short glint gliding along it
              while live, a pause mark says what a press does; paused, a play mark
   · c  Morph  (default, his pick 2026-10-02) icon only, 28px round; the play mark morphs into the two pause bars, which
              breathe in turn while live
   · d  Word   text only; "Live" breathes in its letter weight (a variable font eases it,
              a static one steps), "Paused" sits still at /60
   Live takes the THUMB fill and full ink; paused is bare ink at /60 with a faint fill under
   the pointer. The label swaps in place (4px, 2px blur, 150ms). The signal moves only while
   `animate` is true (data is actually flowing) and never under reduced motion. Motion is
   transform only for a, b and c; d animates the weight. A page switches every toggle below
   it with <LiveToggleVariant variant="c">. */

export type LiveToggleVariantName = "a" | "b" | "c" | "d"

const VariantContext = createContext<LiveToggleVariantName>("c")

/** sets the look of every LiveToggle below it that does not name its own variant */
export function LiveToggleVariant({ variant, children }: { variant: LiveToggleVariantName; children: ReactNode }) {
  return <VariantContext.Provider value={variant}>{children}</VariantContext.Provider>
}

/** the variant in force here (the nearest LiveToggleVariant, or "c") */
export const useLiveToggleVariant = () => useContext(VariantContext)

const EASE = [0.16, 1, 0.3, 1] as const

/** fixed widths: the longer label ("Paused") plus its mark and 12px sides */
const WIDTH: Record<LiveToggleVariantName, number> = { a: 88, b: 88, c: 28, d: 68 }

/* keyframes for the signals; each toggle carries the same small rule set */
const KEYFRAMES = `
@keyframes lt-eq { 0%, 100% { transform: scaleY(0.35) } 50% { transform: scaleY(1) } }
@keyframes lt-glint { 0% { transform: translateX(-100%) } 100% { transform: translateX(300%) } }
@keyframes lt-breathe { 0%, 100% { transform: scaleY(1) } 50% { transform: scaleY(0.62) } }
@keyframes lt-weight { 0%, 100% { font-weight: 460 } 50% { font-weight: 640 } }
@media (prefers-reduced-motion: reduce) { .lt-sig { animation: none !important } }
`

const PILL =
  "relative inline-flex h-7 shrink-0 items-center justify-center rounded-full text-[11px] outline-none transition-[color,background-color,scale] duration-150 focus-visible:bg-foreground/[0.08] active:scale-[0.97] motion-reduce:active:scale-100"
const ON = `${THUMB} text-foreground/90`
const OFF = "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/90"

function PlayMark() {
  return (
    <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden>
      <path d="M3.2 1.8 L10.2 6 L3.2 10.2 Z" fill="currentColor" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  )
}

function PauseMark() {
  return (
    <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden>
      <rect x={2.6} y={2} width={2.4} height={8} rx={0.8} fill="currentColor" />
      <rect x={7} y={2} width={2.4} height={8} rx={0.8} fill="currentColor" />
    </svg>
  )
}

/** a: three 2px bars out of phase, the equaliser of something playing */
function Bars({ moving }: { moving: boolean }) {
  const bars = [
    { d: 1.05, delay: 0, rest: 0.55 },
    { d: 0.85, delay: -0.35, rest: 1 },
    { d: 1.25, delay: -0.7, rest: 0.7 },
  ]
  return (
    <span aria-hidden className="flex h-[10px] items-center gap-[2px]">
      {bars.map((b, i) => (
        <span
          key={i}
          className="lt-sig block h-full w-[2px] rounded-full bg-current"
          style={
            moving
              ? { animation: `lt-eq ${b.d}s ease-in-out ${b.delay}s infinite`, transformOrigin: "center" }
              : { transform: `scaleY(${b.rest})`, transition: "transform 250ms cubic-bezier(0.16, 1, 0.3, 1)" }
          }
        />
      ))}
    </span>
  )
}

/* c: play and pause drawn as the same two four-point shapes, so one morphs into the other.
   Points run top left, top right, bottom right, bottom left. */
const quad = (p: number[]) => `M${p[0]} ${p[1]} L${p[2]} ${p[3]} L${p[4]} ${p[5]} L${p[6]} ${p[7]} Z`
const PAUSE_L = quad([2.6, 2, 5, 2, 5, 10, 2.6, 10])
const PAUSE_R = quad([7, 2, 9.4, 2, 9.4, 10, 7, 10])
const PLAY_L = quad([3.2, 1.8, 7, 4.08, 7, 7.92, 3.2, 10.2])
const PLAY_R = quad([6.9, 4.02, 10.2, 6, 10.2, 6, 6.9, 7.98])

function Morph({ live, moving, reduced }: { live: boolean; moving: boolean; reduced: boolean }) {
  const t = reduced ? { duration: 0 } : { duration: 0.25, ease: EASE }
  return (
    <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden className="overflow-visible">
      {[
        { on: PAUSE_L, off: PLAY_L, delay: 0 },
        { on: PAUSE_R, off: PLAY_R, delay: -0.7 },
      ].map((s, i) => (
        <g
          key={i}
          className="lt-sig"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: live && moving ? `lt-breathe 1.4s ease-in-out ${s.delay}s infinite` : undefined,
          }}
        >
          <motion.path initial={false} animate={{ d: live ? s.on : s.off }} transition={t} fill="currentColor" stroke="currentColor" strokeWidth={0.6} strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  )
}

/** the label, swapped in place inside the fixed width */
function Label({ text, reduced, style, className }: { text: string; reduced: boolean; style?: React.CSSProperties; className?: string }) {
  return (
    <motion.span
      key={text}
      initial={reduced ? false : { opacity: 0, y: 4, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.15, ease: EASE }}
      className={cn("whitespace-nowrap", className)}
      style={style}
    >
      {text}
    </motion.span>
  )
}

/** a mark that swaps through a 0.6 scale and a fade (150ms) */
function Swap({ k, children, reduced }: { k: string; children: ReactNode; reduced: boolean }) {
  return (
    <span aria-hidden className="relative grid h-3 w-3 shrink-0 place-items-center">
      <AnimatePresence initial={false}>
        <motion.span
          key={k}
          className="absolute inset-0 grid place-items-center"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.15, ease: EASE }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export interface LiveToggleProps {
  /** the feed is on */
  live: boolean
  onLiveChange: (next: boolean) => void
  /** the look; defaults to the nearest LiveToggleVariant, then "c" */
  variant?: LiveToggleVariantName
  /** the signal moves only while data is actually flowing; defaults to `live` */
  animate?: boolean
  labels?: { on: string; off: string }
  /** a fixed width in px, when the labels are longer than the defaults */
  width?: number
  "aria-label"?: string
  className?: string
}

/**
 * The live control of a streaming component: a press pauses the feed or plays it. Four
 * looks share one API (see the header); none of them changes width between states.
 */
export function LiveToggle({
  live,
  onLiveChange,
  variant,
  animate,
  labels = { on: "Live", off: "Paused" },
  width,
  "aria-label": ariaLabel,
  className,
}: LiveToggleProps) {
  const fromContext = useContext(VariantContext)
  const v = variant ?? fromContext
  const reduced = useReducedMotion() ?? false
  const moving = (animate ?? live) && !reduced
  const text = live ? labels.on : labels.off
  const w = width ?? WIDTH[v]

  return (
    <button
      type="button"
      aria-pressed={live}
      aria-label={ariaLabel ?? (live ? `${labels.on}, press to pause` : `${labels.off}, press to play`)}
      onClick={() => onLiveChange(!live)}
      className={cn(PILL, v !== "c" && "gap-1.5 px-3", live ? ON : OFF, className)}
      style={{ width: w }}
    >
      {/* inline, not hoisted: a preview frame or a shadow root gets its own copy */}
      <style>{KEYFRAMES}</style>

      {v === "a" && (
        <>
          <Swap k={live ? "bars" : "play"} reduced={reduced}>
            {live ? <Bars moving={moving} /> : <PlayMark />}
          </Swap>
          <Label text={text} reduced={reduced} />
        </>
      )}

      {v === "b" && (
        <>
          <Swap k={live ? "pause" : "play"} reduced={reduced}>
            {live ? <PauseMark /> : <PlayMark />}
          </Swap>
          <Label text={text} reduced={reduced} />
          {/* the hairline sits inside the straight run of the bottom edge, clear of the round ends */}
          <span aria-hidden className="pointer-events-none absolute inset-x-3 bottom-[4px] h-px overflow-hidden rounded-full">
            <span
              className="absolute inset-0 bg-current transition-opacity duration-200"
              style={{ opacity: live ? 0.12 : 0 }}
            />
            {moving && (
              <span
                className="lt-sig absolute inset-y-0 left-0 w-1/3 rounded-full"
                style={{
                  background: "linear-gradient(90deg, transparent, currentColor, transparent)",
                  opacity: 0.7,
                  animation: "lt-glint 1.8s cubic-bezier(0.45, 0, 0.55, 1) infinite",
                }}
              />
            )}
          </span>
        </>
      )}

      {v === "c" && <Morph live={live} moving={moving} reduced={reduced} />}

      {v === "d" && (
        <Label
          text={text}
          reduced={reduced}
          className="lt-sig"
          style={live && moving ? { animation: "lt-weight 2.4s ease-in-out infinite" } : { fontWeight: live ? 560 : 500 }}
        />
      )}
    </button>
  )
}
