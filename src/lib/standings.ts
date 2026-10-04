import type { Match, PlayerId, Round } from "./types"

export interface StandingRow {
  playerId: PlayerId
  rank: number // 1-based; fully tied players share a rank (1, 2, 2, 4)
  played: number
  points: number // points used for ranking; includes `bonus` in final standings
  bonus: number // points added for games a player didn't get to play (final only)
  conceded: number
  diff: number // (scored - conceded), scaled the same way as points
  wins: number
  draws: number
  losses: number
}

// Rank players on scored matches only. Order: points, then point difference,
// then head-to-head among the players still tied, then wins.
//
// In final standings, a player who played fewer games than the most anyone
// played has their points (and difference) scaled up in proportion:
// 12 points from 4 games, when others played 5, counts as 15. Mid-tournament
// nobody is scaled — the others may simply not have played their extra game yet.
export function computeStandings(
  players: PlayerId[],
  rounds: Round[],
  { final = false }: { final?: boolean } = {},
): StandingRow[] {
  const scored = rounds.flatMap((r) => r.matches).filter((m) => m.score !== null)
  const rows = new Map<PlayerId, StandingRow>(
    players.map((id) => [
      id,
      { playerId: id, rank: 0, played: 0, points: 0, bonus: 0, conceded: 0, diff: 0, wins: 0, draws: 0, losses: 0 },
    ]),
  )

  for (const match of scored) {
    const { a, b } = match.score!
    for (const [team, own, other] of [
      [match.teamA, a, b],
      [match.teamB, b, a],
    ] as const) {
      for (const id of team) {
        const row = rows.get(id)!
        row.played++
        row.points += own
        row.conceded += other
        if (own > other) row.wins++
        else if (own < other) row.losses++
        else row.draws++
      }
    }
  }
  for (const row of rows.values()) row.diff = row.points - row.conceded

  if (final) {
    const mostPlayed = Math.max(0, ...[...rows.values()].map((r) => r.played))
    for (const row of rows.values()) {
      if (row.played === 0 || row.played === mostPlayed) continue
      const factor = mostPlayed / row.played
      const scaled = round2(row.points * factor)
      row.bonus = round2(scaled - row.points)
      row.points = scaled
      row.diff = round2(row.diff * factor)
    }
  }

  // Group by points + diff; inside each group, head-to-head decides.
  const byPointsAndDiff = [...rows.values()].sort((x, y) => y.points - x.points || y.diff - x.diff)
  const ordered: StandingRow[] = []
  const h2hOf = new Map<PlayerId, number>()
  for (let i = 0; i < byPointsAndDiff.length; ) {
    let j = i
    while (
      j < byPointsAndDiff.length &&
      byPointsAndDiff[j].points === byPointsAndDiff[i].points &&
      byPointsAndDiff[j].diff === byPointsAndDiff[i].diff
    ) j++
    const group = byPointsAndDiff.slice(i, j)
    const h2h = headToHead(group.map((r) => r.playerId), scored)
    for (const [id, v] of h2h) h2hOf.set(id, v)
    group.sort((x, y) => h2h.get(y.playerId)! - h2h.get(x.playerId)! || y.wins - x.wins)
    ordered.push(...group)
    i = j
  }

  ordered.forEach((row, i) => {
    const prev = ordered[i - 1]
    const tiedWithPrev =
      prev &&
      prev.points === row.points &&
      prev.diff === row.diff &&
      h2hOf.get(prev.playerId) === h2hOf.get(row.playerId) &&
      prev.wins === row.wins
    row.rank = tiedWithPrev ? prev.rank : i + 1
  })
  return ordered
}

// Each tied player's record against the others in the tie: +1 for every
// match won against one of them, -1 for every match lost, 0 for a draw.
// Partners don't count — only matches where they stood on opposite sides.
function headToHead(tied: PlayerId[], matches: Match[]): Map<PlayerId, number> {
  const result = new Map(tied.map((id) => [id, 0]))
  if (tied.length < 2) return result
  for (const match of matches) {
    const { a, b } = match.score!
    if (a === b) continue
    const [winners, losers] = a > b ? [match.teamA, match.teamB] : [match.teamB, match.teamA]
    for (const w of winners) {
      for (const l of losers) {
        if (result.has(w) && result.has(l)) {
          result.set(w, result.get(w)! + 1)
          result.set(l, result.get(l)! - 1)
        }
      }
    }
  }
  return result
}

// Two decimals is plenty for display and keeps float noise out of ties.
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Whole numbers as they are; scaled points to one decimal (10.5, 13.3).
export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
