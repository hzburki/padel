// Underline tabs, so they don't look like the Segmented switch.
export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [value: T, label: string])[]
  value: T
  onChange: (value: T) => void
}) {
  const index = options.findIndex(([v]) => v === value)
  return (
    <div
      className="relative grid shadow-[inset_0_-1.5px_0_var(--border)]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute bottom-0 left-0 flex h-1 justify-center transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ width: `${100 / options.length}%`, transform: `translateX(${index * 100}%)` }}
      >
        <span className="h-full w-16 rounded-full bg-foreground" />
      </span>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className="h-12 text-lg text-muted-foreground transition-colors type-label aria-pressed:text-foreground"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
