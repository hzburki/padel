import { describe, expect, it } from "vitest"
import { isHomePath, legalPageAt, legalPath } from "./paths"

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
