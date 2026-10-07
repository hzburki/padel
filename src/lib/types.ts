// The stored shapes: an Americano tournament or a match, told apart by
// `kind`. Bump `version` and add a migration in storage when either changes
// — events already saved in a browser must still load.

// total: the two scores always sum to the target (6–2 in an 8-point game).
// firstTo: the winner's score equals the target, the loser's is below it.
export type ScoringMode = "total" | "firstTo"

export type PlayerId = string

export interface Player {
  id: PlayerId
  name: string
}

export type Team = [PlayerId, PlayerId]

export interface Score {
  a: number
  b: number
}

export interface Match {
  court: number // 1-based
  teamA: Team
  teamB: Team
  score: Score | null // null until entered
}

export interface Round {
  matches: Match[]
  benched: PlayerId[] // who sat out this round; everyone not on a court
}

export interface Tournament {
  version: 2
  kind: "americano"
  id: string
  name: string
  createdAt: number // epoch ms
  scoringMode: ScoringMode
  target: number // 8–32
  courts: number // courts available; rounds use min(courts, floor(players / 4))
  players: Player[]
  // Every round is generated at creation; scores fill in as they are played.
  rounds: Round[]
  finished: boolean
  // Set on a copy opened from a friend's link. It can be read here, not
  // changed: only the organiser's phone holds the real game.
  shared?: true
}

// One 2 v 2 match played in sets. Sides are 0 and 1, indexing `teams`.
export type Side = 0 | 1

// What happens at 40–40. advantage: two points in a row win the game.
// golden: the next point wins it.
export type DeuceRule = "advantage" | "golden"

// How the score is entered. points: every point is tapped in. games: only
// who won each game, for players who don't want to tap every point.
export type ScoreBy = "points" | "games"

export interface SetMatch {
  version: 2
  kind: "match"
  id: string
  name: string
  createdAt: number // epoch ms
  teams: [[string, string], [string, string]] // player names
  bestOf: 1 | 3 | 5 // sets
  // How the organiser chose the length, and so how it is worded: "best of 3"
  // or "first to 2 sets". The rules are the same either way.
  setsAs: "bestOf" | "firstTo"
  gamesPerSet: number // 2–9; a tie-break is played when both teams reach it
  deuce: DeuceRule // not used when scoring by games
  scoreBy: ScoreBy
  // Who won each point, in order — or who won each game, when `scoreBy` is
  // "games". The only score data stored: games, sets and the winner are
  // worked out from it.
  points: Side[]
  finished: boolean
  shared?: true // a copy from a friend's link, as on a tournament
}

export type SavedEvent = Tournament | SetMatch
