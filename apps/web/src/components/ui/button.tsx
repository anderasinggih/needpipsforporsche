import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF66] disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default: "bg-[#00FF66] text-black font-semibold hover:bg-[#00E55C] shadow-[0_0_15px_rgba(0,255,102,0.25)]",
        electric: "bg-[#00FF66] text-black font-semibold hover:bg-[#00E55C] shadow-[0_0_20px_rgba(0,255,102,0.35)] active:scale-[0.99]",
        destructive: "bg-red-950/40 text-red-400 border border-red-900/60 hover:bg-red-900/50 hover:text-white",
        outline: "border border-neutral-800 bg-black text-neutral-300 hover:bg-neutral-900 hover:text-white hover:border-neutral-700",
        secondary: "bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white border border-neutral-800",
        ghost: "hover:bg-neutral-900 hover:text-neutral-200 text-neutral-400",
        link: "text-[#00FF66] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
