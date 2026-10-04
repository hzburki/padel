import { countGamesPlayed, courtsInPlay, pickBench, shuffle, type Rng } from "./bench"
import type { Match, PlayerId, Round } from "./types"

// Rounds needed for everyone to partner everyone else once: every pair of
// players needs one partnership, and each match makes two.
export function suggestedRoundCount(playerCount: number, courts: number): number {
  const pairs = (playerCount * (playerCount - 1)) / 2
  const perRound = 2 * courtsInPlay(playerCount, courts)
  return Math.ceil(pairs / perRound)
}

// The whole Americano schedule, made before round 1. Each round benches whoever
// has the most games (see bench.ts), then arranges the rest to avoid repeat
// partners first and repeat opponents second. Results never change it.
export function generateSchedule(
  players: PlayerId[],
  courts: number,
  roundCount: number,
  rng: Rng = Math.random,
): Round[] {
  // A few full attempts with different random choices; keep the fairest.
  let best: Round[] = []
  let bestCost = Infinity
  for (let attempt = 0; attempt < 8; attempt++) {
    const rounds = buildSchedule(players, courts, roundCount, rng)
    const cost = scheduleCost(rounds)
    if (cost < bestCost) {
      best = rounds
      bestCost = cost
    }
  }
  return best
}

// Repeating a partner is far worse than facing someone again.
const PARTNER_WEIGHT = 100
const OPPONENT_WEIGHT = 1

type Counts = Map<string, number>
const key = (x: PlayerId, y: PlayerId) => (x < y ? `${x}|${y}` : `${y}|${x}`)
const get = (counts: Counts, x: PlayerId, y: PlayerId) => counts.get(key(x, y)) ?? 0
const bump = (counts: Counts, x: PlayerId, y: PlayerId) => counts.set(key(x, y), get(counts, x, y) + 1)

function buildSchedule(players: PlayerId[], courts: number, roundCount: number, rng: Rng): Round[] {
  const rounds: Round[] = []
  const partners: Counts = new Map()
  const opponents: Counts = new Map()

  for (let r = 0; r < roundCount; r++) {
    const benched = pickBench(players, countGamesPlayed(players, rounds), courts, rng)
    const playing = players.filter((id) => !benched.includes(id))
    const order = arrangeRound(playing, partners, opponents, rng)

    const matches: Match[] = []
    for (let m = 0; m < order.length / 4; m++) {
      const [a1, a2, b1, b2] = order.slice(m * 4, m * 4 + 4)
      matches.push({ court: m + 1, teamA: [a1, a2], teamB: [b1, b2], score: null })
      bump(partners, a1, a2)
      bump(partners, b1, b2)
      for (const a of [a1, a2]) for (const b of [b1, b2]) bump(opponents, a, b)
    }
    rounds.push({ matches, benched })
  }
  return rounds
}

// Order the playing players so that each block of four is one match
// (first two vs last two), keeping the round's repeat cost as low as possible:
// a few random starts, each improved by swapping players until no swap helps.
function arrangeRound(playing: PlayerId[], partners: Counts, opponents: Counts, rng: Rng): PlayerId[] {
  const matchCost = (order: PlayerId[], m: number) => {
    const [a1, a2, b1, b2] = order.slice(m * 4, m * 4 + 4)
    let cost = PARTNER_WEIGHT * (get(partners, a1, a2) + get(partners, b1, b2))
    for (const a of [a1, a2]) for (const b of [b1, b2]) cost += OPPONENT_WEIGHT * get(opponents, a, b)
    return cost
  }
  const totalCost = (order: PlayerId[]) => {
    let cost = 0
    for (let m = 0; m < order.length / 4; m++) cost += matchCost(order, m)
    return cost
  }

  let best = playing
  let bestCost = Infinity
  for (let start = 0; start < 6; start++) {
    const order = shuffle(playing, rng)
    let improved = true
    while (improved) {
      improved = false
      for (let i = 0; i < order.length; i++) {
        for (let j = i + 1; j < order.length; j++) {
          const mi = Math.floor(i / 4)
          const mj = Math.floor(j / 4)
          const before = matchCost(order, mi) + (mi === mj ? 0 : matchCost(order, mj))
          ;[order[i], order[j]] = [order[j], order[i]]
          const after = matchCost(order, mi) + (mi === mj ? 0 : matchCost(order, mj))
          if (after < before) improved = true
          else [order[i], order[j]] = [order[j], order[i]]
        }
      }
    }
    const cost = totalCost(order)
    if (cost < bestCost) {
      best = order
      bestCost = cost
    }
  }
  return best
}

// Sum of squared repeat counts: lower means partnerships and match-ups are
// spread more evenly across the schedule.
function scheduleCost(rounds: Round[]): number {
  const partners: Counts = new Map()
  const opponents: Counts = new Map()
  for (const { matches } of rounds) {
    for (const { teamA, teamB } of matches) {
      bump(partners, ...teamA)
      bump(partners, ...teamB)
      for (const a of teamA) for (const b of teamB) bump(opponents, a, b)
    }
  }
  let cost = 0
  for (const c of partners.values()) cost += PARTNER_WEIGHT * c * c
  for (const c of opponents.values()) cost += OPPONENT_WEIGHT * c * c
  return cost
}
