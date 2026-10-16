import { afterEach, describe, expect, it, vi } from "vitest"
import { CURRENT_VERSION, migrate, onChangedElsewhere } from "./storage"
import type { SetMatch, Tournament } from "./types"

// A tournament as the first version of the app saved it: no `kind`.
const v1 = {
  version: 1,
  id: "t1",
  name: "Friday padel",
  createdAt: 0,
  scoringMode: "total",
  target: 16,
  courts: 1,
  players: [
    { id: "p1", name: "Ana" },
    { id: "p2", name: "Ben" },
    { id: "p3", name: "Cai" },
    { id: "p4", name: "Dee" },
  ],
  rounds: [],
  finished: false,
}

const tournament = { ...v1, version: 3, kind: "americano" } as Tournament

const match: SetMatch = {
  version: 3,
  kind: "match",
  id: "m1",
  name: "Sunday match",
  createdAt: 0,
  teams: [
    ["Ali", "Sara"],
    ["Omar", "Zed"],
  ],
  bestOf: 3,
  setsAs: "firstTo",
  gamesPerSet: 6,
  deuce: "advantage",
  scoreBy: "games",
  points: [0, 1, 0],
  finished: false,
}

describe("migrate", () => {
  it("turns a version 1 save into a version 3 americano tournament, keeping everything else", () => {
    expect(migrate(structuredClone(v1))).toEqual(tournament)
  })

  it("turns a version 2 tournament into version 3, keeping everything else", () => {
    expect(migrate({ ...structuredClone(tournament), version: 2 })).toEqual(tournament)
  })

  it("turns a version 2 match into version 3, keeping everything else", () => {
    expect(migrate({ ...structuredClone(match), version: 2 })).toEqual(match)
  })

  it("loads a version 3 tournament unchanged, with players who joined late or left", () => {
    const changing: Tournament = {
      ...tournament,
      players: [...tournament.players, { id: "p5", name: "Eve", joinedAt: 2 }, { id: "p6", name: "Fin", left: { scaleUp: false } }],
    }
    expect(migrate(structuredClone(changing))).toEqual(changing)
  })

  it("loads a version 3 match unchanged", () => {
    expect(migrate(structuredClone(match))).toEqual(match)
  })

  it("reads a match saved before first to existed as a best of", () => {
    const { setsAs: _, ...older } = match
    expect(migrate(structuredClone(older))).toEqual({ ...match, setsAs: "bestOf" })
  })

  it("reads a match saved before scoring by games existed as scored point by point", () => {
    const { scoreBy: _, ...older } = match
    expect(migrate(structuredClone(older))).toEqual({ ...match, scoreBy: "points" })
  })

  it("keeps the mark on a copy that came from a friend's link", () => {
    expect(migrate({ ...tournament, shared: true })).toHaveProperty("shared", true)
    expect(migrate({ ...match, shared: true })).toHaveProperty("shared", true)
  })

  it("leaves a game made on this phone without that mark", () => {
    expect(migrate(tournament)).not.toHaveProperty("shared")
  })

  it("is on version 3 today", () => {
    expect(CURRENT_VERSION).toBe(3)
  })

  it("refuses something that isn't a saved tournament or match", () => {
    expect(() => migrate(null)).toThrow()
    expect(() => migrate("hello")).toThrow()
    expect(() => migrate({ id: "t1" })).toThrow()
  })

  it("refuses a version it has never heard of", () => {
    expect(() => migrate({ ...v1, version: 0 })).toThrow()
    expect(() => migrate({ ...v1, version: "1" })).toThrow()
  })

  it("refuses a version 2 or 3 save with a missing or unknown kind instead of guessing", () => {
    expect(() => migrate({ ...v1, version: 2 })).toThrow(/kind/)
    expect(() => migrate({ ...v1, version: 3 })).toThrow(/kind/)
    expect(() => migrate({ ...match, kind: "mexicano" })).toThrow(/kind/)
  })

  it("refuses a save from a newer version of the app instead of guessing", () => {
    expect(() => migrate({ ...v1, version: CURRENT_VERSION + 1 })).toThrow(/newer version/)
  })
})

describe("onChangedElsewhere", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("is told the id of a game another tab saved or deleted", async () => {
    const otherTab = new BroadcastChannel("padel")
    const id = await new Promise<string>((resolve) => {
      onChangedElsewhere(resolve)
      otherTab.postMessage("game-1")
    })
    otherTab.close()
    expect(id).toBe("game-1")
  })

  it("hears nothing more once it is stopped", async () => {
    const otherTab = new BroadcastChannel("padel")
    const heard: string[] = []
    const stop = onChangedElsewhere((id) => heard.push(id))
    stop()
    otherTab.postMessage("game-1")
    // A second listener tells us the message has arrived.
    await new Promise<string>((resolve) => {
      onChangedElsewhere(resolve)
      otherTab.postMessage("game-2")
    })
    otherTab.close()
    expect(heard).toEqual([])
  })

  it("still loads on an iPhone too old to talk to other tabs, and just hears nothing", async () => {
    vi.stubGlobal("BroadcastChannel", undefined)
    vi.resetModules()
    const old = await import("./storage")
    const stop = old.onChangedElsewhere(() => {})
    expect(stop).not.toThrow()
  })
})
