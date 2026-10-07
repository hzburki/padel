import type { SavedEvent } from "./types"

// The rules of broadcasting a game, kept apart from Firebase (live.ts) so
// they can be checked on their own.

// What this phone remembers about the games it has put online, by game id:
// "1" while later saves still send a copy, "closed" once another game took
// over the broadcast, "ended" once the finished game has gone out. Only
// "1" sends anything.
export type SharedGames = Record<string, string>

// The broadcasts that close when this game is put online. A phone
// broadcasts one game at a time, so going live closes every other one. A
// finished game is not live: putting its result online closes nothing.
export function broadcastsClosedBy(shared: SharedGames, event: SavedEvent): string[] {
  if (event.finished) return []
  return Object.keys(shared).filter((other) => other !== event.id && shared[other] === "1")
}

// Whether a friend's copy is live: the organiser is still keeping the
// score up to date. `closed` is the mark on the online copy.
export function followedLive(event: SavedEvent, closed: boolean): boolean {
  return !event.finished && !closed
}

// How long the home screen keeps following a friend's game after it was
// created. A game left unfinished would otherwise be followed for ever.
// Opening the game itself still follows it, however old.
const FOLLOW_FROM_HOME_FOR = 4 * 60 * 60 * 1000

// Whether the home screen should open this game to see if it is live. Its
// own games cost nothing to check; a friend's opens a connection.
export function followedFromHome(event: SavedEvent, now: number): boolean {
  if (event.finished) return false
  return !event.shared || now - event.createdAt < FOLLOW_FROM_HOME_FOR
}
