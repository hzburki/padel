// Marks a menu option that was added lately. Shown until the start of
// `until` (YYYY-MM-DD). After that day it no longer shows: remove that use,
// and this file with the last one, without asking.
const loadedAt = Date.now()

export function NewBadge({ until }: { until: string }) {
  if (loadedAt >= new Date(`${until}T00:00:00`).getTime()) return null
  return (
    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] leading-none font-bold tracking-wide text-primary-foreground uppercase">
      New
    </span>
  )
}
