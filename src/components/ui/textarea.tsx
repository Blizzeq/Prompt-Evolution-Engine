import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[1.5rem] border border-white/14 bg-white/[0.52] px-4 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition-[border-color,background-color,box-shadow] outline-none placeholder:text-muted-foreground/85 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/18 disabled:cursor-not-allowed disabled:bg-input/45 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 md:text-sm dark:border-white/8 dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:disabled:bg-white/[0.06] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
