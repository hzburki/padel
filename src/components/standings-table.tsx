import { ArrowDown, ArrowUp } from "lucide-react"
import { formatPoints, type StandingRow } from "@/lib/standings"
import type { PlayerId } from "@/lib/types"

// The on-screen standings: a phone-width list, readable at a glance.
// (The shareable image has its own layout in share-card.ts.)
// moved: places gained (or lost, when negative) through the scaling for
// fewer games. Those rows are tinted and carry an arrow.
export function StandingsTable({
  rows,
  nameOf,
  moved,
}: {
  rows: StandingRow[]
  nameOf: Map<PlayerId, string>
  moved?: Map<PlayerId, number>
}) {
  return (
    <div className="overflow-hidden rounded-3xl border-[1.5px] bg-card">
      <div className="flex items-center gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
        <span className="w-8 text-center">#</span>
        <span className="flex-1">Player</span>
        <span className="w-8 text-right">P</span>
        <span className="w-10 text-right">+/−</span>
        <span className="w-14 text-right">Pts</span>
      </div>
      <ol className="divide-y">
        {rows.map((row) => {
          const places = moved?.get(row.playerId) ?? 0
          return (
            <li key={row.playerId} className={`flex items-center gap-3 px-4 py-3 ${places !== 0 ? "bg-secondary" : ""}`}>
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xl type-display ${
                  row.rank === 1 && row.played > 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {row.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[1.0625rem] type-label">
                  <span className="truncate">{nameOf.get(row.playerId)}</span>
                  {places !== 0 && (
                    <span
                      className={`flex shrink-0 items-center text-sm ${places > 0 ? "text-emerald-700" : "text-destructive"}`}
                      aria-label={`${Math.abs(places)} ${Math.abs(places) === 1 ? "place" : "places"} ${places > 0 ? "up" : "down"} for fewer games`}
                    >
                      {places > 0 ? (
                        <ArrowUp className="size-4" strokeWidth={3} />
                      ) : (
                        <ArrowDown className="size-4" strokeWidth={3} />
                      )}
                      {Math.abs(places)}
                    </span>
                  )}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1 text-[0.8125rem] leading-snug type-label">
                  <span className="rounded-full bg-emerald-100 px-1.5 text-emerald-700">{row.wins}W</span>
                  {row.draws > 0 && (
                    <span className="rounded-full bg-muted px-1.5 text-muted-foreground">{row.draws}D</span>
                  )}
                  <span className="rounded-full bg-destructive/10 px-1.5 text-destructive">{row.losses}L</span>
                  {row.bonus > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      +{formatPoints(row.bonus)} for fewer games
                    </span>
                  )}
                </span>
              </span>
              <span className="w-8 text-right text-muted-foreground">{row.played}</span>
              <span className="w-10 text-right text-muted-foreground">
                {row.diff > 0 ? `+${formatPoints(row.diff)}` : formatPoints(row.diff)}
              </span>
              <span className="w-14 text-right text-[1.75rem] leading-none type-display">{formatPoints(row.points)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
