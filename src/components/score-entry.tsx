import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { isValidScore } from "@/lib/scoring"
import type { Match, Score, ScoringMode } from "@/lib/types"

type Side = "a" | "b"

// Score entry for one match, shown in a sheet. One tap on the number grid
// fills in a score; the rules for what's valid come from scoring.ts.
//   total: tap one team's points, the other team gets the rest.
//   firstTo: pick the team that reached the target, then the other's points.
export function ScoreEntry({
  match,
  teamName,
  target,
  mode,
  onSave,
  onClear,
}: {
  match: Match
  teamName: (side: Side) => string
  target: number
  mode: ScoringMode
  onSave: (score: Score) => void
  onClear: () => void
}) {
  const [score, setScore] = useState<{ a: number | null; b: number | null }>(
    match.score ?? { a: null, b: null },
  )
  // Which team the number grid is filling in.
  const [side, setSide] = useState<Side>(() => {
    if (mode === "firstTo" && match.score) return match.score.a === target ? "b" : "a"
    return "a"
  })
  const winner: Side | null =
    mode === "firstTo" ? (score.a === target ? "a" : score.b === target ? "b" : null) : null
  const other = (s: Side): Side => (s === "a" ? "b" : "a")

  const pick = (n: number) => {
    if (mode === "total") setScore(side === "a" ? { a: n, b: target - n } : { a: target - n, b: n })
    else setScore({ ...score, [side]: n })
  }

  const pickWinner = (s: Side) => {
    const loser = other(s)
    const kept = score[loser] !== null && score[loser] < target ? score[loser] : null
    setScore(s === "a" ? { a: target, b: kept } : { a: kept, b: target })
    setSide(loser)
  }

  const complete = score.a !== null && score.b !== null ? (score as Score) : null
  const valid = complete !== null && isValidScore(complete, target, mode)
  const max = mode === "total" ? target : target - 1
  const gridDisabled = mode === "firstTo" && winner === null

  return (
    <div>
      <p className="px-1 text-lg font-semibold">{match.score ? "Edit score" : "Enter score"}</p>
      <p className="px-1 text-sm text-muted-foreground">Court {match.court}</p>

      {mode === "firstTo" && <Step n={1} done={winner !== null}>Who won? Tap the team that reached {target}</Step>}
      <div className="mt-2 overflow-hidden rounded-lg border bg-card">
        {(["a", "b"] as const).map((s) => {
          const active = mode === "total" ? side === s : winner !== null && side === s
          const won = winner === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => (mode === "total" ? setSide(s) : pickWinner(s))}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left not-first:border-t ${active ? "bg-secondary" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{teamName(s)}</span>
                {mode === "firstTo" && (
                  <span className={`text-sm ${won ? "font-medium text-primary" : "text-muted-foreground"}`}>
                    {won ? `Won, ${target} points` : winner === null ? `Tap to give them ${target}` : "Lost"}
                  </span>
                )}
              </span>
              {mode === "firstTo" && winner === null ? (
                // Before a winner is picked: show what tapping does.
                <span className="flex h-12 min-w-14 items-center justify-center rounded-md border-2 border-dashed border-primary/40 px-2 text-xl font-bold text-primary/70">
                  {target}
                </span>
              ) : (
                <span
                  className={`flex h-12 min-w-14 items-center justify-center rounded-md px-2 text-3xl font-bold ${
                    active ? "bg-primary text-primary-foreground" : won ? "bg-accent text-accent-foreground" : "bg-muted"
                  }`}
                >
                  {score[s] ?? "–"}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {mode === "firstTo" ? (
        <Step n={2} done={valid} dim={winner === null}>
          {winner === null ? "Then the other team's points" : `Points for ${teamName(side)}`}
        </Step>
      ) : (
        <p className="mt-4 mb-2 px-1 text-sm text-muted-foreground">Points for {teamName(side)}</p>
      )}
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: max + 1 }, (_, n) => (
          <button
            key={n}
            type="button"
            disabled={gridDisabled}
            onClick={() => pick(n)}
            className={`h-12 rounded-md text-lg font-semibold active:scale-95 disabled:opacity-30 ${
              score[side] === n && !gridDisabled ? "bg-primary text-primary-foreground" : "bg-card border"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <Button
        size="lg"
        className="mt-4 h-14 w-full rounded-md text-base font-semibold"
        disabled={!valid}
        onClick={() => complete && onSave(complete)}
      >
        Save score
      </Button>
      {match.score && (
        <Button variant="ghost" className="mt-1 h-12 w-full text-destructive" onClick={onClear}>
          Clear score
        </Button>
      )}
    </div>
  )
}

// Numbered instruction for first-to scoring, ticked off as it's done.
function Step({ n, done, dim = false, children }: { n: number; done: boolean; dim?: boolean; children: ReactNode }) {
  return (
    <p className={`mt-4 mb-2 flex items-center gap-2 px-1 text-sm font-medium ${dim ? "text-muted-foreground/60" : ""}`}>
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {children}
    </p>
  )
}
