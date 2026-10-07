import { describe, expect, it } from "vitest"
import { shouldAskToRotate } from "./rotate"

describe("shouldAskToRotate", () => {
  it("asks on a phone turned on its side", () => {
    expect(shouldAskToRotate("landscape-primary", { width: 844, height: 390 })).toBe(true)
  })

  it("asks whichever way the phone was turned", () => {
    expect(shouldAskToRotate("landscape-secondary", { width: 844, height: 390 })).toBe(true)
  })

  it("asks on an iPhone, which reports its upright size even on its side", () => {
    expect(shouldAskToRotate("landscape-primary", { width: 390, height: 844 })).toBe(true)
  })

  it("does not ask on a phone held upright", () => {
    expect(shouldAskToRotate("portrait-primary", { width: 390, height: 844 })).toBe(false)
  })

  it("does not ask on a tablet on its side", () => {
    expect(shouldAskToRotate("landscape-primary", { width: 1024, height: 768 })).toBe(false)
  })

  it("does not ask on a computer", () => {
    expect(shouldAskToRotate("landscape-primary", { width: 1440, height: 900 })).toBe(false)
  })

  it("does not ask when the browser can't say which way the device is held", () => {
    expect(shouldAskToRotate(undefined, { width: 844, height: 390 })).toBe(false)
  })
})
