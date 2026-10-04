import type { PlayerId, Round } from "./types"

export type Rng = () => number // returns [0, 1), like Math.random

// How many games each player has been scheduled into so far.
export function countGamesPlayed(players: PlayerId[], rounds: Round[]): Map<PlayerId, number> {
  const games = new Map(players.map((id) => [id, 0]))
  for (const round of rounds) {
    for (const match of round.matches) {
      for (const id of [...match.teamA, ...match.teamB]) {
        games.set(id, (games.get(id) ?? 0) + 1)
      }
    }
  }
  return games
}

// Who sits out the next round. Only the leftover players beyond a multiple of
// 4 sit, and they are the ones with the most games so far, ties broken at
// random. Repeating this every round keeps max(games) - min(games) <= 1.
export function pickBench(
  players: PlayerId[],
  gamesPlayed: Map<PlayerId, number>,
  rng: Rng = Math.random,
): PlayerId[] {
  const benchSize = players.length % 4
  if (benchSize === 0) return []

  // Shuffle first so the stable sort leaves tied players in random order.
  const shuffled = shuffle(players, rng)
  shuffled.sort((x, y) => (gamesPlayed.get(y) ?? 0) - (gamesPlayed.get(x) ?? 0))
  return shuffled.slice(0, benchSize)
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
