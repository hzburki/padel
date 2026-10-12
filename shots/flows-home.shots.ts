// The home screen and the pages around the games, by tapping. No stored
// images. See taps.ts for the shared steps.
import { expect, test } from "@playwright/test"
import { home, newAmericano, newMatch, tap } from "./taps"

const FOUR = ["Ann", "Ben", "Cal", "Dee"]

test("the newest unfinished game is on top, and the history can be narrowed to one kind", async ({ page }) => {
  await newAmericano(page, { name: "The tournament", players: FOUR })
  await newMatch(page, { name: "The match" })
  await home(page)
  // The match is newer: it gets Continue, the tournament goes to History.
  await expect(page.locator("button", { hasText: "The tournament" })).toContainText("Unfinished")
  const show = page.locator('select[aria-label="Show"]')
  await show.selectOption("match")
  await expect(page.getByText("No matches here yet.")).toBeVisible()
  await show.selectOption("americano")
  await expect(page.locator("button", { hasText: "The tournament" })).toBeVisible()

  await tap(page, 'button:has-text("Continue")')
  await expect(page.getByRole("heading", { name: "The match" })).toBeVisible()
})

test("Play again on the home screen starts from that game's players", async ({ page }) => {
  await newAmericano(page, { name: "Last week", players: FOUR })
  await home(page)
  await tap(page, 'button[aria-label="Play again with the players from Last week"]')
  for (const name of FOUR) {
    await expect(page.locator(`button[aria-label="Remove ${name}"]`).filter({ visible: true })).toBeVisible()
  }
  await expect(page.getByRole("button", { name: "Start tournament" })).toBeEnabled()
})

test("how it works, terms and privacy open from the home screen", async ({ page }) => {
  await newAmericano(page, { name: "Any game", players: FOUR })
  await home(page)
  // With a game on the phone the steps are folded away.
  const steps = page.getByRole("button", { name: "How it works" })
  await expect(steps).toHaveAttribute("aria-expanded", "false")
  await steps.click()
  await expect(steps).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByText("Enter scores courtside")).toBeVisible()

  await tap(page, 'button:has-text("Privacy")')
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible()
  await tap(page, 'button[aria-label="Back"]')
  await tap(page, 'button:has-text("Terms")')
  await expect(page.getByRole("heading", { name: "Terms & conditions" })).toBeVisible()
  await tap(page, 'button[aria-label="Back"]')
  await expect(page.getByText("Ready for a game?")).toBeVisible()
})

test("an address the app doesn't have leads back to the home screen", async ({ page }) => {
  await page.goto("/nothing-here")
  await tap(page, 'button:has-text("Back to the court")')
  await expect(page.getByText("Ready for a game?")).toBeVisible()
  await expect(page).toHaveURL("/")
})

test("a link to a game that was never there says so", async ({ page }) => {
  await page.goto("/t/nosuchgame")
  await expect(page.getByText(/This link doesn't lead to a game/)).toBeVisible()
  await page.goto("/m/nosuchgame")
  await expect(page.getByText(/This link doesn't lead to a game/)).toBeVisible()
})
