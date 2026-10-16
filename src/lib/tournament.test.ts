import { describe, expect, it } from "vitest"
import { countGamesPlayed } from "./bench"
import type { Tournament } from "./types"
import {
  addPlayer,
  addPlayerProblems,
  capitaliseFirst,
  cleanPlayerNames,
  createTournament,
  currentRoundIndex,
  defaultGameName,
  firstOpenRound,
  maxCourts,
  previousSetup,
  removePlayer,
  removePlayerProblems,
  renameProblems,
  repeatedNames,
  roundsLeftAfterAdd,
  roundsLeftAfterRemove,
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

  it("makes the first letter upper case and leaves the rest as typed", () => {
    expect(cleanPlayerNames(["ana", "  ben", "mcKay", "élodie", "de Vries"])).toEqual([
      "Ana",
      "Ben",
      "McKay",
      "Élodie",
      "De Vries",
    ])
  })
})

describe("capitaliseFirst", () => {
  it("makes the first letter upper case as soon as it is typed", () => {
    expect(capitaliseFirst("a")).toBe("A")
    expect(capitaliseFirst("ali")).toBe("Ali")
  })

  it("keeps a space at the end, so a second word can still be typed", () => {
    expect(capitaliseFirst("de ")).toBe("De ")
  })

  it("drops spaces typed before the name", () => {
    expect(capitaliseFirst(" ali")).toBe("Ali")
  })

  it("leaves an empty field empty", () => {
    expect(capitaliseFirst("")).toBe("")
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
    expect(problems).toEqual(["Two players are called Ana. Give them different names."])
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

describe("repeatedNames", () => {
  it("marks nobody when every name is different", () => {
    expect(repeatedNames(["Ana", "Ben", "Cai"])).toEqual(new Set())
  })

  it("marks the second of two players with the same name, not the first", () => {
    expect(repeatedNames(["Ana", "Ben", "Ana"])).toEqual(new Set([2]))
  })

  it("treats names as the same whatever their case or the spaces around them", () => {
    expect(repeatedNames(["Ana", " ana ", "ANA"])).toEqual(new Set([1, 2]))
  })

  it("never marks an empty field", () => {
    expect(repeatedNames(["", "Ana", " ", ""])).toEqual(new Set())
  })
})

describe("createTournament", () => {
  const t = createTournament(valid, { now: 1000, newId: counter() })

  it("stores the setup as a version 3 americano tournament that isn't finished", () => {
    expect(t).toMatchObject({
      version: 3,
      kind: "americano",
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

describe("previousSetup", () => {
  it("carries over the players' names, the courts, the target and the scoring mode, in order", () => {
    const t = createTournament(
      {
        ...valid,
        playerNames: [...valid.playerNames, "Fay", "Gus", "Hal"],
        courts: 2,
        target: 21,
        scoringMode: "firstTo",
      },
      { now: 1000, newId: counter() },
    )
    expect(previousSetup(t)).toEqual({
      playerNames: ["Ana", "Ben", "Cai", "Dee", "Eli", "Fay", "Gus", "Hal"],
      courts: 2,
      target: 21,
      scoringMode: "firstTo",
    })
  })
})

describe("previousSetup after players left", () => {
  it("leaves out players who left", () => {
    const t = createTournament({ ...valid, playerNames: [...valid.playerNames, "Fay"] }, { now: 0, newId: counter() })
    const left = removePlayer(t, t.players[1].id, "sameTime", true)
    expect(previousSetup(left).playerNames).toEqual(["Ana", "Cai", "Dee", "Eli", "Fay"])
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

  it("makes the first letter of a renamed player upper case", () => {
    expect(renameTournament(t, t.name, ["anna", ...names.slice(1)]).players[0].name).toBe("Anna")
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

describe("defaultGameName", () => {
  const sunday = new Date(2026, 9, 4) // 4 October 2026

  it("names a tournament Americano with the short day and date", () => {
    expect(defaultGameName("americano", sunday, "en-GB")).toBe("Americano, Sun 4 Oct")
  })

  it("names a match Match with the short day and date", () => {
    expect(defaultGameName("match", sunday, "en-GB")).toBe("Match, Sun 4 Oct")
  })

  it("follows the phone's date order", () => {
    expect(defaultGameName("match", sunday, "en-US")).toBe("Match, Sun, Oct 4")
  })
})

// A tournament of `players` on `courts` with the first `scored` rounds scored.
function playing(players: number, courts: number, roundCount: number, scored: number): Tournament {
  const names = ["Ana", "Ben", "Cai", "Dee", "Eli", "Fay", "Gus", "Hal", "Ivy", "Jo"].slice(0, players)
  const t = createTournament({ ...valid, playerNames: names, courts, roundCount }, { now: 0, newId: counter() })
  for (const round of t.rounds.slice(0, scored)) for (const m of round.matches) m.score = { a: 10, b: 6 }
  return t
}
const placed = (t: Tournament, r: number) => t.rounds[r].matches.flatMap((m) => [...m.teamA, ...m.teamB])

describe("firstOpenRound", () => {
  it("is the round after the last one with any score", () => {
    const t = playing(8, 2, 7, 3)
    expect(firstOpenRound(t)).toBe(3)
    t.rounds[3].matches[0].score = { a: 8, b: 8 }
    expect(firstOpenRound(t)).toBe(4)
  })

  it("is the first round before any score", () => {
    expect(firstOpenRound(playing(8, 2, 7, 0))).toBe(0)
  })
})

describe("adding a player", () => {
  // Ids that can't clash with the ones createTournament gave out.
  function ids() {
    let n = 0
    return () => `new${++n}`
  }

  it("keeps every round that has a score when a player is added", () => {
    const t = playing(8, 2, 7, 3)
    expect(addPlayer(t, "Ivy", "sameMatches", { newId: ids() }).rounds.slice(0, 3)).toEqual(t.rounds.slice(0, 3))
  })

  it("rebuilds from the round after a partly scored round", () => {
    const t = playing(8, 2, 7, 3)
    t.rounds[3].matches[0].score = { a: 10, b: 6 }
    const added = addPlayer(t, "Ivy", "sameMatches", { newId: ids() })
    expect(added.rounds.slice(0, 4)).toEqual(t.rounds.slice(0, 4))
    expect(added.players.at(-1)?.joinedAt).toBe(4)
  })

  it("plays the new player only in rebuilt rounds", () => {
    const added = addPlayer(playing(8, 2, 7, 3), "ivy", "sameMatches", { newId: ids() })
    expect(added.players.at(-1)).toEqual({ id: "new1", name: "Ivy", joinedAt: 3 })
    for (let r = 0; r < 3; r++) expect(placed(added, r)).not.toContain("new1")
    expect([3, 4, 5, 6, 7].flatMap((r) => [...placed(added, r), ...added.rounds[r].benched])).toContain("new1")
  })

  it("adds a round with Same matches when a ninth player joins 8 on 2 courts", () => {
    expect(addPlayer(playing(8, 2, 7, 3), "Ivy", "sameMatches", { newId: ids() }).rounds).toHaveLength(3 + 5)
  })

  it("keeps the rounds left with Same time", () => {
    expect(addPlayer(playing(8, 2, 7, 3), "Ivy", "sameTime", { newId: ids() }).rounds).toHaveLength(7)
  })

  it("shows the same rounds left as it makes", () => {
    const t = playing(8, 2, 7, 3)
    for (const howLong of ["sameTime", "sameMatches"] as const) {
      expect(roundsLeftAfterAdd(t, howLong)).toBe(addPlayer(t, "Ivy", howLong, { newId: ids() }).rounds.length - 3)
    }
  })

  it("has a joiner sit out as often as the others", () => {
    const added = addPlayer(playing(8, 2, 7, 3), "Ivy", "sameMatches", { newId: ids() })
    const games = countGamesPlayed(added.players.map((p) => p.id), added.rounds.slice(3))
    expect(Math.max(...games.values()) - Math.min(...games.values())).toBeLessThanOrEqual(1)
  })

  it("starts a joiner's rounds with nobody else's scores", () => {
    const added = addPlayer(playing(8, 2, 7, 3), "Ivy", "sameMatches", { newId: ids() })
    expect(added.rounds.slice(3).flatMap((r) => r.matches).every((m) => m.score === null)).toBe(true)
  })

  it("won't add a player once the tournament is finished", () => {
    expect(addPlayerProblems({ ...playing(8, 2, 7, 7), finished: true }, "Ivy")).toEqual(["The tournament is finished."])
  })

  it("won't add a player once every round is scored", () => {
    expect(addPlayerProblems(playing(8, 2, 7, 7), "Ivy")).toEqual(["All rounds are played. Finish the tournament."])
  })

  it("won't add a player once the last round has a score", () => {
    const t = playing(8, 2, 7, 6)
    t.rounds[6].matches[0].score = { a: 10, b: 6 }
    expect(addPlayerProblems(t, "Ivy")).toEqual(["All rounds are played. Finish the tournament."])
  })

  it("adds a player on a friend's copy too: an added organiser's copy is a friend's", () => {
    expect(addPlayerProblems({ ...playing(8, 2, 7, 3), shared: true }, "Ivy")).toEqual([])
  })

  it("needs a name", () => {
    expect(addPlayerProblems(playing(8, 2, 7, 3), "  ")).toEqual(["Type a name."])
  })

  it("won't take the name of a player already in, ignoring case", () => {
    expect(addPlayerProblems(playing(8, 2, 7, 3), "ana")).toEqual([
      "Ana is taken in this tournament. Pick another name.",
    ])
  })

  it("won't take the name of a player who left", () => {
    const t = playing(8, 2, 7, 3)
    const left = removePlayer(t, t.players[0].id, "sameTime", true)
    expect(addPlayerProblems(left, "Ana")).toHaveLength(1)
  })
})

describe("removing a player", () => {
  it("keeps every round that has a score, and the leaver's games in them", () => {
    const t = playing(8, 2, 7, 3)
    expect(removePlayer(t, t.players[0].id, "sameMatches", true).rounds.slice(0, 3)).toEqual(t.rounds.slice(0, 3))
  })

  it("never places a player who left in a rebuilt round", () => {
    const t = playing(9, 2, 9, 3)
    const id = t.players[0].id
    const removed = removePlayer(t, id, "sameMatches", true)
    for (let r = 3; r < removed.rounds.length; r++) {
      expect([...placed(removed, r), ...removed.rounds[r].benched]).not.toContain(id)
    }
  })

  it("stores whether the leaver's points are scaled up", () => {
    const t = playing(8, 2, 7, 3)
    expect(removePlayer(t, t.players[0].id, "sameMatches", false).players[0].left).toEqual({ scaleUp: false })
    expect(removePlayer(t, t.players[0].id, "sameMatches", true).players[0].left).toEqual({ scaleUp: true })
  })

  it("takes a round away with Same matches when 6 on 1 court drop to 5", () => {
    const t = playing(6, 1, 9, 3)
    expect(removePlayer(t, t.players[0].id, "sameMatches", true).rounds).toHaveLength(3 + 5)
  })

  it("adds rounds with Same matches when 8 on 2 courts drop to 7 on 1", () => {
    const t = playing(8, 2, 7, 3)
    expect(removePlayer(t, t.players[0].id, "sameMatches", true).rounds).toHaveLength(3 + 7)
  })

  it("keeps the rounds left with Same time", () => {
    const t = playing(6, 1, 9, 3)
    expect(removePlayer(t, t.players[0].id, "sameTime", true).rounds).toHaveLength(9)
  })

  it("shows the same rounds left as it makes", () => {
    const t = playing(8, 2, 7, 3)
    const id = t.players[0].id
    for (const howLong of ["sameTime", "sameMatches"] as const) {
      expect(roundsLeftAfterRemove(t, id, howLong)).toBe(removePlayer(t, id, howLong, true).rounds.length - 3)
    }
  })

  it("won't remove a player below 4 still in", () => {
    const t = playing(5, 1, 5, 1)
    const once = removePlayer(t, t.players[0].id, "sameTime", true)
    expect(removePlayerProblems(once, once.players[1].id)).toEqual(["At least 4 players must stay in."])
  })

  it("won't remove a player with an unscored match in a kept round", () => {
    const t = playing(8, 2, 7, 3)
    t.rounds[3].matches[0].score = { a: 10, b: 6 }
    const waiting = t.rounds[3].matches[1].teamA[0]
    expect(removePlayerProblems(t, waiting)).toEqual(["Score their match in this round first."])
  })

  it("removes a player who sat out the partly scored round", () => {
    const t = playing(9, 2, 9, 3)
    t.rounds[3].matches[0].score = { a: 10, b: 6 }
    expect(removePlayerProblems(t, t.rounds[3].benched[0])).toEqual([])
  })

  it("won't remove a player once every round is scored", () => {
    const t = playing(8, 2, 7, 7)
    expect(removePlayerProblems(t, t.players[0].id)).toEqual(["All rounds are played. Finish the tournament."])
  })

  it("won't remove a player once the tournament is finished", () => {
    const t = { ...playing(8, 2, 7, 7), finished: true }
    expect(removePlayerProblems(t, t.players[0].id)).toEqual(["The tournament is finished."])
  })
})
