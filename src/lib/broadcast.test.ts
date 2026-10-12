import { describe, expect, it } from "vitest"
import {
  broadcastsClosedBy,
  canBroadcast,
  followedFromHome,
  followedLive,
  followTimeLeft,
  scoreLock,
  sentOnSave,
  shareText,
  takesOver,
} from "./broadcast"
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

describe("a game can be broadcast, and its links handed out", () => {
  it("while it is being played", () => {
    expect(canBroadcast(game(), false)).toBe(true)
  })

  it("but not once it is finished", () => {
    expect(canBroadcast(game({ finished: true }), false)).toBe(false)
    expect(canBroadcast(friends({ finished: true }), true)).toBe(false)
  })

  it("never from a friend's copy that is only for watching", () => {
    expect(canBroadcast(friends(), false)).toBe(false)
  })

  it("from a friend's game this phone is an organiser of", () => {
    expect(canBroadcast(friends(), true)).toBe(true)
  })
})

describe("a save is sent to friends", () => {
  it("never for a game that was not broadcast", () => {
    expect(sentOnSave(null, game(), false)).toBe(false)
    expect(sentOnSave(null, game({ finished: true }), false)).toBe(false)
  })

  it("every time while the game is being broadcast, the finished game included", () => {
    expect(sentOnSave("1", game(), false)).toBe(true)
    expect(sentOnSave("1", game({ finished: true }), false)).toBe(true)
  })

  it("not while another game has taken over the broadcast", () => {
    expect(sentOnSave("closed", game(), false)).toBe(false)
  })

  it("once more when a game whose broadcast was closed is finished", () => {
    expect(sentOnSave("closed", game({ finished: true }), false)).toBe(true)
  })

  it("no more once the finished game has gone out", () => {
    expect(sentOnSave("ended", game({ finished: true }), false)).toBe(false)
  })
})

describe("a game with an organiser link", () => {
  it("is never sent whole, so another organiser's score is not wiped", () => {
    expect(sentOnSave("1", game(), true)).toBe(false)
    expect(sentOnSave("1", game({ finished: true }), true)).toBe(false)
  })

  it("is not sent whole when it is finished with its broadcast closed either: it was finished online", () => {
    expect(sentOnSave("closed", game({ finished: true }), true)).toBe(false)
  })
})

describe("a game can be changed", () => {
  it("by its organiser with no connection, when it has no organiser link", () => {
    expect(scoreLock(game(), false, false)).toBeNull()
  })

  it("by its organiser once it has an organiser link, while there is a connection", () => {
    expect(scoreLock(game(), true, true)).toBeNull()
  })

  it("not by that organiser with no connection: they are told they are offline", () => {
    expect(scoreLock(game(), true, false)).toBe("offline")
  })

  it("never by a friend with the watch link", () => {
    expect(scoreLock(friends(), false, true)).toBe("watch")
    expect(scoreLock(friends(), false, false)).toBe("watch")
  })

  it("by a friend who opened the organiser link, while there is a connection", () => {
    expect(scoreLock(friends(), true, true)).toBeNull()
  })

  it("not by that friend with no connection: they are told they are offline", () => {
    expect(scoreLock(friends(), true, false)).toBe("offline")
  })

  it("not by that friend once the game is finished: it is for watching", () => {
    expect(scoreLock(friends({ finished: true }), true, true)).toBe("watch")
  })

  it("is not called offline once it is finished: there is nothing left to change", () => {
    expect(scoreLock(game({ finished: true }), true, false)).toBeNull()
  })
})

describe("a game its owner left to the other organisers", () => {
  it("is taken by a friend who is one of them", () => {
    expect(takesOver({}, true, true)).toBe(true)
  })

  it("is not taken by a friend who can only watch", () => {
    expect(takesOver({}, false, true)).toBe(false)
  })

  it("is not taken while its owner still has it", () => {
    expect(takesOver({}, true, false)).toBe(false)
  })

  it("is not taken by a friend broadcasting a game of their own", () => {
    expect(takesOver({ theirs: "1" }, true, true)).toBe(false)
  })

  it("is taken by a friend whose own broadcasts are closed or over", () => {
    expect(takesOver({ a: "closed", b: "ended" }, true, true)).toBe(true)
  })
})

describe("the message copied with a link", () => {
  it("asks friends to follow the game, with the watch link on its own line", () => {
    expect(shareText("watch", "Sunday Americano", "https://padel.test/t/ab12")).toBe(
      "Follow Sunday Americano live:\nhttps://padel.test/t/ab12",
    )
  })

  it("asks a friend to help organise the game, with the organiser link on its own line", () => {
    expect(shareText("organise", "Sunday Americano", "https://padel.test/t/ab12/k3y00000")).toBe(
      "Help organise Sunday Americano. Open this link to enter scores:\nhttps://padel.test/t/ab12/k3y00000",
    )
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

describe("a broadcast game goes on", () => {
  it("for 6 hours from when it was created", () => {
    expect(followTimeLeft(friends(), 0)).toBe(6 * HOUR)
    expect(followTimeLeft(game({ createdAt: HOUR }), 2 * HOUR)).toBe(5 * HOUR)
  })

  it("no longer once it is 6 hours old, however much later it is opened", () => {
    expect(followTimeLeft(friends(), 6 * HOUR)).toBe(0)
    expect(followTimeLeft(game(), 30 * HOUR)).toBe(0)
  })

  it("no longer once it is finished, however new", () => {
    expect(followTimeLeft(friends({ finished: true }), HOUR)).toBe(0)
  })
})

describe("the home screen opens", () => {
  it("every unfinished game, yours or a friend's, however old: an old one is finished there", () => {
    expect(followedFromHome(game())).toBe(true)
    expect(followedFromHome(friends())).toBe(true)
  })

  it("no finished game, yours or a friend's", () => {
    expect(followedFromHome(game({ finished: true }))).toBe(false)
    expect(followedFromHome(friends({ finished: true }))).toBe(false)
  })
})
