import { describe, expect, it } from "vitest"
import { randomId } from "./ids"

describe("randomId", () => {
  it("is 32 hex characters", () => {
    expect(randomId()).toMatch(/^[0-9a-f]{32}$/)
  })

  it("doesn't repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, randomId))
    expect(ids.size).toBe(1000)
  })
})
