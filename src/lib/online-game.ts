import * as z from "zod"
import { migrate } from "./storage"
import type { SavedEvent } from "./types"

// The shape of a game's online copy (the `game` map of its Firestore
// document), kept apart from Firebase (live.ts) so it can be checked on its
// own. The copy on the phone keeps its own shape (types.ts).
//
// Scores, player names and points are maps, not lists: Firestore can only
// replace a list whole, so two organisers scoring different courts would
// wipe each other's score. In a map each writes its own entry.

const pair = z.tuple([z.string(), z.string()])
const count = z.number().int().nonnegative()
const common = { name: z.string(), createdAt: z.number(), finished: z.boolean() }

const americano = z.object({
  kind: z.literal("americano"),
  ...common,
  scoringMode: z.enum(["total", "firstTo"]),
  target: count,
  courts: count,
  // By player id. `order` is the player's place in the list. `left` and
  // `joinedAt` only for players who left or joined mid game.
  players: z.record(
    z.string(),
    z.object({
      name: z.string(),
      order: count,
      left: z.object({ scaleUp: z.boolean() }).optional(),
      joinedAt: count.optional(),
    }),
  ),
  rounds: z.array(
    z.object({
      matches: z.array(z.object({ court: count, teamA: pair, teamB: pair })),
      benched: z.array(z.string()),
    }),
  ),
  // One entry per scored match, named by scoreName. None for a match not scored.
  scores: z.record(z.string(), z.object({ a: count, b: count })),
})

const match = z.object({
  kind: z.literal("match"),
  ...common,
  // Firestore can't hold a list inside a list, so the two teams are a map.
  teams: z.object({ 0: pair, 1: pair }),
  bestOf: z.literal([1, 3, 5]),
  setsAs: z.enum(["bestOf", "firstTo"]),
  gamesPerSet: count,
  deuce: z.enum(["advantage", "golden"]),
  scoreBy: z.enum(["points", "games"]),
  // One entry per point (or game), named by its number: "0", "1", "2".
  points: z.record(z.string().regex(/^\d+$/), z.literal([0, 1])),
})

const onlineGame = z.discriminatedUnion("kind", [americano, match])

export type OnlineGame = z.infer<typeof onlineGame>

// What a match's score is filed under: its round, counted from 0, and its court.
const scoreName = (round: number, court: number) => `${round}_${court}`

// The phone's game as its online copy. The id is the document's name, and
// whether it is a friend's copy is the phone's own business.
export function toOnline(event: SavedEvent): OnlineGame {
  const { name, createdAt, finished } = event
  if (event.kind === "match") {
    const { teams, bestOf, setsAs, gamesPerSet, deuce, scoreBy, points } = event
    return {
      kind: "match",
      name,
      createdAt,
      finished,
      teams: { 0: teams[0], 1: teams[1] },
      bestOf,
      setsAs,
      gamesPerSet,
      deuce,
      scoreBy,
      points: Object.fromEntries(points.map((side, number) => [number, side])),
    }
  }
  const { scoringMode, target, courts, players, rounds } = event
  return {
    kind: "americano",
    name,
    createdAt,
    finished,
    scoringMode,
    target,
    courts,
    // Firestore refuses a field set to undefined, so these are left out.
    players: Object.fromEntries(
      players.map(({ id, name, left, joinedAt }, order) => [
        id,
        { name, order, ...(left && { left }), ...(joinedAt !== undefined && { joinedAt }) },
      ]),
    ),
    rounds: rounds.map((round) => ({
      matches: round.matches.map(({ court, teamA, teamB }) => ({ court, teamA, teamB })),
      benched: round.benched,
    })),
    scores: Object.fromEntries(
      rounds.flatMap((round, r) => round.matches.flatMap((m) => (m.score ? [[scoreName(r, m.court), m.score]] : []))),
    ),
  }
}

// LEGACY, remove after 2026-10-28: until 2026-10-14 the whole game was one
// JSON string, `json`. Whether a document is still such a copy.
export const isOldCopy = (document: { json?: unknown }) => typeof document.json === "string"

// A game's online document as a game for this phone. `id` is the document's
// name. Throws when the copy is not the shape above: nothing malformed is
// shown or saved.
export function fromOnline(id: string, document: { game?: unknown; json?: unknown }): SavedEvent {
  // LEGACY, remove after 2026-10-28: an old copy is read from its string.
  if (isOldCopy(document)) return migrate(JSON.parse(document.json as string))
  const game = onlineGame.parse(document.game)
  if (game.kind === "match") {
    const { teams, points, ...rest } = game
    // Firestore hands a map back in any order. A number missing in the
    // middle leaves no gap: the points after it move up.
    const numbers = Object.keys(points).sort((a, b) => Number(a) - Number(b))
    return { version: 3, id, ...rest, teams: [teams[0], teams[1]], points: numbers.map((number) => points[number]) }
  }
  const { players, rounds, scores, ...rest } = game
  return {
    version: 3,
    id,
    ...rest,
    players: Object.entries(players)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([playerId, { name, left, joinedAt }]) => ({
        id: playerId,
        name,
        ...(left && { left }),
        ...(joinedAt !== undefined && { joinedAt }),
      })),
    rounds: rounds.map((round, r) => ({
      matches: round.matches.map((m) => ({ ...m, score: scores[scoreName(r, m.court)] ?? null })),
      benched: round.benched,
    })),
  }
}

// What changedFields gives for a field that is no longer there.
export const REMOVED = Symbol("removed")

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

// Both copies come from toOnline, which writes its fields in one order.
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const differing = (was: Record<string, unknown>, is: Record<string, unknown>) =>
  [...new Set([...Object.keys(was), ...Object.keys(is)])].filter((key) => !same(was[key], is[key]))

// The fields that differ between two online copies of a game, by their
// Firestore path ("game.finished", "game.scores.2_1", "game.points.14"),
// each with its new value, or REMOVED. Sending only these is what lets two
// organisers change a game at once.
// A map (scores, players, points, teams) is compared entry by entry, and an
// entry is sent whole: one score, one player. Anything else is sent whole.
export function changedFields(before: OnlineGame, after: OnlineGame): Record<string, unknown> {
  const changed: Record<string, unknown> = {}
  const put = (path: string, value: unknown) => {
    changed[path] = value === undefined ? REMOVED : value
  }
  const was: Record<string, unknown> = before
  const is: Record<string, unknown> = after
  for (const field of differing(was, is)) {
    const from = was[field]
    const to = is[field]
    if (isMap(from) && isMap(to)) for (const key of differing(from, to)) put(`game.${field}.${key}`, to[key])
    else put(`game.${field}`, to)
  }
  return changed
}
