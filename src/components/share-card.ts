import { formatPoints, type StandingRow } from "@/lib/standings"
import type { Tournament } from "@/lib/types"

// The shareable result image: a fixed 4:5 card (fits WhatsApp and feeds),
// drawn straight onto a canvas. Kept separate from the on-screen standings
// on purpose — it has to read well as a small chat thumbnail.

const W = 1080
const FULL_H = 1350 // 4:5, the shape feeds and chats show best
const PODIUM_TOP = 330
const PODIUM_ROW = 124
const PAD = 80
const BLUE = "#1d4f91"
const BALL = "#dceb3a"
const INK = "#0e2240"
const FONT = '"Geist Variable", system-ui, sans-serif'

// `podiumOnly` draws a shorter card with just the top three — the on-screen
// preview, where the table below already lists everyone. The shared image
// always has every player.
export async function renderShareCard(
  tournament: Tournament,
  rows: StandingRow[],
  { podiumOnly = false }: { podiumOnly?: boolean } = {},
): Promise<Blob> {
  const H = podiumOnly ? PODIUM_TOP + Math.min(3, rows.length) * PODIUM_ROW + 150 : FULL_H
  await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 40px ${FONT}`)])

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
  ctx.font = `700 72px ${FONT}`
  ctx.fillText(fit(ctx, tournament.name, W - 2 * PAD), PAD, 160)
  ctx.fillStyle = "rgba(255,255,255,0.72)"
  ctx.font = `400 34px ${FONT}`
  const date = new Date(tournament.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
  ctx.fillText(`Americano, ${tournament.players.length} players, ${date}`, PAD, 215)

  // Column label for the numbers
  ctx.textAlign = "right"
  ctx.font = `400 28px ${FONT}`
  ctx.fillText("Points", W - PAD, 300)
  ctx.textAlign = "left"

  // Top three, large
  let y = PODIUM_TOP
  const podium = rows.slice(0, 3)
  for (const row of podium) {
    const h = PODIUM_ROW
    const cy = y + h / 2
    ctx.beginPath()
    ctx.arc(PAD + 40, cy, 40, 0, Math.PI * 2)
    ctx.fillStyle = row.rank === 1 ? BALL : "rgba(255,255,255,0.16)"
    ctx.fill()
    ctx.fillStyle = row.rank === 1 ? INK : "#ffffff"
    ctx.font = `700 40px ${FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(row.rank), PAD + 40, cy + 2)

    ctx.textAlign = "right"
    ctx.fillStyle = "#ffffff"
    ctx.font = `700 64px ${FONT}`
    ctx.fillText(formatPoints(row.points), W - PAD, cy + 2)
    const pointsWidth = ctx.measureText(formatPoints(row.points)).width

    ctx.textAlign = "left"
    ctx.font = `700 54px ${FONT}`
    ctx.fillText(fit(ctx, nameOf.get(row.playerId) ?? "", W - 2 * PAD - 110 - pointsWidth - 30), PAD + 110, cy + 2)
    y += h
  }

  // Everyone else, sized to fit
  const rest = podiumOnly ? [] : rows.slice(3)
  if (rest.length > 0) {
    y += 16
    ctx.fillStyle = "rgba(255,255,255,0.2)"
    ctx.fillRect(PAD, y, W - 2 * PAD, 2)
    y += 18
    const bottom = H - 130
    const rowH = Math.max(40, Math.min(72, (bottom - y) / rest.length))
    const fits = Math.floor((bottom - y) / rowH)
    const shown = rest.length > fits ? rest.slice(0, fits - 1) : rest
    const size = Math.round(rowH * 0.5)

    ctx.textBaseline = "middle"
    for (const row of shown) {
      const cy = y + rowH / 2
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.font = `700 ${size}px ${FONT}`
      ctx.textAlign = "center"
      ctx.fillText(String(row.rank), PAD + 40, cy)
      ctx.textAlign = "right"
      ctx.fillStyle = "#ffffff"
      ctx.fillText(formatPoints(row.points), W - PAD, cy)
      ctx.textAlign = "left"
      ctx.font = `400 ${size}px ${FONT}`
      ctx.fillText(fit(ctx, nameOf.get(row.playerId) ?? "", W - 2 * PAD - 260), PAD + 110, cy)
      y += rowH
    }
    if (shown.length < rest.length) {
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.font = `400 ${size}px ${FONT}`
      ctx.fillText(`and ${rest.length - shown.length} more`, PAD + 110, y + rowH / 2)
    }
  }

  // Footer
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"
  ctx.fillStyle = "rgba(255,255,255,0.6)"
  ctx.font = `400 30px ${FONT}`
  ctx.fillText(podiumOnly ? "Top three" : "Final standings", PAD, H - 64)
  ctx.textAlign = "right"
  const mode = tournament.scoringMode === "total" ? `${tournament.target} points per game` : `First to ${tournament.target}`
  ctx.fillText(mode, W - PAD, H - 64)

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
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
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
