import { initializeApp } from "firebase/app"
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth"
import { connectFirestoreEmulator, deleteDoc, doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore"
import { livePath } from "./paths"
import { loadTournament, migrate, saveTournament } from "./storage"
import type { SavedEvent } from "./types"

// Live sharing: the organiser's phone copies a tournament or match to
// Firestore after every save, and anyone with the link watches that copy.
// The copy on the organiser's phone stays the real one.
//
// Local emulators only for now (`npm run emulators`) — there is no Firebase
// project yet. The host is the page's own, so a phone on the same Wi-Fi
// reaches the emulators on this machine.
const app = initializeApp({ projectId: "demo-padel", apiKey: "demo" })
const auth = getAuth(app)
const db = getFirestore(app)
connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true })
connectFirestoreEmulator(db, location.hostname, 8080)

// Which events this phone has shared: "1" while later saves still send a
// copy, "ended" once the finished game has gone out and nothing more will.
const sharedKey = (id: string) => `live:${id}`

// The event travels as one JSON string: Firestore can't hold a list inside
// a list, which a match's teams are. The rules let only `owner` write.
async function send(event: SavedEvent): Promise<void> {
  await auth.authStateReady()
  // An anonymous account: nothing to sign up for, and it marks this browser
  // as the one that may update the score.
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user
  await setDoc(doc(db, "live", event.id), { owner: user.uid, json: JSON.stringify(event) })
}

// Start sharing an event. Returns the link to send to friends. Nothing is
// stored online before this is called.
export async function shareLive(event: SavedEvent): Promise<string> {
  await send(event)
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
    if (saved?.finished || (!saved && !fromLink)) return show(saved, false)

    let latest = saved
    if (saved) show(saved, false)
    stop = onSnapshot(
      doc(db, "live", id),
      (snapshot) => {
        try {
          latest = { ...migrate(JSON.parse(snapshot.get("json"))), shared: true }
        } catch {
          // Deleted by the organiser, or never there.
          stop()
          return show(latest, false)
        }
        void saveTournament(latest)
        show(latest, !latest.finished)
        if (latest.finished) stop()
      },
      () => show(latest, false),
    )
  })
  return () => {
    closed = true
    stop()
  }
}
