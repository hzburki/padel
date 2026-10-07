import { describe, expect, it } from "vitest"
import { canBroadcast, followedFromHome, followedLive, followTimeLeft, broadcastsClosedBy, sentOnSave } from "./broadcast"
import type { SavedEvent } from "./types"

const HOUR = 60 * 60 * 1000

// Only the fields these rules read.
const game = (fields: Partial<SavedEvent> = {}) => ({ createdAt: 0, finished: false, ...fields }) as SavedEvent
const friends = (fields: Partial<SavedEvent> = {}) => game({ shared: true, ...fields })

describe("one broadcast at a time", () => {
  it("closes nothing when no other game is being broadcast", () => {
    expect(broadcastsClosedBy({}, game({ id: "new" }))).toEqual([])
  })

  it("closes the game being broadcast when another game goes live", () => {
    expect(broadcastsClosedBy({ old: "1" }, game({ id: "new" }))).toEqual(["old"])
  })

  it("does not close the game that is going live", () => {
    expect(broadcastsClosedBy({ new: "1" }, game({ id: "new" }))).toEqual([])
  })

  it("leaves alone a game whose broadcast was already closed", () => {
    expect(broadcastsClosedBy({ old: "closed" }, game({ id: "new" }))).toEqual([])
  })

  it("leaves alone a finished game whose result is online", () => {
    expect(broadcastsClosedBy({ old: "ended" }, game({ id: "new" }))).toEqual([])
  })

  it("closes every other broadcast when an older version left several open", () => {
    expect(broadcastsClosedBy({ a: "1", b: "1", c: "ended" }, game({ id: "new" }))).toEqual(["a", "b"])
  })

  it("closes the other game when a closed game is broadcast again", () => {
    expect(broadcastsClosedBy({ old: "closed", other: "1" }, game({ id: "old" }))).toEqual(["other"])
  })
})

describe("a game can be broadcast", () => {
  it("while it is being played", () => {
    expect(canBroadcast(game())).toBe(true)
  })

  it("but not once it is finished", () => {
    expect(canBroadcast(game({ finished: true }))).toBe(false)
  })

  it("and never from a friend's copy", () => {
    expect(canBroadcast(friends())).toBe(false)
  })
})

describe("a save is sent to friends", () => {
  it("never for a game that was not broadcast", () => {
    expect(sentOnSave(null, game())).toBe(false)
    expect(sentOnSave(null, game({ finished: true }))).toBe(false)
  })

  it("every time while the game is being broadcast, the finished game included", () => {
    expect(sentOnSave("1", game())).toBe(true)
    expect(sentOnSave("1", game({ finished: true }))).toBe(true)
  })

  it("not while another game has taken over the broadcast", () => {
    expect(sentOnSave("closed", game())).toBe(false)
  })

  it("once more when a game whose broadcast was closed is finished", () => {
    expect(sentOnSave("closed", game({ finished: true }))).toBe(true)
  })

  it("no more once the finished game has gone out", () => {
    expect(sentOnSave("ended", game({ finished: true }))).toBe(false)
  })
})

describe("a friend's copy is live", () => {
  it("while the organiser is still broadcasting it", () => {
    expect(followedLive(friends(), false)).toBe(true)
  })

  it("but not once the organiser has moved the broadcast to another game", () => {
    expect(followedLive(friends(), true)).toBe(false)
  })

  it("and not once the game is finished", () => {
    expect(followedLive(friends({ finished: true }), false)).toBe(false)
  })
})

describe("a friend's game is followed", () => {
  it("for 4 hours from when it was created", () => {
    expect(followTimeLeft(friends(), 0)).toBe(4 * HOUR)
    expect(followTimeLeft(friends({ createdAt: HOUR }), 2 * HOUR)).toBe(3 * HOUR)
  })

  it("no longer once it is 4 hours old, however much later it is opened", () => {
    expect(followTimeLeft(friends(), 4 * HOUR)).toBe(0)
    expect(followTimeLeft(friends(), 30 * HOUR)).toBe(0)
  })

  it("no longer once it is finished, however new", () => {
    expect(followTimeLeft(friends({ finished: true }), HOUR)).toBe(0)
  })
})

describe("the home screen follows", () => {
  it("your own unfinished game, however old", () => {
    expect(followedFromHome(game(), 100 * HOUR)).toBe(true)
  })

  it("a friend's unfinished game created less than 4 hours ago", () => {
    expect(followedFromHome(friends(), 4 * HOUR - 1)).toBe(true)
  })

  it("no friend's game created 4 hours ago or more", () => {
    expect(followedFromHome(friends(), 4 * HOUR)).toBe(false)
    expect(followedFromHome(friends(), 30 * HOUR)).toBe(false)
  })

  it("no finished game, yours or a friend's", () => {
    expect(followedFromHome(game({ finished: true }), HOUR)).toBe(false)
    expect(followedFromHome(friends({ finished: true }), HOUR)).toBe(false)
  })
})
