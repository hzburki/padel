import * as React from "react"
import { cn } from "cn"

// Chrome ignores autoComplete="off" on a field it takes for a name and offers a saved card or address.
// It does obey a type it knows, and it has nothing saved to offer for a one-time code.
function Input({ className, type, autoComplete = "one-time-code", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      autoComplete={autoComplete}
      data-slot="input"
      className={cn(
        "h-14 w-full min-w-0 rounded-2xl border-0 bg-card px-4 py-1 text-[1.0625rem] font-medium shadow-[inset_0_0_0_1.5px_var(--input)] transition-shadow outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:shadow-[inset_0_0_0_2.5px_var(--primary)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
