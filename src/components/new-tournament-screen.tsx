import { ChevronDown, Minus, Plus, X } from "lucide-react"
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
  // The uneven-matches warning: where it was opened from, and whether the
  // organiser has already accepted uneven matches for this tournament (then
  // it never shows again on this screen).
  const [warnUneven, setWarnUneven] = useState<"rounds" | "start" | null>(null)
  const [unevenAccepted, setUnevenAccepted] = useState(false)
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

  // Leaving with players entered asks first, whichever way back is triggered.
  const dirty = names.length > 0 && !starting
  useBackHandler(dirty, () => setConfirmDiscard(true))

  const addDraft = () => {
    const n = draft.trim()
    if (n === "") return
    setPlayers((p) => [...p, n])
    setDraft("")
    draftRef.current?.focus()
  }

  const start = () => {
    if (problems.length > 0 || starting) return
    setWarnUneven(null)
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
            size="lg"
            className="h-14 w-full rounded-md text-base font-semibold"
            disabled={problems.length > 0 || starting}
            onClick={() => (split.playersWithFewer > 0 && !unevenAccepted ? setWarnUneven("start") : start())}
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
          className="h-12 rounded-md bg-card px-3.5"
          autoComplete="off"
        />
      </Section>

      <Section title={names.length === 0 ? "Players" : `Players (${names.length})`}>
        {players.length > 0 && (
          <ul className="mb-2 divide-y overflow-hidden rounded-lg border bg-card">
            {players.map((p, i) => (
              <li key={i} className="flex items-center pl-3.5">
                <span className="min-w-0 flex-1 truncate py-3">{p}</span>
                <button
                  type="button"
                  aria-label={`Remove ${p}`}
                  onClick={() => setPlayers((all) => all.filter((_, j) => j !== i))}
                  className="flex size-12 items-center justify-center text-muted-foreground active:text-destructive"
                >
                  <X className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
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
            className="h-12 flex-1 rounded-md bg-card px-3.5"
          />
          <Button
            type="submit"
            variant="secondary"
            aria-label="Add player"
            className="size-12 rounded-md"
            disabled={draft.trim() === ""}
          >
            <Plus className="size-5" />
          </Button>
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
          format={(n) => `${n} ${n === 1 ? "court" : "courts"}`}
        />
        {names.length >= MIN_PLAYERS && (
          <Hint>
            {courtsInPlay(names.length, usedCourts) === 1 ? "1 match" : `${playing / 4} matches`} at a time
            {sitting > 0 ? `, ${sitting} sitting out each round.` : ", nobody sits out."}
          </Hint>
        )}
      </Section>

      <Section title="Scoring">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
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
              className="h-11 rounded-sm font-medium text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Stepper
            value={target}
            min={MIN_TARGET}
            max={MAX_TARGET}
            onChange={setTarget}
            format={(n) => `${n} points`}
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
            if (!unevenAccepted && gamesSplit(names.length, usedCourts, n).playersWithFewer > 0) setWarnUneven("rounds")
          }}
          format={(n) => `${n} ${n === 1 ? "round" : "rounds"}`}
        />
        {/* Only speak up when the count isn't the suggested one. */}
        {names.length >= MIN_PLAYERS && roundCount !== suggested && (
          <Hint>
            {split.playersWithFewer > 0
              ? `${split.playersWithFewer} ${split.playersWithFewer === 1 ? "player plays" : "players play"} one match fewer.`
              : roundCount < suggested
                ? "Some pairs won't get to partner up."
                : "Some pairs will partner up twice."}{" "}
            <button type="button" className="font-medium text-primary" onClick={() => setRoundsChosen(null)}>
              Use {suggested} rounds
            </button>
          </Hint>
        )}
      </Section>

      <Sheet open={pickTarget} onClose={() => setPickTarget(false)}>
        <p className="px-1 text-lg font-semibold">Points per game</p>
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
              className={`h-12 rounded-md text-lg font-semibold active:scale-95 ${
                n === target ? "bg-primary text-primary-foreground" : "border bg-card"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)}>
        <p className="text-lg font-semibold">Discard this tournament?</p>
        <p className="mt-1 text-muted-foreground">
          The {names.length} {names.length === 1 ? "player" : "players"} you added won't be saved.
        </p>
        <Button
          variant="destructive"
          size="lg"
          className="mt-5 h-14 w-full rounded-md text-base font-semibold"
          onClick={() => {
            setConfirmDiscard(false)
            nav.back({ force: true })
          }}
        >
          Discard
        </Button>
        <Button variant="ghost" className="mt-1 h-12 w-full" onClick={() => setConfirmDiscard(false)}>
          Keep editing
        </Button>
      </Sheet>

      <Sheet open={warnUneven !== null} onClose={() => setWarnUneven(null)}>
        <UnevenWarning
          roundCount={roundCount}
          split={split}
          suggested={suggested}
          suggestedGames={gamesSplit(names.length, usedCourts, suggested).fewer}
          onUseSuggested={() => {
            setRoundsChosen(null)
            setWarnUneven(null)
          }}
          onAccept={() => {
            setUnevenAccepted(true)
            if (warnUneven === "start") start()
            else setWarnUneven(null)
          }}
          acceptLabel={warnUneven === "start" ? `Start with ${roundCount} rounds` : `Keep ${roundCount} rounds`}
        />
      </Sheet>
    </Screen>
  )
}

// Spells out what uneven matches mean, with a worked example of the scaling.
function UnevenWarning({
  roundCount,
  split,
  suggested,
  suggestedGames,
  onUseSuggested,
  onAccept,
  acceptLabel,
}: {
  roundCount: number
  split: GamesSplit
  suggested: number
  suggestedGames: number
  onUseSuggested: () => void
  onAccept: () => void
  acceptLabel: string
}) {
  const others = split.more
  const fewer = split.fewer
  const n = split.playersWithFewer
  const examplePoints = fewer * 10
  const scaled = Math.round((examplePoints * others) / fewer)
  const matches = (k: number) => `${k} ${k === 1 ? "match" : "matches"}`

  return (
    <div>
      <p className="text-lg font-semibold">Not everyone will play the same number of matches</p>
      <p className="mt-1 text-muted-foreground">With {roundCount} rounds, the sit-outs don't come out even:</p>
      <div className="mt-3 overflow-hidden rounded-lg border bg-card">
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
      <p className="mt-4 font-medium">What happens to their points</p>
      <p className="mt-1 text-muted-foreground">
        At the end, players with fewer matches get their points scaled up, as if they had played {others}. For example,{" "}
        {examplePoints} points from {matches(fewer)} counts as {scaled}.
      </p>
      <p className="mt-3 text-muted-foreground">
        You won't be asked again for this tournament.
      </p>
      <Button size="lg" className="mt-5 h-14 w-full rounded-md text-base font-semibold" onClick={onAccept}>
        {acceptLabel}
      </Button>
      <Button variant="ghost" className="mt-1 h-12 w-full" onClick={onUseSuggested}>
        Use {suggested} rounds instead, everyone plays {suggestedGames}
      </Button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-2">
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2 px-1 text-sm text-muted-foreground">{children}</p>
}

function Stepper({
  value,
  min,
  max,
  onChange,
  format,
  onValueTap,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  format: (n: number) => string
  onValueTap?: () => void // makes the value itself a button (e.g. to open a picker)
}) {
  const button = "flex size-12 items-center justify-center rounded-sm text-primary active:bg-muted disabled:text-muted-foreground/40"
  return (
    <div className="flex items-center rounded-md border bg-card p-1">
      <button type="button" aria-label="Fewer" className={button} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-5" strokeWidth={2.5} />
      </button>
      {onValueTap ? (
        <button
          type="button"
          onClick={onValueTap}
          className="flex h-12 flex-1 items-center justify-center gap-1 rounded-sm text-lg font-semibold active:bg-muted"
        >
          {format(value)}
          <ChevronDown className="size-4 text-muted-foreground" strokeWidth={2.5} />
        </button>
      ) : (
        <span className="flex-1 text-center text-lg font-semibold">{format(value)}</span>
      )}
      <button type="button" aria-label="More" className={button} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
    </div>
  )
}
