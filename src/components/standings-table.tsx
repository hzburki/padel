import { formatPoints, type StandingRow } from "@/lib/standings"
import type { PlayerId } from "@/lib/types"

// The on-screen standings: a phone-width list, readable at a glance.
// (The shareable image has its own layout in share-card.ts.)
export function StandingsTable({ rows, nameOf }: { rows: StandingRow[]; nameOf: Map<PlayerId, string> }) {
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
        {rows.map((row) => (
          <li key={row.playerId} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xl type-display ${
                row.rank === 1 && row.played > 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              }`}
            >
              {row.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[1.0625rem] type-label">{nameOf.get(row.playerId)}</span>
              <span className="text-xs text-muted-foreground">
                {row.wins} won, {row.draws > 0 ? `${row.draws} drawn, ` : ""}
                {row.losses} lost
                {row.bonus > 0 && `, +${formatPoints(row.bonus)} for fewer games`}
              </span>
            </span>
            <span className="w-8 text-right text-muted-foreground">{row.played}</span>
            <span className="w-10 text-right text-muted-foreground">
              {row.diff > 0 ? `+${formatPoints(row.diff)}` : formatPoints(row.diff)}
            </span>
            <span className="w-14 text-right text-[1.75rem] leading-none type-display">{formatPoints(row.points)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
