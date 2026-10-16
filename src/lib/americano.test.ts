import { describe, expect, it } from "vitest"
import { continueSchedule, equalGamesCycle, gamesSplit, generateSchedule, sameMatchesRounds, suggestedRoundCount } from "./americano"
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

  it("rounds 6 players on 1 court up from 8 to 9 rounds so everyone plays 6 games", () => {
    expect(suggestedRoundCount(6, 1)).toBe(9)
    expect(gamesSplit(6, 1, 9)).toEqual({ fewer: 6, more: 6, playersWithFewer: 0 })
  })

  it("rounds 7 players on 1 court up from 11 to 14 rounds so everyone plays 8 games", () => {
    expect(suggestedRoundCount(7, 1)).toBe(14)
  })

  it("always suggests a count where everyone plays the same number of games, for 4 to 24 players", () => {
    for (let n = 4; n <= 24; n++) {
      for (let courts = 1; courts <= 6; courts++) {
        expect(gamesSplit(n, courts, suggestedRoundCount(n, courts)).playersWithFewer).toBe(0)
      }
    }
  })
})

describe("equalGamesCycle", () => {
  it("is 1 round when every player is on a court each round", () => {
    expect(equalGamesCycle(8, 2)).toBe(1)
  })

  it("is 5 rounds for 5 players on 1 court, one sit-out each", () => {
    expect(equalGamesCycle(5, 1)).toBe(5)
  })

  it("is 3 rounds for 12 players on 2 courts", () => {
    expect(equalGamesCycle(12, 2)).toBe(3)
  })
})

describe("gamesSplit", () => {
  it("says everyone plays the same when the rounds come out even", () => {
    expect(gamesSplit(9, 2, 9)).toEqual({ fewer: 8, more: 8, playersWithFewer: 0 })
  })

  it("says how many players get one game fewer when they don't", () => {
    // 9 players, 2 courts, 4 rounds: 32 places, so 5 play 4 games and 4 play 3.
    expect(gamesSplit(9, 2, 4)).toEqual({ fewer: 3, more: 4, playersWithFewer: 4 })
  })

  it("matches what the generated schedule actually gives each player", () => {
    const players = ids(9)
    const counts = [...countGamesPlayed(players, generateSchedule(players, 2, 4, seededRng(2))).values()]
    expect(counts.filter((c) => c === 3)).toHaveLength(4)
    expect(counts.filter((c) => c === 4)).toHaveLength(5)
  })
})

describe("sameMatchesRounds", () => {
  // Each case: games each player still in has, places a round from now (4 a
  // court in play), then rounds left, places and players before the change.
  const rounds = (games: number[], places: number, [r, p, n]: [number, number, number], maxRounds = 99) =>
    sameMatchesRounds({ games, places, before: { rounds: r, places: p, players: n }, maxRounds })
  const all = (n: number, games: number) => Array<number>(n).fill(games)

  it("keeps the rounds left when nobody joins or leaves", () => {
    expect(rounds(all(8, 3), 8, [4, 8, 8])).toBe(4)
  })

  it("adds a round when a ninth player joins 8 on 2 courts", () => {
    // Everyone was due 4 more games: 4.5 rounds for 9 players, ties go to more.
    expect(rounds(all(9, 3), 8, [4, 8, 8])).toBe(5)
  })

  it("takes a round away when 6 on 1 court drop to 5", () => {
    // Everyone was due 4 more games: 5 rounds for 5 players, all level.
    expect(rounds(all(5, 2), 4, [6, 4, 6])).toBe(5)
  })

  it("adds rounds when a leave drops 8 players on 2 courts to 7 on 1", () => {
    // Everyone was due 4 more games, now 4 places a round: 7 rounds, all level.
    expect(rounds(all(7, 3), 4, [4, 8, 8])).toBe(7)
  })

  it("picks a count within a round where everyone ends level over a closer uneven one", () => {
    // 5 to 6 players on 1 court: the target is 3.6 rounds; 4 leaves them a
    // game apart, 3 leaves everyone on 5.
    expect(rounds(all(6, 3), 4, [3, 4, 5])).toBe(3)
  })

  it("never plays more rounds than allowed", () => {
    expect(rounds(all(9, 3), 8, [4, 8, 8], 3)).toBe(3)
  })

  it("plays every round allowed when even one game apart is out of reach", () => {
    expect(rounds([10, 10, 10, 10, 0], 4, [3, 4, 5], 5)).toBe(5)
  })

  it("always plays at least one more round", () => {
    expect(rounds(all(4, 2), 4, [0, 4, 4])).toBe(1)
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

describe("continueSchedule", () => {
  const placed = (round: Round) => [...round.matches.flatMap((m) => [...m.teamA, ...m.teamB]), ...round.benched]

  it("makes only the new rounds, without a score", () => {
    const kept = generateSchedule(ids(8), 2, 3, seededRng(1))
    const rounds = continueSchedule(kept, ids(8), countGamesPlayed(ids(8), kept), 2, 4, seededRng(2))
    expect(rounds).toHaveLength(4)
    expect(rounds.flatMap((r) => r.matches).every((m) => m.score === null)).toBe(true)
  })

  it("never places a player who has left", () => {
    const kept = generateSchedule(ids(9), 2, 3, seededRng(1))
    const stillIn = ids(9).filter((id) => id !== "p4")
    for (const round of continueSchedule(kept, stillIn, countGamesPlayed(stillIn, kept), 2, 5, seededRng(2))) {
      expect(placed(round).sort()).toEqual(stillIn.sort())
    }
  })

  it("uses min(courts, floor(players in / 4)) courts", () => {
    const kept = generateSchedule(ids(8), 2, 2, seededRng(1))
    const stillIn = ids(7)
    for (const round of continueSchedule(kept, stillIn, countGamesPlayed(stillIn, kept), 2, 4, seededRng(2))) {
      expect(round.matches.map((m) => m.court)).toEqual([1])
      expect(round.benched).toHaveLength(3)
    }
  })

  it("counts partners from kept rounds when rebuilding", () => {
    const kept = generateSchedule(ids(4), 1, 1, seededRng(1))
    const rounds = continueSchedule(kept, ids(4), countGamesPlayed(ids(4), kept), 1, 2, seededRng(2))
    const counts = partnerCounts([...kept, ...rounds])
    expect(counts.size).toBe(allPairs(4))
    expect(Math.max(...counts.values())).toBe(1)
  })

  it("benches by the games each player starts with", () => {
    const start = new Map(ids(5).map((id) => [id, id === "p3" ? 5 : 4]))
    const [round] = continueSchedule([], ids(5), start, 1, 1, seededRng(1))
    expect(round.benched).toEqual(["p3"])
  })

  it("a joiner sits out as often as the others", () => {
    const kept = generateSchedule(ids(5), 1, 5, seededRng(1))
    const players = [...ids(5), "p6"]
    // Everyone has 4 games; p6 joins and counts as having 4.
    const start = new Map(players.map((id) => [id, 4]))
    const rounds = continueSchedule(kept, players, start, 1, 3, seededRng(2))
    const games = countGamesPlayed(players, rounds)
    expect(Math.max(...games.values())).toBe(2)
    expect(Math.min(...games.values())).toBe(2)
  })

  it("keeps everyone within one game, counting the starting games, after every new round", () => {
    const kept = generateSchedule(ids(9), 2, 4, seededRng(1))
    const players = [...ids(9).filter((id) => id !== "p2"), "p10", "p11"]
    const start = new Map(players.map((id) => [id, countGamesPlayed(ids(9), kept).get(id) ?? 3]))
    const rounds = continueSchedule(kept, players, start, 2, 8, seededRng(2))
    for (let r = 1; r <= rounds.length; r++) {
      const played = countGamesPlayed(players, rounds.slice(0, r))
      const counts = players.map((id) => start.get(id)! + played.get(id)!)
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    }
  })

  it("leaves the kept rounds as they are", () => {
    const kept = generateSchedule(ids(8), 2, 3, seededRng(1))
    const copy = structuredClone(kept)
    continueSchedule(kept, ids(8), countGamesPlayed(ids(8), kept), 2, 4, seededRng(2))
    expect(kept).toEqual(copy)
  })
})
