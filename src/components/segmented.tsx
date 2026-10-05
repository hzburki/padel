// A switch between a few options: navy track, lime thumb that slides to the
// chosen one.
export function Segmented<T extends string | number>({
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
      className="relative grid rounded-2xl bg-foreground p-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1.5 left-1.5 rounded-xl bg-accent shadow-[inset_0_-3px_0_rgb(14_34_64/0.16)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        // The track's padding is 0.375rem a side; the thumb fills one column.
        style={{ width: `calc((100% - 0.75rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className="relative h-12 text-[1.0625rem] text-primary-foreground/70 transition-colors type-label aria-pressed:text-accent-foreground"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
