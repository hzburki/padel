import { teamName, type MatchState } from "@/lib/set-match"
import { matchStats } from "@/lib/set-match-stats"
import type { SetMatch } from "@/lib/types"

// The two teams side by side, one number per row, the better one in bold.
export function Stats({ match, state }: { match: SetMatch; state: MatchState }) {
  const [first, second] = matchStats(state)
  const rows: [label: string, a: number, b: number][] = [
    ["Sets", first.sets, second.sets],
    ["Games", first.games, second.games],
    // Only known when every point was entered.
    ...(match.scoreBy === "points"
      ? ([
          ["Points", first.points, second.points],
          [match.deuce === "golden" ? "Golden points" : "Deuce games", first.deuceGames, second.deuceGames],
        ] as [string, number, number][])
      : []),
    ["Best run of games", first.bestRun, second.bestRun],
  ]
  return (
    <section className="mt-8">
      <h2 className="mb-3 px-1 text-[1.375rem] type-display">Match stats</h2>
      <div className="overflow-hidden rounded-3xl border-[1.5px] bg-card">
        <div className="flex items-center gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{teamName(match.teams[0])}</span>
          <span className="min-w-0 flex-1 truncate text-right">{teamName(match.teams[1])}</span>
        </div>
        <dl className="divide-y">
          {rows.map(([label, a, b]) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <dd className={`w-12 text-[1.75rem] type-display ${a < b ? "text-muted-foreground" : ""}`}>{a}</dd>
              <dt className="flex-1 text-center text-sm text-muted-foreground">{label}</dt>
              <dd className={`w-12 text-right text-[1.75rem] type-display ${b < a ? "text-muted-foreground" : ""}`}>{b}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
