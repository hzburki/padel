import { describe, expect, it } from "vitest"
import { replay, type MatchRules } from "./set-match"
import { matchStats } from "./set-match-stats"
import type { Side } from "./types"

const advantage: MatchRules = { bestOf: 3, gamesPerSet: 6, deuce: "advantage", scoreBy: "points" }
const golden: MatchRules = { ...advantage, deuce: "golden" }

// "0010" is three points to the first team and one to the second, in order.
function pts(sequence: string): Side[] {
  return [...sequence].map((c) => (c === "0" ? 0 : 1))
}

// Whole games won to love: "001" is two games to the first team, then one
// to the second.
function games(sequence: string): Side[] {
  return [...sequence].flatMap((c) => pts(c.repeat(4)))
}

const stats = (points: Side[], rules = advantage) => matchStats(replay(rules, points))

describe("matchStats", () => {
  it("gives zeros for a match with no points", () => {
    const zero = { sets: 0, games: 0, points: 0, deuceGames: 0, bestRun: 0 }
    expect(stats([])).toEqual([zero, zero])
  })

  it("counts sets and games won by each team", () => {
    const [first, second] = stats([...games("1111000000"), ...games("01")])
    expect(first).toMatchObject({ sets: 1, games: 7 })
    expect(second).toMatchObject({ sets: 0, games: 5 })
  })

  it("counts every point won, including the game still being played", () => {
    const [first, second] = stats(pts("00100" + "011"))
    expect(first.points).toBe(5)
    expect(second.points).toBe(3)
  })

  it("counts a tie-break as one game and its points as points", () => {
    const sixAll = games("000001111101")
    const [first, second] = stats([...sixAll, ...pts("11110000000")])
    expect(first).toMatchObject({ games: 7, points: 24 + 7 })
    expect(second).toMatchObject({ games: 6, points: 24 + 4 })
  })

  it("counts games won after 40–40 for the team that won them", () => {
    const [first, second] = stats(pts("00011100" + "0001111011" + "1111"))
    expect(first.deuceGames).toBe(1)
    expect(second.deuceGames).toBe(1)
  })

  it("counts a game won on a golden point as a game won after 40–40", () => {
    const [first, second] = stats(pts("0001110"), golden)
    expect(first.deuceGames).toBe(1)
    expect(second.deuceGames).toBe(0)
  })

  it("leaves a tie-break out of the games won after 40–40, however close it was", () => {
    const sixAll = games("000001111101")
    const [first] = stats([...sixAll, ...pts("000000111111" + "00")])
    expect(first.deuceGames).toBe(0)
  })

  it("finds each team's longest run of games won in a row", () => {
    const [first, second] = stats(games("0010001101"))
    expect(first.bestRun).toBe(3)
    expect(second.bestRun).toBe(2)
  })

  it("counts sets, games and runs but no points or deuce games when the match is scored by games", () => {
    const [first, second] = stats(pts("0001000" + "00"), { ...advantage, scoreBy: "games" })
    expect(first).toEqual({ sets: 1, games: 8, points: 0, deuceGames: 0, bestRun: 5 })
    expect(second).toEqual({ sets: 0, games: 1, points: 0, deuceGames: 0, bestRun: 1 })
  })

  it("carries a run of games across the end of a set", () => {
    const [first] = stats([...games("11000000"), ...games("00")])
    expect(first.bestRun).toBe(8)
  })
})
