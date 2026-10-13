import { LoaderCircle, WifiOff } from "lucide-react"
import { useSyncExternalStore } from "react"
import { onSlowSend, restartConnection, sendingSlowly } from "@/lib/live"
import { useOnline } from "./online"

// Marks the card of a game whose scores are still being sent to friends.
// With no connection nothing is sent or received, so it says so instead,
// and goes back to Live by itself. So it does while a score from this
// phone is taking too long to go out (sendingSlowly).
// Tapping it restarts the connection: nothing says so, it is there for when
// a phone has stopped getting scores and can't know it.
// It sits on the card's top border, so the element it is placed in must be
// `relative`.
export function LiveBadge() {
  const online = useOnline()
  const slow = useSyncExternalStore(onSlowSend, sendingSlowly)
  const colour = online && !slow ? "border-destructive text-destructive" : "border-muted-foreground text-muted-foreground"
  return (
    <span
      onClick={() => void restartConnection()}
      className={`absolute -top-3.5 right-4 z-10 flex h-5 items-center gap-1.5 rounded-full border-[1.5px] bg-card px-2 text-[0.6875rem] font-bold tracking-wide uppercase ${colour}`}
    >
      {!online ? (
        <WifiOff className="size-3" strokeWidth={3} aria-hidden />
      ) : slow ? (
        <LoaderCircle className="size-3 animate-spin" strokeWidth={3} aria-hidden />
      ) : (
        <span className="size-2 animate-pulse rounded-full bg-destructive" />
      )}
      {!online ? "Offline" : slow ? "Sending…" : "Live"}
    </span>
  )
}
