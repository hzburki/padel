import { ChevronDown, ChevronRight, MonitorDown, Plus, Podium, Repeat, Smartphone } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { formatSets, replay, teamName } from "@/lib/set-match"
import { previousMatchSetup } from "@/lib/set-match-setup"
import { computeStandings, formatPoints, joinNames, winners } from "@/lib/standings"
import { listTournaments } from "@/lib/storage"
import { currentRoundIndex, previousSetup, unscoredMatchCount } from "@/lib/tournament"
import type { SavedEvent, SetMatch, Tournament } from "@/lib/types"
import { BallIcon } from "./ball-icon"
import { CourtIcon } from "./court-icon"
import { CourtLines } from "./court-lines"
import { canInstall, InstallBanner, InstallHelp, isPhone, useInstallPrompt } from "./install-banner"
import { Screen } from "./screen"
import { SharedTag } from "./shared-tag"
import { Sheet } from "./sheet"
import { useIsTopScreen, useNav } from "./stack-navigator"

export function TournamentListScreen() {
  const nav = useNav<Route>()
  const isTop = useIsTopScreen()
  const [events, setEvents] = useState<SavedEvent[] | null>(null)
  const { install } = useInstallPrompt()
  const [installHelp, setInstallHelp] = useState(false)
  const [filter, setFilter] = useState<"all" | SavedEvent["kind"]>("all")

  // Reload whenever this screen comes back into view, so a game just
  // created or scored shows up to date.
  useEffect(() => {
    if (isTop) listTournaments().then(setEvents)
  }, [isTop])

  // The newest unfinished game gets the spotlight; the rest are listed. A
  // friend's game is never the spotlight: there is nothing to continue.
  const playing = events?.find((e) => !e.finished && !e.shared)
  const others = events?.filter((e) => e !== playing) ?? []
  const listed = others.filter((e) => filter === "all" || e.kind === filter)
  const open = (e: SavedEvent) => nav.push({ name: e.kind === "match" ? "match" : "tournament", id: e.id })

  return (
    <Screen
      title="Padel"
      bare
      footer={
        // With a game on, Continue is the lime action and this steps back.
        <Button variant={playing ? "default" : "ball"} size="lg" onClick={() => nav.push({ name: "new" })}>
          <Plus className="size-5" strokeWidth={2.5} />
          New game
        </Button>
      }
    >
      {/* New users always see how it works; everyone else can open it. */}
      <Hero
        howItWorks={events?.length === 0 ? "open" : "collapsible"}
        onInstall={canInstall() ? () => (install ? install() : setInstallHelp(true)) : undefined}
      >
        {/* One child or none, so the header adds no gap when nothing is on. */}
        {playing &&
          (playing.kind === "americano" ? (
            <PlayingNow tournament={playing} onOpen={() => open(playing)} />
          ) : (
            <MatchPlayingNow match={playing} onOpen={() => open(playing)} />
          ))}
      </Hero>

      <InstallBanner />

      {events?.length === 0 && <FirstTournament />}

      {others.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-3 px-1">
            <h2 className="flex-1 text-[1.375rem] type-display">History</h2>
            {/* The phone's own picker behind a pill: nothing to build or to
                get wrong on a small screen. */}
            <span className="relative">
              <select
                aria-label="Show"
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="h-9 appearance-none rounded-full bg-secondary pr-8 pl-3.5 text-sm text-primary outline-none type-label focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]"
              >
                <option value="all">All</option>
                <option value="americano">Americano</option>
                <option value="match">Matches</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-primary"
                strokeWidth={2.5}
                aria-hidden
              />
            </span>
          </div>
          {listed.length === 0 && (
            <p className="px-1 text-muted-foreground">
              {filter === "match" ? "No matches here yet." : "No Americano tournaments here yet."}
            </p>
          )}
          <ul className="divide-y overflow-hidden rounded-3xl bg-card border-[1.5px] empty:hidden">
            {listed.map((t) => (
              <li key={t.id} className="relative">
                <HistoryRow event={t} onOpen={() => open(t)} />
                {t.finished && (
                  // Under the date. Beside the row's button, not inside it: buttons
                  // can't nest.
                  <button
                    type="button"
                    aria-label={`Play again with the players from ${t.name}`}
                    onClick={() =>
                      nav.push(
                        t.kind === "match"
                          ? { name: "new", fromMatch: previousMatchSetup(t) }
                          : { name: "new", from: previousSetup(t) },
                      )
                    }
                    className="absolute right-2 bottom-1 flex size-11 items-center justify-center rounded-full text-primary active:bg-muted"
                  >
                    <Repeat className="size-5" strokeWidth={2.5} />
                  </button>
                )}
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

      <Sheet open={installHelp} onClose={() => setInstallHelp(false)}>
        <InstallHelp onClose={() => setInstallHelp(false)} />
      </Sheet>
    </Screen>
  )
}

// Court-blue panel at the top, with faint court lines like the share card.
function Hero({
  howItWorks,
  onInstall,
  children,
}: {
  howItWorks: "open" | "collapsible"
  onInstall?: () => void // missing where the browser can't install, or already has
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const showSteps = howItWorks === "open" || expanded

  return (
    <div className="relative -mx-4 overflow-hidden rounded-b-2xl bg-primary px-5 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-3 text-primary-foreground">
      <CourtLines />
      {onInstall && (
        <button
          type="button"
          onClick={onInstall}
          className="absolute top-[calc(env(safe-area-inset-top)+1.5rem)] right-4 z-10 flex h-11 items-center gap-1.5 rounded-full bg-white/10 pr-4 pl-3 text-[0.9375rem] text-primary-foreground type-label active:bg-white/20"
        >
          {isPhone() ? (
            <Smartphone className="size-5" strokeWidth={2.5} />
          ) : (
            <MonitorDown className="size-5" strokeWidth={2.5} />
          )}
          Install
        </button>
      )}
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <BallIcon className="size-7" />
          <h1 className="text-[3.25rem] leading-none type-display">Padel</h1>
        </div>
        <p className="mt-2 text-lg text-primary-foreground/75">Ready for a game?</p>

        {howItWorks === "collapsible" && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 -ml-1 flex items-center gap-1 rounded-sm px-1 py-1.5 text-sm font-semibold text-primary-foreground/90 active:bg-white/10"
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

        {children && <div className="mt-2.5">{children}</div>}
        {/* A quiet credit on a row of its own. Under a card it sits as far
            below as "How it works" sits above. */}
        <a
          href="https://hzburki.com"
          target="_blank"
          rel="noopener"
          className={`ml-auto block w-fit text-[0.6875rem] leading-none text-primary-foreground/45 ${children ? "mt-4" : "mt-2"}`}
        >
          hzburki.com
        </a>
      </div>
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

// The spotlight card for a match: sets won where a tournament has its round
// counter, and the set scores where it has the leader.
function MatchPlayingNow({ match, onOpen }: { match: SetMatch; onOpen: () => void }) {
  const state = replay(match, match.points)
  const sets = formatSets(state)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-3xl bg-card p-5 text-left text-card-foreground shadow-lg shadow-black/10 active:scale-[0.99]"
    >
      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Playing now</span>
      <div className="mt-3 flex items-end gap-3">
        <p className="min-w-0 flex-1 truncate text-[1.75rem] type-display">{match.name}</p>
        <p className="shrink-0 text-primary type-display" aria-label={`${state.setsWon[0]} sets to ${state.setsWon[1]}`}>
          <span className="text-[1.75rem]">
            {state.setsWon[0]}–{state.setsWon[1]}
          </span>
          <span className="text-lg text-muted-foreground"> sets</span>
        </p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-semibold">
            {teamName(match.teams[0])} v {teamName(match.teams[1])}
          </span>
          <span className="block truncate text-muted-foreground">{sets === "" ? "No games yet" : `Games ${sets}`}</span>
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
        <BallIcon x="75" y="113" width="18" height="18" stroke="none" />
      </svg>
      <p className="mt-5 text-2xl type-display">No games yet</p>
      <p className="mt-1 max-w-64 text-muted-foreground">Tap New game below to set up your first one.</p>
    </div>
  )
}

function HistoryRow({ event, onOpen }: { event: SavedEvent; onOpen: () => void }) {
  const date = new Date(event.createdAt)
  const match = event.kind === "match"
  const Icon = match ? CourtIcon : Podium
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 py-3.5 pr-2 pl-3.5 text-left active:bg-muted">
      {/* The tile says what kind of game it was: lime for a match. */}
      <span
        className={`flex size-13 shrink-0 items-center justify-center rounded-2xl ${
          match ? "bg-accent text-accent-foreground" : "bg-secondary text-primary"
        }`}
      >
        <Icon className="size-6" strokeWidth={2.5} aria-label={match ? "Match" : "Americano"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg type-label">{event.name}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {event.shared && (
            <>
              <SharedTag /> ·{" "}
            </>
          )}
          {match ? <MatchStatus match={event} /> : <Status tournament={event} />}
        </span>
      </span>
      {/* As wide as the Play again icon that sits under it on finished rows. */}
      <span className="w-11 shrink-0 self-start pt-1 text-center text-[0.8125rem] whitespace-nowrap text-muted-foreground type-label">
        {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
      </span>
    </button>
  )
}

function MatchStatus({ match }: { match: SetMatch }) {
  const state = replay(match, match.points)
  if (match.finished && state.winner !== null) {
    return (
      <>
        🏆 {teamName(match.teams[state.winner])}, {formatSets(state, state.winner)}
      </>
    )
  }
  return (
    <>
      {teamName(match.teams[0])} v {teamName(match.teams[1])}
    </>
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
