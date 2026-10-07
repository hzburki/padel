import type { SavedEvent } from "./types"

// The rules of broadcasting a game, kept apart from Firebase (live.ts) so
// they can be checked on their own.

// What this phone remembers about the games it has put online, by game id:
// "1" while later saves still send a copy, "closed" once another game took
// over the broadcast (or a broadcast was given up on with its copy
// possibly still on the way), "ended" once the finished game has gone out,
// "deleted" while a deleted game's copy is still to be taken away. What
// each one sends is in sentOnSave.
export type SharedGames = Record<string, string>

// Whether the organiser may put this game online. A finished game has
// nothing left to follow, and a friend's copy is not theirs to send.
export function canBroadcast(event: SavedEvent): boolean {
  return !event.finished && !event.shared
}

// Whether a save of this game is sent to friends, given what this phone
// remembers about it (null: never put online). A closed broadcast sends
// nothing until the game is finished: its link still gets the result.
export function sentOnSave(state: string | null, event: SavedEvent): boolean {
  return state === "1" || (state === "closed" && event.finished)
}

// The broadcasts that close when this game is put online. A phone
// broadcasts one game at a time, so going live closes every other one.
export function broadcastsClosedBy(shared: SharedGames, event: SavedEvent): string[] {
  return Object.keys(shared).filter((other) => other !== event.id && shared[other] === "1")
}

// Whether a friend's copy is live: the organiser is still keeping the
// score up to date. `closed` is the mark on the online copy.
export function followedLive(event: SavedEvent, closed: boolean): boolean {
  return !event.finished && !closed
}

// How long a friend's game is followed after it was created. A game left
// unfinished would otherwise hold a connection open for ever.
const FOLLOW_FOR = 4 * 60 * 60 * 1000

// How many more milliseconds a friend's game is followed: none once it is
// finished or too old. Past that its score is read once when it is opened,
// and no connection is kept.
export function followTimeLeft(event: SavedEvent, now: number): number {
  if (event.finished) return 0
  return Math.max(0, event.createdAt + FOLLOW_FOR - now)
}

// Whether the home screen should open this game to see if it is live. Its
// own games cost nothing to check; a friend's opens a connection.
export function followedFromHome(event: SavedEvent, now: number): boolean {
  if (event.finished) return false
  return !event.shared || followTimeLeft(event, now) > 0
}
