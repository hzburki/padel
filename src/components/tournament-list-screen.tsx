import { ChevronRight, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { listTournaments } from "@/lib/storage"
import { currentRoundIndex } from "@/lib/tournament"
import type { Tournament } from "@/lib/types"
import { Screen } from "./screen"
import { useIsTopScreen, useNav } from "./stack-navigator"

export function TournamentListScreen() {
  const nav = useNav<Route>()
  const isTop = useIsTopScreen()
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null)

  // Reload whenever this screen comes back into view, so a tournament just
  // created or scored shows up to date.
  useEffect(() => {
    if (isTop) listTournaments().then(setTournaments)
  }, [isTop])

  return (
    <Screen
      title="Padel"
      large
      footer={
        <Button size="lg" className="h-14 w-full rounded-2xl text-base" onClick={() => nav.push({ name: "new" })}>
          <Plus className="size-5" strokeWidth={2.5} />
          New tournament
        </Button>
      }
    >
      {tournaments?.length === 0 && (
        <div className="pt-16 text-center">
          <p className="text-lg font-semibold">No tournaments yet</p>
          <p className="mx-auto mt-1 max-w-64 text-muted-foreground">
            Add your players and the whole schedule is made for you.
          </p>
        </div>
      )}

      {tournaments && tournaments.length > 0 && (
        <ul className="mt-2 divide-y overflow-hidden rounded-2xl border bg-card">
          {tournaments.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => nav.push({ name: "tournament", id: t.id })}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.players.length} players, {t.courts} {t.courts === 1 ? "court" : "courts"}
                  </p>
                </div>
                <Progress tournament={t} />
                <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}

function Progress({ tournament }: { tournament: Tournament }) {
  const current = currentRoundIndex(tournament)
  const total = tournament.rounds.length
  if (tournament.finished || current === total) {
    return <span className="shrink-0 text-sm text-muted-foreground">Finished</span>
  }
  return (
    <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-sm font-medium text-accent-foreground">
      Round {current + 1} of {total}
    </span>
  )
}
