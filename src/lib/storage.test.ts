import { describe, expect, it } from "vitest"
import { CURRENT_VERSION, migrate } from "./storage"
import type { Tournament } from "./types"

const v1: Tournament = {
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

describe("migrate", () => {
  it("loads a version 1 tournament unchanged", () => {
    expect(migrate(structuredClone(v1))).toEqual(v1)
  })

  it("is on version 1 today", () => {
    expect(CURRENT_VERSION).toBe(1)
  })

  it("refuses something that isn't a tournament", () => {
    expect(() => migrate(null)).toThrow()
    expect(() => migrate("hello")).toThrow()
    expect(() => migrate({ id: "t1" })).toThrow()
  })

  it("refuses a version it has never heard of", () => {
    expect(() => migrate({ ...v1, version: 0 })).toThrow()
    expect(() => migrate({ ...v1, version: "1" })).toThrow()
  })

  it("refuses a tournament saved by a newer version of the app instead of guessing", () => {
    expect(() => migrate({ ...v1, version: CURRENT_VERSION + 1 })).toThrow(/newer version/)
  })
})
