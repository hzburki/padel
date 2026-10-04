import { describe, expect, it } from "vitest"
import { generateSchedule, suggestedRoundCount } from "./americano"
import { countGamesPlayed, type Rng } from "./bench"
import type { PlayerId, Round } from "./types"

const ids = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

// mulberry32, so schedules are repeatable in tests.
function seededRng(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

function partnerCounts(rounds: Round[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { matches } of rounds) {
    for (const team of matches.flatMap((m) => [m.teamA, m.teamB])) {
      const key = [...team].sort().join("+")
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

const allPairs = (n: number) => (n * (n - 1)) / 2

describe("suggestedRoundCount", () => {
  it("suggests 3 rounds for 4 players on 1 court", () => {
    expect(suggestedRoundCount(4, 1)).toBe(3)
  })

  it("suggests 5 rounds for 5 players on 1 court", () => {
    expect(suggestedRoundCount(5, 1)).toBe(5)
  })

  it("suggests 7 rounds for 8 players on 2 courts", () => {
    expect(suggestedRoundCount(8, 2)).toBe(7)
  })

  it("suggests more rounds when there are fewer courts for the same players", () => {
    expect(suggestedRoundCount(16, 4)).toBe(15)
    expect(suggestedRoundCount(16, 2)).toBe(30)
  })
})

describe("generateSchedule", () => {
  it("makes exactly the number of rounds asked for", () => {
    expect(generateSchedule(ids(8), 2, 4, seededRng(1))).toHaveLength(4)
  })

  it("starts every match without a score", () => {
    const rounds = generateSchedule(ids(8), 2, 7, seededRng(1))
    expect(rounds.flatMap((r) => r.matches).every((m) => m.score === null)).toBe(true)
  })

  it("puts every player on exactly one court or the bench each round", () => {
    for (const [n, courts] of [[5, 1], [9, 2], [12, 2], [14, 3]]) {
      for (const round of generateSchedule(ids(n), courts, 6, seededRng(n))) {
        const placed = [...round.matches.flatMap((m) => [...m.teamA, ...m.teamB]), ...round.benched]
        expect(placed.sort()).toEqual(ids(n).sort())
      }
    }
  })

  it("uses two courts and benches one player when 9 play on 2 courts", () => {
    for (const round of generateSchedule(ids(9), 2, 9, seededRng(3))) {
      expect(round.matches.map((m) => m.court)).toEqual([1, 2])
      expect(round.benched).toHaveLength(1)
    }
  })

  it("keeps everyone within one game of each other after every round", () => {
    for (const [n, courts] of [[5, 1], [6, 1], [7, 1], [9, 2], [12, 2], [13, 3]]) {
      const players = ids(n)
      const rounds = generateSchedule(players, courts, suggestedRoundCount(n, courts), seededRng(n))
      for (let r = 1; r <= rounds.length; r++) {
        const counts = [...countGamesPlayed(players, rounds.slice(0, r)).values()]
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
      }
    }
  })

  it("has 4 players partner each other exactly once over 3 rounds", () => {
    const counts = partnerCounts(generateSchedule(ids(4), 1, 3, seededRng(1)))
    expect(counts.size).toBe(allPairs(4))
    expect(Math.max(...counts.values())).toBe(1)
  })

  it("has 5 players each sit once and partner everyone once over 5 rounds", () => {
    const rounds = generateSchedule(ids(5), 1, 5, seededRng(1))
    expect(rounds.flatMap((r) => r.benched).sort()).toEqual(ids(5).sort())
    const counts = partnerCounts(rounds)
    expect(counts.size).toBe(allPairs(5))
    expect(Math.max(...counts.values())).toBe(1)
  })

  it("has 8 players on 2 courts partner everyone exactly once over 7 rounds", () => {
    const counts = partnerCounts(generateSchedule(ids(8), 2, 7, seededRng(1)))
    expect(counts.size).toBe(allPairs(8))
    expect(Math.max(...counts.values())).toBe(1)
  })

  it("has 9 players on 2 courts each sit once and partner everyone once over 9 rounds", () => {
    const rounds = generateSchedule(ids(9), 2, 9, seededRng(1))
    expect(rounds.flatMap((r) => r.benched).sort()).toEqual(ids(9).sort())
    const counts = partnerCounts(rounds)
    expect(counts.size).toBe(allPairs(9))
    expect(Math.max(...counts.values())).toBe(1)
  })

  it("never pairs the same partners three times when the suggested round count is used", () => {
    for (const [n, courts] of [[6, 1], [7, 1], [10, 2], [12, 2], [16, 2]]) {
      const counts = partnerCounts(generateSchedule(ids(n), courts, suggestedRoundCount(n, courts), seededRng(n)))
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2)
    }
  })

  it("makes the same schedule from the same random seed", () => {
    expect(generateSchedule(ids(9), 2, 5, seededRng(42))).toEqual(generateSchedule(ids(9), 2, 5, seededRng(42)))
  })
})
