import { continueSchedule, generateSchedule, sameMatchesRounds } from "./americano"
import { courtsInPlay, gamesCounted, shuffle, type Rng } from "./bench"
import { isValidTarget, MAX_TARGET, MIN_TARGET } from "./scoring"
import type { Player, PlayerId, SavedEvent, Score, ScoringMode, Tournament } from "./types"

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
  return capitaliseFirst(name.trim())
}

// For a name still being typed: the first letter goes upper case straight
// away, and nothing else is touched, so spaces can still be typed.
export function capitaliseFirst(name: string): string {
  const n = name.trimStart()
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

// Where a name repeats one earlier in the list, ignoring case and the
// spaces around it. The first of the two is left alone, and so are blanks.
export function repeatedNames(names: string[]): Set<number> {
  const seen = new Set<string>()
  const repeated = new Set<number>()
  names.forEach((name, i) => {
    const k = name.trim().toLowerCase()
    if (k === "") return
    if (seen.has(k)) repeated.add(i)
    seen.add(k)
  })
  return repeated
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
    version: 3,
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
// people still in and the settings, not the schedule or the scores.
export interface PreviousSetup {
  playerNames: string[]
  courts: number
  target: number
  scoringMode: ScoringMode
}

export function previousSetup(tournament: Tournament): PreviousSetup {
  return {
    playerNames: tournament.players.filter((p) => !p.left).map((p) => p.name),
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
  // A player who left may share a name with one still in.
  const namesIn = names.filter((n, i) => n !== "" && !tournament.players[i]?.left)
  const duplicate = duplicateName(namesIn)
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

// After a player joins or leaves: keep the rounds left as they are, or
// change them so everyone plays about the games they were due.
export type HowLong = "sameTime" | "sameMatches"

// The first round a player change can rebuild: the one after the last round
// with any score. Rounds before it are kept as they are.
export function firstOpenRound(tournament: Tournament): number {
  const lastScored = tournament.rounds.findLastIndex((r) => r.matches.some((m) => m.score !== null))
  return lastScored + 1
}

const stillIn = (players: Player[]) => players.filter((p) => !p.left)

// How many rounds are left after the change to `players` (the whole new
// list, players who left included).
function roundsLeft(tournament: Tournament, players: Player[], howLong: HowLong): number {
  const from = firstOpenRound(tournament)
  const maxRounds = MAX_ROUNDS - from
  const left = tournament.rounds.length - from
  if (howLong === "sameTime") return Math.min(left, maxRounds)
  const before = stillIn(tournament.players).length
  const after = stillIn(players).length
  return sameMatchesRounds({
    games: [...gamesCounted(players, tournament.rounds.slice(0, from)).values()],
    places: 4 * courtsInPlay(after, tournament.courts),
    before: { rounds: left, places: 4 * courtsInPlay(before, tournament.courts), players: before },
    maxRounds,
  })
}

// The tournament with the new player list and every round after the kept
// ones made again, for the players still in.
function rebuild(tournament: Tournament, players: Player[], howLong: HowLong, rng?: Rng): Tournament {
  const from = firstOpenRound(tournament)
  const kept = tournament.rounds.slice(0, from)
  const rounds = continueSchedule(
    kept,
    stillIn(players).map((p) => p.id),
    gamesCounted(players, kept),
    tournament.courts,
    roundsLeft(tournament, players, howLong),
    rng,
  )
  return { ...tournament, players, rounds: [...kept, ...rounds] }
}

// Why no player can join or leave right now, or null if they can.
export function cannotChangePlayers(tournament: Tournament): string | null {
  if (tournament.finished) return "The tournament is finished."
  if (firstOpenRound(tournament) === tournament.rounds.length) return "All rounds are played. Finish the tournament."
  return null
}

// What stops a player from being added, worded for the organiser.
export function addPlayerProblems(tournament: Tournament, name: string): string[] {
  const stop = cannotChangePlayers(tournament)
  if (stop) return [stop]
  const clean = cleanPlayerName(name)
  if (clean === "") return ["Type a name."]
  // A player who left can come back under the same name, as a new player.
  if (stillIn(tournament.players).some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
    return [`${clean} is taken in this tournament. Pick another name.`]
  }
  return []
}

// Rounds left after adding a player, for the organiser to see before confirming.
export function roundsLeftAfterAdd(tournament: Tournament, howLong: HowLong): number {
  return roundsLeft(tournament, [...tournament.players, newPlayer(tournament, "", "")], howLong)
}

function newPlayer(tournament: Tournament, id: PlayerId, name: string): Player {
  return { id, name: cleanPlayerName(name), joinedAt: firstOpenRound(tournament) }
}

// A copy with one more player, who plays from the round after the last one
// with a score. The rounds up to it are kept; the rest are made again. Call
// only once addPlayerProblems() is empty.
export function addPlayer(
  tournament: Tournament,
  name: string,
  howLong: HowLong,
  { newId, rng }: { newId: () => string; rng?: Rng },
): Tournament {
  return rebuild(tournament, [...tournament.players, newPlayer(tournament, newId(), name)], howLong, rng)
}

// What stops a player from being removed, worded for the organiser.
export function removePlayerProblems(tournament: Tournament): string[] {
  const stop = cannotChangePlayers(tournament)
  if (stop) return [stop]
  if (stillIn(tournament.players).length <= MIN_PLAYERS) return [`At least ${MIN_PLAYERS} players must stay in.`]
  return []
}

function withLeaver(tournament: Tournament, id: PlayerId, scaleUp: boolean): Player[] {
  return tournament.players.map((p) => (p.id === id ? { ...p, left: { scaleUp } } : p))
}

// The leaver taken out of any unscored match in the kept rounds (the partly
// scored one). The player sitting out with the fewest games takes their
// place, ties picked at random, so the other 3 keep their match. With nobody
// sitting out, the match is dropped and the other 3 sit out instead.
function withoutLeaverInKeptRounds(tournament: Tournament, id: PlayerId, rng: Rng = Math.random): Tournament {
  const from = firstOpenRound(tournament)
  const rounds = tournament.rounds.map((round, r) => {
    const match = round.matches.find((m) => m.score === null && [...m.teamA, ...m.teamB].includes(id))
    if (r >= from || !match) return round
    const games = gamesCounted(tournament.players, tournament.rounds.slice(0, r))
    const sub = shuffle(round.benched, rng).sort((x, y) => (games.get(x) ?? 0) - (games.get(y) ?? 0))[0]
    if (sub === undefined) {
      return {
        matches: round.matches.filter((m) => m !== match),
        benched: [...round.benched, ...match.teamA, ...match.teamB].filter((p) => p !== id),
      }
    }
    const swap = (team: [PlayerId, PlayerId]) => team.map((p) => (p === id ? sub : p)) as [PlayerId, PlayerId]
    return {
      matches: round.matches.map((m) => (m === match ? { ...m, teamA: swap(m.teamA), teamB: swap(m.teamB) } : m)),
      benched: round.benched.filter((p) => p !== sub),
    }
  })
  return { ...tournament, rounds }
}

// Rounds left after removing a player, for the organiser to see before confirming.
export function roundsLeftAfterRemove(tournament: Tournament, id: PlayerId, howLong: HowLong): number {
  return roundsLeft(withoutLeaverInKeptRounds(tournament, id), withLeaver(tournament, id, true), howLong)
}

// A copy where the player has left: their scored games stay and they play
// no more. The rounds up to the last one with a score are kept, with someone
// else in their unscored match there; the rest are made again without them.
// Call only once removePlayerProblems() is empty.
export function removePlayer(
  tournament: Tournament,
  id: PlayerId,
  howLong: HowLong,
  scaleUp: boolean,
  rng?: Rng,
): Tournament {
  return rebuild(withoutLeaverInKeptRounds(tournament, id, rng), withLeaver(tournament, id, scaleUp), howLong, rng)
}

// How many of `before`'s scores are gone in `after` because their match was
// made again with other players: another organiser changed the players just
// as this phone scored it. That score has to be entered again.
export function scoresMadeAgain(before: Tournament, after: Tournament): number {
  const teams = (m: { teamA: PlayerId[]; teamB: PlayerId[] }) => [...m.teamA, ...m.teamB].join()
  return before.rounds.flatMap((round, r) =>
    round.matches.filter((m) => {
      const now = after.rounds[r]?.matches.find((n) => n.court === m.court)
      return m.score !== null && (!now || (now.score === null && teams(now) !== teams(m)))
    }),
  ).length
}

// The pre-filled name: what kind of game it is and the day it's played,
// kept short, in the phone's language and date order ("Match, Sun 4 Oct").
export function defaultGameName(kind: SavedEvent["kind"], date: Date, locale?: string): string {
  const what = kind === "match" ? "Match" : "Americano"
  return `${what}, ${date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}`
}
