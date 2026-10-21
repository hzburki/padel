import { Pencil } from "lucide-react"
import { useEffect, useRef } from "react"
import { currentRoundIndex } from "@/lib/tournament"
import type { Match, PlayerId, Tournament } from "@/lib/types"
import { LiveBadge } from "./live-badge"

// Every round of a tournament, one card per round, opening on the round
// being played. Tapping a match opens its score entry.
export function RoundsList({
  tournament,
  locked,
  disabled,
  live,
  nameOf,
  team,
  onEdit,
}: {
  tournament: Tournament
  live: boolean // scores are still being sent: the round being played says so
  locked: boolean // finished or being watched: scores are read-only
  disabled: boolean // scored online, with no connection: greyed out until it is back
  nameOf: Map<PlayerId, string>
  team: (ids: PlayerId[]) => string
  onEdit: (round: number, court: number) => void
}) {
  const current = tournament.finished ? -1 : currentRoundIndex(tournament)
  const currentRef = useRef<HTMLLIElement>(null)
  // With every round scored the last one carries the badge: scores can
  // still change until the tournament is finished.
  const liveRound = Math.min(current, tournament.rounds.length - 1)

  // Open on the round being played, not round 1.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "start" })
  }, [])

  return (
    <ol className="space-y-7 pt-4">
      {tournament.rounds.map((round, r) => (
        <li key={r} ref={r === current ? currentRef : undefined} className="scroll-mt-2">
          <div className="mb-2.5 flex items-center gap-2.5 px-1">
            <h2 className={`text-[1.375rem] type-display ${r === current ? "" : "text-muted-foreground"}`}>Round {r + 1}</h2>
            {r === current && (
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">Playing now</span>
            )}
          </div>
          <div className="relative">
            {live && r === liveRound && <LiveBadge />}
            <div
              className={`divide-y overflow-hidden rounded-3xl bg-card ${
                r === current ? "border-2 border-foreground" : "border-[1.5px]"
              }`}
            >
              {round.matches.map((m) => (
                <MatchRow
                  key={m.court}
                  match={m}
                  team={team}
                  current={r === current}
                  onTap={locked ? undefined : () => onEdit(r, m.court)}
                  disabled={disabled}
                />
              ))}
              {round.benched.length > 0 && (
                <p className="px-4 py-2.5 text-sm text-muted-foreground">
                  Sitting out: {round.benched.map((i) => nameOf.get(i)).join(", ")}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function MatchRow({
  match,
  team,
  current,
  onTap,
  disabled,
}: {
  match: Match
  team: (ids: PlayerId[]) => string
  current: boolean
  onTap?: () => void // missing when the tournament is finished or being watched
  disabled: boolean // the score can't be entered right now: its button is greyed out
}) {
  const s = match.score
  const aWon = s !== null && s.a > s.b
  const bWon = s !== null && s.b > s.a
  const Row = onTap ? "button" : "div"

  return (
    <Row
      {...(onTap ? { type: "button" as const, onClick: onTap, disabled } : {})}
      className={`group flex w-full items-center gap-3 px-4 py-3.5 text-left ${onTap ? "active:bg-muted" : ""}`}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground type-display"
        aria-label={`Court ${match.court}`}
      >
        {match.court}
      </span>
      <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
        <span className={`block truncate ${aWon ? "font-bold" : s ? "text-muted-foreground" : "font-medium"}`}>
          {team(match.teamA)}
        </span>
        <span className={`block truncate ${bWon ? "font-bold" : "text-muted-foreground"}`}>
          {team(match.teamB)}
        </span>
      </span>
      {s ? (
        <>
          <span className="flex shrink-0 flex-col items-end text-[1.625rem] leading-[1.1] type-display">
            <span className={aWon ? "" : "text-muted-foreground"}>{s.a}</span>
            <span className={bWon ? "" : "text-muted-foreground"}>{s.b}</span>
          </span>
          {/* Saved scores stay editable until the tournament is finished. */}
          {onTap && (
            <span className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary group-disabled:opacity-40">
              <Pencil className="size-4" aria-label="Edit score" />
            </span>
          )}
        </>
      ) : onTap ? (
        <span
          className={`flex h-11 shrink-0 items-center rounded-xl px-4 type-label group-disabled:opacity-40 ${
            current
              ? "bg-accent text-accent-foreground shadow-[inset_0_-3px_0_rgb(14_34_64/0.16)]"
              : "bg-secondary text-primary/70"
          }`}
        >
          Score
        </span>
      ) : (
        <span className="shrink-0 text-sm text-muted-foreground">Not played</span>
      )}
    </Row>
  )
}
