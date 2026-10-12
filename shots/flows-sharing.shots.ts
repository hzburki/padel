// A game shared: in two tabs, broadcast to a friend, and as a picture.
// No stored images. Broadcasting goes to the local emulators, never to the
// hosted project. See taps.ts for the shared steps.
import { expect, test } from "@playwright/test"
import {
  broadcast,
  catchShare,
  courts,
  finishMatch,
  finishTournament,
  home,
  liveBadge,
  newAmericano,
  newMatch,
  PNG_START,
  points,
  score,
  sharedFile,
  sheet,
  tap,
  unscored,
  win,
  winButton,
} from "./taps"

const FOUR = ["Ann", "Ben", "Cal", "Dee"]

test("a finished Americano's picture is handed to the share sheet as a PNG", async ({ page }) => {
  await catchShare(page)
  await newAmericano(page, { name: "Share me", players: FOUR })
  while ((await unscored(page).count()) > 0) await score(page, unscored(page).first(), 9)
  await finishTournament(page)
  await sheet(page).getByRole("button", { name: "Share" }).click()
  await expect.poll(() => sharedFile(page)).toEqual({ name: "Share-me.png", type: "image/png", start: PNG_START })
})

test("a finished match's picture is handed to the share sheet as a PNG", async ({ page }) => {
  await catchShare(page)
  await newMatch(page, { name: "Share this match", gamesPerSet: 2, scoreBy: "Games only" })
  await win(page, 0, 2)
  await finishMatch(page)
  await sheet(page).getByRole("button", { name: "Close" }).click()
  // The same picture from the finished match's own Share button.
  await page.getByRole("button", { name: "Share" }).click()
  await expect.poll(() => sharedFile(page)).toEqual({ name: "Share-this-match.png", type: "image/png", start: PNG_START })
})

test("the same Americano in two tabs stays the same in both", async ({ page, context }) => {
  const other = await context.newPage()
  await home(other)
  await newAmericano(page, { name: "Two tabs", players: FOUR })
  // Made in one tab, listed in the other without touching it.
  await expect(other.getByText("Two tabs").first()).toBeVisible()

  await tap(other, 'button:has-text("Continue")')
  await score(other, unscored(other).first(), 10)
  await expect(courts(page).first()).toContainText("10")
  await score(page, unscored(page).first(), 4)
  // Neither tab saved over the other's score.
  for (const tab of [page, other]) {
    await expect(courts(tab).nth(0)).toContainText("10")
    await expect(courts(tab).nth(1)).toContainText("12")
  }

  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Delete tournament")')
  await sheet(page).getByRole("button", { name: "Delete", exact: true }).click()
  await expect(other.getByText("This tournament is no longer on this phone.")).toBeVisible()
})

test("the same match in two tabs stays the same in both", async ({ page, context }) => {
  await newMatch(page, { name: "Match in two tabs" })
  const other = await context.newPage()
  await home(other)
  await tap(other, 'button:has-text("Continue")')
  await win(page, 0)
  await expect(points(other, 0)).toHaveText("15")
  await win(other, 1)
  // Neither tab dropped the other's point.
  for (const tab of [page, other]) {
    await expect(points(tab, 0)).toHaveText("15")
    await expect(points(tab, 1)).toHaveText("15")
  }
})

test("a broadcast Americano: a friend follows it, and the organiser scores from two tabs", async ({ page, context, browser }) => {
  await newAmericano(page, { name: "On air", players: FOUR })
  const secondTab = await context.newPage()
  await home(secondTab)
  await expect(liveBadge(secondTab)).toHaveCount(0)

  const link = await broadcast(page)
  // The badge shows in the organiser's other tab too.
  await expect(liveBadge(secondTab).first()).toBeVisible()

  // A friend has a phone of their own: nothing stored, not the organiser.
  const friend = await (await browser.newContext()).newPage()
  await friend.goto(link)
  await expect(friend.getByRole("heading", { name: "On air" })).toBeVisible()
  await expect(friend.getByText("Only the organiser can change it.")).toBeVisible()
  await expect(liveBadge(friend).first()).toBeVisible()
  await expect(unscored(friend)).toHaveCount(0)

  await score(page, unscored(page).first(), 10)
  await expect(friend.locator('[aria-label^="Court"]').first().locator("..")).toContainText("10")

  // The organiser's own link, in another tab of the same browser, is still
  // their game: they can score from there too.
  await secondTab.goto(link)
  await expect(secondTab.getByText("Only the organiser can change it.")).toHaveCount(0)
  await score(secondTab, unscored(secondTab).first(), 4)
  await expect(courts(page).nth(1)).toContainText("12")
  await expect(friend.locator('[aria-label^="Court"]').nth(1).locator("..")).toContainText("12")

  // Finishing ends the broadcast for everyone.
  while ((await unscored(page).count()) > 0) await score(page, unscored(page).first(), 9)
  await finishTournament(page)
  await sheet(page).getByRole("button", { name: "Close" }).click()
  await expect(friend.locator('img[alt="Top three"]')).toBeVisible()
  await expect(liveBadge(friend)).toHaveCount(0)
  await expect(liveBadge(secondTab)).toHaveCount(0)

  // The organiser deletes it: the link is dead, the friend keeps the result.
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Delete tournament")')
  await expect(sheet(page).getByText(/The link stops working/)).toBeVisible()
  await sheet(page).getByRole("button", { name: "Delete", exact: true }).click()
  await home(friend)
  await expect(friend.locator("button", { hasText: "On air" })).toContainText("Shared · 🏆")
  const stranger = await (await browser.newContext()).newPage()
  await stranger.goto(link)
  await expect(stranger.getByText(/This link doesn't lead to a game/)).toBeVisible()
})

test("a broadcast match: a friend follows every point and can change nothing", async ({ page, browser }) => {
  await newMatch(page, { name: "Match on air", gamesPerSet: 2 })
  const link = await broadcast(page, { kind: "m" })
  const friend = await (await browser.newContext()).newPage()
  await friend.goto(link)
  await expect(friend.getByRole("heading", { name: "Match on air" })).toBeVisible()
  await expect(friend.getByText("Only the organiser can change it.")).toBeVisible()
  await expect(liveBadge(friend).first()).toBeVisible()
  await expect(winButton(friend, 0)).toHaveCount(0)
  await expect(friend.getByRole("button", { name: /Undo last/ })).toHaveCount(0)

  await win(page, 0)
  await expect(points(friend, 0)).toHaveText("15")
  // An undo travels too.
  await page.getByRole("button", { name: /Undo last/ }).click()
  await expect(points(friend, 0)).toHaveText("0")

  await win(page, 0, 8)
  await finishMatch(page)
  await expect(friend.locator('img[alt="Final score"]')).toBeVisible()
  await expect(liveBadge(friend)).toHaveCount(0)
})

test("broadcasting a second game closes the first, after asking, and the first can go live again on the same link", async ({ page, browser }) => {
  await newAmericano(page, { name: "First game", players: FOUR })
  const firstLink = await broadcast(page)
  const friend = await (await browser.newContext()).newPage()
  await friend.goto(firstLink)
  await expect(liveBadge(friend).first()).toBeVisible()

  await newAmericano(page, { name: "Second game", players: FOUR })
  const secondLink = await broadcast(page, { closesAnother: true })
  expect(secondLink).not.toBe(firstLink)
  // The friend keeps the first game's last score, no longer live.
  await expect(liveBadge(friend)).toHaveCount(0)
  await expect(friend.getByRole("heading", { name: "First game" })).toBeVisible()

  // On the organiser's home screen only the second game is live.
  await home(page)
  await expect(liveBadge(page)).toHaveCount(1)
  await page.locator("button", { hasText: "First game" }).click()
  await expect(liveBadge(page)).toHaveCount(0)
  expect(await broadcast(page, { closesAnother: true })).toBe(firstLink)
  await expect(liveBadge(friend).first()).toBeVisible()
})

test("a friend can delete their copy without touching the organiser's game", async ({ page, browser }) => {
  await newAmericano(page, { name: "Theirs to keep", players: FOUR })
  const link = await broadcast(page)
  const friend = await (await browser.newContext()).newPage()
  await friend.goto(link)
  await expect(friend.getByRole("heading", { name: "Theirs to keep" })).toBeVisible()
  // A friend's menu has nothing that changes the game.
  await tap(friend, 'button[aria-label="More"]')
  await expect(sheet(friend).getByRole("button", { name: "Edit names" })).toHaveCount(0)
  await expect(sheet(friend).getByRole("button", { name: "Broadcast live" })).toHaveCount(0)
  await tap(friend, 'button:has-text("Delete tournament")')
  await expect(sheet(friend).getByText(/Only your copy is removed/)).toBeVisible()
  await sheet(friend).getByRole("button", { name: "Delete", exact: true }).click()

  await score(page, unscored(page).first(), 10)
  await expect(liveBadge(page).first()).toBeVisible()
  await home(friend)
  await expect(friend.getByText("Theirs to keep")).toHaveCount(0)
})

test("with no connection the Live badge says Offline, and comes back by itself", async ({ page, context }) => {
  await newAmericano(page, { name: "Signal", players: FOUR })
  await broadcast(page)
  await context.setOffline(true)
  await expect(page.getByText("Offline", { exact: true }).first()).toBeVisible()
  // Scores are still taken with no connection.
  await score(page, unscored(page).first(), 10)
  await context.setOffline(false)
  await expect(liveBadge(page).first()).toBeVisible()
})

test("a score entered with no connection reaches the friend once it is back", async ({ page, context, browser }) => {
  await newAmericano(page, { name: "Catch up", players: FOUR })
  const link = await broadcast(page)
  const friend = await (await browser.newContext()).newPage()
  await friend.goto(link)
  await expect(liveBadge(friend).first()).toBeVisible()
  await context.setOffline(true)
  await score(page, unscored(page).first(), 10)
  await context.setOffline(false)
  await expect(friend.locator('[aria-label^="Court"]').first().locator("..")).toContainText("10")
})
