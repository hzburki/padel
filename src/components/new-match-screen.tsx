import { useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { randomId } from "@/lib/ids"
import { MAX_GAMES_PER_SET, MIN_GAMES_PER_SET, setsToWin } from "@/lib/set-match"
import { createSetMatch, matchSetupProblems, type PreviousMatchSetup } from "@/lib/set-match-setup"
import { requestPersistentStorage, saveTournament } from "@/lib/storage"
import { capitaliseFirst, defaultGameName } from "@/lib/tournament"
import type { DeuceRule, ScoreBy, SetMatch, Side } from "@/lib/types"
import { Hint, Section, Stepper } from "./new-tournament-screen"
import { Screen } from "./screen"
import { Segmented } from "./segmented"
import { Sheet } from "./sheet"
import { useBackHandler, useNav } from "./nav"

const NO_NAMES: SetMatch["teams"] = [
  ["", ""],
  ["", ""],
]

export function NewMatchScreen({
  from,
  top,
  active,
}: {
  from?: PreviousMatchSetup
  top: ReactNode // the Americano / Match cards
  active: boolean // false while the Americano form is showing instead
}) {
  const nav = useNav<Route>()
  const [name, setName] = useState(() => defaultGameName("match", new Date()))
  const [teams, setTeams] = useState(from?.teams ?? NO_NAMES)
  const [bestOf, setBestOf] = useState<SetMatch["bestOf"]>(from?.bestOf ?? 1)
  const [setsAs, setSetsAs] = useState<SetMatch["setsAs"]>(from?.setsAs ?? "bestOf")
  const [gamesPerSet, setGamesPerSet] = useState(from?.gamesPerSet ?? 6)
  const [deuce, setDeuce] = useState<DeuceRule>(from?.deuce ?? "advantage")
  const [scoreBy, setScoreBy] = useState<ScoreBy>(from?.scoreBy ?? "points")
  const [starting, setStarting] = useState(false)
  const [startFailed, setStartFailed] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const input = { name, teams, bestOf, setsAs, gamesPerSet, deuce, scoreBy }
  const problems = matchSetupProblems(input)
  const typed = teams.flat().filter((n) => n.trim() !== "").length

  // Leaving with names entered asks first. Names carried over from the last
  // match don't count until changed.
  const dirty = typed > 0 && teams.flat().join("\n") !== (from?.teams ?? NO_NAMES).flat().join("\n") && !starting
  useBackHandler(dirty && active, () => setConfirmDiscard(true))

  // The keyboard's Enter key walks down the fields: name, then the four
  // players. On the last one it puts the keyboard away.
  const fields = useRef<(HTMLInputElement | null)[]>([])
  const enterMovesOn = (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    const next = fields.current[index + 1]
    if (next) next.focus()
    else e.currentTarget.blur()
  }

  const setPlayer = (side: Side, seat: 0 | 1, value: string) =>
    setTeams((t) => t.map((team, s) => team.map((n, i) => (s === side && i === seat ? value : n))) as SetMatch["teams"])

  const start = async () => {
    if (problems.length > 0 || starting) return
    setStartFailed(false)
    setStarting(true)
    requestPersistentStorage()
    try {
      const match = createSetMatch(input, { now: Date.now(), newId: randomId })
      await saveTournament(match)
      nav.replace({ name: "match", id: match.id })
    } catch {
      // Never leave the button stuck: say so and let them try again.
      setStarting(false)
      setStartFailed(true)
    }
  }

  return (
    <Screen
      title="New game"
      footer={
        <div className="space-y-2">
          {startFailed && (
            <p className="text-center text-sm text-destructive">The match couldn't be saved on this phone. Try again.</p>
          )}
          {problems.length > 0 && typed > 0 && (
            <p className="text-center text-sm text-muted-foreground">{problems[0]}</p>
          )}
          <Button variant="ball" size="lg" disabled={problems.length > 0 || starting} onClick={start}>
            Start match
          </Button>
        </div>
      }
    >
      {top}
      <Section title="Name">
        <Input
          ref={(el) => void (fields.current[0] = el)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={enterMovesOn(0)}
          enterKeyHint="next"
        />
      </Section>

      {([0, 1] as const).map((side) => (
        <Section key={side} title={`Team ${side + 1}`}>
          <div className="space-y-2">
            {([0, 1] as const).map((seat) => (
              <Input
                key={seat}
                ref={(el) => void (fields.current[1 + side * 2 + seat] = el)}
                value={teams[side][seat]}
                onChange={(e) => setPlayer(side, seat, capitaliseFirst(e.target.value))}
                onKeyDown={enterMovesOn(1 + side * 2 + seat)}
                placeholder={`Player ${side * 2 + seat + 1}`}
                aria-label={`Team ${side + 1}, player ${seat + 1}`}
                enterKeyHint={side === 1 && seat === 1 ? "done" : "next"}
                autoCapitalize="words"
              />
            ))}
          </div>
        </Section>
      ))}

      <Section title="Sets">
        {/* Two ways to say the same length: first to 2 sets is a best of 3. */}
        <Segmented
          options={[
            ["bestOf", "Best of"],
            ["firstTo", "First to"],
          ]}
          value={setsAs}
          onChange={setSetsAs}
        />
        <div className="mt-2">
          {setsAs === "bestOf" ? (
            <Segmented
              options={[
                [1, "1 set"],
                [3, "3 sets"],
                [5, "5 sets"],
              ]}
              value={bestOf}
              onChange={setBestOf}
            />
          ) : (
            <Stepper
              value={setsToWin(bestOf)}
              min={1}
              max={3}
              onChange={(n) => setBestOf((2 * n - 1) as SetMatch["bestOf"])}
              unit={(n) => (n === 1 ? "set to win" : "sets to win")}
            />
          )}
        </div>
        <div className="mt-2">
          <Stepper
            value={gamesPerSet}
            min={MIN_GAMES_PER_SET}
            max={MAX_GAMES_PER_SET}
            onChange={setGamesPerSet}
            unit={() => "games a set"}
          />
        </div>
        <Hint>
          A set is won at {gamesPerSet} games, two clear. At {gamesPerSet}–{gamesPerSet} a tie-break decides it.
        </Hint>
      </Section>

      <Section title="Keeping score">
        <Segmented
          options={[
            ["points", "Every point"],
            ["games", "Games only"],
          ]}
          value={scoreBy}
          onChange={setScoreBy}
        />
        <Hint>
          {scoreBy === "points"
            ? "Tap who won each point. The app counts the games and sets."
            : "Tap who won each game. Quicker, but points aren't kept."}
        </Hint>
      </Section>

      {/* With no points entered there is no 40–40 to settle. */}
      {scoreBy === "points" && (
        <Section title="At 40–40">
          <Segmented
            options={[
              ["advantage", "Advantage"],
              ["golden", "Golden point"],
            ]}
            value={deuce}
            onChange={setDeuce}
          />
          <Hint>
            {deuce === "advantage"
              ? "A team needs two points in a row to win the game."
              : "The next point wins the game."}
          </Hint>
        </Section>
      )}

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)}>
        <p className="text-2xl type-display">Discard this match?</p>
        <p className="mt-1 text-muted-foreground">The names you typed won't be saved.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" className="px-3" onClick={() => setConfirmDiscard(false)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="px-3"
            onClick={() => {
              setConfirmDiscard(false)
              nav.back({ force: true })
            }}
          >
            Discard
          </Button>
        </div>
      </Sheet>
    </Screen>
  )
}
