import { replay } from "@/lib/set-match"
import { matchStats } from "@/lib/set-match-stats"
import type { SetMatch, Side } from "@/lib/types"
import { BALL, BLUE, body, display, drawCourt, fit, INK, INSET, label, MUTED, PAD, W } from "./share-card"

// The shareable result of a match: the same 4:5 blue card as a tournament's,
// with the winners in the ball-yellow panel, the set scores under it and
// three numbers at the foot.

const FULL_H = 1350
const TOP = 250 // where the winner panel starts, under the title
const WINNER_H = 250
const TABLE_TOP = TOP + WINNER_H + 96 // leaves room for the set labels
const ROW_H = 170
const GAP = 14
const BOTTOM = 60
const SET_W = 112 // one column of games per set, up to five
const RIGHT = W - PAD - INSET

// `scoreOnly` stops under the set scores — the on-screen preview, where the
// stats are already listed below it.
export async function renderMatchShareCard(
  match: SetMatch,
  { scoreOnly = false }: { scoreOnly?: boolean } = {},
): Promise<Blob> {
  await Promise.all([display(40), label(40), body(40)].map((f) => document.fonts.load(f)))

  const state = replay(match, match.points)
  const stats = matchStats(state)
  // Winners on top; everything on the card reads winner first.
  const order: [Side, Side] = state.winner === 1 ? [1, 0] : [0, 1]
  const [won, lost] = order
  const tableBottom = TABLE_TOP + 2 * ROW_H + GAP
  const H = scoreOnly ? tableBottom + BOTTOM : FULL_H

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  ctx.fillStyle = BLUE
  ctx.fillRect(0, 0, W, H)
  drawCourt(ctx, H)

  // Title and details
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#ffffff"
  ctx.font = display(92)
  ctx.fillText(fit(ctx, match.name, W - 2 * PAD), PAD, 142)
  ctx.fillStyle = MUTED
  ctx.font = body(32)
  const date = new Date(match.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
  const length = match.bestOf === 1 ? "1 set" : `best of ${match.bestOf}`
  ctx.fillText(`${date}, ${length}, ${match.gamesPerSet} games a set`, PAD, 196)

  // The winners: a ball-yellow panel, the one loud thing on the card
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(PAD, TOP, W - 2 * PAD, WINNER_H, 36)
  ctx.clip()
  ctx.fillStyle = BALL
  ctx.fill()
  // the seam of a ball, running off the right edge
  ctx.strokeStyle = "rgba(14,34,64,0.09)"
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.arc(W - PAD + 120, TOP - 190, 420, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = INK
  ctx.textAlign = "right"
  ctx.font = display(150)
  const sets = `${state.setsWon[won]}–${state.setsWon[lost]}`
  ctx.fillText(sets, RIGHT, TOP + WINNER_H - 80)
  const setsW = ctx.measureText(sets).width
  ctx.font = label(28)
  ctx.fillText("sets", RIGHT, TOP + WINNER_H - 38)

  ctx.textAlign = "left"
  const x = PAD + INSET + 8
  const nameMax = RIGHT - setsW - 36 - x
  ctx.font = label(30)
  ctx.fillText(state.winner === null ? "Ahead" : "Winners", x, TOP + 58)
  ctx.font = display(88)
  ctx.fillText(fit(ctx, match.teams[won][0], nameMax), x, TOP + 140)
  ctx.fillText(fit(ctx, match.teams[won][1], nameMax), x, TOP + 220)

  // Set scores: one row per team, a column per set
  const played = state.sets.filter((set) => set.played.length > 0)
  const setX = (i: number) => RIGHT - (played.length - 1 - i) * SET_W // right edge of column i
  const NAME_X = PAD + INSET + 8
  const tableNameMax = setX(0) - SET_W - NAME_X

  ctx.textAlign = "right"
  ctx.fillStyle = MUTED
  ctx.font = label(26)
  played.forEach((_, i) => ctx.fillText(`S${i + 1}`, setX(i) - 10, TABLE_TOP - 18))

  order.forEach((side, row) => {
    const y = TABLE_TOP + row * (ROW_H + GAP)
    ctx.fillStyle = "rgba(14,34,64,0.32)"
    ctx.beginPath()
    ctx.roundRect(PAD, y, W - 2 * PAD, ROW_H, 24)
    ctx.fill()

    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = "#ffffff"
    ctx.font = label(50)
    ctx.fillText(fit(ctx, match.teams[side][0], tableNameMax), NAME_X, y + 74)
    ctx.fillText(fit(ctx, match.teams[side][1], tableNameMax), NAME_X, y + 134)

    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    ctx.font = display(96)
    played.forEach((set, i) => {
      // A set they won is lit in ball yellow; one still being played is white.
      ctx.fillStyle = set.winner === side ? BALL : set.winner === null ? "#ffffff" : MUTED
      ctx.fillText(String(set.games[side]), setX(i), y + ROW_H / 2 + 4)
    })
  })

  // Three numbers, winners' first
  if (!scoreOnly) {
    const numbers: [value: string, name: string][] = [
      [`${stats[won].games}–${stats[lost].games}`, "games"],
      [`${stats[won].points}–${stats[lost].points}`, "points"],
      [
        `${stats[won].deuceGames}–${stats[lost].deuceGames}`,
        match.deuce === "golden" ? "golden points" : "deuce games",
      ],
    ]
    const colW = (W - 2 * PAD) / numbers.length
    const mid = (tableBottom + H - BOTTOM) / 2
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    numbers.forEach(([value, name], i) => {
      const cx = PAD + colW * (i + 0.5)
      ctx.fillStyle = "#ffffff"
      ctx.font = display(104)
      ctx.fillText(value, cx, mid + 20)
      ctx.fillStyle = MUTED
      ctx.font = label(30)
      ctx.fillText(name, cx, mid + 70)
    })
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image"))), "image/png"),
  )
}
