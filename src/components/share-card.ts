import { formatPoints, winners, type StandingRow } from "@/lib/standings"
import type { Tournament } from "@/lib/types"

// The shareable result image: a fixed 4:5 card (fits WhatsApp and feeds),
// drawn straight onto a canvas. Kept separate from the on-screen standings
// on purpose — it has to read well as a small chat thumbnail.

const W = 1080
const FULL_H = 1350 // 4:5, the shape feeds and chats show best
const PAD = 60
const INSET = 28 // text sits this far inside the winner panel and the table rows
const BLUE = "#1d4f91"
const BALL = "#dceb3a"
const INK = "#0e2240"
const MUTED = "rgba(255,255,255,0.7)"
const FAMILY = '"Archivo Variable", sans-serif'
// The app's scoreboard voice: narrow and heavy for names and numbers.
const display = (size: number) => `800 condensed ${size}px ${FAMILY}`
const label = (size: number) => `700 semi-condensed ${size}px ${FAMILY}`
const body = (size: number) => `500 ${size}px ${FAMILY}`

const TOP = 250 // where the winner panel starts, under the title
const WINNER_H = 240
const WINNER_H_SHARED = 170 // a shared first place stacks one panel per winner
const GAP = 14
const HEADER_H = 58 // the column labels above the table
const ROW_MIN = 64 // smaller than this and the names can't be read in a chat
const ROW_MAX = 100
const BOTTOM = 60

// Played, won, drawn, lost: narrow columns sitting left of the points.
const STATS = [
  ["P", "played"],
  ["W", "wins"],
  ["D", "draws"],
  ["L", "losses"],
] as const
const STAT_W = 72
const RIGHT = W - PAD - INSET
const STATS_RIGHT = RIGHT - 170 // leaves room for the points
const statX = (i: number) => STATS_RIGHT - (STATS.length - 1 - i) * STAT_W // right edge of column i
const NAME_X = PAD + INSET + 84
const NAME_MAX = statX(0) - STAT_W - 16 - NAME_X

// `podiumOnly` draws a shorter card with just the top three — the on-screen
// preview, where the table below already lists everyone. The shared image
// lists as many players as fit at a readable size and counts the rest.
export async function renderShareCard(
  tournament: Tournament,
  rows: StandingRow[],
  { podiumOnly = false }: { podiumOnly?: boolean } = {},
): Promise<Blob> {
  await Promise.all([display(40), label(40), body(40)].map((f) => document.fonts.load(f)))

  // Everyone sharing first place gets a panel; the table takes the others.
  const champions = winners(rows).slice(0, 3)
  const winnerRows = rows.filter((r) => champions.includes(r.playerId))
  const others = rows.filter((r) => !champions.includes(r.playerId))
  const winnerH = winnerRows.length > 1 ? WINNER_H_SHARED : WINNER_H
  const tableTop = TOP + winnerRows.length * (winnerH + GAP) + HEADER_H

  const listed = podiumOnly ? others.slice(0, Math.max(0, 3 - winnerRows.length)) : others
  const H = podiumOnly ? tableTop + listed.length * ROW_MAX + BOTTOM : FULL_H
  const room = H - BOTTOM - tableTop
  const rowH = Math.max(ROW_MIN, Math.min(ROW_MAX, room / Math.max(1, listed.length)))
  const fits = Math.floor(room / rowH)
  // When they don't all fit, the last line says how many are left out.
  const shown = listed.length > fits ? listed.slice(0, fits - 1) : listed

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  const nameOf = new Map(tournament.players.map((p) => [p.id, p.name]))

  ctx.fillStyle = BLUE
  ctx.fillRect(0, 0, W, H)
  drawCourt(ctx, H)

  // Title and details
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#ffffff"
  ctx.font = display(92)
  ctx.fillText(fit(ctx, tournament.name, W - 2 * PAD), PAD, 142)
  ctx.fillStyle = MUTED
  ctx.font = body(32)
  const date = new Date(tournament.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
  const mode = tournament.scoringMode === "total" ? `${tournament.target} points per game` : `first to ${tournament.target}`
  ctx.fillText(`${date}, ${tournament.players.length} players, ${mode}`, PAD, 196)

  // The winner: a ball-yellow panel, the one loud thing on the card
  let y = TOP
  for (const row of winnerRows) {
    const big = winnerRows.length === 1
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(PAD, y, W - 2 * PAD, winnerH, 36)
    ctx.clip()
    ctx.fillStyle = BALL
    ctx.fill()
    // the seam of a ball, running off the right edge
    ctx.strokeStyle = "rgba(14,34,64,0.09)"
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.arc(W - PAD + 120, y - 190, 420, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = INK
    ctx.textBaseline = "alphabetic"
    ctx.textAlign = "right"
    ctx.font = display(big ? 150 : 104)
    const points = formatPoints(row.points)
    ctx.fillText(points, RIGHT, y + winnerH - (big ? 76 : 58))
    const pointsW = ctx.measureText(points).width
    ctx.font = label(28)
    ctx.fillText("points", RIGHT, y + winnerH - (big ? 36 : 26))

    ctx.textAlign = "left"
    const x = PAD + INSET + 8
    const nameMax = RIGHT - pointsW - 36 - x
    if (big) {
      ctx.font = label(30)
      ctx.fillText("Winner", x, y + 58)
    }
    ctx.font = display(big ? 100 : 76)
    ctx.fillText(fit(ctx, nameOf.get(row.playerId) ?? "", nameMax), x, y + (big ? 152 : 86))
    ctx.font = body(30)
    ctx.globalAlpha = 0.75
    const record = `${row.played} played, ${row.wins} won, ${row.draws} drawn, ${row.losses} lost`
    ctx.fillText(fit(ctx, record, nameMax), x, y + winnerH - (big ? 36 : 30))
    ctx.globalAlpha = 1
    y += winnerH + GAP
  }

  // Everyone else: one table, sized to fit
  if (shown.length > 0) {
    ctx.textBaseline = "alphabetic"
    ctx.textAlign = "right"
    ctx.fillStyle = MUTED
    ctx.font = label(26)
    ctx.fillText("Pts", RIGHT, tableTop - 16)
    STATS.forEach(([text], i) => ctx.fillText(text, statX(i), tableTop - 16))

    const size = Math.round(rowH * 0.5)
    y = tableTop
    ctx.textBaseline = "middle"
    shown.forEach((row, i) => {
      const cy = y + rowH / 2 + 2
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(14,34,64,0.32)"
        ctx.beginPath()
        ctx.roundRect(PAD, y, W - 2 * PAD, rowH, 18)
        ctx.fill()
      }
      ctx.textAlign = "center"
      ctx.fillStyle = row.rank <= 3 ? BALL : MUTED
      ctx.font = display(size)
      ctx.fillText(String(row.rank), PAD + INSET + 24, cy)

      ctx.textAlign = "right"
      ctx.fillStyle = "#ffffff"
      ctx.font = display(Math.round(size * 1.15))
      ctx.fillText(formatPoints(row.points), RIGHT, cy)
      ctx.fillStyle = MUTED
      ctx.font = body(Math.round(size * 0.85))
      STATS.forEach(([, key], j) => ctx.fillText(String(row[key]), statX(j), cy))

      ctx.textAlign = "left"
      ctx.fillStyle = "#ffffff"
      ctx.font = label(size)
      ctx.fillText(fit(ctx, nameOf.get(row.playerId) ?? "", NAME_MAX), NAME_X, cy)
      y += rowH
    })
    if (shown.length < listed.length) {
      ctx.fillStyle = MUTED
      ctx.font = body(Math.round(size * 0.85))
      ctx.fillText(`and ${listed.length - shown.length} more players`, NAME_X, y + rowH / 2 + 2)
    }
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image"))), "image/png"),
  )
}

// Faint padel court lines behind everything: outer walls, net, service lines.
function drawCourt(ctx: CanvasRenderingContext2D, H: number) {
  const courtW = 760
  const courtH = courtW * 2 // a court is 10 m by 20 m
  const x = W - courtW * 0.62
  const y = (H - courtH) / 2
  const m = courtH / 20 // pixels per metre
  ctx.save()
  ctx.strokeStyle = "rgba(255,255,255,0.1)"
  ctx.lineWidth = 6
  ctx.strokeRect(x, y, courtW, courtH)
  ctx.beginPath()
  ctx.moveTo(x, y + 10 * m) // net
  ctx.lineTo(x + courtW, y + 10 * m)
  ctx.moveTo(x, y + (10 - 6.95) * m) // service lines
  ctx.lineTo(x + courtW, y + (10 - 6.95) * m)
  ctx.moveTo(x, y + (10 + 6.95) * m)
  ctx.lineTo(x + courtW, y + (10 + 6.95) * m)
  ctx.moveTo(x + courtW / 2, y + (10 - 6.95) * m) // centre service line
  ctx.lineTo(x + courtW / 2, y + (10 + 6.95) * m)
  ctx.stroke()
  ctx.restore()
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

// Share the image as a real file (WhatsApp, Photos, …); where the Web Share
// API can't take files, download it instead. Call straight from a tap — iOS
// only allows sharing during the user's gesture.
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch (e) {
      if ((e as Error).name === "AbortError") return // the user closed the share sheet
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
