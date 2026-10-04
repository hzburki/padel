import { describe, expect, it } from "vitest"
import { countGamesPlayed, pickBench, type Rng } from "./bench"
import type { PlayerId, Round } from "./types"

const ids = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

// Deterministic stand-in for Math.random so tie-breaks are repeatable
// (mulberry32: small consecutive seeds still give unrelated sequences).
function seededRng(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

// A round where everyone not benched plays, four to a court.
function roundWith(players: PlayerId[], benched: PlayerId[]): Round {
  const playing = players.filter((id) => !benched.includes(id))
  const matches = []
  for (let i = 0; i < playing.length; i += 4) {
    const [a, b, c, d] = playing.slice(i, i + 4)
    matches.push({ court: i / 4 + 1, teamA: [a, b] as [PlayerId, PlayerId], teamB: [c, d] as [PlayerId, PlayerId], score: null })
  }
  return { matches, benched }
}

describe("countGamesPlayed", () => {
  it("starts every player at zero before any round", () => {
    const games = countGamesPlayed(ids(5), [])
    expect([...games.values()]).toEqual([0, 0, 0, 0, 0])
  })

  it("counts one game for each player in a match and none for the benched player", () => {
    const players = ids(5)
    const games = countGamesPlayed(players, [roundWith(players, ["p5"])])
    expect(games.get("p1")).toBe(1)
    expect(games.get("p5")).toBe(0)
  })
})

describe("pickBench", () => {
  it("benches nobody when the player count is a multiple of 4", () => {
    expect(pickBench(ids(4), countGamesPlayed(ids(4), []))).toEqual([])
    expect(pickBench(ids(8), countGamesPlayed(ids(8), []))).toEqual([])
  })

  it("benches one player when 5 are entered, two when 6, three when 7", () => {
    for (const n of [5, 6, 7]) {
      expect(pickBench(ids(n), countGamesPlayed(ids(n), []))).toHaveLength(n % 4)
    }
  })

  it("benches the player with the most games when 5 are entered", () => {
    const players = ids(5)
    const games = new Map(players.map((id) => [id, 1]))
    games.set("p3", 2)
    expect(pickBench(players, games)).toEqual(["p3"])
  })

  it("never benches a player who has fewer games than someone left playing", () => {
    const players = ids(6)
    const games = new Map([["p1", 2], ["p2", 2], ["p3", 2], ["p4", 1], ["p5", 1], ["p6", 1]])
    for (let seed = 0; seed < 50; seed++) {
      const bench = pickBench(players, games, seededRng(seed))
      expect(bench).toHaveLength(2)
      expect(bench.every((id) => games.get(id) === 2)).toBe(true)
    }
  })

  it("breaks ties at random, so every tied player can end up benched", () => {
    const players = ids(5)
    const games = countGamesPlayed(players, [])
    const seen = new Set<PlayerId>()
    for (let seed = 0; seed < 100; seed++) seen.add(pickBench(players, games, seededRng(seed))[0])
    expect(seen).toEqual(new Set(players))
  })

  it("keeps everyone within one game of each other after every round, for 5 to 11 players", () => {
    for (let n = 5; n <= 11; n++) {
      const players = ids(n)
      const rng = seededRng(n)
      const rounds: Round[] = []
      for (let r = 0; r < 20; r++) {
        const bench = pickBench(players, countGamesPlayed(players, rounds), rng)
        rounds.push(roundWith(players, bench))
        const counts = [...countGamesPlayed(players, rounds).values()]
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
      }
    }
  })

  it("sits a different player out each round until all 5 have sat once", () => {
    const players = ids(5)
    const rng = seededRng(7)
    const rounds: Round[] = []
    for (let r = 0; r < 5; r++) {
      rounds.push(roundWith(players, pickBench(players, countGamesPlayed(players, rounds), rng)))
    }
    expect(new Set(rounds.flatMap((r) => r.benched))).toEqual(new Set(players))
  })
})
