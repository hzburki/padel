// A game with more than one organiser: the organiser adds another, and
// anyone with that link scores, renames and finishes it too. No stored images. Everything goes to the
// local emulators, never to the hosted project. See taps.ts for the steps.
import { expect, test, type Page } from "@playwright/test"
import {
  addScorer,
  broadcast,
  catchCopy,
  copied,
  courts,
  emulatorsReady,
  finishMatch,
  finishMatchButton,
  finishTournament,
  home,
  liveBadge,
  newAmericano,
  newMatch,
  newPhone,
  points,
  score,
  sheet,
  tap,
  unscored,
  watchLink,
  win,
  winButton,
} from "./taps"

const FOUR = ["Ann", "Ben", "Cal", "Dee"]
const EIGHT = [...FOUR, "Eve", "Fay", "Gus", "Hal"]
const OFFLINE = "You can't change it until you're back."

// A match's row on a phone that can only watch: it is not a button there.
const watched = (page: Page, nth: number) => page.locator('[aria-label^="Court"]').nth(nth).locator("..")

test.beforeAll(({ playwright }) => emulatorsReady(playwright))

const isOrganiser = (page: Page) => page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("live:") && localStorage.getItem(k) === "1"))

test("a friend with the organiser link scores, and everyone sees it", async ({ page, browser }) => {
  await newAmericano(page, { name: "Court two", players: FOUR })
  const link = await addScorer(page)

  const scorer = await newPhone(browser)
  await scorer.goto(link)
  await expect(scorer.getByRole("heading", { name: "Court two" })).toBeVisible()
  await expect(scorer.getByText("You're an organiser.")).toBeVisible()
  await expect(liveBadge(scorer).first()).toBeVisible()

  const watcher = await newPhone(browser)
  await watcher.goto(watchLink(link))
  await expect(watcher.getByText("Watch only.")).toBeVisible()
  await expect(unscored(watcher)).toHaveCount(0)

  await score(scorer, unscored(scorer).first(), 10)
  await expect(courts(page).first()).toContainText("10")
  await expect(watched(watcher, 0)).toContainText("10")

  // The organiser still scores, on top of what the friend entered.
  await score(page, unscored(page).first(), 4)
  for (const phone of [page, scorer]) {
    await expect(courts(phone).nth(0)).toContainText("10")
    await expect(courts(phone).nth(1)).toContainText("12")
  }
  await expect(watched(watcher, 1)).toContainText("12")

  // The friend can correct a score too.
  await score(scorer, courts(scorer).first(), 9)
  await expect(courts(page).first()).toContainText("9")
})

test("the organiser link is the watch link plus a key of 8, and is the same every time", async ({ page }) => {
  await newAmericano(page, { name: "Same link", players: FOUR })
  const watch = await broadcast(page)
  const link = await addScorer(page)
  expect(link).toMatch(new RegExp(`^${watch}/[0-9a-z]{8}$`))
  expect(await addScorer(page)).toBe(link)
})

test("two friends scoring two courts at once both keep their score", async ({ page, browser }) => {
  await newAmericano(page, { name: "Two courts", players: EIGHT, courts: 2 })
  const link = await addScorer(page)
  const first = await newPhone(browser)
  const second = await newPhone(browser)
  for (const phone of [first, second]) {
    await phone.goto(link)
    await expect(phone.getByText("You're an organiser.")).toBeVisible()
  }
  await Promise.all([score(first, courts(first).nth(0), 10), score(second, courts(second).nth(1), 7)])
  for (const phone of [page, first, second]) {
    await expect(courts(phone).nth(0)).toContainText("10")
    await expect(courts(phone).nth(1)).toContainText("7")
  }
})

test("an organiser's own scores stay on their screen while nothing reaches their phone", async ({ page, browser }) => {
  // The stream that brings the online copy to this phone never answers.
  await page.route(/\/Listen\/channel/, (route) => (route.request().method() === "GET" ? new Promise(() => {}) : route.continue()))
  await newAmericano(page, { name: "Silent", players: EIGHT, courts: 2 })
  const link = await addScorer(page)
  const watcher = await newPhone(browser)
  await watcher.goto(watchLink(link))
  await expect(watcher.getByText("Watch only.")).toBeVisible()

  await score(page, courts(page).nth(0), 10)
  await score(page, courts(page).nth(1), 7)
  // Both went online, and neither was taken back off the organiser's screen.
  await expect(watched(watcher, 0)).toContainText("10")
  await expect(watched(watcher, 1)).toContainText("7")
  await expect(courts(page).nth(0)).toContainText("10")
  await expect(courts(page).nth(1)).toContainText("7")
  await page.unrouteAll({ behavior: "ignoreErrors" })
})

test("an organiser link with the wrong key only lets a friend watch", async ({ page, browser }) => {
  await newAmericano(page, { name: "Wrong key", players: FOUR })
  const link = await addScorer(page)
  const friend = await newPhone(browser)
  await friend.goto(`${watchLink(link)}/wr0ngkey`)
  await expect(friend.getByRole("heading", { name: "Wrong key" })).toBeVisible()
  await expect(friend.getByText("Watch only.")).toBeVisible()
  await expect(unscored(friend)).toHaveCount(0)
})

test("an added organiser with no connection is told so, and scores again once it is back", async ({ page, browser }) => {
  await newAmericano(page, { name: "No signal", players: FOUR })
  const link = await addScorer(page)
  const context = await browser.newContext()
  const scorer = await context.newPage()
  await scorer.goto(link)
  await expect(scorer.getByText("You're an organiser.")).toBeVisible()

  // What a scorer may do stays on screen, greyed out.
  await context.setOffline(true)
  await expect(scorer.getByText(OFFLINE)).toBeVisible()
  await expect(unscored(scorer).first()).toBeDisabled()

  await context.setOffline(false)
  await expect(scorer.getByText("You're an organiser.")).toBeVisible()
  await score(scorer, unscored(scorer).first(), 10)
  await expect(courts(page).first()).toContainText("10")
})

test("the organiser of a game friends are scoring needs a connection too", async ({ page, context }) => {
  await newAmericano(page, { name: "Organiser offline", players: FOUR })
  await addScorer(page)
  await context.setOffline(true)
  await expect(page.getByText(OFFLINE)).toBeVisible()
  await expect(unscored(page).first()).toBeDisabled()
  await tap(page, 'button:has-text("Standings")')
  await expect(page.getByRole("button", { name: "Finish tournament" })).toBeDisabled()
  await tap(page, 'button:has-text("Rounds")')
  // Names are changed online as well.
  await tap(page, 'button[aria-label="More"]')
  await expect(sheet(page).getByRole("button", { name: "Edit names" })).toBeDisabled()
  await page.keyboard.press("Escape")

  await context.setOffline(false)
  await expect(page.getByText(OFFLINE)).toHaveCount(0)
  await score(page, unscored(page).first(), 10)
  await expect(courts(page).first()).toContainText("10")
})

test("with no connection a game can't be broadcast or given another organiser", async ({ page, context }) => {
  await newAmericano(page, { name: "No way out", players: FOUR })
  await context.setOffline(true)
  await tap(page, 'button[aria-label="More"]')
  for (const row of ["Broadcast live", "Add an organiser"]) {
    await expect(sheet(page).getByRole("button", { name: row })).toBeDisabled()
  }
  // Nothing else in the menu needs a connection.
  await expect(sheet(page).getByRole("button", { name: "Edit names" })).toBeEnabled()
  await context.setOffline(false)
  for (const row of ["Broadcast live", "Add an organiser"]) {
    await expect(sheet(page).getByRole("button", { name: row })).toBeEnabled()
  }
})

test("a match: an added organiser's points and undo reach everyone, and they can finish it", async ({ page, browser }) => {
  await newMatch(page, { name: "Scored match", gamesPerSet: 2 })
  const link = await addScorer(page, { kind: "m" })
  const scorer = await newPhone(browser)
  await scorer.goto(link)
  await expect(scorer.getByText("You're an organiser.")).toBeVisible()
  const watcher = await newPhone(browser)
  await watcher.goto(watchLink(link))
  await expect(winButton(watcher, 0)).toHaveCount(0)

  await win(scorer, 0)
  for (const phone of [page, watcher]) await expect(points(phone, 0)).toHaveText("15")
  await scorer.getByRole("button", { name: /Undo last/ }).click()
  for (const phone of [page, watcher]) await expect(points(phone, 0)).toHaveText("0")

  // Tapped quickly, every point counts and none is entered twice.
  await win(scorer, 0, 3)
  await expect(points(page, 0)).toHaveText("40")
  await win(page, 1)
  await expect(points(scorer, 1)).toHaveText("15")

  await win(scorer, 0, 5)
  await expect(finishMatchButton(page)).toBeVisible()
  await expect(scorer.getByRole("button", { name: /Undo last/ })).toBeVisible()
  await finishMatch(scorer)
  await sheet(scorer).getByRole("button", { name: "Close" }).click()
  for (const phone of [page, watcher]) await expect(phone.locator('img[alt="Final score"]')).toBeVisible()
})

test("an added organiser of a match with no connection sees the buttons greyed out", async ({ page, browser }) => {
  await newMatch(page, { name: "Greyed out", gamesPerSet: 2 })
  const link = await addScorer(page, { kind: "m" })
  const context = await browser.newContext()
  const scorer = await context.newPage()
  await scorer.goto(link)
  await expect(scorer.getByText("You're an organiser.")).toBeVisible()
  await win(scorer, 0)

  await context.setOffline(true)
  await expect(scorer.getByText(OFFLINE)).toBeVisible()
  for (const side of [0, 1] as const) await expect(winButton(scorer, side)).toBeDisabled()
  await expect(scorer.getByRole("button", { name: /Undo last/ })).toBeDisabled()

  await context.setOffline(false)
  await expect(winButton(scorer, 0)).toBeEnabled()
  await win(scorer, 0)
  await expect(points(page, 0)).toHaveText("30")
})

test("an added organiser renames the game, hands out both links and finishes it", async ({ page, browser }) => {
  await newAmericano(page, { name: "Run by two", players: FOUR })
  const link = await addScorer(page)
  const added = await newPhone(browser)
  await catchCopy(added)
  await added.goto(link)
  await expect(added.getByText("You're an organiser.")).toBeVisible()

  await tap(added, 'button[aria-label="More"]')
  await tap(added, 'button:has-text("Edit names")')
  await sheet(added).locator("#tournament-name").fill("Renamed by two")
  await sheet(added).getByRole("button", { name: "Save names" }).click()
  await expect(page.getByRole("heading", { name: "Renamed by two" })).toBeVisible()

  // The same two links the first organiser hands out.
  await tap(added, 'button[aria-label="More"]')
  await tap(added, 'button:has-text("Broadcast live")')
  await expect(added.getByText("Link copied!")).toBeVisible()
  expect(await copied(added)).toBe(`Follow Renamed by two live:\nhttp://localhost:5199${watchLink(link)}`)
  await tap(added, 'button[aria-label="More"]')
  await tap(added, 'button:has-text("Add an organiser")')
  await expect(added.getByText("Organiser link copied!")).toBeVisible()
  expect(await copied(added)).toBe(`Help organise Renamed by two. Open this link to enter scores:\nhttp://localhost:5199${link}`)

  while ((await unscored(added).count()) > 0) await score(added, unscored(added).first(), 9)
  await finishTournament(added)
  await sheet(added).getByRole("button", { name: "Close" }).click()
  await expect(page.locator('img[alt="Top three"]')).toBeVisible()
  await expect(liveBadge(page)).toHaveCount(0)
})

test("an added organiser's Delete removes only their copy", async ({ page, browser }) => {
  await newAmericano(page, { name: "Not theirs to delete", players: FOUR })
  const link = await addScorer(page)
  const added = await newPhone(browser)
  await added.goto(link)
  await expect(added.getByText("You're an organiser.")).toBeVisible()
  await tap(added, 'button[aria-label="More"]')
  await tap(added, 'button:has-text("Delete tournament")')
  await expect(sheet(added).getByText(/Only your copy is removed/)).toBeVisible()
  await sheet(added).getByRole("button", { name: "Delete", exact: true }).click()

  // The game goes on, and the same link still lets the friend back in.
  await score(page, unscored(page).first(), 10)
  await added.goto(link)
  await expect(added.getByText("You're an organiser.")).toBeVisible()
  await expect(courts(added).first()).toContainText("10")
})

test("finishing locks every organiser, and deleting the game kills the organiser link", async ({ page, browser }) => {
  await newAmericano(page, { name: "The end", players: FOUR })
  const link = await addScorer(page)
  const scorer = await newPhone(browser)
  await scorer.goto(link)
  await expect(scorer.getByText("You're an organiser.")).toBeVisible()

  while ((await unscored(page).count()) > 0) await score(page, unscored(page).first(), 9)
  await finishTournament(page)
  await sheet(page).getByRole("button", { name: "Close" }).click()
  await expect(scorer.locator('img[alt="Top three"]')).toBeVisible()
  await expect(scorer.getByText("Watch only.")).toBeVisible()
  await expect(liveBadge(scorer)).toHaveCount(0)
  await expect(liveBadge(page)).toHaveCount(0)

  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Delete tournament")')
  await sheet(page).getByRole("button", { name: "Delete", exact: true }).click()
  const stranger = await newPhone(browser)
  await stranger.goto(link)
  await expect(stranger.getByText(/This link doesn't lead to a game/)).toBeVisible()
})

test("each link is copied as a short message with the game's name", async ({ page }) => {
  await catchCopy(page)
  await newAmericano(page, { name: "Sunday Americano", players: FOUR })
  const watch = await broadcast(page)
  await expect(page.getByText("Link copied!")).toBeVisible()
  expect(await copied(page)).toBe(`Follow Sunday Americano live:\nhttp://localhost:5199${watch}`)

  const link = await addScorer(page)
  await expect(page.getByText("Organiser link copied!")).toBeVisible()
  expect(await copied(page)).toBe(`Help organise Sunday Americano. Open this link to enter scores:\nhttp://localhost:5199${link}`)
})

test("the organiser edits a name while a friend scores, and both are kept", async ({ page, browser }) => {
  await newAmericano(page, { name: "Before", players: FOUR })
  const link = await addScorer(page)
  const scorer = await newPhone(browser)
  await scorer.goto(link)
  await expect(scorer.getByText("You're an organiser.")).toBeVisible()
  await score(scorer, unscored(scorer).first(), 10)

  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Edit names")')
  await sheet(page).locator("#tournament-name").fill("After")
  await sheet(page).getByLabel("Player 1").fill("Annie")
  await sheet(page).getByRole("button", { name: "Save names" }).click()

  await expect(scorer.getByRole("heading", { name: "After" })).toBeVisible()
  await expect(scorer.getByText(/Annie/).first()).toBeVisible()
  for (const phone of [page, scorer]) await expect(courts(phone).first()).toContainText("10")
})

test("the organiser goes live with another game: the first passes to its other organiser", async ({ page, browser }) => {
  await newAmericano(page, { name: "First game", players: FOUR })
  const link = await addScorer(page)
  const scorer = await newPhone(browser)
  await scorer.goto(link)
  await expect(scorer.getByText("You're an organiser.")).toBeVisible()
  const watcher = await newPhone(browser)
  await watcher.goto(watchLink(link))
  await expect(liveBadge(watcher).first()).toBeVisible()

  await newAmericano(page, { name: "Second game", players: FOUR })
  await addScorer(page, { closesAnother: true, passes: true })

  // The friend is told, and the game is theirs: still live, on the same links.
  await expect(scorer.getByText("This game is yours now")).toBeVisible()
  await expect(scorer.getByText("You're an organiser.")).toHaveCount(0)
  await expect(liveBadge(scorer).first()).toBeVisible()
  await expect(liveBadge(watcher).first()).toBeVisible()
  await tap(scorer, 'button[aria-label="More"]')
  await tap(scorer, 'button:has-text("Edit names")')
  await sheet(scorer).locator("#tournament-name").fill("Now mine")
  await sheet(scorer).getByRole("button", { name: "Save names" }).click()
  await expect(watcher.getByRole("heading", { name: "Now mine" })).toBeVisible()

  // On the old owner's phone it is a friend's game they still organise.
  await home(page)
  await page.locator("button", { hasText: "Now mine" }).click()
  await expect(page.getByText("You're an organiser.")).toBeVisible()
  await score(page, unscored(page).first(), 10)
  await expect(courts(scorer).first()).toContainText("10")
  // Deleting it there no longer deletes it for everyone.
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Delete tournament")')
  await expect(sheet(page).getByText(/Only your copy is removed/)).toBeVisible()
  await page.keyboard.press("Escape")

  // The new owner finishes it, for everyone.
  while ((await unscored(scorer).count()) > 0) await score(scorer, unscored(scorer).first(), 9)
  await finishTournament(scorer)
  await sheet(scorer).getByRole("button", { name: "Close" }).click()
  await expect(watcher.locator('img[alt="Top three"]')).toBeVisible()
  await expect(page.locator('img[alt="Top three"]')).toBeVisible()
})

test("a game passed on has exactly one new organiser when two friends score it", async ({ page, browser }) => {
  await newAmericano(page, { name: "One of two", players: FOUR })
  const link = await addScorer(page)
  const first = await newPhone(browser)
  const second = await newPhone(browser)
  for (const phone of [first, second]) {
    await phone.goto(link)
    await expect(phone.getByText("You're an organiser.")).toBeVisible()
  }
  await newAmericano(page, { name: "Elsewhere", players: FOUR })
  await broadcast(page, { closesAnother: true })

  await expect.poll(async () => [await isOrganiser(first), await isOrganiser(second)].filter(Boolean).length).toBe(1)
  // The other one still scores.
  const [organiser, other] = (await isOrganiser(first)) ? [first, second] : [second, first]
  await expect(organiser.getByText("This game is yours now")).toBeVisible()
  await expect(other.getByText("You're an organiser.")).toBeVisible()
  await score(other, unscored(other).first(), 10)
  await expect(courts(organiser).first()).toContainText("10")
})

test("a game whose organiser link nobody opened closes, and goes live again on the same links", async ({ page, browser }) => {
  await newAmericano(page, { name: "Nobody came", players: FOUR })
  const link = await addScorer(page)
  await newAmericano(page, { name: "Other game", players: FOUR })
  await broadcast(page, { closesAnother: true })

  // A friend who opens the organiser link now is still an organiser of it,
  // though it is not live.
  const late = await newPhone(browser)
  await late.goto(link)
  await expect(late.getByRole("heading", { name: "Nobody came" })).toBeVisible()
  await expect(late.getByText("You're an organiser.")).toBeVisible()
  await expect(liveBadge(late)).toHaveCount(0)

  // Still the first organiser's own game, changed online like before.
  await home(page)
  await page.locator("button", { hasText: "Nobody came" }).click()
  await expect(liveBadge(page)).toHaveCount(0)
  await score(page, unscored(page).first(), 10)
  expect(await addScorer(page, { closesAnother: true })).toBe(link)
  await expect(late.getByText("You're an organiser.")).toBeVisible()
  await expect(courts(late).first()).toContainText("10")
})
