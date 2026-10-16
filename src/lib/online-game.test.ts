import { describe, expect, it } from "vitest"
import { changedFields, changesLineUp, fromOnline, REMOVED, stillAsSeen, toOnline } from "./online-game"
import { createSetMatch } from "./set-match-setup"
import { addPoint, undoPoint } from "./set-match"
import { addPlayer, createTournament, removePlayer, renameTournament, setScore } from "./tournament"
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

  it("files a score with the four players it was for, team A first", () => {
    const scored = setScore(tournament(), 2, 1, { a: 9, b: 7 })
    const { teamA, teamB } = scored.rounds[2].matches[0]
    expect(toOnline(scored)).toMatchObject({ scores: { "2_1": { players: [...teamA, ...teamB] } } })
  })

  it("drops a score for other players than the match's: it was entered for a match made again since", () => {
    const t = tournament()
    const online = toOnline(t) as Extract<ReturnType<typeof toOnline>, { kind: "americano" }>
    const { teamA, teamB } = t.rounds[0].matches[0]
    online.scores["0_1"] = { a: 9, b: 7, players: [...teamB, ...teamA] }
    expect((fromGame(t.id, online) as Tournament).rounds[0].matches[0].score).toBeNull()
  })

  it("takes a score with no players, as sent by an older version of the app", () => {
    const t = tournament()
    const online = toOnline(t) as Extract<ReturnType<typeof toOnline>, { kind: "americano" }>
    online.scores["0_1"] = { a: 9, b: 7 }
    expect((fromGame(t.id, online) as Tournament).rounds[0].matches[0].score).toEqual({ a: 9, b: 7 })
  })

  it("comes back the same with a player who joined and one who left", () => {
    const scored = setScore(setScore(tournament(), 0, 1, { a: 9, b: 7 }), 0, 2, { a: 8, b: 8 })
    const joined = addPlayer(scored, "Ivy", "sameMatches", { newId: () => "id10", rng: () => 0.5 })
    const changed = removePlayer(joined, "id2", "sameTime", false, () => 0.5)
    expect(fromGame(changed.id, toOnline(changed))).toEqual(changed)
  })

  it("marks only the players who joined or left", () => {
    const scored = setScore(tournament(), 0, 1, { a: 9, b: 7 })
    const joined = addPlayer(scored, "Ivy", "sameTime", { newId: () => "id10", rng: () => 0.5 })
    const { players } = toOnline(removePlayer(joined, "id2", "sameTime", true, () => 0.5)) as {
      players: Record<string, object>
    }
    expect(players.id1).toEqual({ name: "Ana", order: 0 })
    expect(players.id2).toEqual({ name: "Ben", order: 1, left: { scaleUp: true } })
    expect(players.id10).toEqual({ name: "Ivy", order: 8, joinedAt: 1 })
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
    const { teamA, teamB } = before.rounds[0].matches[1]
    expect(sends(before, setScore(before, 0, 2, { a: 10, b: 6 }))).toEqual({
      "game.scores.0_2": { a: 10, b: 6, players: [...teamA, ...teamB] },
    })
  })

  it("sends a corrected score whole, both teams' points", () => {
    const before = setScore(tournament(), 1, 2, { a: 10, b: 6 })
    const { teamA, teamB } = before.rounds[1].matches[1]
    expect(sends(before, setScore(before, 1, 2, { a: 10, b: 5 }))).toEqual({
      "game.scores.1_2": { a: 10, b: 5, players: [...teamA, ...teamB] },
    })
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

  it("sends an added player as that one player and the schedule whole", () => {
    const before = setScore(tournament(), 0, 1, { a: 9, b: 7 })
    const after = addPlayer(before, "Ivy", "sameTime", { newId: () => "id10", rng: () => 0.5 })
    expect(Object.keys(sends(before, after)).sort()).toEqual(["game.players.id10", "game.rounds"])
  })

  it("sends a player who left as that one player and the schedule whole", () => {
    const before = setScore(tournament(), 0, 1, { a: 9, b: 7 })
    const after = removePlayer(before, "id2", "sameTime", false, () => 0.5)
    const sent = sends(before, after)
    expect(Object.keys(sent).sort()).toEqual(["game.players.id2", "game.rounds"])
    expect(sent["game.players.id2"]).toEqual({ name: "Ben", order: 1, left: { scaleUp: false } })
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

describe("a player change made from what a phone had seen", () => {
  const seen = () => setScore(tournament(), 0, 1, { a: 9, b: 7 })
  const ivy = (t: Tournament) => addPlayer(t, "Ivy", "sameTime", { newId: () => "id10", rng: () => 0.5 })
  const online = (t: Tournament) => toOnline(fromGame(t.id, toOnline(t)))

  it("is a change to who plays when a player joins or leaves", () => {
    expect(changesLineUp(toOnline(seen()), toOnline(ivy(seen())))).toBe(true)
    expect(changesLineUp(toOnline(seen()), toOnline(removePlayer(seen(), "id2", "sameTime", true, () => 0.5)))).toBe(true)
  })

  it("is not a change to who plays when only a score or a name changes", () => {
    expect(changesLineUp(toOnline(seen()), toOnline(setScore(seen(), 0, 2, { a: 8, b: 8 })))).toBe(false)
    expect(changesLineUp(toOnline(seen()), toOnline(renameTournament(seen(), "Club night", ["Anna"])))).toBe(false)
  })

  it("still fits the online copy when nothing changed there", () => {
    expect(stillAsSeen(online(seen()), toOnline(seen()))).toBe(true)
  })

  it("still fits when only a name was changed there", () => {
    const renamed = renameTournament(seen(), "Club night", ["Anna", "Ben", "Cai", "Dee", "Eli", "Fay", "Gus", "Hal"])
    expect(stillAsSeen(online(renamed), toOnline(seen()))).toBe(true)
  })

  it("no longer fits when a score was entered there", () => {
    expect(stillAsSeen(online(setScore(seen(), 0, 2, { a: 8, b: 8 })), toOnline(seen()))).toBe(false)
  })

  it("no longer fits when a score was changed there", () => {
    expect(stillAsSeen(online(setScore(seen(), 0, 1, { a: 8, b: 8 })), toOnline(seen()))).toBe(false)
  })

  it("no longer fits when a player joined or left there", () => {
    expect(stillAsSeen(online(ivy(seen())), toOnline(seen()))).toBe(false)
    expect(stillAsSeen(online(removePlayer(seen(), "id2", "sameTime", true, () => 0.5)), toOnline(seen()))).toBe(false)
  })

  it("still fits whatever order the online maps arrive in", () => {
    const copy = online(setScore(seen(), 1, 1, { a: 6, b: 10 }))
    if (copy.kind !== "americano") throw new Error("not an americano")
    const shuffled = {
      ...copy,
      players: Object.fromEntries(Object.entries(copy.players).reverse()),
      scores: Object.fromEntries(Object.entries(copy.scores).reverse()),
    }
    expect(stillAsSeen(shuffled, online(setScore(seen(), 1, 1, { a: 6, b: 10 })))).toBe(true)
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

  it("has a player who left without saying how their points count", () => {
    const online = toOnline(tournament()) as { players: Record<string, object> }
    refused({ ...online, players: { ...online.players, id1: { name: "Ana", order: 0, left: true } } })
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
