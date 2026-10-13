// Shown until the start of this day. After it the badge no longer shows:
// remove this file and where it is used, without asking.
const shown = Date.now() < new Date("2026-10-21T00:00:00").getTime()

// Marks a menu option that was added lately.
export function NewBadge() {
  if (!shown) return null
  return (
    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] leading-none font-bold tracking-wide text-primary-foreground uppercase">
      New
    </span>
  )
}
