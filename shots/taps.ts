// What the game flows share: setting a game up and scoring it by tapping,
// the way an organiser would.
import { expect, type Locator, type Page } from "@playwright/test"

// A plain reload would bring back the screen stack kept in history.
export async function home(page: Page) {
  await page.goto("about:blank")
  await page.goto("/")
}

export async function tap(page: Page, selector: string, nth = 0) {
  await page.locator(selector).filter({ visible: true }).nth(nth).click()
}

export const sheet = (page: Page) => page.getByRole("dialog")
export const liveBadge = (page: Page) => page.getByText("Live", { exact: true }).filter({ visible: true })

// Americano ---------------------------------------------------------------

// Every match on the rounds list, and those with no score yet.
export const courts = (page: Page) => page.locator('button:has([aria-label^="Court"])')
export const unscored = (page: Page) => courts(page).filter({ hasText: "Score" })

// Fills in the New game form for an Americano, without starting it.
export async function fillAmericano(
  page: Page,
  { name, players, courts = 1, firstTo = false, target }: { name: string; players: string[]; courts?: number; firstTo?: boolean; target?: number },
) {
  await home(page)
  await tap(page, 'button:has-text("New game")')
  await page.locator("input").filter({ visible: true }).first().fill(name)
  const player = page.locator('input[placeholder*="player" i]').filter({ visible: true })
  for (const p of players) {
    await player.fill(p)
    await page.keyboard.press("Enter")
  }
  // The steppers, top to bottom: courts, points a game, rounds.
  for (let i = 1; i < courts; i++) await tap(page, 'button[aria-label="More"]', 0)
  if (firstTo) await tap(page, 'button:has-text("First to")')
  if (target) {
    await tap(page, 'button:has-text("points a game")')
    await sheet(page).getByRole("button", { name: String(target), exact: true }).click()
  }
}

// Starts the tournament on the form and waits for its rounds: working out
// the schedule can take a moment.
export async function startTournament(page: Page) {
  await tap(page, 'button:has-text("Start tournament")')
  await expect(unscored(page).first()).toBeVisible()
}

export async function newAmericano(page: Page, setup: Parameters<typeof fillAmericano>[1]) {
  await fillAmericano(page, setup)
  await startTournament(page)
}

// Total points: taps the first team's points and saves.
export async function score(page: Page, row: Locator, points: number) {
  await row.click()
  await sheet(page).getByRole("button", { name: String(points), exact: true }).click()
  await sheet(page).getByRole("button", { name: "Save score" }).click()
  await expect(sheet(page)).toHaveCount(0)
}

// First to: the first team won, the other got `loserPoints`.
export async function scoreFirstTo(page: Page, row: Locator, loserPoints: number) {
  await row.click()
  await sheet(page).locator('button:has-text("Tap to give them")').first().click()
  await sheet(page).getByRole("button", { name: String(loserPoints), exact: true }).click()
  await sheet(page).getByRole("button", { name: "Save score" }).click()
  await expect(sheet(page)).toHaveCount(0)
}

export async function finishTournament(page: Page) {
  await tap(page, 'button:has-text("Finish tournament")')
  await sheet(page).getByRole("button", { name: "Finish", exact: true }).click()
}

// Match -------------------------------------------------------------------

export type MatchSetup = {
  name: string
  sets?: "1 set" | "3 sets" | "5 sets" | { firstTo: 1 | 2 | 3 }
  gamesPerSet?: number
  scoreBy?: "Every point" | "Games only"
  deuce?: "Advantage" | "Golden point"
}

// Ann & Ben against Cal & Dee.
export async function newMatch(page: Page, { name, sets = "1 set", gamesPerSet = 6, scoreBy = "Every point", deuce = "Advantage" }: MatchSetup) {
  await home(page)
  await tap(page, 'button:has-text("New game")')
  await tap(page, 'button[aria-pressed]:has-text("Match")')
  await page.locator("input").filter({ visible: true }).first().fill(name)
  for (const [label, player] of [
    ["Team 1, player 1", "Ann"],
    ["Team 1, player 2", "Ben"],
    ["Team 2, player 1", "Cal"],
    ["Team 2, player 2", "Dee"],
  ]) {
    await page.getByLabel(label).fill(player)
  }
  if (typeof sets === "string") {
    await tap(page, `button:has-text("${sets}")`)
  } else {
    await tap(page, 'button:has-text("First to")')
    for (let i = 1; i < sets.firstTo; i++) await tap(page, 'button[aria-label="More"]', 0)
  }
  // The last stepper on the form is games a set, which starts at 6.
  const fewer = page.locator('button[aria-label="Fewer"]').filter({ visible: true }).last()
  const more = page.locator('button[aria-label="More"]').filter({ visible: true }).last()
  for (let n = 6; n > gamesPerSet; n--) await fewer.click()
  for (let n = 6; n < gamesPerSet; n++) await more.click()
  await tap(page, `button:has-text("${scoreBy}")`)
  if (scoreBy === "Every point") await tap(page, `button:has-text("${deuce}")`)
  await tap(page, 'button:has-text("Start match")')
  await expect(winButton(page, 0)).toBeVisible()
}

// The two big buttons: a point, a game or a tie-break for Ann & Ben (0) or
// Cal & Dee (1).
export const winButton = (page: Page, side: 0 | 1) =>
  page.locator("button", { hasText: /Point for|Game for|Tie-break for/ }).filter({ visible: true }).nth(side)

export async function win(page: Page, side: 0 | 1, times = 1) {
  for (let i = 0; i < times; i++) await winButton(page, side).click()
}

// The points of the game being played, as the scoreboard shows them.
export const points = (page: Page, side: 0 | 1) => page.locator("span.h-14.w-14.bg-primary").filter({ visible: true }).nth(side)

export const finishMatchButton = (page: Page) => page.getByRole("button", { name: "Finish match" })

export async function finishMatch(page: Page) {
  await finishMatchButton(page).click()
  await sheet(page).getByRole("button", { name: "Finish", exact: true }).click()
}

// Sharing -----------------------------------------------------------------

// Taps Broadcast live and returns the link the organiser would paste to
// friends. Broadcasts go to the local emulators.
export async function broadcast(page: Page, { kind = "t", closesAnother = false }: { kind?: "t" | "m"; closesAnother?: boolean } = {}) {
  await tap(page, 'button[aria-label="More"]')
  await tap(page, 'button:has-text("Broadcast live")')
  if (closesAnother) {
    await expect(sheet(page).getByText("Your other broadcast closes.")).toBeVisible()
    await sheet(page).getByRole("button", { name: "Broadcast", exact: true }).click()
  }
  await expect(liveBadge(page).first()).toBeVisible()
  return page.evaluate((kind) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("live:") && localStorage.getItem(k) === "1")!
    return `/${kind}/${key.slice(5)}`
  }, kind)
}

// The share sheet belongs to the phone: stand in for it and keep the file.
export async function catchShare(page: Page) {
  await page.addInitScript(() => {
    navigator.canShare = () => true
    navigator.share = async (data) => {
      const file = data!.files![0]
      const start = new Uint8Array(await file.slice(0, 4).arrayBuffer())
      ;(window as unknown as { shared: unknown }).shared = { name: file.name, type: file.type, start: [...start] }
    }
  })
}

export const sharedFile = (page: Page) => page.evaluate(() => (window as unknown as { shared: unknown }).shared)

// Every PNG file starts with these four bytes.
export const PNG_START = [0x89, 0x50, 0x4e, 0x47]
