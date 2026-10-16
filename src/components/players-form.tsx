import { UserMinus, UserPlus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  addPlayerProblems,
  cannotChangePlayers,
  cleanPlayerName,
  MIN_PLAYERS,
  removePlayerProblems,
  roundsLeftAfterAdd,
  roundsLeftAfterRemove,
  type HowLong,
} from "@/lib/tournament"
import type { Player, PlayerId, Tournament } from "@/lib/types"

// The players of a running tournament, shown in a sheet: remove on each
// player still in, a field to add one. Before either, the organiser picks
// how long to play on, and for a leaver how their points count.
export function PlayersForm({
  tournament,
  onAdd,
  onRemove,
}: {
  tournament: Tournament
  onAdd: (name: string, howLong: HowLong) => void
  onRemove: (id: PlayerId, howLong: HowLong, scaleUp: boolean) => void
}) {
  const [name, setName] = useState("")
  const [howLong, setHowLong] = useState<HowLong>("sameMatches")
  const [leaving, setLeaving] = useState<Player | null>(null)
  const stop = cannotChangePlayers(tournament)

  if (leaving) {
    return (
      <RemoveStep
        tournament={tournament}
        player={leaving}
        onCancel={() => setLeaving(null)}
        onRemove={onRemove}
      />
    )
  }

  const typed = name.trim() !== ""
  const problems = addPlayerProblems(tournament, name)
  // Remove is not offered once only the fewest that can play are left.
  const canRemove = !stop && tournament.players.filter((p) => !p.left).length > MIN_PLAYERS

  return (
    <form
      data-fits
      onSubmit={(e) => {
        e.preventDefault()
        if (problems.length === 0) onAdd(name, howLong)
      }}
    >
      <p className="text-2xl type-display">Players</p>
      {!stop && (
        <p className="mt-1 text-muted-foreground">
          {canRemove ? (
            <>
              Add someone below, or tap <UserMinus aria-label="remove" className="inline size-4.5 align-[-3px] text-destructive" /> to
              remove them.
            </>
          ) : (
            "Add someone below."
          )}
        </p>
      )}

      <ul className="mt-4 divide-y overflow-hidden rounded-3xl border-[1.5px] bg-card">
        {tournament.players.map((p) => (
          <li key={p.id} className="flex min-h-13 items-center gap-2 pl-4 font-medium">
            <span className={`truncate ${p.left ? "text-muted-foreground" : ""}`}>{p.name}</span>
            {p.left && <LeftBadge />}
            {!p.left && canRemove && (
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => setLeaving(p)}
                className="ml-auto flex size-13 shrink-0 items-center justify-center text-destructive active:bg-muted"
              >
                <UserMinus className="size-5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {stop ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">{stop}</p>
      ) : (
        <>
          <label className="mt-5 mb-2 block px-1 text-sm font-semibold text-muted-foreground" htmlFor="new-player">
            Add a player
          </label>
          <Input
            id="new-player"
            value={name}
            placeholder="Name"
            onChange={(e) => setName(e.target.value)}
            autoCapitalize="words"
            enterKeyHint="done"
            aria-invalid={typed && problems.length > 0}
          />
          {typed && problems.length > 0 && (
            <p role="alert" className="mt-1.5 px-1 text-sm font-medium text-destructive">
              {problems[0]}
            </p>
          )}

          {typed && (
            <Choice
              question="How long to play?"
              value={howLong}
              onChange={setHowLong}
              options={[
                { value: "sameTime", label: "Same time", rounds: roundsLeftAfterAdd(tournament, "sameTime") },
                { value: "sameMatches", label: "Same matches", rounds: roundsLeftAfterAdd(tournament, "sameMatches") },
              ]}
            />
          )}

          <Button type="submit" size="lg" className="mt-4" disabled={problems.length > 0}>
            <UserPlus className="size-5" />
            {typed ? `Add ${cleanPlayerName(name)}` : "Add"}
          </Button>
        </>
      )}
    </form>
  )
}

// Asks how long to play on and how the leaver's points count, then removes.
function RemoveStep({
  tournament,
  player,
  onCancel,
  onRemove,
}: {
  tournament: Tournament
  player: Player
  onCancel: () => void
  onRemove: (id: PlayerId, howLong: HowLong, scaleUp: boolean) => void
}) {
  const [howLong, setHowLong] = useState<HowLong>("sameMatches")
  const [scaleUp, setScaleUp] = useState(true)
  const problems = removePlayerProblems(tournament, player.id)

  return (
    <div>
      <p className="text-2xl type-display">Remove {player.name}?</p>
      <p className="mt-1 text-muted-foreground">Their scores stay. Back later? They start from 0.</p>

      {problems.length > 0 ? (
        <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {problems[0]}
        </p>
      ) : (
        <>
          <Choice
            question="How long to play?"
            value={howLong}
            onChange={setHowLong}
            options={[
              { value: "sameTime", label: "Same time", rounds: roundsLeftAfterRemove(tournament, player.id, "sameTime") },
              {
                value: "sameMatches",
                label: "Same matches",
                rounds: roundsLeftAfterRemove(tournament, player.id, "sameMatches"),
              },
            ]}
          />
          <Choice
            question="Their points?"
            value={scaleUp ? "scaleUp" : "asScored"}
            onChange={(v) => setScaleUp(v === "scaleUp")}
            options={[
              { value: "scaleUp", label: "Scale up" },
              { value: "asScored", label: "Keep as scored" },
            ]}
          />
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="ghost" size="lg" className="px-3" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="lg"
          className="px-3"
          disabled={problems.length > 0}
          onClick={() => onRemove(player.id, howLong, scaleUp)}
        >
          Remove
        </Button>
      </div>
    </div>
  )
}

// Two options side by side, each a card; with `rounds`, the card shows the
// rounds that would be left.
function Choice<T extends string>({
  question,
  value,
  onChange,
  options,
}: {
  question: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; rounds?: number }[]
}) {
  return (
    <>
      <p className="mt-5 mb-2 px-1 text-sm font-semibold text-muted-foreground">{question}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className="rounded-2xl border-[1.5px] bg-card px-4 py-3 text-left aria-pressed:border-primary aria-pressed:shadow-[inset_0_0_0_1px_var(--primary)]"
          >
            <span className="block text-sm font-semibold">{o.label}</span>
            {o.rounds !== undefined && (
              <>
                <span className="mt-1 block text-[1.75rem] leading-none type-display">{o.rounds}</span>
                <span className="block text-sm text-muted-foreground">{o.rounds === 1 ? "round left" : "rounds left"}</span>
              </>
            )}
          </button>
        ))}
      </div>
    </>
  )
}

// Marks a player who was removed mid game.
export function LeftBadge() {
  return (
    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.6875rem] leading-none font-semibold text-muted-foreground">
      left
    </span>
  )
}
