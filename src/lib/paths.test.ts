import { describe, expect, it } from "vitest"
import { isHomePath, legalPageAt, legalPath, liveAt, livePath } from "./paths"

describe("legalPath", () => {
  it("puts the privacy policy at /privacy and the terms at /terms", () => {
    expect(legalPath("privacy")).toBe("/privacy")
    expect(legalPath("terms")).toBe("/terms")
  })
})

describe("isHomePath", () => {
  it("treats / and /index.html as home", () => {
    expect(isHomePath("/")).toBe(true)
    expect(isHomePath("/index.html")).toBe(true)
  })

  it("treats any other address as not home", () => {
    expect(isHomePath("/nope")).toBe(false)
    expect(isHomePath("/privacy")).toBe(false)
  })
})

describe("legalPageAt", () => {
  it("opens each page from its own address", () => {
    expect(legalPageAt("/privacy")).toBe("privacy")
    expect(legalPageAt("/terms")).toBe("terms")
  })

  it("accepts a trailing slash and capital letters", () => {
    expect(legalPageAt("/privacy/")).toBe("privacy")
    expect(legalPageAt("/Terms")).toBe("terms")
  })

  it("opens nothing from the home address or one it does not know", () => {
    expect(legalPageAt("/")).toBeNull()
    expect(legalPageAt("/privacy/extra")).toBeNull()
    expect(legalPageAt("/about")).toBeNull()
  })
})

describe("livePath", () => {
  it("puts a shared tournament at /live/t/<id> and a shared match at /live/m/<id>", () => {
    expect(livePath("americano", "ab12")).toBe("/live/t/ab12")
    expect(livePath("match", "ab12")).toBe("/live/m/ab12")
  })

  it("gives a game the same link every time it is broadcast", () => {
    expect(livePath("match", "ab12")).toBe(livePath("match", "ab12"))
  })
})

describe("liveAt", () => {
  it("reads back the kind and id that livePath wrote", () => {
    expect(liveAt(livePath("americano", "ab12"))).toEqual({ kind: "americano", id: "ab12" })
    expect(liveAt(livePath("match", "ab12"))).toEqual({ kind: "match", id: "ab12" })
  })

  it("accepts a trailing slash", () => {
    expect(liveAt("/live/m/ab12/")).toEqual({ kind: "match", id: "ab12" })
  })

  it("is null for an address that is not a live link", () => {
    expect(liveAt("/")).toBeNull()
    expect(liveAt("/privacy")).toBeNull()
    expect(liveAt("/live/m/")).toBeNull()
    expect(liveAt("/live/x/ab12")).toBeNull()
  })
})
