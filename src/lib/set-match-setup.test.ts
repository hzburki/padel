import { describe, expect, it } from "vitest"
import { createSetMatch, matchSetupProblems, previousMatchSetup, type MatchSetupInput } from "./set-match-setup"

const valid: MatchSetupInput = {
  name: "Sunday match",
  teams: [
    ["Ali", "Sara"],
    ["Omar", "Zed"],
  ],
  bestOf: 3,
  setsAs: "bestOf",
  gamesPerSet: 6,
  deuce: "advantage",
}

const deps = { now: 1000, newId: () => "id1" }

describe("matchSetupProblems", () => {
  it("finds nothing wrong with a complete setup", () => {
    expect(matchSetupProblems(valid)).toEqual([])
  })

  it("asks for a name", () => {
    expect(matchSetupProblems({ ...valid, name: "  " })).toEqual(["Give the match a name."])
  })

  it("asks for all four player names, counting blanks as missing", () => {
    const teams: MatchSetupInput["teams"] = [
      ["Ali", " "],
      ["Omar", ""],
    ]
    expect(matchSetupProblems({ ...valid, teams })).toEqual(["Add 2 more players. A match needs 4."])
  })

  it("rejects two players with the same name, ignoring case and spaces, even on opposite teams", () => {
    const teams: MatchSetupInput["teams"] = [
      ["Ali", "Sara"],
      ["Omar", " ali"],
    ]
    expect(matchSetupProblems({ ...valid, teams })).toEqual(["Two players are called Ali. Give them different names."])
  })

  it("accepts any whole number of games a set from 2 to 9", () => {
    expect(matchSetupProblems({ ...valid, gamesPerSet: 2 })).toEqual([])
    expect(matchSetupProblems({ ...valid, gamesPerSet: 9 })).toEqual([])
  })

  it("rejects games a set below 2, above 9, or not whole", () => {
    const problem = ["Pick between 2 and 9 games a set."]
    expect(matchSetupProblems({ ...valid, gamesPerSet: 1 })).toEqual(problem)
    expect(matchSetupProblems({ ...valid, gamesPerSet: 10 })).toEqual(problem)
    expect(matchSetupProblems({ ...valid, gamesPerSet: 4.5 })).toEqual(problem)
  })
})

describe("createSetMatch", () => {
  it("starts with no points and not finished", () => {
    const match = createSetMatch(valid, deps)
    expect(match.points).toEqual([])
    expect(match.finished).toBe(false)
  })

  it("is saved as a version 2 record of kind match", () => {
    expect(createSetMatch(valid, deps)).toMatchObject({ version: 2, kind: "match", id: "id1", createdAt: 1000 })
  })

  it("trims the names and makes each first letter upper case", () => {
    const teams: MatchSetupInput["teams"] = [
      [" ali", "sara "],
      ["omar", "de Vries"],
    ]
    const match = createSetMatch({ ...valid, name: " Sunday match ", teams }, deps)
    expect(match.name).toBe("Sunday match")
    expect(match.teams).toEqual([
      ["Ali", "Sara"],
      ["Omar", "De Vries"],
    ])
  })

  it("keeps the chosen sets, how they were chosen, games a set and deuce rule", () => {
    const match = createSetMatch({ ...valid, bestOf: 5, setsAs: "firstTo", gamesPerSet: 4, deuce: "golden" }, deps)
    expect(match).toMatchObject({ bestOf: 5, setsAs: "firstTo", gamesPerSet: 4, deuce: "golden" })
  })
})

describe("previousMatchSetup", () => {
  it("carries the teams and rules to a rematch, not the points", () => {
    const played = { ...createSetMatch(valid, deps), points: [0, 1, 0] as (0 | 1)[], finished: true }
    expect(previousMatchSetup(played)).toEqual({
      teams: valid.teams,
      bestOf: 3,
      setsAs: "bestOf",
      gamesPerSet: 6,
      deuce: "advantage",
    })
  })
})
