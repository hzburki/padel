import type { DeuceRule, SetMatch, Side } from "./types"

export const MIN_GAMES_PER_SET = 2
export const MAX_GAMES_PER_SET = 9

const TIEBREAK_TARGET = 7

export type MatchRules = Pick<SetMatch, "bestOf" | "gamesPerSet" | "deuce">

export interface GameResult {
  winner: Side
  points: [number, number] // points won by each side, counted 1, 2, 3
  tiebreak: boolean
  deuce: boolean // reached 40–40
  golden: boolean // decided by the single point at 40–40
}

export interface SetState {
  games: [number, number]
  winner: Side | null
  played: GameResult[]
}

export interface MatchState {
  sets: SetState[] // the last one is in progress unless the match is decided
  setsWon: [number, number]
  current: { points: [number, number]; tiebreak: boolean } // the game in progress
  winner: Side | null
}

// The whole match worked out from the point log. Points logged after the
// match is decided are ignored.
export function replay(rules: MatchRules, points: Side[]): MatchState {
  const setsToWin = Math.ceil(rules.bestOf / 2)
  const sets: SetState[] = [newSet()]
  const setsWon: [number, number] = [0, 0]
  let game: [number, number] = [0, 0]
  let deuce = false
  let winner: Side | null = null

  for (const side of points) {
    if (winner !== null) break
    const set = sets[sets.length - 1]
    const tiebreak = isTiebreak(set, rules.gamesPerSet)

    game[side]++
    if (!tiebreak && game[0] === 3 && game[1] === 3) deuce = true
    if (!gameWon(game, side, tiebreak, rules.deuce)) continue

    set.played.push({ winner: side, points: game, tiebreak, deuce, golden: deuce && rules.deuce === "golden" })
    set.games[side]++
    game = [0, 0]
    deuce = false
    // A tie-break is the deciding game, so whoever takes it takes the set.
    if (!tiebreak && !setWon(set.games, side, rules.gamesPerSet)) continue

    set.winner = side
    setsWon[side]++
    if (setsWon[side] === setsToWin) winner = side
    else sets.push(newSet())
  }

  const tiebreak = winner === null && isTiebreak(sets[sets.length - 1], rules.gamesPerSet)
  return { sets, setsWon, current: { points: game, tiebreak }, winner }
}

function newSet(): SetState {
  return { games: [0, 0], winner: null, played: [] }
}

function isTiebreak(set: SetState, gamesPerSet: number): boolean {
  return set.games[0] === gamesPerSet && set.games[1] === gamesPerSet
}

function gameWon(game: [number, number], side: Side, tiebreak: boolean, rule: DeuceRule): boolean {
  const mine = game[side]
  const theirs = game[other(side)]
  // The golden point only applies to ordinary games, never to a tie-break.
  if (!tiebreak && rule === "golden") return mine >= 4
  return mine >= (tiebreak ? TIEBREAK_TARGET : 4) && mine - theirs >= 2
}

function setWon(games: [number, number], side: Side, gamesPerSet: number): boolean {
  return games[side] >= gamesPerSet && games[side] - games[other(side)] >= 2
}

function other(side: Side): Side {
  return side === 0 ? 1 : 0
}

// A pair's name wherever the match is shown: "Ali & Sara".
export function teamName(team: [string, string]): string {
  return team.join(" & ")
}

const CALLS = ["0", "15", "30", "40"]

// How the game in progress is called: 0, 15, 30, 40 and Ad, or plain
// numbers in a tie-break.
export function pointLabels(state: MatchState): [string, string] {
  const [a, b] = state.current.points
  if (state.current.tiebreak) return [String(a), String(b)]
  if (a >= 3 && b >= 3) return [a > b ? "Ad" : "40", b > a ? "Ad" : "40"]
  return [CALLS[a], CALLS[b]]
}

// How a finished game went, in the words players use: "To 15" when the
// loser got one point, "After deuce", "Golden point", "Tie-break 7–4".
export function gameSummary(game: GameResult): string {
  const won = game.points[game.winner]
  const lost = game.points[other(game.winner)]
  if (game.tiebreak) return `Tie-break ${won}–${lost}`
  if (game.golden) return "Golden point"
  if (game.deuce) return "After deuce"
  return `To ${lost === 0 ? "love" : CALLS[lost]}`
}

// A copy of the match with one more point. Unchanged once the match is
// decided or finished.
export function addPoint(match: SetMatch, side: Side): SetMatch {
  if (match.finished || replay(match, match.points).winner !== null) return match
  return { ...match, points: [...match.points, side] }
}

// A copy of the match without its last point. Unchanged once finished.
export function undoPoint(match: SetMatch): SetMatch {
  if (match.finished || match.points.length === 0) return match
  return { ...match, points: match.points.slice(0, -1) }
}

// The set scores in order, first team's games first: "6–4 3–6 7–6". A set
// with no game played yet is left out.
export function formatSets(state: MatchState): string {
  return state.sets
    .filter((set) => set.played.length > 0)
    .map((set) => `${set.games[0]}–${set.games[1]}`)
    .join(" ")
}
