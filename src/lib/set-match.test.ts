import { describe, expect, it } from "vitest"
import { addPoint, formatSets, pointLabels, replay, undoPoint, type MatchRules } from "./set-match"
import type { SetMatch, Side } from "./types"

const advantage: MatchRules = { bestOf: 3, gamesPerSet: 6, deuce: "advantage" }
const golden: MatchRules = { ...advantage, deuce: "golden" }

// "0010" is three points to the first team and one to the second, in order.
function pts(sequence: string): Side[] {
  return [...sequence].map((c) => (c === "0" ? 0 : 1))
}

// Whole games won to love: "001" is two games to the first team, then one
// to the second.
function games(sequence: string): Side[] {
  return [...sequence].flatMap((c) => pts(c.repeat(4)))
}

// 5–5, then one game each.
const SIX_ALL = games("000001111101")
const SET_TO_FIRST = games("000000")
const SET_TO_SECOND = games("111111")

function match(points: Side[], rules: MatchRules = advantage): SetMatch {
  return {
    version: 2,
    kind: "match",
    id: "m1",
    name: "Sunday match",
    createdAt: 1000,
    teams: [
      ["Ali", "Sara"],
      ["Omar", "Zed"],
    ],
    ...rules,
    points,
    finished: false,
  }
}

describe("a game", () => {
  it("starts at 0–0 in the first set with no winner", () => {
    const state = replay(advantage, [])
    expect(state.sets).toHaveLength(1)
    expect(state.sets[0].games).toEqual([0, 0])
    expect(pointLabels(state)).toEqual(["0", "0"])
    expect(state.winner).toBeNull()
  })

  it("calls the points 15, 30 and 40", () => {
    expect(pointLabels(replay(advantage, pts("0")))).toEqual(["15", "0"])
    expect(pointLabels(replay(advantage, pts("001")))).toEqual(["30", "15"])
    expect(pointLabels(replay(advantage, pts("00011")))).toEqual(["40", "30"])
  })

  it("wins a game with four points in a row", () => {
    const state = replay(advantage, pts("0000"))
    expect(state.sets[0].games).toEqual([1, 0])
    expect(pointLabels(state)).toEqual(["0", "0"])
  })

  it("needs two clear points after 40–40 when the rule is advantage", () => {
    expect(replay(advantage, pts("0001110")).sets[0].games).toEqual([0, 0])
    expect(replay(advantage, pts("00011100")).sets[0].games).toEqual([1, 0])
  })

  it("shows Ad for the team one point ahead after deuce", () => {
    expect(pointLabels(replay(advantage, pts("0001110")))).toEqual(["Ad", "40"])
    expect(pointLabels(replay(advantage, pts("0001111")))).toEqual(["40", "Ad"])
  })

  it("goes back to 40–40 when the team with advantage loses the point", () => {
    expect(pointLabels(replay(advantage, pts("00011101")))).toEqual(["40", "40"])
  })

  it("wins the game on the next point at 40–40 when the rule is golden point", () => {
    expect(replay(golden, pts("0001111")).sets[0].games).toEqual([0, 1])
  })

  it("marks a game that reached 40–40 as a deuce game", () => {
    expect(replay(advantage, pts("00011100")).sets[0].played[0].deuce).toBe(true)
    expect(replay(advantage, pts("00010")).sets[0].played[0].deuce).toBe(false)
  })

  it("marks a game won at 40–40 under golden point as a golden point", () => {
    expect(replay(golden, pts("0001110")).sets[0].played[0].golden).toBe(true)
    expect(replay(golden, pts("00010")).sets[0].played[0].golden).toBe(false)
    expect(replay(advantage, pts("00011100")).sets[0].played[0].golden).toBe(false)
  })
})

describe("a set", () => {
  it("wins a set 6–4 when games per set is 6", () => {
    const state = replay(advantage, games("1111000000"))
    expect(state.sets[0].games).toEqual([6, 4])
    expect(state.sets[0].winner).toBe(0)
  })

  it("plays on at 6–5 because the lead is only one game", () => {
    const state = replay(advantage, games("00000111110"))
    expect(state.sets[0].games).toEqual([6, 5])
    expect(state.sets[0].winner).toBeNull()
  })

  it("wins a set 7–5", () => {
    const state = replay(advantage, games("000001111100"))
    expect(state.sets[0].games).toEqual([7, 5])
    expect(state.sets[0].winner).toBe(0)
  })

  it("starts the next set at 0–0 after a set is won", () => {
    const state = replay(advantage, SET_TO_FIRST)
    expect(state.sets).toHaveLength(2)
    expect(state.sets[1].games).toEqual([0, 0])
    expect(state.setsWon).toEqual([1, 0])
  })
})

describe("a tie-break", () => {
  it("starts a tie-break at 6–6", () => {
    const state = replay(advantage, SIX_ALL)
    expect(state.sets[0].winner).toBeNull()
    expect(state.current.tiebreak).toBe(true)
  })

  it("starts a tie-break at 4–4 when games per set is 4", () => {
    const state = replay({ ...advantage, gamesPerSet: 4 }, games("00011101"))
    expect(state.sets[0].games).toEqual([4, 4])
    expect(state.current.tiebreak).toBe(true)
  })

  it("counts tie-break points 1, 2, 3 instead of 15, 30, 40", () => {
    expect(pointLabels(replay(advantage, [...SIX_ALL, ...pts("00010")]))).toEqual(["4", "1"])
  })

  it("wins a tie-break at 7 points when two clear", () => {
    const state = replay(advantage, [...SIX_ALL, ...pts("0000000")])
    expect(state.sets[0].winner).toBe(0)
  })

  it("plays a tie-break on past 7 until one team is two clear", () => {
    const sixAllInPoints = pts("000000111111")
    expect(replay(advantage, [...SIX_ALL, ...sixAllInPoints, ...pts("0")]).sets[0].winner).toBeNull()
    expect(replay(advantage, [...SIX_ALL, ...sixAllInPoints, ...pts("00")]).sets[0].winner).toBe(0)
  })

  it("ignores the golden point rule inside a tie-break", () => {
    const state = replay(golden, [...SIX_ALL, ...pts("0001110")])
    expect(state.sets[0].winner).toBeNull()
    expect(pointLabels(state)).toEqual(["4", "3"])
  })

  it("records a set won on a tie-break as 7–6 and keeps the tie-break points", () => {
    const set = replay(advantage, [...SIX_ALL, ...pts("11110000000")]).sets[0]
    expect(set.games).toEqual([7, 6])
    expect(set.played.at(-1)).toMatchObject({ tiebreak: true, points: [7, 4] })
  })

  it("plays a tie-break in the final set too", () => {
    const state = replay(advantage, [...SET_TO_FIRST, ...SET_TO_SECOND, ...SIX_ALL])
    expect(state.sets).toHaveLength(3)
    expect(state.current.tiebreak).toBe(true)
  })
})

describe("the match", () => {
  it("wins a one-set match with the first set", () => {
    expect(replay({ ...advantage, bestOf: 1 }, SET_TO_SECOND).winner).toBe(1)
  })

  it("wins a best of 3 at two sets and does not start a third", () => {
    const state = replay(advantage, [...SET_TO_FIRST, ...SET_TO_FIRST])
    expect(state.winner).toBe(0)
    expect(state.sets).toHaveLength(2)
  })

  it("plays a third set in a best of 3 when the first two are shared", () => {
    const state = replay(advantage, [...SET_TO_FIRST, ...SET_TO_SECOND])
    expect(state.winner).toBeNull()
    expect(state.sets).toHaveLength(3)
  })

  it("needs three sets to win a best of 5", () => {
    const bestOf5: MatchRules = { ...advantage, bestOf: 5 }
    expect(replay(bestOf5, [...SET_TO_FIRST, ...SET_TO_FIRST]).winner).toBeNull()
    expect(replay(bestOf5, [...SET_TO_FIRST, ...SET_TO_FIRST, ...SET_TO_FIRST]).winner).toBe(0)
  })

  it("ignores points logged after the match is decided", () => {
    const decided = [...SET_TO_FIRST, ...SET_TO_FIRST]
    expect(replay(advantage, [...decided, ...pts("1111")])).toEqual(replay(advantage, decided))
  })

  it("writes the set scores as 6–4 3–6 7–6", () => {
    const points = [...games("1111000000"), ...games("000111111"), ...SIX_ALL, ...pts("0000000")]
    expect(formatSets(replay(advantage, points))).toBe("6–4 3–6 7–6")
  })

  it("leaves a set with no game played out of the set scores", () => {
    expect(formatSets(replay(advantage, SET_TO_FIRST))).toBe("6–0")
  })
})

describe("adding and undoing points", () => {
  it("adds a point to the end of the log", () => {
    expect(addPoint(match(pts("01")), 1).points).toEqual(pts("011"))
  })

  it("does not add a point once the match is decided", () => {
    const decided = match([...SET_TO_FIRST, ...SET_TO_FIRST])
    expect(addPoint(decided, 1)).toBe(decided)
  })

  it("does not add or undo a point once the match is finished", () => {
    const finished = { ...match(pts("01")), finished: true }
    expect(addPoint(finished, 0)).toBe(finished)
    expect(undoPoint(finished)).toBe(finished)
  })

  it("undoes the last point, back across a game and a set boundary", () => {
    const afterSet = match(SET_TO_FIRST)
    const state = replay(advantage, undoPoint(afterSet).points)
    expect(state.sets).toHaveLength(1)
    expect(state.sets[0].games).toEqual([5, 0])
    expect(pointLabels(state)).toEqual(["40", "0"])
  })

  it("undoes the point that decided the match, so play can go on", () => {
    const decided = match([...SET_TO_FIRST, ...SET_TO_FIRST])
    expect(replay(advantage, undoPoint(decided).points).winner).toBeNull()
  })

  it("leaves an empty match unchanged on undo", () => {
    const empty = match([])
    expect(undoPoint(empty)).toBe(empty)
  })
})
