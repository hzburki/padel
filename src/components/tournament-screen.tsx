import { useEffect, useState } from "react"
import { loadTournament } from "@/lib/storage"
import type { Tournament } from "@/lib/types"
import { Screen } from "./screen"

// Read-only schedule for now; score entry comes in the next slice.
export function TournamentScreen({ id }: { id: string }) {
  const [tournament, setTournament] = useState<Tournament | null | undefined>(undefined)

  useEffect(() => {
    loadTournament(id).then(setTournament)
  }, [id])

  if (tournament === undefined) return <Screen title="">{null}</Screen>
  if (tournament === null) {
    return (
      <Screen title="Not found">
        <p className="pt-16 text-center text-muted-foreground">This tournament is no longer on this phone.</p>
      </Screen>
    )
  }

  const nameOf = new Map(tournament.players.map((p) => [p.id, p.name]))
  const team = (ids: string[]) => ids.map((i) => nameOf.get(i)).join(" & ")

  return (
    <Screen title={tournament.name}>
      <ol className="space-y-5 pt-2">
        {tournament.rounds.map((round, r) => (
          <li key={r}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Round {r + 1}</h2>
            <div className="divide-y overflow-hidden rounded-2xl border bg-card">
              {round.matches.map((m) => (
                <div key={m.court} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {m.court}
                  </span>
                  <div className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
                    <p className="truncate">{team(m.teamA)}</p>
                    <p className="truncate text-muted-foreground">v {team(m.teamB)}</p>
                  </div>
                </div>
              ))}
              {round.benched.length > 0 && (
                <p className="px-4 py-2.5 text-sm text-muted-foreground">
                  Sitting out: {round.benched.map((i) => nameOf.get(i)).join(", ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Screen>
  )
}
