import { ChevronDown, Ellipsis, Pencil, Repeat, Share, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { computeStandings, winners } from "@/lib/standings"
import { deleteTournament, loadTournament, saveTournament } from "@/lib/storage"
import { currentRoundIndex, renameTournament, setScore, unscoredMatchCount } from "@/lib/tournament"
import type { Match, PlayerId, Score, Tournament } from "@/lib/types"
import { Screen } from "./screen"
import { ScoreEntry } from "./score-entry"
import { Congrats } from "./congrats"
import { RenameForm } from "./rename-form"
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
  // Which sheet (other than score entry) is open.
  const [confirm, setConfirm] = useState<"menu" | "rename" | "finish" | "delete" | "congrats" | null>(null)
  // The full card to share, and a top-three preview for the screen.
  const [image, setImage] = useState<{ blob: Blob; previewUrl: string } | null>(null)
  // The last opened match, kept after closing so the sheet still has
  // content while it slides away.
  const [shown, setShown] = useState<Editing | null>(null)
  const fullStandings = useRef<HTMLHeadingElement>(null)

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
      { final: true },
    )
    Promise.all([renderShareCard(tournament, rows), renderShareCard(tournament, rows, { podiumOnly: true })]).then(
      ([blob, preview]) => {
        if (cancelled) return
        url = URL.createObjectURL(preview)
        setImage({ blob, previewUrl: url })
      },
    )
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
    setConfirm("congrats")
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

  const playAgain = () =>
    nav.push({
      name: "new",
      from: {
        playerNames: tournament.players.map((p) => p.name),
        courts: tournament.courts,
        target: tournament.target,
        scoringMode: tournament.scoringMode,
      },
    })

  const footer = tournament.finished ? (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" size="lg" className="px-3" onClick={playAgain}>
        <Repeat className="size-5" />
        Play again
      </Button>
      <Button variant="ball" size="lg" className="px-3" disabled={!image} onClick={share}>
        <Share className="size-5" />
        Share
      </Button>
    </div>
  ) : tab === "standings" || unscored === 0 ? (
    <Button
      size="lg"
      variant={unscored === 0 ? "ball" : "secondary"}
      onClick={() => setConfirm("finish")}
    >
      Finish tournament
    </Button>
  ) : undefined

  return (
    <Screen
      title={tournament.name}
      // A tournament always opens straight from home, so back is home; once
      // it's finished, say so with a home icon.
      homeButton={tournament.finished}
      toolbar={<Tabs tab={tab} onChange={setTab} />}
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
      footer={footer}
    >
      {saveError && (
        <p className="mt-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          The last score couldn't be saved on this phone. It's still shown here; enter it again to retry.
        </p>
      )}
      {tab === "rounds" ? (
        <RoundsList
          tournament={tournament}
          locked={tournament.finished}
          team={team}
          onEdit={(round, court) => {
            setEditing({ round, court })
            setShown({ round, court })
          }}
        />
      ) : (
        <div className="pt-4">
          {tournament.finished && (
            <div className="mb-6">
              <div className="min-h-48 overflow-hidden rounded-3xl bg-primary">
                {image && <img src={image.previewUrl} alt="Top three" className="block w-full" />}
              </div>
              {/* The card can fill a small screen; make it obvious there's more below. */}
              <button
                type="button"
                onClick={() => fullStandings.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="mx-auto mt-2 flex items-center gap-1 py-2 text-sm font-medium text-primary"
              >
                Full standings
                <ChevronDown className="size-4" />
              </button>
            </div>
          )}
          <h2 ref={fullStandings} className="mb-3 scroll-mt-2 px-1 text-[1.375rem] type-display">
            {tournament.finished ? "Full standings" : "Standings so far"}
          </h2>
          <StandingsTable
            rows={computeStandings(
              tournament.players.map((p) => p.id),
              tournament.rounds,
              { final: tournament.finished || unscored === 0 },
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

      <Sheet open={confirm === "menu"} onClose={() => setConfirm(null)}>
        <div className="divide-y overflow-hidden rounded-3xl bg-card border-[1.5px]">
          <button
            type="button"
            onClick={() => setConfirm("rename")}
            className="flex w-full items-center gap-3 px-4 py-4 text-left font-medium active:bg-muted"
          >
            <Pencil className="size-5 text-primary" />
            Edit names
          </button>
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            className="flex w-full items-center gap-3 px-4 py-4 text-left font-medium text-destructive active:bg-muted"
          >
            <Trash2 className="size-5" />
            Delete tournament
          </button>
        </div>
      </Sheet>

      <Sheet open={confirm === "rename"} onClose={() => setConfirm(null)}>
        {confirm === "rename" && (
          <RenameForm
            tournament={tournament}
            onSave={(name, playerNames) => {
              setConfirm(null)
              update(renameTournament(tournament, name, playerNames))
            }}
          />
        )}
      </Sheet>

      <Sheet open={confirm === "finish"} onClose={() => setConfirm(null)}>
        <p className="text-2xl type-display">Finish the tournament?</p>
        <p className="mt-1 text-muted-foreground">
          Scores can't be changed once a tournament is finished.
          {unscored > 0 &&
            ` ${unscored} ${unscored === 1 ? "match still has" : "matches still have"} no score; anyone left with fewer games gets their points scaled up.`}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" className="px-3" onClick={() => setConfirm(null)}>
            Keep playing
          </Button>
          <Button size="lg" className="px-3" onClick={finish}>
            Finish
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirm === "congrats"} onClose={() => setConfirm(null)}>
        <Congrats
          winnerNames={winners(
            computeStandings(
              tournament.players.map((p) => p.id),
              tournament.rounds,
              { final: true },
            ),
          ).map((id) => nameOf.get(id) ?? "")}
          canShare={image !== null}
          onShare={share}
          onClose={() => setConfirm(null)}
        />
      </Sheet>

      <Sheet open={confirm === "delete"} onClose={() => setConfirm(null)}>
        <p className="text-2xl type-display">Delete {tournament.name}?</p>
        <p className="mt-1 text-muted-foreground">The schedule and every score will be removed from this phone.</p>
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

// Underline tabs, so they don't look like the scoring switch on setup.
function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="relative grid grid-cols-2 shadow-[inset_0_-1.5px_0_var(--border)]">
      <span
        aria-hidden
        className="absolute bottom-0 left-0 flex h-1 w-1/2 justify-center transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ transform: tab === "standings" ? "translateX(100%)" : undefined }}
      >
        <span className="h-full w-16 rounded-full bg-foreground" />
      </span>
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
          className="h-12 text-lg text-muted-foreground transition-colors type-label aria-pressed:text-foreground"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function RoundsList({
  tournament,
  locked,
  team,
  onEdit,
}: {
  tournament: Tournament
  locked: boolean // finished: scores are read-only
  team: (ids: PlayerId[]) => string
  onEdit: (round: number, court: number) => void
}) {
  const current = locked ? -1 : currentRoundIndex(tournament)
  const currentRef = useRef<HTMLLIElement>(null)
  const nameOf = new Map(tournament.players.map((p) => [p.id, p.name]))

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
              />
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
  onTap?: () => void // missing when the tournament is finished
}) {
  const s = match.score
  const aWon = s !== null && s.a > s.b
  const bWon = s !== null && s.b > s.a
  const Row = onTap ? "button" : "div"

  return (
    <Row
      {...(onTap ? { type: "button" as const, onClick: onTap } : {})}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${onTap ? "active:bg-muted" : ""}`}
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
            <span className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <Pencil className="size-4" aria-label="Edit score" />
            </span>
          )}
        </>
      ) : onTap ? (
        <span
          className={`flex h-11 shrink-0 items-center rounded-xl px-4 type-label ${
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
