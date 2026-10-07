import { WifiOff } from "lucide-react"
import { useSyncExternalStore } from "react"

function onConnectionChange(changed: () => void) {
  window.addEventListener("online", changed)
  window.addEventListener("offline", changed)
  return () => {
    window.removeEventListener("online", changed)
    window.removeEventListener("offline", changed)
  }
}

// Marks the card of a game whose scores are still being sent to friends.
// With no connection nothing is sent or received, so it says so instead,
// and goes back to Live by itself.
// It sits on the card's top border, so the element it is placed in must be
// `relative`.
export function LiveBadge() {
  const online = useSyncExternalStore(onConnectionChange, () => navigator.onLine)
  const colour = online ? "border-destructive text-destructive" : "border-muted-foreground text-muted-foreground"
  return (
    <span
      className={`absolute -top-3.5 right-4 z-10 flex h-5 items-center gap-1.5 rounded-full border-[1.5px] bg-card px-2 text-[0.6875rem] font-bold tracking-wide uppercase ${colour}`}
    >
      {online ? (
        <span className="size-2 animate-pulse rounded-full bg-destructive" />
      ) : (
        <WifiOff className="size-3" strokeWidth={3} aria-hidden />
      )}
      {online ? "Live" : "Offline"}
    </span>
  )
}
