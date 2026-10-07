// The games every screenshot run starts from. The same date, ids and
// pairings each time, so a screen only changes when the app does.

// 10 January 2026, midday. Also what the page's clock is set to.
export const NOW = Date.UTC(2026, 0, 10, 12)

// Long, short, hyphenated and accented names, to stretch every row.
export const NAMES = [
  "Maximilian Alexander",
  "Bartholomew",
  "Ana",
  "Christopher-James",
  "Li",
  "Siobhán",
  "Muhammad Abdullah",
  "Jo",
  "Wolfeschlegelsteinhausen",
]

// Runs in the page, so it can save through the app's own modules. It can use
// nothing from this file but what it is handed.
export async function seed({ names, now }: { names: string[]; now: number }) {
  const T = await import("/src/lib/tournament.ts")
  const S = await import("/src/lib/storage.ts")
  const MS = await import("/src/lib/set-match-setup.ts")
  const SM = await import("/src/lib/set-match.ts")
  const day = 86400000

  let ids = 0
  const newId = () => String(++ids).padStart(10, "0")
  // A small seeded random number maker (mulberry32), so the pairings repeat.
  let state = 20260110
  const rng = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const tournament = (input, daysAgo) => T.createTournament(input, { now: now - daysAgo * day, newId, rng })
  const scoreRounds = (t, upTo) => {
    t.rounds.forEach((round, r) => {
      if (r < upTo) round.matches.forEach((m, i) => (m.score = { a: 32 - (((r + i) * 7) % 15), b: ((r + i) * 7) % 15 }))
    })
    return t
  }

  const finished = scoreRounds(
    tournament({ name: "Saturday Americano at Padel Club Islamabad", playerNames: names, courts: 2, target: 32, scoringMode: "total", roundCount: 9 }, 3),
    9,
  )
  finished.finished = true

  const notStarted = tournament({ name: "Thursday night", playerNames: names.slice(0, 5), courts: 1, target: 16, scoringMode: "total", roundCount: 5 }, 6)

  const firstTo = tournament({ name: "First to 21", playerNames: names.slice(0, 8), courts: 2, target: 21, scoringMode: "firstTo", roundCount: 7 }, 5)

  const shared = tournament({ name: "Friends at the other club", playerNames: names.slice(2, 6), courts: 1, target: 16, scoringMode: "total", roundCount: 3 }, 2)
  shared.shared = true
  shared.finished = true

  const play = (match, stopAt) => {
    let m = match
    for (let i = 0; i < stopAt && SM.replay(m, m.points).winner === null; i++) {
      m = SM.addPoint(m, (i * 7) % 11 < 6 ? 0 : 1)
    }
    return m
  }
  const rules = { bestOf: 3, setsAs: "bestOf", gamesPerSet: 6, deuce: "advantage", scoreBy: "points" }
  const teams = [
    [names[0], names[8]],
    [names[6], names[3]],
  ]
  const doneMatch = play(MS.createSetMatch({ ...rules, name: "Club final, best of three", teams }, { now: now - 4 * day, newId }), 9999)
  doneMatch.finished = true
  const liveMatch = play(MS.createSetMatch({ ...rules, name: "Match in play", teams }, { now: now - day, newId }), 75)

  const playing = scoreRounds(
    tournament({ name: "Sunday Americano with everyone", playerNames: names, courts: 2, target: 32, scoringMode: "total", roundCount: 9 }, 0),
    2,
  )

  for (const game of [finished, notStarted, firstTo, shared, doneMatch, liveMatch, playing]) await S.saveTournament(game)
}
