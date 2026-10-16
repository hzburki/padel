// Americano tournaments played by tapping: every way one can be set up,
// scored and ended. No stored images. See taps.ts for the shared steps.
import { expect, test } from "@playwright/test"
import { courts, fillAmericano, finishTournament, home, newAmericano, score, scoreFirstTo, sheet, startTournament, tap, unscored } from "./taps"

const NINE = ["Ann", "Ben", "Cal", "Dee", "Eve", "Fay", "Gus", "Hal", "Ivy"]

test("total points, 5 players on 1 court: from the first score to the result", async ({ page }) => {
  await newAmericano(page, { name: "Five friends", players: NINE.slice(0, 5) })
  // Five players on one court: one sits out every round.
  await expect(page.getByText(/Sitting out/).first()).toBeVisible()

  // Nothing can be saved before a score is picked.
  await unscored(page).first().click()
  await expect(sheet(page).getByRole("button", { name: "Save score" })).toBeDisabled()
  await sheet(page).getByRole("button", { name: "10", exact: true }).click()
  await sheet(page).getByRole("button", { name: "Save score" }).click()
  await expect(sheet(page)).toHaveCount(0)

  // The score is still there after the app is closed and opened again, and
  // the other team got the rest of the 16 points.
  await home(page)
  await tap(page, 'button:has-text("Continue")')
  const first = courts(page).first()
  await expect(first).toContainText("10")
  await expect(first).toContainText("6")

  // A saved score can be changed, or cleared.
  await score(page, first, 12)
  await expect(first).toContainText("12")
  await first.click()
  await sheet(page).getByRole("button", { name: "Clear score" }).click()
  await expect(first).toContainText("Score")

  while ((await unscored(page).count()) > 0) await score(page, unscored(page).first(), 9)

  await finishTournament(page)
  await expect(sheet(page).getByText(/Congrats/)).toBeVisible()
  await sheet(page).getByRole("button", { name: "Close" }).click()
  await expect(page.locator('img[alt="Top three"]')).toBeVisible()
  await expect(page.getByText("Full standings").first()).toBeVisible()
  // Finished: nothing left to score, and the winner is on the home screen.
  await tap(page, 'button:has-text("Rounds")')
  await expect(unscored(page)).toHaveCount(0)
  await home(page)
  await expect(page.locator("button", { hasText: "Five friends" })).toContainText("🏆")
})

test("first to: the winner is picked first, and a whole tournament is played that way", async ({ page }) => {
  await newAmericano(page, { name: "First to", players: NINE.slice(0, 4), firstTo: true })
  await unscored(page).first().click()
  const save = sheet(page).getByRole("button", { name: "Save score" })
  // No winner yet: the numbers can't be tapped.
  await expect(sheet(page).getByRole("button", { name: "7", exact: true })).toBeDisabled()
  const target = /Tap to give them (\d+)/.exec(await sheet(page).innerText())![1]
  await sheet(page).locator('button:has-text("Tap to give them")').first().click()
  await expect(sheet(page).getByText(`Won, ${target} points`)).toBeVisible()
  await expect(save).toBeDisabled()
  // The loser can't have reached the target too.
  await expect(sheet(page).getByRole("button", { name: target, exact: true })).toHaveCount(0)
  await sheet(page).getByRole("button", { name: "7", exact: true }).click()
  await save.click()
  await expect(courts(page).first()).toContainText(target)
  await expect(courts(page).first()).toContainText("7")

  // The scores don't have to add up to anything: a win to love is fine.
  while ((await unscored(page).count()) > 0) await scoreFirstTo(page, unscored(page).first(), 0)
  await finishTournament(page)
  await expect(sheet(page).getByText(/Congrats/)).toBeVisible()
})

test("the points a game can be picked, and both scoring modes follow it", async ({ page }) => {
  await fillAmericano(page, { name: "To 24", players: NINE.slice(0, 4), target: 24 })
  await expect(page.getByText("Every game is 24 points in total, like 14–10.")).toBeVisible()
  await tap(page, 'button:has-text("First to")')
  await expect(page.getByText("A game ends when one team reaches 24.")).toBeVisible()
  await tap(page, 'button:has-text("Total points")')
  await startTournament(page)

  await unscored(page).first().click()
  // 0 to 24 can be tapped, and nothing above.
  await expect(sheet(page).getByRole("button", { name: "24", exact: true })).toBeVisible()
  await expect(sheet(page).getByRole("button", { name: "25", exact: true })).toHaveCount(0)
  await sheet(page).getByRole("button", { name: "20", exact: true }).click()
  await sheet(page).getByRole("button", { name: "Save score" }).click()
  await expect(courts(page).first()).toContainText("20")
  await expect(courts(page).first()).toContainText("4")
})

test("the smallest and the largest game: 8 points and 32 points", async ({ page }) => {
  await fillAmericano(page, { name: "Small", players: NINE.slice(0, 4), target: 8 })
  // 8 is the least: the stepper won't go lower.
  await expect(page.locator('button[aria-label="Fewer"]').filter({ visible: true }).nth(1)).toBeDisabled()
  await startTournament(page)
  await score(page, unscored(page).first(), 4)
  // A draw is a score like any other in total points.
  await expect(courts(page).first()).toContainText("4")

  await fillAmericano(page, { name: "Large", players: NINE.slice(0, 4), target: 32 })
  await expect(page.locator('button[aria-label="More"]').filter({ visible: true }).nth(1)).toBeDisabled()
  await startTournament(page)
  await unscored(page).first().click()
  // Every number can be reached and Save score is never under them.
  const top = sheet(page).getByRole("button", { name: "32", exact: true })
  await top.scrollIntoViewIfNeeded()
  await top.click()
  await sheet(page).getByRole("button", { name: "Save score" }).click()
  await expect(courts(page).first()).toContainText("32")
})

test("a tournament needs 4 players to start", async ({ page }) => {
  await fillAmericano(page, { name: "Too few", players: NINE.slice(0, 3) })
  const start = page.getByRole("button", { name: "Start tournament" })
  await expect(start).toBeDisabled()
  const player = page.locator('input[placeholder*="player" i]').filter({ visible: true })
  await player.fill("Dee")
  await page.keyboard.press("Enter")
  await expect(page.getByText("1 match at a time, nobody sits out.")).toBeVisible()
  await expect(start).toBeEnabled()
  // A player can be taken off again.
  await tap(page, 'button[aria-label="Remove Dee"]')
  await expect(start).toBeDisabled()
})

test("9 players on 2 courts: two matches at once, one sits out, and court time stays even", async ({ page }) => {
  await fillAmericano(page, { name: "Nine", players: NINE, courts: 2 })
  await expect(page.getByText("2 matches at a time, 1 sitting out each round.")).toBeVisible()
  await startTournament(page)

  const round1 = page.getByRole("listitem").first()
  await expect(round1.locator('[aria-label="Court 1"]')).toBeVisible()
  await expect(round1.locator('[aria-label="Court 2"]')).toBeVisible()
  // One name after "Sitting out", so no comma.
  await expect(round1.getByText(/^Sitting out: [^,]+$/)).toBeVisible()

  // The schedule as saved: every round fills both courts and benches one,
  // and after every round nobody has played two games more than anyone.
  const schedule = await page.evaluate(async () => {
    const storage = await import("/src/lib/storage.ts" as string)
    const [t] = await storage.listTournaments()
    const played = new Map<string, number>(t.players.map((p: { id: string }) => [p.id, 0]))
    let widestGap = 0
    for (const round of t.rounds) {
      for (const m of round.matches) for (const id of [...m.teamA, ...m.teamB]) played.set(id, played.get(id)! + 1)
      widestGap = Math.max(widestGap, Math.max(...played.values()) - Math.min(...played.values()))
    }
    return {
      widestGap,
      matchesPerRound: [...new Set(t.rounds.map((r: { matches: unknown[] }) => r.matches.length))],
      benchedPerRound: [...new Set(t.rounds.map((r: { benched: unknown[] }) => r.benched.length))],
    }
  })
  expect(schedule).toEqual({ widestGap: 1, matchesPerRound: [2], benchedPerRound: [1] })

  // Both courts of a round are scored on their own.
  await score(page, unscored(page).nth(0), 10)
  await score(page, unscored(page).nth(0), 7)
  await expect(courts(page).nth(0)).toContainText("10")
  await expect(courts(page).nth(1)).toContainText("7")
})

test("12 players on 2 courts: four sit out, and a third court takes everyone", async ({ page }) => {
  const twelve = [...NINE, "Jan", "Kim", "Lou"]
  await fillAmericano(page, { name: "Twelve", players: twelve, courts: 2 })
  await expect(page.getByText("2 matches at a time, 4 sitting out each round.")).toBeVisible()
  await tap(page, 'button[aria-label="More"]', 0)
  await expect(page.getByText("3 matches at a time, nobody sits out.")).toBeVisible()
  // No more courts than the players can fill.
  await expect(page.locator('button[aria-label="More"]').filter({ visible: true }).nth(0)).toBeDisabled()
  await tap(page, 'button[aria-label="Fewer"]', 0)
  await startTournament(page)
  await expect(page.getByRole("listitem").first().getByText(/^Sitting out: [^,]+, [^,]+, [^,]+, [^,]+$/)).toBeVisible()
})

test("a round count that leaves some players a match short: the warning, and the fix", async ({ page }) => {
  await fillAmericano(page, { name: "Uneven", players: NINE.slice(0, 5) })
  // One round fewer than suggested: the organiser is told once.
  await tap(page, 'button[aria-label="Fewer"]', 2)
  await expect(sheet(page).getByText("4 players will play one match fewer")).toBeVisible()
  await sheet(page).getByRole("button", { name: /Use 5 rounds, everyone plays 4/ }).click()
  await expect(page.getByText("4 players play one match fewer.")).toHaveCount(0)

  // Chosen again, it is kept without asking twice, with a way back.
  await tap(page, 'button[aria-label="Fewer"]', 2)
  await expect(sheet(page)).toHaveCount(0)
  await expect(page.getByText("4 players play one match fewer.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Use 5 rounds" })).toBeVisible()
  await startTournament(page)

  while ((await unscored(page).count()) > 0) await score(page, unscored(page).first(), 9)
  await tap(page, 'button:has-text("Standings")')
  // Not everyone played the same number of games: the standings explain it.
  await tap(page, 'button:has-text("Fewer games")')
  await expect(sheet(page).getByText("Fewer games played")).toBeVisible()
  await sheet(page).getByRole("button", { name: "Got it" }).click()
  await finishTournament(page)
  await expect(sheet(page).getByText(/Congrats/)).toBeVisible()
})

test("a tournament can be finished early, after asking", async ({ page }) => {
  await newAmericano(page, { name: "Cut short", players: NINE.slice(0, 4) })
  await score(page, unscored(page).first(), 10)
  // With matches left, Finish is on the standings tab.
  await expect(page.getByRole("button", { name: "Finish tournament" })).toHaveCount(0)
  await tap(page, 'button:has-text("Standings")')
  await tap(page, 'button:has-text("Finish tournament")')
  await expect(sheet(page).getByText(/2 matches still have no score/)).toBeVisible()
  await sheet(page).getByRole("button", { name: "Keep playing" }).click()
  await finishTournament(page)
  await sheet(page).getByRole("button", { name: "Close" }).click()
  await tap(page, 'button:has-text("Rounds")')
  await expect(page.getByText("Not played")).toHaveCount(2)
  // A finished game can't be broadcast or scored.
  await tap(page, 'button[aria-label="More"]')
  await expect(sheet(page).getByRole("button", { name: "Broadcast live" })).toHaveCount(0)
})

test("the same name can't be added twice: the field turns red until the name changes", async ({ page }) => {
  await fillAmericano(page, { name: "Twins", players: NINE.slice(0, 4) })
  const player = page.locator('input[placeholder*="player" i]').filter({ visible: true })
  await player.fill(" ann")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("alert")).toHaveText("Ann is already playing")
  await expect(player).toHaveAttribute("aria-invalid", "true")
  await expect(page.locator('button[aria-label="Remove Ann"]').filter({ visible: true })).toHaveCount(1)

  // Taking the first Ann off frees the name.
  await tap(page, 'button[aria-label="Remove Ann"]')
  await expect(page.getByRole("alert")).toHaveCount(0)
  await player.press("Enter")
  await expect(page.locator('button[aria-label="Remove Ann"]').filter({ visible: true })).toHaveCount(1)

  await player.fill("ann")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("alert")).toBeVisible()
  await player.fill("Anna")
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(player).toHaveAttribute("aria-invalid", "false")
  await page.keyboard.press("Enter")
  await expect(page.locator('button[aria-label="Remove Anna"]').filter({ visible: true })).toBeVisible()
})

test("editing a name to one already taken marks that field and can't be saved", async ({ page }) => {
  await newAmericano(page, { name: "Twins", players: NINE.slice(0, 4) })
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Edit names")')
  const second = sheet(page).getByLabel("Player 2", { exact: true })
  await second.fill("ann")
  await expect(sheet(page).getByRole("alert")).toHaveText("Ann is already playing")
  await expect(second).toHaveAttribute("aria-invalid", "true")
  await expect(sheet(page).getByRole("button", { name: "Save names" })).toBeDisabled()
  await second.fill("Bob")
  await expect(sheet(page).getByRole("alert")).toHaveCount(0)
  await expect(sheet(page).getByRole("button", { name: "Save names" })).toBeEnabled()
})

test("names can be edited, and Play again starts from the same players", async ({ page }) => {
  await newAmericano(page, { name: "Before", players: NINE.slice(0, 4) })
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Edit names")')
  await sheet(page).locator("#tournament-name").fill("After")
  await sheet(page).getByLabel("Player 1", { exact: true }).fill("Zoe")
  await sheet(page).getByRole("button", { name: "Save names" }).click()
  await expect(page.getByRole("heading", { name: "After" })).toBeVisible()
  await expect(page.getByText(/Zoe/).first()).toBeVisible()

  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Play again")')
  for (const name of ["Zoe", "Ben", "Cal", "Dee"]) {
    await expect(page.locator(`button[aria-label="Remove ${name}"]`).filter({ visible: true })).toBeVisible()
  }
})

test("leaving a half-filled tournament asks before throwing it away", async ({ page }) => {
  await fillAmericano(page, { name: "Half", players: ["Ann", "Ben"] })
  await tap(page, 'button[aria-label="Back"]')
  await expect(sheet(page).getByText("Discard this tournament?")).toBeVisible()
  await sheet(page).getByRole("button", { name: "Keep editing" }).click()
  await expect(page.locator('button[aria-label="Remove Ann"]').filter({ visible: true })).toBeVisible()
  await tap(page, 'button[aria-label="Back"]')
  await sheet(page).getByRole("button", { name: "Discard" }).click()
  await expect(page.getByText("Ready for a game?")).toBeVisible()
})

test("a tournament is deleted from its menu, after asking", async ({ page }) => {
  await newAmericano(page, { name: "Going", players: NINE.slice(0, 4) })
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Delete tournament")')
  await expect(sheet(page).getByText("The schedule and every score will be removed from this phone.")).toBeVisible()
  await sheet(page).getByRole("button", { name: "Cancel" }).click()
  await expect(unscored(page).first()).toBeVisible()
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Delete tournament")')
  await sheet(page).getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByText("No games yet")).toBeVisible()
})

test("a player joins and another leaves mid game: scored rounds stay, the rest are made again", async ({ page }) => {
  await newAmericano(page, { name: "Comings and goings", players: NINE.slice(0, 5) })
  await score(page, unscored(page).first(), 10)
  const scored = (await courts(page).first().textContent())!

  // Ivy joins: she plays from the next round on.
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Players")')
  await sheet(page).getByPlaceholder("Name").fill("Ivy")
  // Same matches is picked, and each option shows its rounds left.
  await expect(sheet(page).getByRole("button", { name: /Same matches/ })).toHaveAttribute("aria-pressed", "true")
  await expect(sheet(page).getByRole("button", { name: /Same time/ })).toContainText("rounds left")
  await sheet(page).getByRole("button", { name: "Add Ivy" }).click()
  await expect(sheet(page)).toHaveCount(0)
  await expect(courts(page).first()).toHaveText(scored)
  await expect(page.getByText("Ivy").first()).toBeVisible()

  await score(page, unscored(page).first(), 9)

  // Ann leaves; her points stay as they were scored.
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Players")')
  await sheet(page).getByRole("button", { name: "Remove Ann" }).click()
  await expect(sheet(page).getByText("Their scores stay.")).toBeVisible()
  await sheet(page).getByRole("button", { name: "Keep as scored" }).click()
  await sheet(page).getByRole("button", { name: "Remove", exact: true }).click()
  await expect(sheet(page)).toHaveCount(0)
  await expect(courts(page).first()).toHaveText(scored)
  // She plays in none of the rounds still to score.
  for (const row of await unscored(page).all()) await expect(row).not.toContainText("Ann")

  // The change is saved: it is still there after the app is opened again.
  await home(page)
  await tap(page, 'button:has-text("Continue")')
  await expect(unscored(page).first()).toBeVisible()
  for (const row of await unscored(page).all()) await expect(row).not.toContainText("Ann")

  while ((await unscored(page).count()) > 0) await score(page, unscored(page).first(), 9)
  await finishTournament(page)
  await sheet(page).getByRole("button", { name: "Close" }).click()
  // A standings row has a win count: "2W".
  const standings = page.locator("ol li").filter({ hasText: /\d+W/ })
  await expect(standings).toHaveCount(6)
  await expect(standings.filter({ hasText: "Ann" })).toContainText("left")
  await expect(standings.filter({ hasText: "Ivy" })).not.toContainText("left")
})
