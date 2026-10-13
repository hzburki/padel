import { expect, test, type Page } from "@playwright/test"
import { addScorer, courts, emulatorsReady, newAmericano, newPhone, score, sheet, tap, unscored } from "./taps"

test.beforeAll(async ({ playwright }, info) => { if (String(info.project.use.baseURL).includes("localhost")) await emulatorsReady(playwright) })

const log = (who: string, page: Page) => {
  page.on("console", (m) => { if (!/cloudflareinsights|ERR_FAILED|due to access control|Failed to load resource/.test(m.text()) && (/firestore|firebase/i.test(m.text()) || m.type() === "error")) console.log(`[${who}] ${m.type()}: ${m.text().slice(0, 300)}`) })
  page.on("pageerror", (e) => console.log(`[${who}] pageerror: ${e.message}`))
}
const seen = async (who: string, page: Page, nth: number, text: string) => {
  try { await expect(courts(page).nth(nth)).toContainText(text, { timeout: 12_000 }); console.log(`OK   ${who} sees ${text} on row ${nth}`); return true }
  catch { console.log(`FAIL ${who} does not see ${text} on row ${nth}: "${await courts(page).nth(nth).textContent()}"`); return false }
}

test("hosted: scores go both ways", async ({ page, browser }) => {
  log("owner", page)
  await newAmericano(page, { name: "Claude test, delete me", players: ["Ann", "Ben", "Cal", "Dee"] })
  const link = await addScorer(page)
  const friend = await newPhone(browser)
  log("friend", friend)
  await friend.goto(link)
  await expect(friend.getByText("You're an organiser.")).toBeVisible({ timeout: 20_000 })
  console.log("friend joined")

  const hide = (p: Page, hidden: boolean) => p.evaluate((hidden) => { Object.defineProperty(document, "hidden", { value: hidden, configurable: true }); document.dispatchEvent(new Event("visibilitychange")) }, hidden)
  // Like two real windows: only the one being used is in front.
  await hide(friend, true)
  await score(page, unscored(page).first(), 10)
  await page.waitForTimeout(3000)
  await hide(page, true); await hide(friend, false)
  const a = await seen("friend", friend, 0, "10")
  await score(friend, unscored(friend).first(), 4)
  await friend.waitForTimeout(3000)
  await hide(friend, true); await hide(page, false)
  const b = await seen("owner", page, 1, "12")
  await score(page, unscored(page).first(), 7)
  await page.waitForTimeout(3000)
  await hide(page, true); await hide(friend, false)
  const c = await seen("friend", friend, 2, "7")
  await hide(page, false)
  if (!a || !b || !c) {
    await friend.reload(); await page.reload()
    await friend.waitForTimeout(4000)
    console.log("after reload friend:", await friend.locator("main").last().innerText().then((t) => t.replace(/\n/g, " | ").slice(0, 300)))
  }

  // Clean up: delete the game for everyone.
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Delete tournament")')
  await sheet(page).getByRole("button", { name: "Delete", exact: true }).click()
  await page.waitForTimeout(5000)
  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("live:") || k.startsWith("score:")))
  console.log("flags left after delete:", JSON.stringify(left))
  expect(a && b && c).toBe(true)
})
