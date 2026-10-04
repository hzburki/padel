import { Share, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { computeStandings } from "@/lib/standings"
import { deleteTournament, loadTournament, saveTournament } from "@/lib/storage"
import { currentRoundIndex, setScore, unscoredMatchCount } from "@/lib/tournament"
import type { Match, PlayerId, Score, Tournament } from "@/lib/types"
import { Screen } from "./screen"
import { ScoreEntry } from "./score-entry"
import { renderShareCard, shareOrDownload } from "./share-card"
import { Sheet } from "./sheet"
import { useNav } from "./stack-navigator"
import { StandingsTable } from "./standings-table"

type Tab = "rounds" | "standings"
type Editing = { round: number; court: number }

export function TournamentScreen({ id }: { id: string }) {
  const nav = useNav<Route>()
  const [tournament, setTournament] = useState<Tournament | null | undefined>(undefined)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [tab, setTab] = useState<Tab>("rounds")
  const [confirm, setConfirm] = useState<"finish" | "delete" | null>(null)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  // The last opened match, kept after closing so the sheet still has
  // content while it slides away.
  const [shown, setShown] = useState<Editing | null>(null)

  useEffect(() => {
    loadTournament(id).then((t) => {
      setTournament(t)
      if (t?.finished) setTab("standings")
    })
  }, [id])

  // Render the share image ahead of time, so the Share tap can hand it to
  // the share sheet immediately (iOS only allows that during the tap).
  useEffect(() => {
    if (!tournament?.finished) return
    let url = ""
    let cancelled = false
    const rows = computeStandings(
      tournament.players.map((p) => p.id),
      tournament.rounds,
    )
    renderShareCard(tournament, rows).then((blob) => {
      if (cancelled) return
      url = URL.createObjectURL(blob)
      setImage({ blob, url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
      setImage(null)
    }
  }, [tournament])

  if (tournament === undefined) return <Screen title="">{null}</Screen>
  if (tournament === null) {
    return (
      <Screen title="Not found">
        <p className="pt-16 text-center text-muted-foreground">This tournament is no longer on this phone.</p>
      </Screen>
    )
  }

  const nameOf = new Map(tournament.players.map((p) => [p.id, p.name]))
  const team = (ids: PlayerId[]) => ids.map((i) => nameOf.get(i)).join(" & ")
  const unscored = unscoredMatchCount(tournament)

  // Save straight away: the phone may be locked or the tab killed any moment.
  const update = async (next: Tournament) => {
    setTournament(next)
    try {
      await saveTournament(next)
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }

  const saveScore = (score: Score | null) => {
    if (!editing) return
    update(setScore(tournament, editing.round, editing.court, score))
    setEditing(null)
  }

  const finish = () => {
    setConfirm(null)
    setTab("standings")
    update({ ...tournament, finished: true })
  }

  const remove = async () => {
    setConfirm(null)
    await deleteTournament(tournament.id)
    nav.back()
  }

  const share = () => {
    if (!image) return
    const filename = `${tournament.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "padel"}.png`
    shareOrDownload(image.blob, filename, tournament.name)
  }

  const shownMatch = shown && tournament.rounds[shown.round]?.matches.find((m) => m.court === shown.court)

  const footer = tournament.finished ? (
    <Button size="lg" className="h-14 w-full rounded-2xl text-base" disabled={!image} onClick={share}>
      <Share className="size-5" />
      Share results
    </Button>
  ) : tab === "standings" || unscored === 0 ? (
    <Button
      size="lg"
      variant={unscored === 0 ? "default" : "secondary"}
      className="h-14 w-full rounded-2xl text-base"
      onClick={() => (unscored === 0 ? finish() : setConfirm("finish"))}
    >
      Finish tournament
    </Button>
  ) : undefined

  return (
    <Screen
      title={tournament.name}
      toolbar={<Tabs tab={tab} onChange={setTab} />}
      action={
        <button
          type="button"
          aria-label="Delete tournament"
          onClick={() => setConfirm("delete")}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        >
          <Trash2 className="size-5" />
        </button>
      }
      footer={footer}
    >
      {saveError && (
        <p className="mt-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          The last score couldn't be saved on this phone. It's still shown here; enter it again to retry.
        </p>
      )}
      {tab === "rounds" ? (
        <RoundsList tournament={tournament} team={team} onEdit={(round, court) => {
            setEditing({ round, court })
            setShown({ round, court })
          }}
        />
      ) : (
        <div className="pt-2">
          {tournament.finished && (
            <div className="mb-4">
              <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-primary">
                {image && <img src={image.url} alt="Final standings card" className="size-full" />}
              </div>
              <button
                type="button"
                className="mt-2 w-full py-2 text-sm font-medium text-primary"
                onClick={() => update({ ...tournament, finished: false })}
              >
                Reopen tournament
              </button>
            </div>
          )}
          <StandingsTable
            rows={computeStandings(
              tournament.players.map((p) => p.id),
              tournament.rounds,
            )}
            nameOf={nameOf}
          />
        </div>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)}>
        {shown && shownMatch && (
          <ScoreEntry
            key={`${shown.round}-${shown.court}`}
            match={shownMatch}
            teamName={(s) => team(s === "a" ? shownMatch.teamA : shownMatch.teamB)}
            target={tournament.target}
            mode={tournament.scoringMode}
            onSave={saveScore}
            onClear={() => saveScore(null)}
          />
        )}
      </Sheet>

      <Sheet open={confirm === "finish"} onClose={() => setConfirm(null)}>
        <p className="text-lg font-semibold">
          {unscored} {unscored === 1 ? "match has" : "matches have"} no score
        </p>
        <p className="mt-1 text-muted-foreground">Final standings will only count the scores entered so far.</p>
        <Button size="lg" className="mt-5 h-14 w-full rounded-2xl text-base" onClick={finish}>
          Finish anyway
        </Button>
        <Button variant="ghost" className="mt-1 h-12 w-full" onClick={() => setConfirm(null)}>
          Keep playing
        </Button>
      </Sheet>

      <Sheet open={confirm === "delete"} onClose={() => setConfirm(null)}>
        <p className="text-lg font-semibold">Delete {tournament.name}?</p>
        <p className="mt-1 text-muted-foreground">The schedule and every score will be removed from this phone.</p>
        <Button variant="destructive" size="lg" className="mt-5 h-14 w-full rounded-2xl text-base" onClick={remove}>
          Delete tournament
        </Button>
        <Button variant="ghost" className="mt-1 h-12 w-full" onClick={() => setConfirm(null)}>
          Cancel
        </Button>
      </Sheet>
    </Screen>
  )
}

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      {(
        [
          ["rounds", "Rounds"],
          ["standings", "Standings"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={tab === value}
          onClick={() => onChange(value)}
          className="h-10 rounded-lg font-medium text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function RoundsList({
  tournament,
  team,
  onEdit,
}: {
  tournament: Tournament
  team: (ids: PlayerId[]) => string
  onEdit: (round: number, court: number) => void
}) {
  const current = currentRoundIndex(tournament)
  const currentRef = useRef<HTMLLIElement>(null)
  const nameOf = new Map(tournament.players.map((p) => [p.id, p.name]))

  // Open on the round being played, not round 1.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "start" })
  }, [])

  return (
    <ol className="space-y-5 pt-2">
      {tournament.rounds.map((round, r) => (
        <li key={r} ref={r === current ? currentRef : undefined} className="scroll-mt-2">
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Round {r + 1}</h2>
            {r === current && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                Playing now
              </span>
            )}
          </div>
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {round.matches.map((m) => (
              <MatchRow key={m.court} match={m} team={team} current={r === current} onTap={() => onEdit(r, m.court)} />
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
  )
}

function MatchRow({
  match,
  team,
  current,
  onTap,
}: {
  match: Match
  team: (ids: PlayerId[]) => string
  current: boolean
  onTap: () => void
}) {
  const s = match.score
  const aWon = s !== null && s.a > s.b
  const bWon = s !== null && s.b > s.a

  return (
    <button type="button" onClick={onTap} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {match.court}
      </span>
      <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
        <span className={`block truncate ${aWon ? "font-semibold" : s ? "text-muted-foreground" : ""}`}>
          {team(match.teamA)}
        </span>
        <span className={`block truncate ${bWon ? "font-semibold" : "text-muted-foreground"}`}>
          {team(match.teamB)}
        </span>
      </span>
      {s ? (
        <span className="flex shrink-0 flex-col items-end text-lg leading-snug font-bold">
          <span className={aWon ? "" : "text-muted-foreground"}>{s.a}</span>
          <span className={bWon ? "" : "text-muted-foreground"}>{s.b}</span>
        </span>
      ) : (
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
            current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          Score
        </span>
      )}
    </button>
  )
}
