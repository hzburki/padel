import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { computeStandings, formatPoints, joinNames, winners } from "@/lib/standings"
import { listTournaments } from "@/lib/storage"
import { currentRoundIndex, unscoredMatchCount } from "@/lib/tournament"
import type { Tournament } from "@/lib/types"
import { CourtLines } from "./court-lines"
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

  // The newest unfinished tournament gets the spotlight; the rest are listed.
  const playing = tournaments?.find((t) => !t.finished)
  const others = tournaments?.filter((t) => t !== playing) ?? []
  const open = (t: Tournament) => nav.push({ name: "tournament", id: t.id })

  return (
    <Screen
      title="Padel"
      bare
      footer={
        // With a tournament on, Continue is the lime action and this steps back.
        <Button variant={playing ? "default" : "ball"} size="lg" onClick={() => nav.push({ name: "new" })}>
          <Plus className="size-5" strokeWidth={2.5} />
          New tournament
        </Button>
      }
    >
      {/* New users always see how it works; everyone else can open it. */}
      <Hero howItWorks={tournaments?.length === 0 ? "open" : "collapsible"}>
        {playing && <PlayingNow tournament={playing} onOpen={() => open(playing)} />}
      </Hero>

      {tournaments?.length === 0 && <FirstTournament />}

      {others.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 px-1 text-[1.375rem] type-display">
            {playing ? "Other tournaments" : "Tournaments"}
          </h2>
          <ul className="divide-y overflow-hidden rounded-3xl bg-card border-[1.5px]">
            {others.map((t) => (
              <li key={t.id}>
                <TournamentRow tournament={t} onOpen={() => open(t)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Quiet links at the very end of the page. */}
      <nav className="mt-10 flex justify-center gap-1 text-xs text-muted-foreground/70">
        <button type="button" className="px-2 py-2" onClick={() => nav.push({ name: "legal", page: "terms" })}>
          Terms
        </button>
        <span className="py-2" aria-hidden>
          ·
        </span>
        <button type="button" className="px-2 py-2" onClick={() => nav.push({ name: "legal", page: "privacy" })}>
          Privacy
        </button>
      </nav>
    </Screen>
  )
}

// Court-blue panel at the top, with faint court lines like the share card.
function Hero({ howItWorks, children }: { howItWorks: "open" | "collapsible"; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const showSteps = howItWorks === "open" || expanded

  return (
    <div className="relative -mx-4 overflow-hidden rounded-b-2xl bg-primary px-5 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-6 text-primary-foreground">
      <CourtLines />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="size-7 rounded-full bg-accent shadow-[inset_-4px_-4px_0_rgba(0,0,0,0.12)]" aria-hidden />
          <h1 className="text-[3.25rem] leading-none type-display">Padel</h1>
        </div>
        <p className="mt-2 text-lg text-primary-foreground/75">Hi 👋 Ready for a game?</p>

        {howItWorks === "collapsible" && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 -ml-1 flex items-center gap-1 rounded-sm px-1 py-1.5 text-sm font-semibold text-primary-foreground/90 active:bg-white/10"
          >
            How it works
            <ChevronDown
              className={`size-4 transition-transform duration-300 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
              strokeWidth={2.5}
            />
          </button>
        )}
        {/* Animating grid rows from 0fr to 1fr grows the panel to the steps'
            natural height, pushing the rest of the page down. */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: showSteps ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden" inert={!showSteps}>
            <div className={howItWorks === "open" ? "pt-6" : "pt-3"}>
              <HowItWorks />
            </div>
          </div>
        </div>

        {children && <div className="mt-6">{children}</div>}
      </div>
      {/* A quiet credit tucked into the corner of the court. */}
      <a
        href="https://hzburki.com"
        target="_blank"
        rel="noopener"
        className="absolute right-5 bottom-1 py-1 text-[0.6875rem] text-primary-foreground/45"
      >
        hzburki.com
      </a>
    </div>
  )
}

function PlayingNow({ tournament, onOpen }: { tournament: Tournament; onOpen: () => void }) {
  const total = tournament.rounds.length
  const current = currentRoundIndex(tournament)
  const allScored = unscoredMatchCount(tournament) === 0
  const rows = computeStandings(
    tournament.players.map((p) => p.id),
    tournament.rounds,
  )
  const nameOf = new Map(tournament.players.map((p) => [p.id, p.name]))
  const leaders = winners(rows)
  const leaderPoints = rows[0]?.points ?? 0

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-3xl bg-card p-5 text-left text-card-foreground shadow-lg shadow-black/10 active:scale-[0.99]"
    >
      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
        Playing now
      </span>
      <div className="mt-3 flex items-end gap-3">
        <p className="min-w-0 flex-1 truncate text-[1.75rem] type-display">{tournament.name}</p>
        {/* Scoreboard-style round counter. */}
        <p className="shrink-0 text-primary type-display" aria-label={allScored ? "Every round played" : `Round ${current + 1} of ${total}`}>
          {allScored ? (
            <span className="text-base">All played</span>
          ) : (
            <>
              <span className="text-[1.75rem]">{current + 1}</span>
              <span className="text-lg text-muted-foreground">/{total}</span>
            </>
          )}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(current / total) * 100}%` }} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-sm">
          {leaders.length > 0 ? (
            <>
              <span className="text-muted-foreground">Leading: </span>
              <span className="font-semibold">{joinNames(leaders.map((id) => nameOf.get(id) ?? ""))}</span>
              <span className="text-muted-foreground">, {formatPoints(leaderPoints)} pts</span>
            </>
          ) : (
            <span className="text-muted-foreground">No scores yet</span>
          )}
        </p>
        <span className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-accent pr-3 pl-4 text-accent-foreground shadow-[inset_0_-3px_0_rgb(14_34_64/0.16)] type-label">
          Continue
          <ChevronRight className="size-4" strokeWidth={2.5} />
        </span>
      </div>
    </button>
  )
}

function HowItWorks() {
  const steps = ["Add your players and courts", "Enter scores courtside", "Share the final standings"]
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
            {i + 1}
          </span>
          <span className="font-medium">{step}</span>
        </li>
      ))}
    </ol>
  )
}

// Empty home: a court seen from above, with a ball waiting to be served.
function FirstTournament() {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <svg viewBox="0 0 120 180" className="h-44 text-primary/25" fill="none" stroke="currentColor" aria-hidden>
        <rect x="10" y="5" width="100" height="170" rx="4" strokeWidth="3" className="fill-secondary" />
        <path d="M10 90h100" strokeWidth="4" />
        <path d="M10 31h100M10 149h100M60 31v118" strokeWidth="2" />
        <circle cx="84" cy="122" r="9" className="fill-accent" stroke="none" />
      </svg>
      <p className="mt-5 text-2xl type-display">No tournaments yet</p>
      <p className="mt-1 max-w-64 text-muted-foreground">Tap New tournament below to set up your first one.</p>
    </div>
  )
}

function TournamentRow({ tournament, onOpen }: { tournament: Tournament; onOpen: () => void }) {
  const date = new Date(tournament.createdAt)
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left active:bg-muted">
      <span className="flex size-13 shrink-0 flex-col items-center justify-center rounded-2xl bg-secondary leading-none">
        <span className="text-2xl type-display">{date.getDate()}</span>
        <span className="mt-0.5 text-[0.6875rem] font-medium text-muted-foreground">
          {date.toLocaleDateString(undefined, { month: "short" })}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg type-label">{tournament.name}</span>
        <span className="block truncate text-sm text-muted-foreground">
          <Status tournament={tournament} />
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
    </button>
  )
}

function Status({ tournament }: { tournament: Tournament }) {
  if (tournament.finished) {
    const rows = computeStandings(
      tournament.players.map((p) => p.id),
      tournament.rounds,
      { final: true },
    )
    const nameOf = new Map(tournament.players.map((p) => [p.id, p.name]))
    const won = winners(rows)
    return won.length > 0 ? <>🏆 {joinNames(won.map((id) => nameOf.get(id) ?? ""))}</> : <>Finished</>
  }
  const current = currentRoundIndex(tournament)
  return (
    <>
      Round {Math.min(current + 1, tournament.rounds.length)} of {tournament.rounds.length}, {tournament.players.length}{" "}
      players
    </>
  )
}
