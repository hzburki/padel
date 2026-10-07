import { initializeApp } from "firebase/app"
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth"
import { connectFirestoreEmulator, deleteDoc, doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore"
import { broadcastsClosedBy, followedLive, type SharedGames } from "./broadcast"
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

// Start sharing an event. Returns the link to send to friends, the same
// one every time for the same event. Nothing is stored online before this
// is called. Going live closes the broadcast of any other game, but only
// once this one is online: a failed attempt leaves the old broadcast on.
export async function shareLive(event: SavedEvent): Promise<string> {
  await send(event)
  broadcastsClosedBy(sharedGames(), event).forEach(closeLive)
  localStorage.setItem(sharedKey(event.id), event.finished ? "ended" : "1")
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

// Call after every save. Does nothing unless the event is being sent.
// Never throws: a failed send is made up for by the next one, which carries
// the whole event again. The finished game is the last thing sent: friends
// stop following when they get it.
export function pushLive(event: SavedEvent): void {
  if (!isSending(event.id)) return
  send(event)
    .then(() => {
      if (event.finished) localStorage.setItem(sharedKey(event.id), "ended")
    })
    .catch(() => {})
}

// Call when the organiser deletes an event: takes the online copy away too,
// so the link stops working. Friends keep what they already saved.
export async function deleteLive(id: string): Promise<void> {
  if (!hasLink(id)) return
  localStorage.removeItem(sharedKey(id))
  await auth.authStateReady()
  await deleteDoc(doc(db, "live", id))
}

// Open an event for its screen. `show` gets the event (null when there is
// none) and whether it is live: being sent from this phone, or followed on
// a friend's. Returns the function to call when the screen closes.
//
// A friend's copy is saved on this phone on every change, marked `shared`,
// so it is still there with no connection or after the organiser deletes
// theirs. Once it is finished nothing more can change, so following stops.
// A closed broadcast is still followed, in case it is picked up again.
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
    if (saved && !saved.shared) return show(saved, !saved.finished && isSending(id))
    if (saved?.finished || (!saved && !fromLink) || !canShareLive) return show(saved, false)

    let latest = saved
    if (saved) show(saved, false)
    let unsubscribe = () => {}
    // Nothing more will come, or the screen closed: stop for good.
    const end = () => {
      document.removeEventListener("visibilitychange", onVisibility)
      unsubscribe()
    }
    const follow = () =>
      onSnapshot(
        doc(db, "live", id),
        (snapshot) => {
          try {
            latest = { ...migrate(JSON.parse(snapshot.get("json"))), shared: true }
          } catch {
            // Deleted by the organiser, or never there.
            end()
            return show(latest, false)
          }
          void saveTournament(latest)
          show(latest, followedLive(latest, snapshot.get("closed") === true))
          if (latest.finished) end()
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
