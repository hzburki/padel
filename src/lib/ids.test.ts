import { describe, expect, it } from "vitest"
import { randomId } from "./ids"

describe("randomId", () => {
  it("is 10 characters, digits and lowercase letters only", () => {
    for (let i = 0; i < 1000; i++) expect(randomId()).toMatch(/^[0-9a-z]{10}$/)
  })

  it("uses every digit and letter", () => {
    const seen = new Set(Array.from({ length: 1000 }, randomId).join(""))
    expect(seen.size).toBe(36)
  })

  it("doesn't repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, randomId))
    expect(ids.size).toBe(1000)
  })
})
