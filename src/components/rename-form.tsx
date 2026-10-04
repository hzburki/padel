import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { renameProblems } from "@/lib/tournament"
import type { Tournament } from "@/lib/types"

// Edit the tournament's name and its players' names, shown in a sheet.
// Once the tournament is finished only its own name can change.
export function RenameForm({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (name: string, playerNames: string[]) => void
}) {
  const [name, setName] = useState(tournament.name)
  const [playerNames, setPlayerNames] = useState(tournament.players.map((p) => p.name))
  const problems = renameProblems(tournament, name, playerNames)
  const locked = tournament.finished

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (problems.length === 0) onSave(name, playerNames)
      }}
    >
      <p className="text-lg font-semibold">Edit names</p>

      <label className="mt-4 mb-2 block px-1 text-sm font-semibold text-muted-foreground" htmlFor="tournament-name">
        Tournament
      </label>
      <Input
        id="tournament-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        className="h-12 rounded-md bg-card px-3.5"
      />

      <p className="mt-5 mb-2 px-1 text-sm font-semibold text-muted-foreground">Players</p>
      {locked && (
        <p className="mb-2 px-1 text-sm text-muted-foreground">
          Player names can't be changed once a tournament is finished.
        </p>
      )}
      <div className="space-y-2">
        {playerNames.map((n, i) => (
          <Input
            key={tournament.players[i].id}
            value={n}
            disabled={locked}
            aria-label={`Player ${i + 1}`}
            onChange={(e) => setPlayerNames((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
            autoComplete="off"
            autoCapitalize="words"
            className="h-12 rounded-md bg-card px-3.5"
          />
        ))}
      </div>

      {problems.length > 0 && <p className="mt-4 text-center text-sm text-muted-foreground">{problems[0]}</p>}
      <Button type="submit" size="lg" className="mt-4 h-14 w-full rounded-md text-base font-semibold" disabled={problems.length > 0}>
        Save names
      </Button>
    </form>
  )
}
