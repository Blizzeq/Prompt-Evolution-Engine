import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-clip-padding text-sm font-semibold tracking-[-0.02em] whitespace-nowrap transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-300 outline-none select-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary text-primary-foreground shadow-[0_20px_45px_-20px_rgba(17,186,157,0.58)] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_24px_60px_-24px_rgba(17,186,157,0.62)]",
        outline:
          "border-white/16 bg-white/[0.62] text-foreground shadow-[0_18px_40px_-30px_rgba(20,24,37,0.28)] hover:-translate-y-0.5 hover:bg-white/[0.82] aria-expanded:bg-white/[0.82] dark:border-white/8 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:aria-expanded:bg-white/[0.1]",
        secondary:
          "border-secondary/15 bg-secondary/75 text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/88 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-white/[0.08] hover:text-foreground aria-expanded:bg-white/[0.08] aria-expanded:text-foreground dark:hover:bg-white/[0.06] dark:aria-expanded:bg-white/[0.06]",
        destructive:
          "border-destructive/25 bg-destructive text-white shadow-[0_20px_48px_-24px_rgba(220,38,38,0.6)] hover:-translate-y-0.5 hover:bg-destructive/92 focus-visible:border-destructive/45 focus-visible:ring-destructive/18 dark:focus-visible:ring-destructive/35",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1 rounded-xl px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-2xl px-3.5 text-[0.83rem] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 rounded-[1.15rem] px-5 text-[0.92rem] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10 rounded-2xl",
        "icon-xs":
          "size-7 rounded-xl [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-2xl [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-11 rounded-[1.15rem] [&_svg:not([class*='size-'])]:size-4.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
