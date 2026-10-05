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
  return names.map(cleanPlayerName).filter((n) => n !== "")
}

// Trimmed, first letter upper case ("ana" → "Ana"); the rest is left as
// typed, so "McKay" or "de Vries" keep their own casing after the first letter.
export function cleanPlayerName(name: string): string {
  const n = name.trim()
  return n.charAt(0).toLocaleUpperCase() + n.slice(1)
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
  const duplicate = duplicateName(names)
  if (duplicate) problems.push(`Two players are called ${duplicate}. Give them different names.`)
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

// The first name that appears twice, ignoring case; null if all differ.
export function duplicateName(names: string[]): string | null {
  const seen = new Set<string>()
  for (const name of names) {
    const k = name.toLowerCase()
    if (seen.has(k)) return name
    seen.add(k)
  }
  return null
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
    version: 2,
    kind: "americano",
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

// What a new tournament starts from when the same group plays again: the
// people and the settings, not the schedule or the scores.
export interface PreviousSetup {
  playerNames: string[]
  courts: number
  target: number
  scoringMode: ScoringMode
}

export function previousSetup(tournament: Tournament): PreviousSetup {
  return {
    playerNames: tournament.players.map((p) => p.name),
    courts: tournament.courts,
    target: tournament.target,
    scoringMode: tournament.scoringMode,
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

// What stops a rename from being saved. `playerNames` is in the same order
// as tournament.players. Once finished, player names are fixed and ignored.
export function renameProblems(tournament: Tournament, name: string, playerNames: string[]): string[] {
  const problems: string[] = []
  if (name.trim() === "") problems.push("Give the tournament a name.")
  if (tournament.finished) return problems
  const names = playerNames.map((n) => n.trim())
  if (names.some((n) => n === "")) problems.push("Every player needs a name.")
  const duplicate = duplicateName(names.filter((n) => n !== ""))
  if (duplicate) problems.push(`Two players are called ${duplicate}. Give them different names.`)
  return problems
}

// A copy with new names. Only names change: player ids stay the same, so
// the schedule and every score still point at the right people. Once the
// tournament is finished only its own name can change.
export function renameTournament(tournament: Tournament, name: string, playerNames: string[]): Tournament {
  return {
    ...tournament,
    name: name.trim(),
    players: tournament.finished
      ? tournament.players
      : tournament.players.map((p, i) => ({ ...p, name: cleanPlayerName(playerNames[i] ?? "") || p.name })),
  }
}

// The pre-filled name: the day and date it's played, in the phone's
// language and date order ("Padel, Sunday 4 October").
export function defaultTournamentName(date: Date, locale?: string): string {
  return `Padel, ${date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}`
}
