import { describe, expect, it } from "vitest"
import { CURRENT_VERSION, migrate } from "./storage"
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

const tournament = { ...v1, version: 2, kind: "americano" } as Tournament

const match: SetMatch = {
  version: 2,
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
  points: [0, 1, 0],
  finished: false,
}

describe("migrate", () => {
  it("turns a version 1 save into a version 2 americano tournament, keeping everything else", () => {
    expect(migrate(structuredClone(v1))).toEqual(tournament)
  })

  it("loads a version 2 tournament unchanged", () => {
    expect(migrate(structuredClone(tournament))).toEqual(tournament)
  })

  it("loads a version 2 match unchanged", () => {
    expect(migrate(structuredClone(match))).toEqual(match)
  })

  it("reads a match saved before first to existed as a best of", () => {
    const { setsAs: _, ...older } = match
    expect(migrate(structuredClone(older))).toEqual({ ...match, setsAs: "bestOf" })
  })

  it("is on version 2 today", () => {
    expect(CURRENT_VERSION).toBe(2)
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

  it("refuses a version 2 save with a missing or unknown kind instead of guessing", () => {
    expect(() => migrate({ ...v1, version: 2 })).toThrow(/kind/)
    expect(() => migrate({ ...match, kind: "mexicano" })).toThrow(/kind/)
  })

  it("refuses a save from a newer version of the app instead of guessing", () => {
    expect(() => migrate({ ...v1, version: CURRENT_VERSION + 1 })).toThrow(/newer version/)
  })
})
