import { courtsInPlay, pickBench, shuffle, type Rng } from "./bench"
import type { Match, PlayerId, Round } from "./types"

// The suggested number of rounds: enough for everyone to partner everyone
// else once, rounded up so that everyone ends on the same number of games.
export function suggestedRoundCount(playerCount: number, courts: number): number {
  const pairs = (playerCount * (playerCount - 1)) / 2
  const perRound = 2 * courtsInPlay(playerCount, courts)
  const rotation = Math.ceil(pairs / perRound)
  const cycle = equalGamesCycle(playerCount, courts)
  return Math.ceil(rotation / cycle) * cycle
}

// Fewest rounds after which everyone has played the same number of games.
// Each round fills 4 × courts-in-play places; games come out equal once the
// total number of places is a multiple of the player count.
export function equalGamesCycle(playerCount: number, courts: number): number {
  const places = 4 * courtsInPlay(playerCount, courts)
  return playerCount / gcd(playerCount, places)
}

export interface GamesSplit {
  fewer: number // games for the players who play less
  more: number // games for everyone else
  playersWithFewer: number // 0 when everyone plays the same number of games
}

// How many games each player gets over a schedule of this length. Because
// the bench always picks whoever has the most games, nobody is ever more
// than one game behind.
export function gamesSplit(playerCount: number, courts: number, roundCount: number): GamesSplit {
  const places = roundCount * 4 * courtsInPlay(playerCount, courts)
  const fewer = Math.floor(places / playerCount)
  const extra = places % playerCount
  return extra === 0
    ? { fewer, more: fewer, playersWithFewer: 0 }
    : { fewer, more: fewer + 1, playersWithFewer: playerCount - extra }
}

export interface SameMatchesInput {
  games: number[] // games each player still in counts as having so far
  places: number // places filled each round from now: 4 × courts in play
  before: { rounds: number; places: number; players: number } // rounds left, places and players before the change
  maxRounds: number
}

// How many rounds to play after players join or leave, so that each player
// still in plays about as many more games as they were due before. The
// rounds are played out as the bench plays them, fewest games first, one
// game a round at most. A count within a round of the target where
// everyone ends level wins; failing that, the count closest to the target
// that leaves nobody more than one game apart; failing that, every round
// allowed. Ties go to more rounds. At least 1 round.
export function sameMatchesRounds({ games, places, before, maxRounds }: SameMatchesInput): number {
  const due = (before.rounds * before.places) / before.players
  const target = (due * games.length) / places
  const counts = [...games]
  const level: number[] = []
  const oneApart: number[] = []
  for (let rounds = 1; rounds <= maxRounds; rounds++) {
    counts.sort((x, y) => x - y)
    for (let i = 0; i < places; i++) counts[i]++
    const gap = Math.max(...counts) - Math.min(...counts)
    if (gap === 0 && Math.abs(rounds - target) <= 1) level.push(rounds)
    if (gap <= 1) oneApart.push(rounds)
  }
  const closest = (options: number[]) =>
    options.reduce((best, n) => (Math.abs(n - target) <= Math.abs(best - target) ? n : best))
  if (level.length > 0) return closest(level)
  if (oneApart.length > 0) return closest(oneApart)
  return maxRounds
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
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
  return continueSchedule([], players, new Map(), courts, roundCount, rng)
}

// The rounds to play after `kept`, made with the same rules for the players
// still in. Partners and opponents from the kept rounds count as already
// had; `startGames` is what each player counts as having so far (see
// gamesCounted in bench.ts). Returns only the new rounds.
export function continueSchedule(
  kept: Round[],
  players: PlayerId[],
  startGames: Map<PlayerId, number>,
  courts: number,
  roundCount: number,
  rng: Rng = Math.random,
): Round[] {
  // A few full attempts with different random choices; keep the fairest.
  let best: Round[] = []
  let bestCost = Infinity
  for (let attempt = 0; attempt < 8; attempt++) {
    const rounds = buildSchedule(kept, players, startGames, courts, roundCount, rng)
    const cost = scheduleCost([...kept, ...rounds])
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

function buildSchedule(
  kept: Round[],
  players: PlayerId[],
  startGames: Map<PlayerId, number>,
  courts: number,
  roundCount: number,
  rng: Rng,
): Round[] {
  const rounds: Round[] = []
  const { partners, opponents } = countPairings(kept)
  const games = new Map(players.map((id) => [id, startGames.get(id) ?? 0]))

  for (let r = 0; r < roundCount; r++) {
    const benched = pickBench(players, games, courts, rng)
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
    for (const id of playing) games.set(id, (games.get(id) ?? 0) + 1)
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

// How often each pair has partnered and faced each other in these rounds.
function countPairings(rounds: Round[]): { partners: Counts; opponents: Counts } {
  const partners: Counts = new Map()
  const opponents: Counts = new Map()
  for (const { matches } of rounds) {
    for (const { teamA, teamB } of matches) {
      bump(partners, ...teamA)
      bump(partners, ...teamB)
      for (const a of teamA) for (const b of teamB) bump(opponents, a, b)
    }
  }
  return { partners, opponents }
}

// Sum of squared repeat counts: lower means partnerships and match-ups are
// spread more evenly across the schedule.
function scheduleCost(rounds: Round[]): number {
  const { partners, opponents } = countPairings(rounds)
  let cost = 0
  for (const c of partners.values()) cost += PARTNER_WEIGHT * c * c
  for (const c of opponents.values()) cost += OPPONENT_WEIGHT * c * c
  return cost
}
