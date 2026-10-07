import { Users } from "lucide-react"

// Marks a game that came from a friend's link: a copy that can be read here
// but not changed.
export function SharedTag() {
  return (
    <span className="inline-flex items-center gap-1 align-bottom font-medium text-primary">
      <Users className="size-3.5" strokeWidth={2.5} aria-hidden />
      Shared
    </span>
  )
}
