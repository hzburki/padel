import { describe, expect, it } from "vitest"
import { isValidScore, isValidTarget } from "./scoring"

describe("point target", () => {
  it("accepts any whole number from 8 to 32", () => {
    expect(isValidTarget(8)).toBe(true)
    expect(isValidTarget(21)).toBe(true)
    expect(isValidTarget(32)).toBe(true)
  })

  it("rejects targets below 8, above 32, or not whole", () => {
    expect(isValidTarget(7)).toBe(false)
    expect(isValidTarget(33)).toBe(false)
    expect(isValidTarget(16.5)).toBe(false)
  })
})

describe("total points mode", () => {
  it("accepts 6–2 in an 8-point game", () => {
    expect(isValidScore({ a: 6, b: 2 }, 8, "total")).toBe(true)
  })

  it("accepts a 4–4 draw in an 8-point game", () => {
    expect(isValidScore({ a: 4, b: 4 }, 8, "total")).toBe(true)
  })

  it("accepts a whitewash of 8–0 in an 8-point game", () => {
    expect(isValidScore({ a: 8, b: 0 }, 8, "total")).toBe(true)
  })

  it("rejects scores that do not add up to the target", () => {
    expect(isValidScore({ a: 6, b: 1 }, 8, "total")).toBe(false)
    expect(isValidScore({ a: 8, b: 3 }, 8, "total")).toBe(false)
  })
})

describe("first to mode", () => {
  it("accepts 8–3 in a first-to-8 game", () => {
    expect(isValidScore({ a: 8, b: 3 }, 8, "firstTo")).toBe(true)
  })

  it("accepts the winner on either side", () => {
    expect(isValidScore({ a: 5, b: 8 }, 8, "firstTo")).toBe(true)
  })

  it("accepts 8–7, which total points mode would reject", () => {
    expect(isValidScore({ a: 8, b: 7 }, 8, "firstTo")).toBe(true)
    expect(isValidScore({ a: 8, b: 7 }, 8, "total")).toBe(false)
  })

  it("rejects 8–8 because only one team can reach the target", () => {
    expect(isValidScore({ a: 8, b: 8 }, 8, "firstTo")).toBe(false)
  })

  it("rejects a score where nobody reached the target", () => {
    expect(isValidScore({ a: 6, b: 2 }, 8, "firstTo")).toBe(false)
  })

  it("rejects a score above the target", () => {
    expect(isValidScore({ a: 9, b: 4 }, 8, "firstTo")).toBe(false)
  })
})

describe("in either mode", () => {
  it("rejects negative scores", () => {
    expect(isValidScore({ a: 10, b: -2 }, 8, "total")).toBe(false)
    expect(isValidScore({ a: 8, b: -1 }, 8, "firstTo")).toBe(false)
  })

  it("rejects fractional scores", () => {
    expect(isValidScore({ a: 4.5, b: 3.5 }, 8, "total")).toBe(false)
  })
})
