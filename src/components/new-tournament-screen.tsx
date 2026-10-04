import { ChevronDown, Minus, Plus, TriangleAlert, X } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { gamesSplit, suggestedRoundCount, type GamesSplit } from "@/lib/americano"
import { courtsInPlay } from "@/lib/bench"
import { MAX_TARGET, MIN_TARGET } from "@/lib/scoring"
import { randomId } from "@/lib/ids"
import { requestPersistentStorage, saveTournament } from "@/lib/storage"
import {
  cleanPlayerName,
  cleanPlayerNames,
  createTournament,
  defaultTournamentName,
  MAX_ROUNDS,
  maxCourts,
  MIN_PLAYERS,
  setupProblems,
} from "@/lib/tournament"
import type { ScoringMode } from "@/lib/types"
import { Screen } from "./screen"
import { Sheet } from "./sheet"
import { useBackHandler, useNav } from "./stack-navigator"


export function NewTournamentScreen() {
  const nav = useNav<Route>()
  const [name, setName] = useState(() => defaultTournamentName(new Date()))
  const [players, setPlayers] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [courts, setCourts] = useState(1)
  const [target, setTarget] = useState(16)
  const [scoringMode, setScoringMode] = useState<ScoringMode>("total")
  const [roundsChosen, setRoundsChosen] = useState<number | null>(null) // null: follow the suggestion
  const [starting, setStarting] = useState(false)
  // The off-suggestion rounds warning: where it was opened from, and whether
  // it has been shown yet. It shows once per setup — as soon as the rounds
  // move off the suggestion, or on Start if they got there another way.
  const [warnRounds, setWarnRounds] = useState<"rounds" | "start" | null>(null)
  const [roundsWarned, setRoundsWarned] = useState(false)
  const [startFailed, setStartFailed] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [pickTarget, setPickTarget] = useState(false)
  const draftRef = useRef<HTMLInputElement>(null)

  // The typed-but-not-added name still counts, so nobody gets lost.
  const names = cleanPlayerNames([...players, draft])
  const courtLimit = maxCourts(names.length)
  const usedCourts = Math.min(courts, courtLimit)
  const suggested = names.length >= MIN_PLAYERS ? suggestedRoundCount(names.length, usedCourts) : 1
  const roundCount = roundsChosen ?? suggested

  const input = { name, playerNames: names, courts: usedCourts, target, scoringMode, roundCount }
  const problems = setupProblems(input)
  const split = gamesSplit(names.length, usedCourts, roundCount)
  // How the chosen round count differs from the suggested one, if it does.
  const roundsOff: RoundsOff | null =
    names.length < MIN_PLAYERS || roundCount === suggested
      ? null
      : split.playersWithFewer > 0
        ? "uneven"
        : roundCount < suggested
          ? "fewer"
          : "more"

  // Leaving with players entered asks first, whichever way back is triggered.
  const dirty = names.length > 0 && !starting
  useBackHandler(dirty, () => setConfirmDiscard(true))

  const addDraft = () => {
    const n = cleanPlayerName(draft)
    if (n === "") return
    setPlayers((p) => [...p, n])
    setDraft("")
    draftRef.current?.focus()
  }

  const start = () => {
    if (problems.length > 0 || starting) return
    setWarnRounds(null)
    setStartFailed(false)
    setStarting(true)
    requestPersistentStorage()
    // Let the button repaint before the schedule search, which can take a
    // moment with many players.
    setTimeout(async () => {
      try {
        const tournament = createTournament(input, { now: Date.now(), newId: randomId })
        await saveTournament(tournament)
        nav.replace({ name: "tournament", id: tournament.id })
      } catch {
        // Never leave the button spinning: say so and let them try again.
        setStarting(false)
        setStartFailed(true)
      }
    }, 30)
  }

  const playing = courtsInPlay(names.length, usedCourts) * 4
  const sitting = names.length - playing

  return (
    <Screen
      title="New tournament"
      footer={
        <div className="space-y-2">
          {startFailed && (
            <p className="text-center text-sm text-destructive">
              The tournament couldn't be saved on this phone. Try again.
            </p>
          )}
          {problems.length > 0 && names.length > 0 && (
            <p className="text-center text-sm text-muted-foreground">{problems[0]}</p>
          )}
          <Button
            variant="ball"
            size="lg"
            disabled={problems.length > 0 || starting}
            onClick={() => {
              if (roundsOff && !roundsWarned) {
                setRoundsWarned(true)
                setWarnRounds("start")
              } else start()
            }}
          >
            {starting ? "Making the schedule…" : "Start tournament"}
          </Button>
        </div>
      }
    >
      <Section title="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </Section>

      <Section title="Players" count={names.length > 0 ? names.length : undefined}>
        {players.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {players.map((p, i) => (
              <li key={i} className="flex h-11 max-w-full items-center rounded-full bg-card pl-4 shadow-[inset_0_0_0_1.5px_var(--border)]">
                <span className="min-w-0 truncate font-semibold">{p}</span>
                <button
                  type="button"
                  aria-label={`Remove ${p}`}
                  onClick={() => setPlayers((all) => all.filter((_, j) => j !== i))}
                  className="flex h-11 w-10 shrink-0 items-center justify-center rounded-r-full text-muted-foreground active:text-destructive"
                >
                  <X className="size-4" strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault()
            addDraft()
          }}
        >
          <Input
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={players.length === 0 ? "First player's name" : "Next player"}
            enterKeyHint="next"
            autoComplete="off"
            autoCapitalize="words"
            className="pr-16"
          />
          <button
            type="submit"
            aria-label="Add player"
            disabled={draft.trim() === ""}
            className="absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors active:scale-95 disabled:bg-secondary disabled:text-primary/40"
          >
            <Plus className="size-5" strokeWidth={2.75} />
          </button>
        </form>
      </Section>

      <Section title="Courts">
        <Stepper
          value={usedCourts}
          min={1}
          max={courtLimit}
          onChange={(n) => {
            setCourts(n)
            setRoundsChosen(null) // courts change the ideal round count, so follow it again
          }}
          unit={(n) => (n === 1 ? "court" : "courts")}
        />
        {names.length >= MIN_PLAYERS && (
          <Hint>
            {courtsInPlay(names.length, usedCourts) === 1 ? "1 match" : `${playing / 4} matches`} at a time
            {sitting > 0 ? `, ${sitting} sitting out each round.` : ", nobody sits out."}
          </Hint>
        )}
      </Section>

      <Section title="Scoring">
        {/* Navy track, lime thumb that slides to the chosen mode. */}
        <div className="relative grid grid-cols-2 rounded-2xl bg-foreground p-1.5">
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl bg-accent shadow-[inset_0_-3px_0_rgb(14_34_64/0.16)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
            style={{ transform: scoringMode === "firstTo" ? "translateX(100%)" : undefined }}
          />
          {(
            [
              ["total", "Total points"],
              ["firstTo", "First to"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={scoringMode === mode}
              onClick={() => setScoringMode(mode)}
              className="relative h-12 text-[1.0625rem] text-primary-foreground/70 transition-colors type-label aria-pressed:text-accent-foreground"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <Stepper
            value={target}
            min={MIN_TARGET}
            max={MAX_TARGET}
            onChange={setTarget}
            unit={() => "points a game"}
            onValueTap={() => setPickTarget(true)}
          />
        </div>
        <Hint>
          {scoringMode === "total"
            ? `Every game is ${target} points in total, like ${Math.ceil(target / 2) + 2}–${Math.floor(target / 2) - 2}.`
            : `A game ends when one team reaches ${target}.`}
        </Hint>
      </Section>

      <Section title="Rounds">
        <Stepper
          value={roundCount}
          min={1}
          max={MAX_ROUNDS}
          onChange={(n) => {
            setRoundsChosen(n)
            if (!roundsWarned && names.length >= MIN_PLAYERS && n !== suggested) {
              setRoundsWarned(true)
              setWarnRounds("rounds")
            }
          }}
          unit={(n) => (n === 1 ? "round" : "rounds")}
        />
        {/* Only speak up when the count isn't the suggested one. */}
        {roundsOff && (
          <Hint>
            {roundsOff === "uneven"
              ? `${split.playersWithFewer} ${split.playersWithFewer === 1 ? "player plays" : "players play"} one match fewer.`
              : roundsOff === "fewer"
                ? "Some pairs won't get to partner up."
                : "Some pairs will partner up twice."}{" "}
            <button type="button" className="font-medium text-primary" onClick={() => setRoundsChosen(null)}>
              Use {suggested} rounds
            </button>
          </Hint>
        )}
      </Section>

      <Sheet open={pickTarget} onClose={() => setPickTarget(false)}>
        <p className="px-1 text-2xl type-display">Points per game</p>
        <p className="mb-3 px-1 text-sm text-muted-foreground">
          {scoringMode === "total" ? "The two scores add up to this." : "The first team to reach this wins."}
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: MAX_TARGET - MIN_TARGET + 1 }, (_, i) => MIN_TARGET + i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setTarget(n)
                setPickTarget(false)
              }}
              className={`h-14 rounded-xl text-[1.75rem] type-display active:scale-95 ${
                n === target ? "bg-primary text-primary-foreground" : "bg-card shadow-[inset_0_0_0_1.5px_var(--border)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)}>
        <p className="text-2xl type-display">Discard this tournament?</p>
        <p className="mt-1 text-muted-foreground">
          The {names.length} {names.length === 1 ? "player" : "players"} you added won't be saved.
        </p>
        <Button
          variant="destructive"
          size="lg"
          className="mt-5"
          onClick={() => {
            setConfirmDiscard(false)
            nav.back({ force: true })
          }}
        >
          Discard
        </Button>
        <Button variant="ghost" className="mt-1 h-12 w-full text-base font-semibold" onClick={() => setConfirmDiscard(false)}>
          Keep editing
        </Button>
      </Sheet>

      <Sheet open={warnRounds !== null && roundsOff !== null} onClose={() => setWarnRounds(null)}>
        {roundsOff && (
          <RoundsWarning
            off={roundsOff}
            playerCount={names.length}
            pairsPerRound={playing / 2}
            roundCount={roundCount}
            split={split}
            suggested={suggested}
            suggestedGames={gamesSplit(names.length, usedCourts, suggested).fewer}
            onUseSuggested={() => {
              setRoundsChosen(null)
              setWarnRounds(null)
            }}
            onAccept={warnRounds === "start" ? start : () => setWarnRounds(null)}
            acceptLabel={`${warnRounds === "start" ? "Start with" : "Keep"} ${roundCount} rounds`}
          />
        )}
      </Sheet>
    </Screen>
  )
}

type RoundsOff = "uneven" | "fewer" | "more"

// Shown once when the round count leaves the suggested one: a short
// warning, with the numbers behind it one tap away.
function RoundsWarning({
  off,
  playerCount,
  pairsPerRound,
  roundCount,
  split,
  suggested,
  suggestedGames,
  onUseSuggested,
  onAccept,
  acceptLabel,
}: {
  off: RoundsOff
  playerCount: number
  pairsPerRound: number
  roundCount: number
  split: GamesSplit
  suggested: number
  suggestedGames: number
  onUseSuggested: () => void
  onAccept: () => void
  acceptLabel: string
}) {
  const [details, setDetails] = useState(false)
  const { fewer, more: others, playersWithFewer: n } = split
  const matches = (k: number) => `${k} ${k === 1 ? "match" : "matches"}`
  const pairs = (playerCount * (playerCount - 1)) / 2
  const onCourt = roundCount * pairsPerRound
  const examplePoints = fewer * 10
  const scaled = Math.round((examplePoints * others) / Math.max(fewer, 1))

  const title =
    off === "uneven"
      ? `${n} ${n === 1 ? "player" : "players"} will play one match fewer`
      : off === "fewer"
        ? "Not everyone gets to partner up"
        : "Some pairs will partner up twice"
  const message =
    off === "uneven"
      ? "Their points get scaled up at the end to keep it fair."
      : off === "fewer"
        ? "There aren't enough rounds for everyone to play together once."
        : "There are more rounds than there are partners to go round."

  return (
    <div className="text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <TriangleAlert className="size-8" strokeWidth={2.5} aria-hidden />
      </div>
      <p className="mt-3 text-2xl type-display">{title}</p>
      <p className="mt-1 text-muted-foreground">{message}</p>

      <Button size="lg" className="mt-5" onClick={onUseSuggested}>
        Use {suggested} rounds, everyone plays {suggestedGames}
      </Button>
      <Button variant="ghost" className="mt-1 h-12 w-full text-base font-medium text-muted-foreground" onClick={onAccept}>
        {acceptLabel}
      </Button>

      {details ? (
        <div className="mt-3 text-left">
          {off === "uneven" ? (
            <>
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-muted-foreground">
                    {n} {n === 1 ? "player" : "players"}
                  </span>
                  <span className="font-semibold">{matches(fewer)}</span>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-muted-foreground">Everyone else</span>
                  <span className="font-semibold">{matches(others)}</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                With {roundCount} rounds the sit-outs don't come out even. At the end, players with fewer matches get
                their points scaled up as if they had played {others}: {examplePoints} points from {matches(fewer)}{" "}
                counts as {scaled}.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {playerCount} players make {pairs} possible pairs, and each round puts {pairsPerRound} of them on court.{" "}
              {off === "fewer"
                ? `${roundCount} rounds leave at least ${pairs - onCourt} pairs who never play together.`
                : `${roundCount} rounds fit ${onCourt}, so at least ${onCourt - pairs} partnerships repeat.`}{" "}
              {suggested} rounds gives room for everyone to partner with everyone once.
            </p>
          )}
        </div>
      ) : (
        <button type="button" className="mt-2 py-2 text-sm font-medium text-primary" onClick={() => setDetails(true)}>
          See details
        </button>
      )}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-3">
      <h2 className="mb-3 flex items-baseline gap-2 px-1 text-[1.375rem] type-display">
        {title}
        {count !== undefined && <span className="text-primary">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2 px-1 text-sm text-muted-foreground">{children}</p>
}

// A setting with a big number in the middle: minus on the left, plus (the
// usual move) filled on the right.
function Stepper({
  value,
  min,
  max,
  onChange,
  unit,
  onValueTap,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  unit: (n: number) => string
  onValueTap?: () => void // makes the value itself a button (e.g. to open a picker)
}) {
  const step =
    "flex size-14 shrink-0 items-center justify-center rounded-2xl transition-transform active:scale-90 disabled:bg-transparent disabled:text-muted-foreground/30 disabled:shadow-[inset_0_0_0_1.5px_var(--border)]"
  const Value = onValueTap ? "button" : "div"
  return (
    <div className="flex items-center gap-2 rounded-3xl bg-card p-2 shadow-[inset_0_0_0_1.5px_var(--border)]">
      <button
        type="button"
        aria-label="Fewer"
        className={`${step} bg-secondary text-primary`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-6" strokeWidth={2.75} />
      </button>
      <Value
        {...(onValueTap ? { type: "button" as const, onClick: onValueTap } : {})}
        className={`flex min-w-0 flex-1 flex-col items-center rounded-2xl py-1 ${onValueTap ? "active:bg-muted" : ""}`}
      >
        {/* Re-keyed so each change gives the number a small kick. */}
        <span
          key={value}
          className="text-[3.5rem] leading-[0.9] type-display animate-in duration-200 zoom-in-90 motion-reduce:animate-none"
        >
          {value}
        </span>
        <span className="mt-0.5 flex items-center gap-0.5 text-sm font-medium text-muted-foreground">
          {unit(value)}
          {onValueTap && <ChevronDown className="size-3.5" strokeWidth={2.75} />}
        </span>
      </Value>
      <button
        type="button"
        aria-label="More"
        className={`${step} bg-primary text-primary-foreground`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-6" strokeWidth={2.75} />
      </button>
    </div>
  )
}
