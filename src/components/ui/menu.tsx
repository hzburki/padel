import { WifiOff, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

// The list of options in a game's More sheet.
export function Menu({ children }: { children: ReactNode }) {
  return <div className="divide-y overflow-hidden rounded-3xl bg-card border-[1.5px]">{children}</div>
}

// One option. `offline`: it needs a connection the phone doesn't have, so
// it is greyed out and says why.
export function MenuItem({
  icon: Icon,
  label,
  onClick,
  offline = false,
  destructive = false,
  badge,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  offline?: boolean
  destructive?: boolean
  badge?: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={offline}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-4 text-left font-medium active:bg-muted disabled:text-muted-foreground ${
        destructive ? "text-destructive" : ""
      }`}
    >
      <Icon className={`size-5 ${offline || destructive ? "" : "text-primary"}`} />
      {label}
      {badge}
      {offline && <WifiOff className="ml-auto size-4.5" aria-label="Offline" />}
    </button>
  )
}
