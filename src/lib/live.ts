import { initializeApp } from "firebase/app"
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth"
import { connectFirestoreEmulator, deleteDoc, doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore"
import { broadcastsClosedBy, followedLive, followTimeLeft, sentOnSave, type SharedGames } from "./broadcast"
import { livePath } from "./paths"
import { loadTournament, migrate, saveTournament } from "./storage"
import type { SavedEvent } from "./types"

// Live sharing: the organiser's phone copies a tournament or match to
// Firestore after every save, and anyone with the link watches that copy.
// The copy on the organiser's phone stays the real one.
//
// A build talks to the Firebase project named in `.env`; the dev server
// talks to the local emulators (`npm run emulators`). The emulators' host is
// the page's own, so a phone on the same Wi-Fi reaches them on this machine.
const project = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const emulators = { projectId: "demo-padel", apiKey: "demo" }

// False in a build made without the `.env` values: there is nowhere to send
// a game, so the screens hide the share button and links open nothing.
export const canShareLive = import.meta.env.DEV || Boolean(project.apiKey && project.projectId)

// Without the values Firebase still needs something to start with; nothing
// is ever sent to it.
const app = initializeApp(import.meta.env.DEV || !canShareLive ? emulators : project)
const auth = getAuth(app)
const db = getFirestore(app)
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, location.hostname, 8080)
}

// Which events this phone has shared, kept in localStorage. What the
// values mean is in broadcast.ts (SharedGames).
const sharedKey = (id: string) => `live:${id}`

function sharedGames(): SharedGames {
  const shared: SharedGames = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith("live:")) shared[key.slice(5)] = localStorage.getItem(key) ?? ""
  }
  return shared
}

// The event travels as one JSON string: Firestore can't hold a list inside
// a list, which a match's teams are. The rules let only `owner` write.
// `closed` tells friends the score is no longer being kept up to date.
async function send(event: SavedEvent, closed = false): Promise<void> {
  await auth.authStateReady()
  // An anonymous account: nothing to sign up for, and it marks this browser
  // as the one that may update the score.
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user
  await setDoc(doc(db, "live", event.id), { owner: user.uid, json: JSON.stringify(event), ...(closed && { closed }) })
}

// Whether putting this game online would close the broadcast of another:
// the screens ask the organiser first.
export function closesAnother(event: SavedEvent): boolean {
  return broadcastsClosedBy(sharedGames(), event).length > 0
}

// Stop broadcasting a game without taking its copy away: the link still
// opens the last score sent, and broadcasting the game again reuses it.
// Never throws: with no connection the copy just isn't marked.
function closeLive(id: string): void {
  localStorage.setItem(sharedKey(id), "closed")
  loadTournament(id)
    .then((event) => event && send(event, true))
    .catch(() => {})
}

// How long putting a game online may take before the organiser is told it
// did not work.
const SHARE_LIMIT = 5000

// Start sharing an event. Returns the link to send to friends, the same
// one every time for the same event. Nothing is stored online before this
// is called. Going live closes the broadcast of any other game, but only
// once this one is online: a failed attempt leaves the old broadcast on.
//
// With no connection it fails at once. On a connection that is up but
// dead it gives up after SHARE_LIMIT, so the screen is never left waiting.
export async function shareLive(event: SavedEvent): Promise<string> {
  if (navigator.onLine === false) throw new Error("No connection")
  let timer: ReturnType<typeof setTimeout> | undefined
  const tooSlow = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Firestore keeps the send and makes it when the connection is back.
      // Remember there may be a copy, not being broadcast, so that
      // deleting the game takes it away.
      if (!hasLink(event.id)) localStorage.setItem(sharedKey(event.id), "closed")
      reject(new Error("No connection"))
    }, SHARE_LIMIT)
  })
  try {
    await Promise.race([send(event), tooSlow])
  } finally {
    clearTimeout(timer)
  }
  broadcastsClosedBy(sharedGames(), event).forEach(closeLive)
  localStorage.setItem(sharedKey(event.id), "1")
  return location.origin + livePath(event.kind, event.id)
}

// Whether this phone has put the event online.
export function hasLink(id: string): boolean {
  return localStorage.getItem(sharedKey(id)) !== null
}

// Whether saves on this phone are still being sent to friends.
export function isSending(id: string): boolean {
  return localStorage.getItem(sharedKey(id)) === "1"
}

// Call after every save. Does nothing unless the save is one to send
// (sentOnSave). Never throws: a failed send is made up for by the next one,
// which carries the whole event again. The finished game is the last thing
// sent: friends stop following when they get it.
export function pushLive(event: SavedEvent): void {
  if (!sentOnSave(localStorage.getItem(sharedKey(event.id)), event)) return
  send(event)
    .then(() => {
      if (event.finished) localStorage.setItem(sharedKey(event.id), "ended")
    })
    .catch(() => {})
}

// Call when the organiser deletes an event: takes the online copy away too,
// so the link stops working. Friends keep what they already saved, as a
// finished game. The phone remembers the delete until it has gone through:
// with no connection it is tried again when the app starts (finishDeletes).
export async function deleteLive(id: string): Promise<void> {
  if (!hasLink(id)) return
  localStorage.setItem(sharedKey(id), "deleted")
  await auth.authStateReady()
  try {
    await deleteDoc(doc(db, "live", id))
  } catch (error) {
    // Refused: the copy is already gone, or is not this phone's to delete.
    // Trying again would change nothing.
    if ((error as { code?: string }).code !== "permission-denied") throw error
  }
  localStorage.removeItem(sharedKey(id))
}

// Call when the app starts: takes away the online copies of games that
// were deleted while there was no connection. Never throws.
export function finishDeletes(): void {
  for (const [id, state] of Object.entries(sharedGames())) {
    if (state === "deleted") deleteLive(id).catch(() => {})
  }
}

// Open an event for its screen. `show` gets the event (null when there is
// none) and whether it is live: being sent from this phone, or followed on
// a friend's. Returns the function to call when the screen closes.
//
// A friend's copy is saved on this phone on every change, marked `shared`,
// so it is still there with no connection or after the organiser deletes
// theirs, which finishes it here. Once it is finished nothing more can
// change, so following stops.
// A closed broadcast is still followed, in case it is picked up again.
// Following also stops when the game gets too old (followTimeLeft): opened
// after that, its newest score is read once and it is not live.
export function openGame(
  id: string,
  fromLink: boolean, // opened from a shared link, so it may not be saved here yet
  show: (event: SavedEvent | null, live: boolean) => void,
): () => void {
  let stop = () => {}
  let closed = false
  loadTournament(id).then((saved) => {
    if (closed) return
    // The organiser's own game, even when opened from their own link.
    if (saved && !saved.shared) {
      // A result that never went out, finished with no connection, goes now.
      if (saved.finished) pushLive(saved)
      return show(saved, !saved.finished && isSending(id))
    }
    if (saved?.finished || (!saved && !fromLink) || !canShareLive) return show(saved, false)

    let latest = saved
    if (saved) show(saved, false)
    let unsubscribe = () => {}
    let tooOld: ReturnType<typeof setTimeout> | undefined
    // Nothing more will come, or the screen closed: stop for good.
    const end = () => {
      document.removeEventListener("visibilitychange", onVisibility)
      clearTimeout(tooOld)
      unsubscribe()
    }
    const follow = () =>
      onSnapshot(
        doc(db, "live", id),
        // Also told when an answer from memory is confirmed by the server:
        // that is how a delete is heard of once the connection is back.
        { includeMetadataChanges: true },
        (snapshot) => {
          // With no connection Firestore answers from its own empty memory:
          // that is not a delete, so keep waiting for the real answer.
          if (!snapshot.exists() && snapshot.metadata.fromCache) return show(latest, false)
          if (!snapshot.exists()) {
            // Deleted by the organiser, or never there. Nothing more will
            // come, so a copy saved here is kept as a finished game.
            end()
            if (latest) {
              latest = { ...latest, finished: true }
              void saveTournament(latest)
            }
            return show(latest, false)
          }
          try {
            latest = { ...migrate(JSON.parse(snapshot.get("json"))), shared: true }
          } catch {
            // A copy this build can't read, such as one from a newer build.
            end()
            return show(latest, false)
          }
          void saveTournament(latest)
          const left = followTimeLeft(latest, Date.now())
          show(latest, left > 0 && followedLive(latest, snapshot.get("closed") === true))
          if (left === 0) return end()
          clearTimeout(tooOld)
          tooOld = setTimeout(() => {
            end()
            show(latest, false)
          }, left)
        },
        () => show(latest, false),
      )
    // No connection is kept open for a page nobody is looking at: following
    // stops while it is hidden and starts again when it comes back.
    function onVisibility() {
      unsubscribe()
      unsubscribe = document.hidden ? () => {} : follow()
    }
    document.addEventListener("visibilitychange", onVisibility)
    stop = end
    onVisibility()
  })
  return () => {
    closed = true
    stop()
  }
}
