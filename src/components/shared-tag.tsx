import { Users, WifiOff } from "lucide-react"

// Marks a game that came from a friend's link: a copy that is not this
// phone's to rename, finish or broadcast.
export function SharedTag() {
  return (
    <span className="inline-flex items-center gap-1 align-bottom font-medium text-primary">
      <Users className="size-3.5" strokeWidth={2.5} aria-hidden />
      Shared
    </span>
  )
}

// The one line under a game's title that says what this phone can do with
// it: `lock` is why it can't change the game, if it can't (scoreLock). Your
// own game needs no line while it can be changed.
export function ScoreNote({ shared, lock }: { shared: boolean; lock: "watch" | "offline" | null }) {
  if (lock === "offline") {
    return (
      <p className="pt-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 align-bottom font-medium text-primary">
          <WifiOff className="size-3.5" strokeWidth={2.5} aria-hidden />
          Offline.
        </span>{" "}
        You can't change it until you're back.
      </p>
    )
  }
  if (!shared) return null
  return (
    <p className="pt-3 text-sm text-muted-foreground">
      <SharedTag /> with you. {lock === "watch" ? "Watch only." : "You're an organiser."}
    </p>
  )
}
