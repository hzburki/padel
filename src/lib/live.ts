import { initializeApp } from "firebase/app"
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth"
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  query,
  type DocumentSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import {
  broadcastsClosedBy,
  canBroadcast,
  followedLive,
  followTimeLeft,
  scoreLock,
  sentOnSave,
  takesOver,
  type SharedGames,
} from "./broadcast"
import { randomId } from "./ids"
import { livePath, scorePath } from "./paths"
import { loadTournament, migrate, onChangedElsewhere, saveTournament } from "./storage"
import type { SavedEvent } from "./types"

// Live sharing: the organiser's phone copies a tournament or match to
// Firestore after every save, and anyone with the link watches that copy.
// The copy on the organiser's phone stays the real one.
//
// Unless the organiser adds another organiser. Then friends with the
// organiser link change the online copy too, so from then on the online
// copy is the real one: every organiser's phone changes it there
// (changeLive) and follows it, and none sends its own copy over the top.
// The code calls that link's key the score key, and those friends scorers.
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

// The key that ends a game's organiser link, on the phones that have it:
// the organiser's once they add another, a friend's once they open that link.
const scoreKeyAt = (id: string) => `score:${id}`
const SCORE_KEY_LENGTH = 8

export function scoreKey(id: string): string | null {
  return localStorage.getItem(scoreKeyAt(id))
}

const liveDoc = (id: string) => doc(db, "live", id)
// The friends who may score a game, one document each (firestore.rules).
const scorersOf = (id: string) => collection(db, "live", id, "scorers")

// An anonymous account: nothing to sign up for, and it marks this browser
// as the one that may update the score.
async function signedIn() {
  await auth.authStateReady()
  return auth.currentUser ?? (await signInAnonymously(auth)).user
}

// The event travels as one JSON string: Firestore can't hold a list inside
// a list, which a match's teams are. The rules let only `owner` and the
// game's scorers write.
// `closed` tells friends the score is no longer being kept up to date.
async function send(event: SavedEvent, closed = false): Promise<void> {
  const user = await signedIn()
  await setDoc(liveDoc(event.id), { owner: user.uid, json: JSON.stringify(event), ...(closed && { closed }) })
}

// Whether a change to this game has to be made online (changeLive): it
// has an organiser link, so the online copy is the real one, for every
// organiser and for as long as the game is there.
export function changesOnline(event: SavedEvent): boolean {
  return scoreKey(event.id) !== null
}

// Why this phone can't change the game right now, if it can't (scoreLock).
export function scoreLockOn(event: SavedEvent, online: boolean) {
  return scoreLock(event, scoreKey(event.id) !== null, online)
}

// Whether this phone may hand out the game's links (canBroadcast).
export function canShare(event: SavedEvent): boolean {
  return canBroadcast(event, scoreKey(event.id) !== null)
}

// Whether putting this game online would close the broadcast of another:
// the screens ask the organiser first. A friend's game is online already.
export function closesAnother(event: SavedEvent): boolean {
  return !event.shared && broadcastsClosedBy(sharedGames(), event).length > 0
}

// Stop broadcasting a game without taking its copy away: the link still
// opens the last score sent, and broadcasting the game again reuses it.
// A game with an organiser link is only marked: its online copy is the
// real one, and this phone's is never sent over it.
// Never throws: with no connection the copy just isn't marked.
function closeLive(id: string): void {
  localStorage.setItem(sharedKey(id), "closed")
  if (scoreKey(id) !== null) return void updateDoc(liveDoc(id), { closed: true }).catch(() => {})
  loadTournament(id)
    .then((event) => event && send(event, true))
    .catch(() => {})
}

// The games open on this page, each with what opens it again (openGame).
// Whose game it is can change under a screen that is showing it.
const openGames = new Map<string, Set<() => void>>()
const reopen = (id: string) => openGames.get(id)?.forEach((open) => open())

// Whether any friend has opened this game's organiser link. Only its owner
// may ask. Asked of the server: with no connection Firestore's own memory
// would say nobody has.
async function hasScorers(id: string): Promise<boolean> {
  return !(await getDocsFromServer(query(scorersOf(id), limit(1)))).empty
}

// Whether putting this game online leaves another to its other organisers
// rather than closing it: the screens say which before the organiser agrees.
export async function passesOn(event: SavedEvent): Promise<boolean> {
  const scored = broadcastsClosedBy(sharedGames(), event).filter((id) => scoreKey(id) !== null)
  return (await Promise.all(scored.map(hasScorers))).includes(true)
}

// Leave a game to its other organisers: the first of their phones to see
// the mark becomes its owner (takeOver), the one that can delete it for
// everyone. On this phone it turns into a friend's game, still organised
// from here.
async function handOver(id: string): Promise<void> {
  const user = await signedIn()
  await setDoc(doc(scorersOf(id), user.uid), { key: scoreKey(id) })
  await updateDoc(liveDoc(id), { handover: true })
  localStorage.removeItem(sharedKey(id))
  const event = await loadTournament(id)
  if (event) await saveTournament({ ...event, shared: true })
  reopen(id)
}

// What happens to a game when another takes over the broadcast. One that
// friends are scoring goes on without this phone, with one of them as its
// organiser; any other is closed. Never throws.
function passOrClose(id: string): void {
  if (scoreKey(id) === null) return closeLive(id)
  hasScorers(id)
    .then((joined) => (joined ? handOver(id) : closeLive(id)))
    .catch(() => closeLive(id))
}

// Become the owner of a friend's game that was left to its other
// organisers. Fails when another of them got there first.
async function takeOver(id: string): Promise<void> {
  const user = await signedIn()
  await runTransaction(db, async (transaction) => {
    const online = await transaction.get(liveDoc(id))
    if (online.get("handover") !== true) throw new Error("Already taken")
    transaction.set(liveDoc(id), { owner: user.uid, json: online.get("json") })
  })
  const mine = await loadTournament(id)
  if (!mine) return
  localStorage.setItem(sharedKey(id), "1")
  await saveTournament(asOwn(mine))
  reopen(id)
}

// A friend's copy as this phone's own game.
function asOwn(event: SavedEvent): SavedEvent {
  const own = { ...event }
  delete own.shared
  return own
}

// How long putting a game online, or a change to one, may take before the
// phone is told it did not work.
const SHARE_LIMIT = 5000
const TOO_SLOW = new Error("No connection")

function inTime<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const tooSlow = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(TOO_SLOW), SHARE_LIMIT)
  })
  return Promise.race([work, tooSlow]).finally(() => clearTimeout(timer))
}

// Start sharing an event. Returns the link to send to friends, the same
// one every time for the same event. Nothing is stored online before this
// is called. Going live takes the broadcast from any other game
// (passOrClose), but only once this one is online: a failed attempt leaves
// the old broadcast on.
//
// With no connection it fails at once. On a connection that is up but
// dead it gives up after SHARE_LIMIT, so the screen is never left waiting.
export async function shareLive(event: SavedEvent): Promise<string> {
  const link = location.origin + livePath(event.kind, event.id)
  // A friend's game this phone is an organiser of is online already.
  if (event.shared) return link
  if (navigator.onLine === false) throw new Error("No connection")
  if (changesOnline(event)) {
    // A game with an organiser link is online already, and that copy is
    // the real one: it is not sent again, only marked as live again.
    if (!isSending(event.id)) await inTime(updateDoc(liveDoc(event.id), { closed: deleteField() }))
  } else {
    try {
      await inTime(send(event))
    } catch (error) {
      // Firestore keeps the send and makes it when the connection is back.
      // Remember there may be a copy, not being broadcast, so that
      // deleting the game takes it away.
      if (error === TOO_SLOW && !hasLink(event.id)) localStorage.setItem(sharedKey(event.id), "closed")
      throw error
    }
  }
  broadcastsClosedBy(sharedGames(), event).forEach(passOrClose)
  localStorage.setItem(sharedKey(event.id), "1")
  return link
}

// Start letting friends organise an event too, putting it online first if
// it is not. Returns the link to send to a friend who should score, rename
// and finish it as well, the same one every time for the same event.
export async function shareScoreLink(event: SavedEvent): Promise<string> {
  await shareLive(event)
  let key = scoreKey(event.id)
  // A friend's game is only shared on by a phone that has its key (canShare).
  if (key === null && !event.shared) {
    key = randomId(SCORE_KEY_LENGTH)
    await inTime(setDoc(doc(db, "live", event.id, "keys", key), {}))
    localStorage.setItem(scoreKeyAt(event.id), key)
  }
  if (key === null) throw new Error("Not an organiser")
  return location.origin + scorePath(event.kind, event.id, key)
}

// Sign this phone up as an organiser of a friend's game. Refused when the
// key is not the one in the game's organiser link.
async function join(id: string, key: string): Promise<void> {
  const user = await signedIn()
  await setDoc(doc(scorersOf(id), user.uid), { key })
  localStorage.setItem(scoreKeyAt(id), key)
}

// The changes still to be made to each game, in the order they were asked
// for, and how many of them there are.
const changes = new Map<string, Promise<unknown>>()
const waiting = new Map<string, number>()

// Make a change to a game that is scored online (changesOnline). The change
// is made to the newest online copy, not to this phone's, so two phones
// scoring at once both keep their score; `change` may run more than once.
// The result is saved on this phone and returned. Fails with no connection,
// after SHARE_LIMIT at most.
export function changeLive<E extends SavedEvent>(id: string, change: (event: E) => E): Promise<E> {
  waiting.set(id, (waiting.get(id) ?? 0) + 1)
  // Once the phone has been told a change did not work, it must not go
  // through after all: the tap would count twice when it is made again.
  let givenUp = false
  const changed = (changes.get(id) ?? Promise.resolve())
    .then(signedIn)
    .then(() =>
      inTime(
        runTransaction(db, async (transaction) => {
          const online = await transaction.get(liveDoc(id))
          if (givenUp) throw TOO_SLOW
          const next = change(migrate(JSON.parse(online.get("json"))) as E)
          transaction.update(liveDoc(id), { json: JSON.stringify(next) })
          return next
        }),
      ).catch((error) => {
        givenUp = true
        throw error
      }),
    )
    .then(async (next) => {
      const mine = await loadTournament(id)
      // A friend's copy stays one, unless this phone has just taken the game over.
      const saved = mine?.shared && !isSending(id) ? { ...next, shared: true as const } : next
      await saveTournament(saved)
      if (saved.finished && !saved.shared) markEnded(id)
      return saved
    })
  // A change that failed does not hold up the ones after it.
  changes.set(
    id,
    changed.catch(() => {}),
  )
  return changed.finally(() => {
    waiting.set(id, (waiting.get(id) ?? 1) - 1)
    if (!isChanging(id)) void catchUp(id)
  })
}

// What takes in the online copy of each game open on this page (openGame).
const followers = new Map<string, Set<(online: DocumentSnapshot) => void>>()

function followed(id: string, take: (online: DocumentSnapshot) => void): () => void {
  const taking = followers.get(id) ?? new Set()
  followers.set(id, taking.add(take))
  return () => void taking.delete(take)
}

// The taps have all gone through. While they were on their way the online
// copy was not shown, and a friend's score may have landed in between:
// read the copy as it now stands, so no phone with a connection is left
// showing anything else. Never throws.
async function catchUp(id: string): Promise<void> {
  try {
    const online = await getDocFromServer(liveDoc(id))
    if (!isChanging(id)) followers.get(id)?.forEach((take) => take(online))
  } catch {
    // No connection any more: the next change to arrive brings it up to date.
  }
}

// While changes are on their way the screen shows what was tapped; the
// online copy, a tap or two behind, would make the score jump back.
export function isChanging(id: string): boolean {
  return (waiting.get(id) ?? 0) > 0
}

// A finished game's result is online: nothing more is sent for it.
function markEnded(id: string): void {
  if (isSending(id) || localStorage.getItem(sharedKey(id)) === "closed") localStorage.setItem(sharedKey(id), "ended")
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
  if (!sentOnSave(localStorage.getItem(sharedKey(event.id)), event, scoreKey(event.id) !== null)) return
  send(event)
    .then(() => {
      if (event.finished) localStorage.setItem(sharedKey(event.id), "ended")
    })
    .catch(() => {})
}

// Call when the app starts: sends again every game whose saves are sent to
// friends (sentOnSave). A score entered with no connection waits in memory
// for the connection, and is lost if the app is closed first; this makes
// up for it. Never throws.
export function resendLive(): void {
  for (const id of Object.keys(sharedGames())) {
    loadTournament(id)
      .then((event) => event && pushLive(event))
      .catch(() => {})
  }
}

// Call when the organiser deletes an event: takes the online copy away too,
// so the link stops working. Friends keep what they already saved, as a
// finished game. The phone remembers the delete until it has gone through:
// with no connection it is tried again when the app starts (finishDeletes).
export async function deleteLive(id: string): Promise<void> {
  if (!hasLink(id)) {
    // A friend's copy: all there is to forget is that this phone could score it.
    localStorage.removeItem(scoreKeyAt(id))
    return
  }
  localStorage.setItem(sharedKey(id), "deleted")
  await auth.authStateReady()
  try {
    // The organiser link goes first: the rules ask the game who its owner is.
    const key = scoreKey(id)
    if (key !== null) {
      const scorers = await getDocs(scorersOf(id))
      await Promise.all(scorers.docs.map((scorer) => deleteDoc(scorer.ref)))
      await deleteDoc(doc(db, "live", id, "keys", key))
    }
    await deleteDoc(liveDoc(id))
  } catch (error) {
    // Refused: the copy is already gone, or is not this phone's to delete.
    // Trying again would change nothing.
    if ((error as { code?: string }).code !== "permission-denied") throw error
  }
  localStorage.removeItem(sharedKey(id))
  localStorage.removeItem(scoreKeyAt(id))
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
// a friend's. `key` is the end of an organiser link the screen was opened from.
// Returns the function to call when the screen closes.
//
// Whose game it is can change while it is open: a friend's becomes this
// phone's when it takes the game over, and this phone's becomes a friend's
// when another tab leaves it to its other organisers. It is opened again then.
export function openGame(
  id: string,
  fromLink: boolean, // opened from a shared link, so it may not be saved here yet
  show: (event: SavedEvent | null, live: boolean) => void,
  key?: string,
): () => void {
  let stop = () => {}
  let closed = false
  let opened = 0
  const open = () => {
    if (closed) return
    stop()
    stop = () => {}
    const mine = ++opened
    loadTournament(id).then((saved) => {
      if (closed || mine !== opened) return
      // This phone took the game over (takeOver) and a copy from before was
      // saved over its own: only an organiser's phone is sending a game.
      if (saved?.shared && isSending(id)) {
        saved = asOwn(saved)
        void saveTournament(saved)
      }
      stop = saved && !saved.shared ? openOwn(id, saved, show) : openFriends(id, saved, fromLink, key, show)
    })
  }
  const games = openGames.get(id) ?? new Set()
  openGames.set(id, games.add(open))
  open()
  return () => {
    closed = true
    games.delete(open)
    stop()
  }
}

const finished = <E extends SavedEvent>(event: E): E => ({ ...event, finished: true })

// The organiser's own game, even when opened from their own link. It is
// shown again whenever another tab of this browser changes it, or starts or
// closes its broadcast. While friends are scoring it too, the online copy is
// followed and kept on this phone.
function openOwn(
  id: string,
  saved: SavedEvent,
  show: (event: SavedEvent | null, live: boolean) => void,
): () => void {
  let stopped = false
  // A result that never went out, finished with no connection, goes now.
  if (saved.finished) pushLive(saved)
  const showOwn = (own: SavedEvent) => show(own, !own.finished && isSending(id))
  let unfollow = () => {}
  let following = false
  let seen: unknown
  const take = (snapshot: DocumentSnapshot) => {
    // Firestore's own memory is no newer than this phone's copy.
    if (stopped || !snapshot.exists() || snapshot.metadata.fromCache) return
    // No longer this phone's game: left to its other organisers.
    if (!hasLink(id)) return
    // Saving tells this browser's other tabs, which follow the game
    // too: only a copy that is new is saved.
    if (snapshot.get("json") === seen) return
    seen = snapshot.get("json")
    let online: SavedEvent
    try {
      online = migrate(JSON.parse(snapshot.get("json")))
    } catch {
      return
    }
    void saveTournament(online)
    if (online.finished) markEnded(id)
    if (!isChanging(id)) showOwn(online)
  }
  const follow = () => onSnapshot(liveDoc(id), take, () => {})
  // After this phone's own taps, its copy is their result, not what was
  // last seen online: take the online copy whatever it is.
  const unfollowed = followed(id, (online) => {
    seen = undefined
    take(online)
  })
  // No connection is kept open for a page nobody is looking at.
  const refollow = () => {
    const wanted = !stopped && !document.hidden && changesOnline(saved) && hasLink(id)
    if (wanted === following) return
    following = wanted
    unfollow()
    unfollow = wanted ? follow() : () => {}
  }
  const showAgain = () => {
    refollow()
    void loadTournament(id).then((own) => {
      if (stopped) return
      if (own?.shared) return reopen(id)
      if (own) showOwn(own)
      else show(null, false)
    })
  }
  // Scored, renamed, finished or deleted in another tab: show that here.
  const unlisten = onChangedElsewhere((changed) => {
    if (changed === id) showAgain()
  })
  // Broadcast started or closed in another tab: the browser tells every
  // other tab when localStorage changes.
  const onShared = (change: StorageEvent) => {
    if (change.key === sharedKey(id) || change.key === scoreKeyAt(id)) showAgain()
  }
  window.addEventListener("storage", onShared)
  // A tab left in the background may not have heard: look again when it
  // is back in front.
  const onVisible = () => {
    if (document.hidden) refollow()
    else showAgain()
  }
  document.addEventListener("visibilitychange", onVisible)
  // A broadcast game is finished once it has gone on too long
  // (followTimeLeft), by whichever organiser's phone has it open then, or
  // opens it next.
  const finishOld = () => {
    if (changesOnline(saved)) return void changeLive(id, finished).then(showOwn, () => {})
    void loadTournament(id).then(async (own) => {
      if (stopped || !own || own.finished) return
      const done = finished(own)
      await saveTournament(done)
      pushLive(done)
      showOwn(done)
    })
  }
  const tooOld = hasLink(id) && !saved.finished ? setTimeout(finishOld, followTimeLeft(saved, Date.now())) : undefined
  refollow()
  showOwn(saved)
  return () => {
    stopped = true
    clearTimeout(tooOld)
    unfollow()
    unfollowed()
    unlisten()
    window.removeEventListener("storage", onShared)
    document.removeEventListener("visibilitychange", onVisible)
  }
}

// A friend's game, or a link to one not saved here yet.
//
// A friend's copy is saved on this phone on every change, marked `shared`,
// so it is still there with no connection or after the organiser deletes
// theirs, which finishes it here. Once it is finished nothing more can
// change, so following stops.
// A closed broadcast is still followed, in case it is picked up again.
// A game that has gone on too long (followTimeLeft) is finished: opened
// after that, its newest score is read once first.
function openFriends(
  id: string,
  saved: SavedEvent | null,
  fromLink: boolean,
  key: string | undefined,
  show: (event: SavedEvent | null, live: boolean) => void,
): () => void {
  if (saved?.finished || (!saved && !fromLink) || !canShareLive) {
    show(saved, false)
    return () => {}
  }

  let latest = saved
  let live = false
  let stopped = false
  const tell = (isLive: boolean) => {
    live = isLive
    // The online copy lags behind the taps still being sent (isChanging).
    if (!isChanging(id)) show(latest, live)
  }
  if (saved) show(saved, false)
  // Opened from the organiser link: sign up, once, and show the game
  // again now that it can be changed. The game itself is no different, so
  // the screen gets a fresh copy to draw. A wrong key leaves it for watching.
  if (key && scoreKey(id) === null) {
    join(id, key)
      .then(() => {
        if (!stopped && latest) show({ ...latest }, live)
      })
      .catch(() => {})
  }
  let taking = false
  let unsubscribe = () => {}
  let tooOld: ReturnType<typeof setTimeout> | undefined
  // Taken over in another tab of this browser: it is this phone's game now.
  const unlisten = onChangedElsewhere((changed) => {
    if (changed !== id) return
    void loadTournament(id).then((copy) => {
      if (!stopped && copy && !copy.shared) reopen(id)
    })
  })
  // Nothing more will come, or the screen closed: stop for good.
  const end = () => {
    stopped = true
    unlisten()
    unfollowed()
    document.removeEventListener("visibilitychange", onVisibility)
    clearTimeout(tooOld)
    unsubscribe()
  }
  const take = (snapshot: DocumentSnapshot) => {
    // Becoming the organiser: this phone's copy is no longer a friend's.
    if (taking) return
    // Become it already, in another tab.
    if (isSending(id)) return reopen(id)
    // With no connection Firestore answers from its own empty memory:
    // that is not a delete, so keep waiting for the real answer.
    if (!snapshot.exists() && snapshot.metadata.fromCache) return tell(false)
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
    if (!latest.finished && followTimeLeft(latest, Date.now()) === 0) return finishOld()
    // Left to its other organisers: this phone becomes its owner, unless
    // another of them is quicker.
    if (!taking && takesOver(sharedGames(), scoreKey(id) !== null, snapshot.get("handover") === true)) {
      taking = true
      takeOver(id).catch(() => {
        taking = false
      })
    }
    tell(followedLive(latest, snapshot.get("closed") === true))
    // Finished: nothing more will come.
    if (latest.finished) return end()
    clearTimeout(tooOld)
    tooOld = setTimeout(finishOld, followTimeLeft(latest, Date.now()))
  }
  // A broadcast game is finished once it has gone on too long
  // (followTimeLeft). An organiser's phone finishes it for everyone; any
  // other only on itself, until an organiser's does.
  function finishOld() {
    end()
    if (scoreKey(id) !== null) void changeLive(id, finished).catch(() => {})
    if (latest) {
      latest = finished(latest)
      void saveTournament(latest)
    }
    show(latest, false)
  }
  const follow = () =>
    // Also told when an answer from memory is confirmed by the server:
    // that is how a delete is heard of once the connection is back.
    onSnapshot(liveDoc(id), { includeMetadataChanges: true }, take, () => tell(false))
  const unfollowed = followed(id, (online) => {
    if (!stopped) take(online)
  })
  // No connection is kept open for a page nobody is looking at: following
  // stops while it is hidden and starts again when it comes back.
  function onVisibility() {
    unsubscribe()
    unsubscribe = document.hidden ? () => {} : follow()
  }
  document.addEventListener("visibilitychange", onVisibility)
  onVisibility()
  return end
}

// Whether this phone is one of the game's organisers: the game is its own,
// or a friend's that it opened from the organiser link.
export function isOrganiser(event: SavedEvent): boolean {
  return !event.shared || scoreKey(event.id) !== null
}
