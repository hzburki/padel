import { describe, expect, it } from "vitest"
import { computeStandings } from "./standings"
import type { Match, PlayerId, Round } from "./types"

const ids = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

// match("p1 p2", 6, 2, "p3 p4") — teamA scored 6, teamB scored 2.
function match(teamA: string, a: number | null, b: number | null, teamB: string, court = 1): Match {
  return {
    court,
    teamA: teamA.split(" ") as [PlayerId, PlayerId],
    teamB: teamB.split(" ") as [PlayerId, PlayerId],
    score: a === null || b === null ? null : { a, b },
  }
}
const round = (...matches: Match[]): Round => ({ matches, benched: [] })
const order = (rows: { playerId: PlayerId }[]) => rows.map((r) => r.playerId)

describe("computeStandings", () => {
  it("gives every player a team's points, so both partners score the same", () => {
    const rows = computeStandings(ids(4), [round(match("p1 p2", 6, 2, "p3 p4"))])
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]))
    expect(byId.p1.points).toBe(6)
    expect(byId.p2.points).toBe(6)
    expect(byId.p3.points).toBe(2)
    expect(byId.p3.conceded).toBe(6)
    expect(byId.p3.diff).toBe(-4)
  })

  it("ranks players by total points scored", () => {
    const rows = computeStandings(ids(4), [
      round(match("p1 p2", 5, 3, "p3 p4")),
      round(match("p1 p3", 6, 2, "p2 p4")),
    ])
    // p1 5+6=11, p3 3+6=9, p2 5+2=7, p4 3+2=5
    expect(order(rows)).toEqual(["p1", "p3", "p2", "p4"])
    expect(rows.map((r) => r.points)).toEqual([11, 9, 7, 5])
  })

  it("ignores matches that have no score yet", () => {
    const rows = computeStandings(ids(4), [round(match("p1 p2", null, null, "p3 p4"))])
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true)
  })

  it("counts wins, draws and losses", () => {
    const rows = computeStandings(ids(4), [
      round(match("p1 p2", 6, 2, "p3 p4")),
      round(match("p1 p3", 4, 4, "p2 p4")),
    ])
    const p1 = rows.find((r) => r.playerId === "p1")!
    expect([p1.played, p1.wins, p1.draws, p1.losses]).toEqual([2, 1, 1, 0])
  })

  it("lists a player who sat out every round with zero games", () => {
    const rows = computeStandings(ids(5), [{ matches: [match("p1 p2", 6, 2, "p3 p4")], benched: ["p5"] }])
    const p5 = rows.find((r) => r.playerId === "p5")!
    expect(p5.played).toBe(0)
    expect(p5.points).toBe(0)
  })

  it("breaks a points tie by point difference, in first-to mode", () => {
    // Both p1 and p5 score 8, but p5 conceded 2 and p1 conceded 6.
    const rows = computeStandings(ids(8), [
      round(match("p1 p2", 8, 6, "p3 p4", 1), match("p5 p6", 8, 2, "p7 p8", 2)),
    ])
    expect(order(rows).indexOf("p5")).toBeLessThan(order(rows).indexOf("p1"))
  })

  it("breaks a points and difference tie by head-to-head", () => {
    // p1 and p3 both finish on 8 points, diff 0, one win each. They met once
    // on opposite sides and p1 won, so p1 is above p3.
    const players = ["p3", "p1", "p2", "p4", "p5", "p6", "p7", "p8"]
    const rows = computeStandings(players, [
      round(match("p1 p2", 5, 3, "p3 p4", 1), match("p5 p6", 4, 4, "p7 p8", 2)),
      round(match("p1 p5", 3, 5, "p6 p7", 1), match("p3 p8", 5, 3, "p2 p4", 2)),
    ])
    const ranked = order(rows)
    expect(ranked.indexOf("p1")).toBeLessThan(ranked.indexOf("p3"))
  })

  it("breaks a tie by wins when head-to-head can't separate the players", () => {
    // p1 and p3 both finish on 8 points, diff 0, and never faced each other.
    // p1 drew twice; p3 won once and lost once, so p3 is above p1.
    const rows = computeStandings(ids(8), [
      round(match("p1 p2", 4, 4, "p5 p6", 1), match("p3 p4", 6, 2, "p7 p8", 2)),
      round(match("p1 p7", 4, 4, "p8 p4", 1), match("p3 p5", 2, 6, "p2 p6", 2)),
    ])
    const ranked = order(rows)
    expect(ranked.indexOf("p3")).toBeLessThan(ranked.indexOf("p1"))
  })

  it("gives players who are tied on everything the same rank", () => {
    const rows = computeStandings(ids(4), [round(match("p1 p2", 6, 2, "p3 p4"))])
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, 3])
  })

  it("puts everyone level at rank 1 before any score is entered", () => {
    const rows = computeStandings(ids(5), [])
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1, 1, 1])
  })
})
