import { generateSchedule } from "./americano"
import type { Rng } from "./bench"
import { isValidTarget, MAX_TARGET, MIN_TARGET } from "./scoring"
import type { Score, ScoringMode, Tournament } from "./types"

export const MIN_PLAYERS = 4
export const MAX_ROUNDS = 99

export interface SetupInput {
  name: string
  playerNames: string[] // as typed; blanks are ignored
  courts: number
  target: number
  scoringMode: ScoringMode
  roundCount: number
}

export function cleanPlayerNames(names: string[]): string[] {
  return names.map((n) => n.trim()).filter((n) => n !== "")
}

// More courts than players can fill would only sit empty.
export function maxCourts(playerCount: number): number {
  return Math.max(1, Math.floor(playerCount / 4))
}

// What stops the tournament from starting, worded for the organiser.
export function setupProblems(input: SetupInput): string[] {
  const problems: string[] = []
  const names = cleanPlayerNames(input.playerNames)

  if (input.name.trim() === "") problems.push("Give the tournament a name.")
  if (names.length < MIN_PLAYERS) {
    const missing = MIN_PLAYERS - names.length
    problems.push(`Add ${missing} more player${missing === 1 ? "" : "s"}. A match needs 4.`)
  }
  const seen = new Set<string>()
  for (const name of names) {
    const k = name.toLowerCase()
    if (seen.has(k)) {
      problems.push(`Two players are called ${name}. Give them different names.`)
      break
    }
    seen.add(k)
  }
  if (!Number.isInteger(input.courts) || input.courts < 1 || input.courts > maxCourts(names.length)) {
    const max = maxCourts(names.length)
    problems.push(max === 1 ? "Use 1 court. 8 players are needed for 2." : `Pick between 1 and ${max} courts.`)
  }
  if (!isValidTarget(input.target)) {
    problems.push(`Pick a point target from ${MIN_TARGET} to ${MAX_TARGET}.`)
  }
  if (!Number.isInteger(input.roundCount) || input.roundCount < 1 || input.roundCount > MAX_ROUNDS) {
    problems.push(`Pick between 1 and ${MAX_ROUNDS} rounds.`)
  }
  return problems
}

export interface CreateDeps {
  now: number
  newId: () => string
  rng?: Rng
}

// Build a ready-to-play tournament with its whole schedule. Call only once
// setupProblems() is empty.
export function createTournament(input: SetupInput, { now, newId, rng }: CreateDeps): Tournament {
  const players = cleanPlayerNames(input.playerNames).map((name) => ({ id: newId(), name }))
  return {
    version: 1,
    id: newId(),
    name: input.name.trim(),
    createdAt: now,
    scoringMode: input.scoringMode,
    target: input.target,
    courts: input.courts,
    players,
    rounds: generateSchedule(
      players.map((p) => p.id),
      input.courts,
      input.roundCount,
      rng,
    ),
    finished: false,
  }
}

// The first round that still has a match without a score; equals
// rounds.length once every match is scored.
export function currentRoundIndex(tournament: Tournament): number {
  const i = tournament.rounds.findIndex((r) => r.matches.some((m) => m.score === null))
  return i === -1 ? tournament.rounds.length : i
}

// A copy of the tournament with one match's score set (or cleared with null).
// Matches are found by round and court number.
export function setScore(
  tournament: Tournament,
  roundIndex: number,
  court: number,
  score: Score | null,
): Tournament {
  return {
    ...tournament,
    rounds: tournament.rounds.map((round, r) =>
      r !== roundIndex
        ? round
        : { ...round, matches: round.matches.map((m) => (m.court === court ? { ...m, score } : m)) },
    ),
  }
}

export function unscoredMatchCount(tournament: Tournament): number {
  return tournament.rounds.flatMap((r) => r.matches).filter((m) => m.score === null).length
}
