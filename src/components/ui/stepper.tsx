import { ChevronDown, Minus, Plus } from "lucide-react"

// A setting with a big number in the middle: minus on the left, plus (the
// usual move) filled on the right.
export function Stepper({
  value,
  min,
  max,
  onChange,
  unit,
  onValueTap,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  unit: (n: number) => string
  onValueTap?: () => void // makes the value itself a button (e.g. to open a picker)
}) {
  const step =
    "flex size-14 shrink-0 items-center justify-center rounded-2xl transition-transform active:scale-90 disabled:bg-transparent disabled:text-muted-foreground/30 disabled:shadow-[inset_0_0_0_1.5px_var(--border)]"
  const Value = onValueTap ? "button" : "div"
  return (
    <div className="flex items-center gap-2 rounded-3xl bg-card p-2 shadow-[inset_0_0_0_1.5px_var(--border)]">
      <button
        type="button"
        aria-label="Fewer"
        className={`${step} bg-secondary text-primary`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-6" strokeWidth={2.75} />
      </button>
      <Value
        {...(onValueTap ? { type: "button" as const, onClick: onValueTap } : {})}
        className={`flex min-w-0 flex-1 flex-col items-center rounded-2xl py-1 ${onValueTap ? "active:bg-muted" : ""}`}
      >
        {/* Re-keyed so each change gives the number a small kick. */}
        <span
          key={value}
          className="text-[3.5rem] leading-[0.9] type-display animate-in duration-200 zoom-in-90 motion-reduce:animate-none"
        >
          {value}
        </span>
        <span className="mt-0.5 flex items-center gap-0.5 text-sm font-medium text-muted-foreground">
          {unit(value)}
          {onValueTap && <ChevronDown className="size-3.5" strokeWidth={2.75} />}
        </span>
      </Value>
      <button
        type="button"
        aria-label="More"
        className={`${step} bg-primary text-primary-foreground`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-6" strokeWidth={2.75} />
      </button>
    </div>
  )
}
