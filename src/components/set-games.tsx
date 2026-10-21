import { gameSummary, teamName, type SetState } from "@/lib/set-match"
import type { SetMatch } from "@/lib/types"

// One set's games. While it is being played the newest is on top; once the
// match is over they read in order, with the set score beside the title.
export function SetGames({
  match,
  set,
  number,
  newestFirst = false,
}: {
  match: SetMatch
  set: SetState
  number: number
  newestFirst?: boolean
}) {
  const games = set.played.map((game, i) => ({ game, number: i + 1 }))
  if (newestFirst) games.reverse()
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-baseline gap-2 px-1 text-[1.375rem] type-display">
        <span className="flex-1">{newestFirst ? `Set ${number} games` : `Set ${number}`}</span>
        {set.winner !== null && (
          <span className="text-primary">
            {set.games[0]}–{set.games[1]}
          </span>
        )}
      </h2>
      {games.length === 0 ? (
        <p className="px-1 text-muted-foreground">No game finished yet in this set.</p>
      ) : (
        <ol className="divide-y overflow-hidden rounded-3xl border-[1.5px] bg-card">
          {games.map(({ game, number }) => (
            <li key={number} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xl text-primary type-display">
                {number}
              </span>
              <span className="min-w-0 flex-1 truncate text-[1.0625rem] type-label">{teamName(match.teams[game.winner])}</span>
              <span className="shrink-0 text-sm text-muted-foreground">{gameSummary(game)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
