import { Minus, Plus, X } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { gamesSplit, suggestedRoundCount } from "@/lib/americano"
import { courtsInPlay } from "@/lib/bench"
import { MAX_TARGET, MIN_TARGET } from "@/lib/scoring"
import { randomId } from "@/lib/ids"
import { requestPersistentStorage, saveTournament } from "@/lib/storage"
import {
  cleanPlayerNames,
  createTournament,
  MAX_ROUNDS,
  maxCourts,
  MIN_PLAYERS,
  setupProblems,
} from "@/lib/tournament"
import type { ScoringMode } from "@/lib/types"
import { Screen } from "./screen"
import { Sheet } from "./sheet"
import { useBackHandler, useNav } from "./stack-navigator"

const defaultName = () => `${new Date().toLocaleDateString(undefined, { weekday: "long" })} padel`

export function NewTournamentScreen() {
  const nav = useNav<Route>()
  const [name, setName] = useState(defaultName)
  const [players, setPlayers] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [courts, setCourts] = useState(1)
  const [target, setTarget] = useState(16)
  const [scoringMode, setScoringMode] = useState<ScoringMode>("total")
  const [roundsChosen, setRoundsChosen] = useState<number | null>(null) // null: follow the suggestion
  const [starting, setStarting] = useState(false)
  const [warnUneven, setWarnUneven] = useState(false)
  const [startFailed, setStartFailed] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
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
    setWarnUneven(false)
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
            className="h-14 w-full rounded-2xl text-base"
            disabled={problems.length > 0 || starting}
            onClick={() => (split.playersWithFewer > 0 ? setWarnUneven(true) : start())}
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
          className="h-12 rounded-xl bg-card px-3.5"
          autoComplete="off"
        />
      </Section>

      <Section title={names.length === 0 ? "Players" : `Players (${names.length})`}>
        {players.length > 0 && (
          <ul className="mb-2 divide-y overflow-hidden rounded-xl border bg-card">
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
            className="h-12 flex-1 rounded-xl bg-card px-3.5"
          />
          <Button
            type="submit"
            variant="secondary"
            aria-label="Add player"
            className="size-12 rounded-xl"
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
          onChange={setCourts}
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
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
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
              className="h-11 rounded-lg font-medium text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Stepper value={target} min={MIN_TARGET} max={MAX_TARGET} onChange={setTarget} format={(n) => `${n} points`} />
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
          onChange={setRoundsChosen}
          format={(n) => `${n} ${n === 1 ? "round" : "rounds"}`}
        />
        {names.length >= MIN_PLAYERS && (
          <Hint>
            {split.playersWithFewer > 0
              ? `${split.playersWithFewer} ${split.playersWithFewer === 1 ? "player plays" : "players play"} ${split.fewer} ${split.fewer === 1 ? "match" : "matches"}, the others ${split.more}.`
              : roundCount >= suggested
                ? `Everyone plays ${split.fewer} matches and partners everyone at least once.`
                : `Everyone plays ${split.fewer} matches, but some pairs won't partner up.`}
            {roundsChosen !== null && roundsChosen !== suggested && (
              <>
                {" "}
                <button type="button" className="font-medium text-primary" onClick={() => setRoundsChosen(null)}>
                  Use {suggested}
                </button>
              </>
            )}
          </Hint>
        )}
      </Section>

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)}>
        <p className="text-lg font-semibold">Discard this tournament?</p>
        <p className="mt-1 text-muted-foreground">
          The {names.length} {names.length === 1 ? "player" : "players"} you added won't be saved.
        </p>
        <Button
          variant="destructive"
          size="lg"
          className="mt-5 h-14 w-full rounded-2xl text-base"
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

      <Sheet open={warnUneven} onClose={() => setWarnUneven(false)}>
        <p className="text-lg font-semibold">Some players will play fewer matches</p>
        <p className="mt-1 text-muted-foreground">
          With {roundCount} rounds, {split.playersWithFewer} {split.playersWithFewer === 1 ? "player plays" : "players play"}{" "}
          {split.fewer} {split.fewer === 1 ? "match" : "matches"} while the others play {split.more}. To keep it fair,
          their final points will be scaled up to match.
        </p>
        <Button
          size="lg"
          className="mt-5 h-14 w-full rounded-2xl text-base"
          onClick={() => {
            setRoundsChosen(null)
            setWarnUneven(false)
          }}
        >
          Use {suggested} rounds, everyone plays {gamesSplit(names.length, usedCourts, suggested).fewer}
        </Button>
        <Button variant="ghost" className="mt-1 h-12 w-full" onClick={start}>
          Start with {roundCount} rounds anyway
        </Button>
      </Sheet>
    </Screen>
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
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  format: (n: number) => string
}) {
  const button = "flex size-12 items-center justify-center rounded-xl text-primary active:bg-muted disabled:text-muted-foreground/40"
  return (
    <div className="flex items-center rounded-xl border bg-card p-1">
      <button type="button" aria-label="Fewer" className={button} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-5" strokeWidth={2.5} />
      </button>
      <span className="flex-1 text-center text-lg font-semibold">{format(value)}</span>
      <button type="button" aria-label="More" className={button} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
    </div>
  )
}
