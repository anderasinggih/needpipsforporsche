import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/components/ui/button"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
        secondary:
          "border-transparent bg-zinc-850 text-zinc-300 hover:bg-zinc-800",
        destructive:
          "border-transparent bg-red-950 text-red-400 border border-red-800/40",
        outline: "text-zinc-300 border-zinc-750",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-mono",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-400 font-mono",
        live: "border-blue-500/20 bg-blue-500/10 text-blue-400 font-mono",
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
