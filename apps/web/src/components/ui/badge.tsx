import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/components/ui/button"

const badgeVariants = cva(
  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium transition-colors select-none tabular-nums",
  {
    variants: {
      variant: {
        default:
          "border border-zinc-800 bg-zinc-900 text-zinc-200",
        secondary:
          "border border-zinc-800/80 bg-zinc-950 text-zinc-400",
        destructive:
          "border border-red-500/20 bg-red-500/10 text-red-400",
        success:
          "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        warning:
          "border border-amber-500/20 bg-amber-500/10 text-amber-400",
        info:
          "border border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
        outline:
          "border border-zinc-800 text-zinc-300 bg-transparent",
        live:
          "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        electric:
          "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
