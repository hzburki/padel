// Matches played by tapping: every length, both ways of keeping score, and
// both rules at 40–40. No stored images. Ann & Ben play Cal & Dee; see
// taps.ts for the shared steps.
import { expect, test } from "@playwright/test"
import { finishMatch, finishMatchButton, home, newMatch, points, sheet, tap, win, winButton } from "./taps"

const ANN = 0
const CAL = 1

test("every point, advantage: games, deuce, undo and the result", async ({ page }) => {
  await newMatch(page, { name: "Points match" })
  const undo = page.getByRole("button", { name: /Undo last/ })
  // Nothing to take back before the first point.
  await expect(undo).toBeDisabled()

  await win(page, ANN)
  await expect(points(page, ANN)).toHaveText("15")
  await undo.click()
  await expect(points(page, ANN)).toHaveText("0")

  // 40–40, advantage, back to 40–40, then two in a row wins the game.
  for (let i = 0; i < 3; i++) {
    await win(page, ANN)
    await win(page, CAL)
  }
  await expect(points(page, ANN)).toHaveText("40")
  await expect(points(page, CAL)).toHaveText("40")
  await win(page, ANN)
  await expect(points(page, ANN)).toHaveText("Ad")
  await win(page, CAL)
  await expect(points(page, ANN)).toHaveText("40")
  await win(page, ANN, 2)
  await expect(page.getByText("After deuce").first()).toBeVisible()

  // Five more games to love take the set, and with it the match.
  await win(page, ANN, 20)
  await expect(finishMatchButton(page)).toBeVisible()
  // The last point can still be taken back until the organiser confirms.
  await undo.click()
  await expect(finishMatchButton(page)).toHaveCount(0)
  await win(page, ANN)
  await finishMatchButton(page).click()
  await sheet(page).getByRole("button", { name: "Not yet" }).click()
  await finishMatch(page)
  await expect(sheet(page).getByText(/Congrats, Ann and Ben/)).toBeVisible()
  await sheet(page).getByRole("button", { name: "Close" }).click()
  await expect(page.locator('img[alt="Final score"]')).toBeVisible()
  await expect(page.getByText("Match stats")).toBeVisible()
  await expect(page.getByText("Deuce games")).toBeVisible()
  await home(page)
  await expect(page.locator("button", { hasText: "Points match" })).toContainText("6–0")
})

test("every point, golden point: the next point at 40–40 wins, but not in a tie-break", async ({ page }) => {
  await newMatch(page, { name: "Golden", gamesPerSet: 2, deuce: "Golden point" })
  for (let i = 0; i < 3; i++) {
    await win(page, ANN)
    await win(page, CAL)
  }
  await expect(points(page, ANN)).toHaveText("40")
  await win(page, ANN)
  // No advantage: that one point took the game.
  await expect(page.getByText("Golden point").first()).toBeVisible()
  await expect(points(page, ANN)).toHaveText("0")

  // 2–2 in a set to 2 games: a tie-break, counted in plain numbers.
  await win(page, CAL, 4)
  await win(page, ANN, 4)
  await win(page, CAL, 4)
  await expect(page.getByText("Tie-break", { exact: true }).first()).toBeVisible()
  for (let i = 0; i < 6; i++) {
    await win(page, ANN)
    await win(page, CAL)
  }
  await expect(points(page, ANN)).toHaveText("6")
  await expect(points(page, CAL)).toHaveText("6")
  // First to 7 needs two clear, and the golden point doesn't cut it short.
  await win(page, ANN)
  await expect(points(page, ANN)).toHaveText("7")
  await expect(finishMatchButton(page)).toHaveCount(0)
  await win(page, ANN)
  await expect(page.getByText("Tie-break 8–6")).toBeVisible()
  await finishMatch(page)
  await expect(sheet(page).getByText(/Congrats, Ann and Ben/)).toBeVisible()
  await sheet(page).getByRole("button", { name: "Close" }).click()
  await expect(page.getByText("Golden points")).toBeVisible()
  // The tie-break counts as one game: 3–2.
  await home(page)
  await expect(page.locator("button", { hasText: "Golden" })).toContainText("3–2")
})

test("games only: one tap a game, with nothing about points", async ({ page }) => {
  await newMatch(page, { name: "Games match", scoreBy: "Games only" })
  await expect(winButton(page, CAL)).toContainText("Game for")
  await expect(page.getByText("Points", { exact: true })).toHaveCount(0)
  await win(page, CAL, 5)
  await page.getByRole("button", { name: "Undo last game" }).click()
  await win(page, CAL, 2)
  await finishMatch(page)
  await expect(sheet(page).getByText(/Congrats, Cal and Dee/)).toBeVisible()
  await sheet(page).getByRole("button", { name: "Close" }).click()
  // No points were entered, so there are none to report.
  await expect(page.getByText("Match stats")).toBeVisible()
  await expect(page.getByText("Deuce games")).toHaveCount(0)
})

test("games only: at 2–2 in a set to 2 the next tap is the tie-break", async ({ page }) => {
  await newMatch(page, { name: "Tie", gamesPerSet: 2, scoreBy: "Games only" })
  for (let i = 0; i < 2; i++) {
    await win(page, ANN)
    await win(page, CAL)
  }
  await expect(winButton(page, CAL)).toContainText("Tie-break for")
  await win(page, CAL)
  await finishMatch(page)
  await expect(sheet(page).getByText(/Congrats, Cal and Dee/)).toBeVisible()
  await home(page)
  await expect(page.locator("button", { hasText: "Tie" })).toContainText("3–2")
})

test("a set needs two games clear: 2–1 is not enough in a set to 2", async ({ page }) => {
  await newMatch(page, { name: "Two clear", gamesPerSet: 2, scoreBy: "Games only" })
  await win(page, ANN)
  await win(page, CAL)
  await win(page, ANN)
  await expect(finishMatchButton(page)).toHaveCount(0)
})

test("best of 3: the match goes to the first team with two sets", async ({ page }) => {
  await newMatch(page, { name: "Best of three", sets: "3 sets", gamesPerSet: 2, scoreBy: "Games only" })
  await win(page, ANN, 2)
  await expect(finishMatchButton(page)).toHaveCount(0)
  await expect(page.getByText("Set 2", { exact: true }).first()).toBeVisible()
  await win(page, CAL, 2)
  await expect(finishMatchButton(page)).toHaveCount(0)
  await win(page, ANN, 2)
  await finishMatch(page)
  await expect(sheet(page).getByText(/Congrats, Ann and Ben/)).toBeVisible()
  await home(page)
  await expect(page.locator("button", { hasText: "Best of three" })).toContainText("2–0 0–2 2–0")
})

test("best of 5: two sets are not enough, three are", async ({ page }) => {
  await newMatch(page, { name: "Best of five", sets: "5 sets", gamesPerSet: 2, scoreBy: "Games only" })
  await win(page, CAL, 4)
  await expect(finishMatchButton(page)).toHaveCount(0)
  await win(page, CAL, 2)
  await finishMatch(page)
  await expect(sheet(page).getByText(/Congrats, Cal and Dee/)).toBeVisible()
  await home(page)
  await expect(page.locator("button", { hasText: "Best of five" })).toContainText("2–0 2–0 2–0")
})

test("first to 2 sets plays like a best of 3", async ({ page }) => {
  await newMatch(page, { name: "First to two", sets: { firstTo: 2 }, gamesPerSet: 2, scoreBy: "Games only" })
  await win(page, ANN, 2)
  await expect(finishMatchButton(page)).toHaveCount(0)
  await win(page, ANN, 2)
  await expect(finishMatchButton(page)).toBeVisible()
})

test("first to 3 sets plays like a best of 5", async ({ page }) => {
  await newMatch(page, { name: "First to three", sets: { firstTo: 3 }, gamesPerSet: 2, scoreBy: "Games only" })
  await win(page, ANN, 4)
  await expect(finishMatchButton(page)).toHaveCount(0)
  await win(page, ANN, 2)
  await expect(finishMatchButton(page)).toBeVisible()
})

test("a set to 9 games, the longest there is", async ({ page }) => {
  await newMatch(page, { name: "Long set", gamesPerSet: 9, scoreBy: "Games only" })
  await win(page, ANN, 8)
  await expect(finishMatchButton(page)).toHaveCount(0)
  await win(page, ANN)
  await expect(finishMatchButton(page)).toBeVisible()
})

test("the match form: a set is 2 to 9 games, and all four players are needed", async ({ page }) => {
  await home(page)
  await tap(page, 'button:has-text("New game")')
  await tap(page, 'button[aria-pressed]:has-text("Match")')
  const start = page.getByRole("button", { name: "Start match" })
  await expect(start).toBeDisabled()
  const fewer = page.locator('button[aria-label="Fewer"]').filter({ visible: true }).last()
  const more = page.locator('button[aria-label="More"]').filter({ visible: true }).last()
  for (let i = 0; i < 4; i++) await fewer.click()
  await expect(page.getByText("A set is won at 2 games, two clear. At 2–2 a tie-break decides it.")).toBeVisible()
  await expect(fewer).toBeDisabled()
  for (let i = 0; i < 7; i++) await more.click()
  await expect(more).toBeDisabled()
  // Scored by games there is no 40–40 to settle.
  await tap(page, 'button:has-text("Games only")')
  await expect(page.getByText("At 40–40")).toHaveCount(0)

  for (const label of ["Team 1, player 1", "Team 1, player 2", "Team 2, player 1"]) await page.getByLabel(label).fill("Someone " + label.at(-1) + label.at(5))
  await expect(start).toBeDisabled()
  await page.getByLabel("Team 2, player 2").fill("Dee")
  await expect(start).toBeEnabled()
})

test("the match form: a name typed twice turns its field red until it changes", async ({ page }) => {
  await home(page)
  await tap(page, 'button:has-text("New game")')
  await tap(page, 'button[aria-pressed]:has-text("Match")')
  for (const [label, player] of [
    ["Team 1, player 1", "Ann"],
    ["Team 1, player 2", "Ben"],
    ["Team 2, player 1", "Cal"],
  ]) {
    await page.getByLabel(label).fill(player)
  }
  const last = page.getByLabel("Team 2, player 2")
  await last.fill("ann ")
  await expect(page.getByRole("alert")).toHaveText("Ann is already playing")
  await expect(last).toHaveAttribute("aria-invalid", "true")
  await expect(page.getByLabel("Team 1, player 1")).toHaveAttribute("aria-invalid", "false")
  await expect(page.getByRole("button", { name: "Start match" })).toBeDisabled()

  await last.fill("Dee")
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Start match" })).toBeEnabled()
})

test("a match is still there, point for point, after the app is closed and opened", async ({ page }) => {
  await newMatch(page, { name: "Kept" })
  await win(page, ANN, 2)
  // Saving takes a few thousandths of a second; nobody closes the app that
  // fast, but this does.
  await expect.poll(() => page.evaluate(async () => (await (await import("/src/lib/storage.ts" as string)).listTournaments())[0].points.length)).toBe(2)
  await home(page)
  await tap(page, 'button:has-text("Continue")')
  await expect(points(page, ANN)).toHaveText("30")
  await page.getByRole("button", { name: /Undo last/ }).click()
  await expect(points(page, ANN)).toHaveText("15")
})

test("Play again starts a match with the same players and rules", async ({ page }) => {
  await newMatch(page, { name: "Again", sets: "3 sets", gamesPerSet: 4, deuce: "Golden point" })
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Play again")')
  await expect(page.getByLabel("Team 1, player 1")).toHaveValue("Ann")
  await expect(page.getByLabel("Team 2, player 2")).toHaveValue("Dee")
  await expect(page.getByText("A set is won at 4 games, two clear. At 4–4 a tie-break decides it.")).toBeVisible()
  await expect(page.getByText("The next point wins the game.")).toBeVisible()
})

test("a match is deleted from its menu, after asking", async ({ page }) => {
  await newMatch(page, { name: "Going" })
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Delete match")')
  await expect(sheet(page).getByText("Every point will be removed from this phone.")).toBeVisible()
  await sheet(page).getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByText("No games yet")).toBeVisible()
})
