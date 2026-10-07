// Walks the app the way an organiser would and compares every screen with
// its stored image in shots/images. Run with `npm run shots`.
import { expect, test, type Page } from "@playwright/test"
import { NAMES, NOW, seed } from "./seed"

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

// A plain reload would bring back the screen stack kept in history.
async function home(page: Page) {
  await page.goto("about:blank")
  await page.goto("/")
}

async function homeWithGames(page: Page) {
  await home(page)
  await page.evaluate(seed, { names: NAMES, now: NOW })
  await home(page)
}

// soft: one changed screen doesn't hide the ones after it.
async function shot(page: Page, name: string) {
  await expect.soft(page).toHaveScreenshot(`${name}.png`)
}

async function tap(page: Page, selector: string, nth = 0) {
  await page.locator(selector).filter({ visible: true }).nth(nth).click()
}

// Scrolls the screen on top to its start or its end.
async function scrollTo(page: Page, where: "start" | "end") {
  await page.evaluate(async (where) => {
    const layer = [...document.querySelectorAll<HTMLElement>("#root > div > div")].filter((d) => !d.inert).at(-1)!
    const main = [...layer.querySelectorAll("main")].find((m) => m.clientHeight > 0)!
    // The app scrolls a field being typed into to the centre, smoothly. Wait
    // for that to stop, or it carries on from the new place.
    for (let last = -1; last !== main.scrollTop; ) {
      last = main.scrollTop
      await new Promise((done) => setTimeout(done, 100))
    }
    main.scrollTop = where === "start" ? 0 : main.scrollHeight
  }, where)
}

async function closeSheet(page: Page) {
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

test("a phone on its side is asked to turn upright", async ({ page }) => {
  await home(page)
  await shot(page, "01-turn-upright")
})

test("a phone with no games: home and the new game screens", async ({ page }) => {
  await home(page)
  await shot(page, "01-home-empty")

  await tap(page, 'button:has-text("New game")')
  await shot(page, "02-new-americano-empty")
  const player = page.locator('input[placeholder*="player" i]').filter({ visible: true })
  for (const name of NAMES) {
    await player.fill(name)
    await page.keyboard.press("Enter")
  }
  await player.blur()
  // Adding a player scrolls the list, and where it stops varies.
  await expect(page.locator("html")).not.toHaveAttribute("data-typing")
  await scrollTo(page, "start")
  await shot(page, "03-new-americano-players")
  await scrollTo(page, "end")
  await shot(page, "04-new-americano-bottom")
  await tap(page, 'button:has-text("points a game")')
  await shot(page, "05-sheet-points-picker")
  await closeSheet(page)
  await tap(page, 'button[aria-label="Fewer"]', 2)
  await shot(page, "06-sheet-rounds-warning")
  await tap(page, 'button:has-text("See details")')
  await shot(page, "07-sheet-rounds-details")
  await closeSheet(page)

  await tap(page, 'button[aria-pressed]:has-text("Match")')
  await shot(page, "08-new-match")
  await scrollTo(page, "end")
  await shot(page, "09-new-match-bottom")
})

test("the not found and privacy pages", async ({ page }) => {
  await page.goto("/nothing-here")
  await shot(page, "10-not-found")
  await page.goto("/privacy")
  await shot(page, "11-privacy")
})

test("home with games on the phone", async ({ page }) => {
  await homeWithGames(page)
  await shot(page, "20-home-playing")
  await tap(page, 'button:has-text("How it works")')
  await shot(page, "21-home-how-it-works")
  await tap(page, 'button:has-text("How it works")')
  await scrollTo(page, "end")
  await shot(page, "22-home-history")
})

test("an Americano in play: rounds, score sheet, standings and menu", async ({ page }) => {
  await homeWithGames(page)
  await tap(page, 'button:has-text("Continue")')
  await shot(page, "30-rounds")
  await tap(page, 'button:has-text("Score")')
  await shot(page, "31-sheet-score-total")
  await closeSheet(page)
  await tap(page, 'button:has-text("Standings")')
  await shot(page, "32-standings")
  await tap(page, 'button:has-text("Fewer games")')
  await shot(page, "33-sheet-scaling")
  await closeSheet(page)
  await tap(page, 'button[aria-label="More"]')
  await shot(page, "34-sheet-menu")
  await tap(page, 'button:has-text("Edit names")')
  await shot(page, "35-sheet-rename")
  await closeSheet(page)
  await tap(page, 'button:has-text("Finish tournament")')
  await shot(page, "36-sheet-finish")
})

test("a first-to Americano: the score sheet", async ({ page }) => {
  await homeWithGames(page)
  await tap(page, 'button:has-text("First to 21")')
  await tap(page, 'button:has-text("Score")')
  await shot(page, "40-sheet-score-firstto")
  await tap(page, 'button:has-text("Tap to give them")')
  await shot(page, "41-sheet-score-firstto-picked")
})

test("a finished Americano", async ({ page }) => {
  await homeWithGames(page)
  await tap(page, 'button:has-text("Saturday Americano")')
  await expect(page.locator('img[alt="Top three"]')).toBeVisible()
  await shot(page, "50-finished-tournament")
  await scrollTo(page, "end")
  await shot(page, "51-finished-tournament-bottom")
})

test("a match in play and a finished match", async ({ page }) => {
  await homeWithGames(page)
  await tap(page, 'button:has-text("Match in play")')
  await shot(page, "60-match-play")
  await scrollTo(page, "end")
  await shot(page, "61-match-play-bottom")
  await tap(page, 'button[aria-label="More"]')
  await shot(page, "62-match-menu")
  await closeSheet(page)

  await home(page)
  await tap(page, 'button:has-text("Club final")')
  await expect(page.locator('img[alt="Final score"]')).toBeVisible()
  await shot(page, "63-match-finished")
  await scrollTo(page, "end")
  await shot(page, "64-match-finished-bottom")
})
