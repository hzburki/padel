import { describe, expect, it } from "vitest"
import { changedFields, fromOnline, REMOVED, toOnline } from "./online-game"
import { createSetMatch } from "./set-match-setup"
import { addPoint, undoPoint } from "./set-match"
import { createTournament, renameTournament, setScore } from "./tournament"
import type { SetMatch, Side, Tournament } from "./types"

function counter() {
  let n = 0
  return () => `id${++n}`
}

// Players id1 to id8, the game id9. Two courts, three rounds.
const tournament = (): Tournament =>
  createTournament(
    { name: "Friday padel", playerNames: ["Ana", "Ben", "Cai", "Dee", "Eli", "Fay", "Gus", "Hal"], courts: 2, target: 16, scoringMode: "total", roundCount: 3 },
    { now: 1000, newId: counter(), rng: () => 0.5 },
  )

const setMatch = (): SetMatch =>
  createSetMatch(
    { name: "Club final", teams: [["Ana", "Ben"], ["Cai", "Dee"]], bestOf: 3, setsAs: "firstTo", gamesPerSet: 6, deuce: "golden", scoreBy: "points" },
    { now: 1000, newId: counter() },
  )

// A game read from a document that holds only its `game` map.
const fromGame = (id: string, game: unknown) => fromOnline(id, { game })

const withPoints = (sides: Side[]) => sides.reduce(addPoint, setMatch())

describe("the online copy of an Americano", () => {
  it("comes back as the same game", () => {
    const scored = setScore(setScore(tournament(), 0, 2, { a: 10, b: 6 }), 2, 1, { a: 0, b: 16 })
    expect(fromGame(scored.id, toOnline(scored))).toEqual(scored)
  })

  it("comes back the same when it is finished", () => {
    const done = { ...tournament(), finished: true }
    expect(fromGame(done.id, toOnline(done))).toEqual(done)
  })

  it("keeps the players in a map by id, each with their place in the list", () => {
    const { players } = toOnline(tournament()) as { players: object }
    expect(players).toMatchObject({ id1: { name: "Ana", order: 0 }, id8: { name: "Hal", order: 7 } })
  })

  it("puts the players back in their order, whatever order the map arrives in", () => {
    const online = toOnline(tournament()) as { players: Record<string, unknown> }
    const backwards = { ...online, players: Object.fromEntries(Object.entries(online.players).reverse()) }
    expect((fromGame("a", backwards) as Tournament).players.map((p) => p.name)).toEqual(["Ana", "Ben", "Cai", "Dee", "Eli", "Fay", "Gus", "Hal"])
  })

  it("has no score for a match that is not scored", () => {
    expect(toOnline(tournament())).toMatchObject({ scores: {} })
  })

  it("files a score under its round, counted from 0, and its court", () => {
    const scored = setScore(tournament(), 2, 1, { a: 9, b: 7 })
    expect(toOnline(scored)).toMatchObject({ scores: { "2_1": { a: 9, b: 7 } } })
  })

  it("keeps the schedule without the scores", () => {
    const { rounds } = toOnline(setScore(tournament(), 0, 1, { a: 9, b: 7 })) as { rounds: { matches: object[] }[] }
    expect(Object.keys(rounds[0].matches[0])).toEqual(["court", "teamA", "teamB"])
  })
})

describe("the online copy of a match", () => {
  it("comes back as the same match", () => {
    const played = withPoints([0, 0, 1, 0, 1, 1, 0])
    expect(fromGame(played.id, toOnline(played))).toEqual(played)
  })

  it("comes back the same with no point played", () => {
    expect(fromGame("id1", toOnline(setMatch()))).toEqual(setMatch())
  })

  it("keeps the two teams in a map, since Firestore can't hold a list inside a list", () => {
    expect(toOnline(setMatch())).toMatchObject({ teams: { 0: ["Ana", "Ben"], 1: ["Cai", "Dee"] } })
  })

  it("keeps one entry per point, named by its number", () => {
    expect(toOnline(withPoints([0, 1, 1]))).toMatchObject({ points: { 0: 0, 1: 1, 2: 1 } })
  })

  it("puts the points back in order, the 10th after the 9th and not after the 1st", () => {
    const sides: Side[] = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1]
    const online = toOnline(withPoints(sides)) as { points: Record<string, Side> }
    const backwards = { ...online, points: Object.fromEntries(Object.entries(online.points).reverse()) }
    expect((fromGame("a", backwards) as SetMatch).points).toEqual(sides)
  })

  it("moves the later points up when one in the middle is missing", () => {
    const online = { ...toOnline(setMatch()), points: { 0: 0, 1: 1, 3: 0 } }
    expect((fromGame("a", online) as SetMatch).points).toEqual([0, 1, 0])
  })
})

describe("what the online copy leaves out", () => {
  it("has no id: the document is named by it", () => {
    expect(toOnline(tournament())).not.toHaveProperty("id")
    expect(fromGame("from-the-name", toOnline(tournament())).id).toBe("from-the-name")
  })

  it("does not say it is a friend's copy: that is the phone's own business", () => {
    const friends = { ...tournament(), shared: true as const }
    expect(toOnline(friends)).toEqual(toOnline(tournament()))
    expect(fromGame("a", toOnline(friends))).not.toHaveProperty("shared")
  })
})

// LEGACY, remove after 2026-10-28, with the code it tests.
describe("a copy put online before 2026-10-14, as one JSON string", () => {
  it("is read from that string", () => {
    const old = setScore(tournament(), 0, 1, { a: 9, b: 7 })
    expect(fromOnline(old.id, { json: JSON.stringify(old) })).toEqual(old)
    expect(fromOnline("id1", { json: JSON.stringify(setMatch()) })).toEqual(setMatch())
  })

  it("is read from that string even when a change has added fields beside it", () => {
    const old = tournament()
    expect(fromOnline(old.id, { json: JSON.stringify(old), game: { scores: { "0_1": { a: 9, b: 7 } } } })).toEqual(old)
  })

  it("is refused when the string is not a game", () => {
    expect(() => fromOnline("a", { json: "{}" })).toThrow()
    expect(() => fromOnline("a", { json: "not json" })).toThrow()
  })
})

describe("what a change sends online", () => {
  const sends = (before: Tournament | SetMatch, after: Tournament | SetMatch) => changedFields(toOnline(before), toOnline(after))

  it("sends nothing when nothing changed", () => {
    expect(sends(tournament(), tournament())).toEqual({})
  })

  it("sends a new score as that one score", () => {
    const before = setScore(tournament(), 0, 1, { a: 8, b: 8 })
    expect(sends(before, setScore(before, 0, 2, { a: 10, b: 6 }))).toEqual({ "game.scores.0_2": { a: 10, b: 6 } })
  })

  it("sends a corrected score whole, both teams' points", () => {
    const before = setScore(tournament(), 1, 2, { a: 10, b: 6 })
    expect(sends(before, setScore(before, 1, 2, { a: 10, b: 5 }))).toEqual({ "game.scores.1_2": { a: 10, b: 5 } })
  })

  it("removes a score that was cleared", () => {
    const before = setScore(tournament(), 1, 2, { a: 10, b: 6 })
    expect(sends(before, setScore(before, 1, 2, null))).toEqual({ "game.scores.1_2": REMOVED })
  })

  it("sends a new name for the game as the name alone", () => {
    const before = tournament()
    const names = before.players.map((p) => p.name)
    expect(sends(before, renameTournament(before, "Saturday padel", names))).toEqual({ "game.name": "Saturday padel" })
  })

  it("sends a renamed player as that one player", () => {
    const before = tournament()
    const names = before.players.map((p) => p.name)
    names[2] = "Caitlin"
    expect(sends(before, renameTournament(before, before.name, names))).toEqual({ "game.players.id3": { name: "Caitlin", order: 2 } })
  })

  it("sends finishing the game as one field", () => {
    expect(sends(tournament(), { ...tournament(), finished: true })).toEqual({ "game.finished": true })
  })

  it("sends a changed schedule whole", () => {
    const before = tournament()
    const sent = sends(before, { ...before, rounds: before.rounds.slice(0, 2) })
    expect(Object.keys(sent)).toEqual(["game.rounds"])
    expect(sent["game.rounds"]).toHaveLength(2)
  })

  it("sends a point as one entry, named by its number", () => {
    const before = withPoints([0, 1])
    expect(sends(before, addPoint(before, 1))).toEqual({ "game.points.2": 1 })
  })

  it("removes the last point when it is undone", () => {
    const before = withPoints([0, 1, 1])
    expect(sends(before, undoPoint(before))).toEqual({ "game.points.2": REMOVED })
  })

  it("sends finishing a match as one field", () => {
    const before = withPoints([0, 1])
    expect(sends(before, { ...before, finished: true })).toEqual({ "game.finished": true })
  })
})

describe("a copy that is refused", () => {
  const refused = (raw: unknown) => expect(() => fromGame("a", raw)).toThrow()

  it("is not a game at all", () => {
    refused(null)
    refused("{}")
    refused({})
    expect(() => fromOnline("a", {})).toThrow()
  })

  it("is of a kind this app does not know", () => {
    refused({ ...toOnline(tournament()), kind: "mexicano" })
  })

  it("has a field missing", () => {
    const { target: _, ...noTarget } = toOnline(tournament()) as { target: number }
    refused(noTarget)
    const { points: __, ...noPoints } = toOnline(setMatch()) as { points: object }
    refused(noPoints)
  })

  it("has a field of the wrong type", () => {
    refused({ ...toOnline(tournament()), finished: "yes" })
    refused({ ...toOnline(tournament()), rounds: {} })
    refused({ ...toOnline(setMatch()), bestOf: 2 })
  })

  it("has a score that is not two whole numbers", () => {
    refused({ ...toOnline(tournament()), scores: { "0_1": { a: 10 } } })
    refused({ ...toOnline(tournament()), scores: { "0_1": { a: "10", b: 6 } } })
    refused({ ...toOnline(tournament()), scores: { "0_1": { a: 9.5, b: 6.5 } } })
  })

  it("has a team that is not two players", () => {
    refused({ ...toOnline(setMatch()), teams: { 0: ["Ana"], 1: ["Cai", "Dee"] } })
  })

  it("has a point won by neither team, or not named by a number", () => {
    refused({ ...toOnline(setMatch()), points: { 0: 2 } })
    refused({ ...toOnline(setMatch()), points: { first: 0 } })
  })
})
