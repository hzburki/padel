import { ChevronDown } from "lucide-react"

// A pick-one list: the phone's own picker behind a pill, so there is
// nothing to build or to get wrong on a small screen.
export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string // read out by screen readers, since the pill shows only the choice
  options: readonly (readonly [value: T, label: string])[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <span className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-11 appearance-none rounded-full bg-secondary pr-8 pl-3.5 text-sm text-primary outline-none type-label focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-primary"
        strokeWidth={2.5}
        aria-hidden
      />
    </span>
  )
}
