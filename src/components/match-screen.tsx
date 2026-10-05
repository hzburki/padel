import { Ellipsis, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { pointLabels, replay, type MatchState } from "@/lib/set-match"
import { deleteTournament, loadTournament } from "@/lib/storage"
import type { SetMatch, Side } from "@/lib/types"
import { Screen } from "./screen"
import { Sheet } from "./sheet"
import { useNav } from "./stack-navigator"

export function MatchScreen({ id }: { id: string }) {
  const nav = useNav<Route>()
  const [match, setMatch] = useState<SetMatch | null | undefined>(undefined)
  // Which sheet is open.
  const [confirm, setConfirm] = useState<"menu" | "delete" | null>(null)

  useEffect(() => {
    // A tournament has its own screen; here it counts as not found.
    loadTournament(id).then((saved) => setMatch(saved?.kind === "match" ? saved : null))
  }, [id])

  if (match === undefined) return <Screen title="">{null}</Screen>
  if (match === null) {
    return (
      <Screen title="Not found">
        <p className="pt-16 text-center text-muted-foreground">This match is no longer on this phone.</p>
      </Screen>
    )
  }

  const state = replay(match, match.points)

  const remove = async () => {
    setConfirm(null)
    await deleteTournament(match.id)
    nav.back()
  }

  return (
    <Screen
      title={match.name}
      action={
        <button
          type="button"
          aria-label="More"
          onClick={() => setConfirm("menu")}
          className="flex size-11 items-center justify-center rounded-full text-primary active:bg-muted"
        >
          <Ellipsis className="size-6" />
        </button>
      }
    >
      <div className="pt-2">
        <Scoreboard match={match} state={state} />
      </div>

      <Sheet open={confirm === "menu"} onClose={() => setConfirm(null)}>
        <div className="divide-y overflow-hidden rounded-3xl bg-card border-[1.5px]">
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            className="flex w-full items-center gap-3 px-4 py-4 text-left font-medium text-destructive active:bg-muted"
          >
            <Trash2 className="size-5" />
            Delete match
          </button>
        </div>
      </Sheet>

      <Sheet open={confirm === "delete"} onClose={() => setConfirm(null)}>
        <p className="text-2xl type-display">Delete {match.name}?</p>
        <p className="mt-1 text-muted-foreground">Every point will be removed from this phone.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" className="px-3" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button variant="destructive" size="lg" className="px-3" onClick={remove}>
            Delete
          </Button>
        </div>
      </Sheet>
    </Screen>
  )
}

// Like a TV scoreboard: one row per team, a column of games per set, and
// the points of the game in progress on the right.
function Scoreboard({ match, state }: { match: SetMatch; state: MatchState }) {
  const points = pointLabels(state)
  const live = state.winner === null && !match.finished
  return (
    <div className="overflow-hidden rounded-3xl border-[1.5px] bg-card">
      <div className="flex items-center gap-1 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
        <span className="flex-1">{state.current.tiebreak ? "Tie-break" : `Set ${state.sets.length}`}</span>
        {state.sets.map((_, i) => (
          <span key={i} className="w-7 text-center">
            S{i + 1}
          </span>
        ))}
        {live && <span className="ml-2 w-14 text-center">Points</span>}
      </div>
      <div className="divide-y">
        {([0, 1] as const).map((side: Side) => (
          <div key={side} className="flex items-center gap-1 px-4 py-3">
            <span className="min-w-0 flex-1 text-lg leading-tight type-label">
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
            {live && (
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
