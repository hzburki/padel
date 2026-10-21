import { pointLabels, type MatchState } from "@/lib/set-match"
import type { SetMatch, Side } from "@/lib/types"

// Like a TV scoreboard: one row per team, a column of games per set, and
// the points of the game in progress on the right. A match scored by games
// has no points to show.
export function Scoreboard({ match, state }: { match: SetMatch; state: MatchState }) {
  const points = pointLabels(state)
  const live = state.winner === null
  const showPoints = live && match.scoreBy === "points"
  return (
    <div className="overflow-hidden rounded-3xl border-[1.5px] bg-card">
      <div className="flex items-center gap-1 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
        <span className="flex-1">
          {!live ? "Final score" : state.current.tiebreak ? "Tie-break" : `Set ${state.sets.length}`}
        </span>
        {state.sets.map((_, i) => (
          <span key={i} className="w-7 text-center">
            S{i + 1}
          </span>
        ))}
        {showPoints && <span className="ml-2 w-14 text-center">Points</span>}
      </div>
      <div className="divide-y">
        {([0, 1] as const).map((side: Side) => (
          <div key={side} className="flex items-center gap-1 px-4 py-3">
            <span
              className={`min-w-0 flex-1 text-lg leading-tight type-label ${
                !live && state.winner !== side ? "text-muted-foreground" : ""
              }`}
            >
              <span className="block truncate">{match.teams[side][0]}</span>
              <span className="block truncate">{match.teams[side][1]}</span>
            </span>
            {state.sets.map((set, i) => (
              <span
                key={i}
                className={`w-7 text-center text-[1.75rem] type-display ${
                  set.winner !== null && set.winner !== side ? "text-muted-foreground" : ""
                }`}
              >
                {set.games[side]}
              </span>
            ))}
            {showPoints && (
              <span className="ml-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-[1.75rem] text-primary-foreground type-display">
                {points[side]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
