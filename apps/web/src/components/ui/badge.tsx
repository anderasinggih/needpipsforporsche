import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/components/ui/button"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-neutral-900 text-neutral-200",
        secondary:
          "border-neutral-800 bg-neutral-900/60 text-neutral-400",
        destructive:
          "border-red-900/60 bg-red-950/30 text-red-400",
        outline: "border-neutral-800 text-neutral-300",
        electric:
          "border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66] shadow-[0_0_10px_rgba(0,255,102,0.15)]",
        live:
          "border-[#00FF66]/40 bg-[#00FF66]/10 text-[#00FF66] animate-pulse",
        success:
          "border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66]",
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
