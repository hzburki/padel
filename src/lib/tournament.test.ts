import { describe, expect, it } from "vitest"
import {
  cleanPlayerNames,
  createTournament,
  currentRoundIndex,
  maxCourts,
  renameProblems,
  renameTournament,
  setScore,
  setupProblems,
  unscoredMatchCount,
  type SetupInput,
} from "./tournament"

const valid: SetupInput = {
  name: "Friday padel",
  playerNames: ["Ana", "Ben", "Cai", "Dee", "Eli"],
  courts: 1,
  target: 16,
  scoringMode: "total",
  roundCount: 5,
}

function counter() {
  let n = 0
  return () => `id${++n}`
}

describe("cleanPlayerNames", () => {
  it("trims names and drops empty rows", () => {
    expect(cleanPlayerNames([" Ana ", "", "  ", "Ben"])).toEqual(["Ana", "Ben"])
  })
})

describe("maxCourts", () => {
  it("allows one court per four players", () => {
    expect(maxCourts(9)).toBe(2)
    expect(maxCourts(12)).toBe(3)
  })

  it("always allows at least one court, even before 4 players are entered", () => {
    expect(maxCourts(0)).toBe(1)
    expect(maxCourts(3)).toBe(1)
  })
})

describe("setupProblems", () => {
  it("finds nothing wrong with a complete setup", () => {
    expect(setupProblems(valid)).toEqual([])
  })

  it("asks for more players when fewer than 4 are entered, ignoring blank rows", () => {
    expect(setupProblems({ ...valid, playerNames: ["Ana", "Ben", "", " "] })).toEqual([
      "Add 2 more players. A match needs 4.",
    ])
  })

  it("rejects two players with the same name, ignoring case and spaces", () => {
    const problems = setupProblems({ ...valid, playerNames: ["Ana", "Ben", "Cai", " ana"] })
    expect(problems).toEqual(["Two players are called ana. Give them different names."])
  })

  it("rejects more courts than the players can fill", () => {
    expect(setupProblems({ ...valid, courts: 2 })).toEqual(["Use 1 court. 8 players are needed for 2."])
    const nine = ["Ana", "Ben", "Cai", "Dee", "Eli", "Fin", "Gus", "Hal", "Ivy"]
    expect(setupProblems({ ...valid, playerNames: nine, courts: 3 })).toEqual(["Pick between 1 and 2 courts."])
  })

  it("rejects a point target outside 8 to 32", () => {
    expect(setupProblems({ ...valid, target: 40 })).toEqual(["Pick a point target from 8 to 32."])
  })

  it("rejects zero rounds", () => {
    expect(setupProblems({ ...valid, roundCount: 0 })).toEqual(["Pick between 1 and 99 rounds."])
  })

  it("asks for a tournament name", () => {
    expect(setupProblems({ ...valid, name: "  " })).toEqual(["Give the tournament a name."])
  })
})

describe("createTournament", () => {
  const t = createTournament(valid, { now: 1000, newId: counter() })

  it("stores the setup as a version 1 tournament that isn't finished", () => {
    expect(t).toMatchObject({
      version: 1,
      name: "Friday padel",
      createdAt: 1000,
      scoringMode: "total",
      target: 16,
      courts: 1,
      finished: false,
    })
  })

  it("gives every player their own id", () => {
    const ids = t.players.map((p) => p.id)
    expect(new Set(ids).size).toBe(5)
    expect(ids).not.toContain(t.id)
  })

  it("generates the whole schedule up front with the chosen number of rounds", () => {
    expect(t.rounds).toHaveLength(5)
    expect(t.rounds.every((r) => r.matches.length === 1 && r.benched.length === 1)).toBe(true)
  })
})

describe("currentRoundIndex", () => {
  const t = createTournament({ ...valid, roundCount: 3 }, { now: 0, newId: counter() })

  it("is the first round before any score is entered", () => {
    expect(currentRoundIndex(t)).toBe(0)
  })

  it("moves on once every match in a round has a score", () => {
    const played = structuredClone(t)
    played.rounds[0].matches[0].score = { a: 10, b: 6 }
    expect(currentRoundIndex(played)).toBe(1)
  })

  it("equals the number of rounds once everything is scored", () => {
    const played = structuredClone(t)
    for (const r of played.rounds) for (const m of r.matches) m.score = { a: 8, b: 8 }
    expect(currentRoundIndex(played)).toBe(3)
  })
})

describe("setScore", () => {
  const t = createTournament({ ...valid, roundCount: 2 }, { now: 0, newId: counter() })

  it("sets the score of one match and leaves every other match alone", () => {
    const next = setScore(t, 1, 1, { a: 9, b: 7 })
    expect(next.rounds[1].matches[0].score).toEqual({ a: 9, b: 7 })
    expect(next.rounds[0].matches[0].score).toBeNull()
  })

  it("does not change the tournament it was given", () => {
    setScore(t, 0, 1, { a: 9, b: 7 })
    expect(t.rounds[0].matches[0].score).toBeNull()
  })

  it("clears a score when given null", () => {
    const scored = setScore(t, 0, 1, { a: 9, b: 7 })
    expect(setScore(scored, 0, 1, null).rounds[0].matches[0].score).toBeNull()
  })
})

describe("unscoredMatchCount", () => {
  it("counts the matches still waiting for a score", () => {
    const t = createTournament({ ...valid, roundCount: 3 }, { now: 0, newId: counter() })
    expect(unscoredMatchCount(t)).toBe(3)
    expect(unscoredMatchCount(setScore(t, 0, 1, { a: 10, b: 6 }))).toBe(2)
  })
})

describe("renaming", () => {
  const t = createTournament({ ...valid, roundCount: 2 }, { now: 0, newId: counter() })
  const names = t.players.map((p) => p.name) // Ana, Ben, Cai, Dee, Eli

  it("changes the tournament name and player names", () => {
    const next = renameTournament(t, "Club night", ["Anna", ...names.slice(1)])
    expect(next.name).toBe("Club night")
    expect(next.players[0].name).toBe("Anna")
  })

  it("keeps player ids, so the schedule and scores stay with the same people", () => {
    const next = renameTournament(t, t.name, ["Anna", ...names.slice(1)])
    expect(next.players.map((p) => p.id)).toEqual(t.players.map((p) => p.id))
    expect(next.rounds).toBe(t.rounds)
  })

  it("trims spaces from new names", () => {
    expect(renameTournament(t, "  Club night ", [" Anna ", ...names.slice(1)]).players[0].name).toBe("Anna")
  })

  it("rejects a blank tournament name", () => {
    expect(renameProblems(t, " ", names)).toEqual(["Give the tournament a name."])
  })

  it("rejects a blank player name", () => {
    expect(renameProblems(t, t.name, ["", ...names.slice(1)])).toEqual(["Every player needs a name."])
  })

  it("rejects two players with the same name", () => {
    expect(renameProblems(t, t.name, ["Ben", ...names.slice(1)])).toEqual([
      "Two players are called Ben. Give them different names.",
    ])
  })

  describe("once the tournament is finished", () => {
    const finished = { ...t, finished: true }

    it("still lets the tournament name change", () => {
      expect(renameTournament(finished, "Club night", names).name).toBe("Club night")
    })

    it("keeps player names as they were", () => {
      const next = renameTournament(finished, finished.name, ["Anna", ...names.slice(1)])
      expect(next.players[0].name).toBe("Ana")
    })

    it("doesn't complain about player names it will ignore", () => {
      expect(renameProblems(finished, finished.name, ["", "", "", "", ""])).toEqual([])
    })
  })
})
