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

// Whether this phone may put the game online and hand out its links: the
// game is its own, or a friend's it was made an organiser of. A finished
// game has nothing left to follow.
export function canBroadcast(event: SavedEvent, hasOrganiserLink: boolean): boolean {
  return !event.finished && (!event.shared || hasOrganiserLink)
}

// Whether a save of this game is sent to friends, given what this phone
// remembers about it (null: never put online). A closed broadcast sends
// nothing until the game is finished: its link still gets the result.
// A game with an organiser link is never sent whole: other organisers
// change the online copy too, and this phone's copy would wipe their scores.
export function sentOnSave(state: string | null, event: SavedEvent, hasOrganiserLink: boolean): boolean {
  return !hasOrganiserLink && (state === "1" || (state === "closed" && event.finished))
}

// Why this phone can't change the game right now, or null when it can.
// "watch": this copy is a friend's, for watching. "offline": the game has
// an organiser link, so the online copy is the real one and every change
// is made there, and there is no connection.
// A finished game is locked for everyone; a friend's says it is for watching.
export function scoreLock(event: SavedEvent, hasOrganiserLink: boolean, online: boolean): "watch" | "offline" | null {
  if (event.shared && (!hasOrganiserLink || event.finished)) return "watch"
  return hasOrganiserLink && !event.finished && !online ? "offline" : null
}

// Whether this phone becomes the owner of a friend's game that its owner
// left to the other organisers: it is one of them, and is not broadcasting
// a game of its own, which taking this one would close.
export function takesOver(shared: SharedGames, hasOrganiserLink: boolean, handedOver: boolean): boolean {
  return handedOver && hasOrganiserLink && !Object.values(shared).includes("1")
}

// What is copied for the organiser to paste to friends: one line saying
// what the link is for, then the link.
export function shareText(link: "watch" | "organise", name: string, url: string): string {
  return link === "organise" ? `Help organise ${name}. Open this link to enter scores:\n${url}` : `Follow ${name} live:\n${url}`
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

// How long a broadcast game goes on after it was created. Past that it is
// finished, for everyone: a game left unfinished would otherwise hold
// connections open for ever. There is no server to end it: each phone works
// it out from the time the game was created, whenever it opens the game.
const PLAYED_FOR = 6 * 60 * 60 * 1000

// How many more milliseconds a broadcast game goes on: none once it is
// finished or 6 hours old.
export function followTimeLeft(event: SavedEvent, now: number): number {
  if (event.finished) return 0
  return Math.max(0, event.createdAt + PLAYED_FOR - now)
}

// Whether the home screen should open this game: to see if it is live, and
// to finish it when it has gone on too long.
export function followedFromHome(event: SavedEvent): boolean {
  return !event.finished
}
