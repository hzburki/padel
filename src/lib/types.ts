// The stored shape of a tournament. Bump `version` and add a migration in
// storage when this changes — tournaments already saved in a browser must
// still load.

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
  benched: PlayerId[] // who sat out this round; empty when playerCount % 4 === 0
}

export interface Tournament {
  version: 1
  id: string
  name: string
  createdAt: number // epoch ms
  scoringMode: ScoringMode
  target: number // 8–32
  players: Player[]
  // Every round is generated at creation; scores fill in as they are played.
  rounds: Round[]
  finished: boolean
}
