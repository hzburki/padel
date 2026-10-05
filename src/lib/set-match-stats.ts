import type { MatchState } from "./set-match"
import type { Side } from "./types"

export interface TeamStats {
  sets: number
  games: number // a tie-break counts as one game, as it does in the set score
  points: number // every point won, tie-break points included; 0 when scored by games
  deuceGames: number // games won after reaching 40–40, by either deuce rule; 0 when scored by games
  bestRun: number // most games won in a row, carried across sets
}

// Both teams' numbers for the match so far, first team first.
export function matchStats(state: MatchState): [TeamStats, TeamStats] {
  const stats: [TeamStats, TeamStats] = [
    { sets: state.setsWon[0], games: 0, points: state.current.points[0], deuceGames: 0, bestRun: 0 },
    { sets: state.setsWon[1], games: 0, points: state.current.points[1], deuceGames: 0, bestRun: 0 },
  ]
  let runSide: Side | null = null
  let run = 0

  for (const game of state.sets.flatMap((set) => set.played)) {
    const winner = stats[game.winner]
    stats[0].points += game.points?.[0] ?? 0
    stats[1].points += game.points?.[1] ?? 0
    winner.games++
    if (game.deuce) winner.deuceGames++

    run = game.winner === runSide ? run + 1 : 1
    runSide = game.winner
    winner.bestRun = Math.max(winner.bestRun, run)
  }
  return stats
}
