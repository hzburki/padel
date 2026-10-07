// Marks the card of a game whose scores are still being sent to friends.
// It sits on the card's top border, so the element it is placed in must be
// `relative`.
export function LiveBadge() {
  return (
    <span className="absolute -top-3.5 right-4 z-10 flex h-5 items-center gap-1.5 rounded-full border-[1.5px] border-destructive bg-card px-2 text-[0.6875rem] font-bold tracking-wide text-destructive uppercase">
      <span className="size-2 animate-pulse rounded-full bg-destructive" />
      Live
    </span>
  )
}
