import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SavedEvent } from "./types"

// Firebase, the phone's storage and the page are stood in for, so these
// check what live.ts asks of them: what it sends, when it listens, and what
// it tells the screen. They run before live.ts is loaded.
const fake = vi.hoisted(() => {
  const flags = new Map<string, string>()
  const pageListeners = new Set<() => void>()
  const page = {
    hidden: false,
    addEventListener: (_: string, fn: () => void) => void pageListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => void pageListeners.delete(fn),
  }
  vi.stubGlobal("localStorage", {
    get length() {
      return flags.size
    },
    key: (i: number) => [...flags.keys()][i] ?? null,
    getItem: (key: string) => flags.get(key) ?? null,
    setItem: (key: string, value: string) => void flags.set(key, value),
    removeItem: (key: string) => void flags.delete(key),
  })
  vi.stubGlobal("location", { hostname: "localhost", origin: "https://padel.test" })
  vi.stubGlobal("document", page)
  const storageListeners = new Set<(change: { key: string }) => void>()
  vi.stubGlobal("window", {
    addEventListener: (_: string, fn: (change: { key: string }) => void) => void storageListeners.add(fn),
    removeEventListener: (_: string, fn: (change: { key: string }) => void) => void storageListeners.delete(fn),
  })

  type Listener = { id: string; next: (snapshot: unknown) => void; fail: () => void; open: boolean }
  return {
    flags,
    page,
    pageListeners,
    storageListeners, // told when another tab changes localStorage
    saved: new Map<string, unknown>(), // the games on this phone
    listeners: [] as Listener[], // every Firestore listener ever opened
    online: new Map<string, Record<string, unknown>>(), // the copies an update or a transaction changes, by game
    scorers: new Map<string, string[]>(), // the friends signed up to score each game
    // Change fields of a game's online copy, each named by its path
    // ("game.name"). A field set to what deleteField gives is taken away.
    // A game with no copy here is left alone.
    update(id: string, data: Record<string, unknown>) {
      const copy = structuredClone(this.online.get(id))
      if (!copy) return
      for (const [path, value] of Object.entries(data)) {
        const names = path.split(".")
        const last = names.pop()!
        const map = names.reduce((at, name) => at[name] as Record<string, unknown>, copy)
        if (value === "no such field") delete map[last]
        else map[last] = value
      }
      this.online.set(id, copy)
    },
    scorersAt(path: string) {
      const uids = this.scorers.get(path.split("/")[1]) ?? []
      return { empty: uids.length === 0, docs: uids.map((uid) => ({ ref: { id: uid, path: `${path}/${uid}` } })) }
    },
    otherTabs: new Set<(id: string) => void>(), // what to call, with the game's id, when another tab changes a game
  }
})

vi.mock("firebase/app", () => ({ initializeApp: () => ({}) }))
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ authStateReady: async () => {}, currentUser: { uid: "organiser" } }),
  connectAuthEmulator: () => {},
  signInAnonymously: async () => ({ user: { uid: "organiser" } }),
}))
vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  connectFirestoreEmulator: () => {},
  // A game is live/<id>; its score key and scorers are documents under it.
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  doc: (parent: { path?: string }, ...path: string[]) => {
    const full = [...(parent.path ? [parent.path] : []), ...path].join("/")
    return { id: full.split("/").pop(), path: full }
  },
  query: (ref: unknown) => ref,
  limit: () => undefined,
  getDocs: vi.fn(async (ref: { path: string }) => fake.scorersAt(ref.path)),
  getDocsFromServer: vi.fn(async (ref: { path: string }) => fake.scorersAt(ref.path)),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async (ref: { id: string }, data: Record<string, unknown>) => fake.update(ref.id, data)),
  deleteField: () => "no such field",
  deleteDoc: vi.fn(async () => {}),
  disableNetwork: vi.fn(async () => {}),
  enableNetwork: vi.fn(async () => {}),
  // Reads and writes fake.online.
  runTransaction: vi.fn(async (_db: unknown, work: (transaction: unknown) => Promise<unknown>) =>
    work({
      get: async (ref: { id: string }) => ({ get: (field: string) => fake.online.get(ref.id)?.[field] }),
      update: (ref: { id: string }, data: Record<string, unknown>) => fake.update(ref.id, data),
    }),
  ),
  // The friend's listener passes options; the organiser's does not.
  onSnapshot: vi.fn((ref: { id: string }, ...rest: unknown[]) => {
    const [next, fail] = (typeof rest[0] === "function" ? rest : rest.slice(1)) as [(snapshot: unknown) => void, () => void]
    const listener = { id: ref.id, next, fail, open: true }
    fake.listeners.push(listener)
    return () => {
      listener.open = false
    }
  }),
}))
vi.mock("./storage", () => ({
  loadTournament: async (id: string) => fake.saved.get(id) ?? null,
  saveTournament: vi.fn(async (event: { id: string }) => void fake.saved.set(event.id, event)),
  migrate: (raw: unknown) => raw,
  onChangedElsewhere: (changed: (id: string) => void) => {
    fake.otherTabs.add(changed)
    return () => void fake.otherTabs.delete(changed)
  },
}))

import { deleteDoc, disableNetwork, enableNetwork, getDocsFromServer, runTransaction, setDoc, updateDoc } from "firebase/firestore"
import {
  canAddOrganiser,
  changesOnline,
  closesAnother,
  deleteLive,
  finishDeletes,
  hasLink,
  isSending,
  onSlowSend,
  openGame,
  passesOn,
  pushLive,
  resendLive,
  restartConnection,
  scoreKey,
  sendChange,
  sendingSlowly,
  shareLive,
  shareScoreLink,
} from "./live"
import { toOnline, type OnlineGame } from "./online-game"
import { saveTournament } from "./storage"

// A whole game, since its online copy holds every field.
const game = (id: string, fields: Partial<SavedEvent> = {}) =>
  ({
    version: 3,
    kind: "americano",
    id,
    name: id,
    createdAt: 0,
    finished: false,
    scoringMode: "total",
    target: 16,
    courts: 1,
    players: [],
    rounds: [],
    ...fields,
  }) as SavedEvent

const match = (id: string): SavedEvent => ({
  version: 3,
  kind: "match",
  id,
  name: id,
  createdAt: 0,
  finished: false,
  teams: [
    ["Ana", "Ben"],
    ["Cai", "Dee"],
  ],
  bestOf: 3,
  setsAs: "bestOf",
  gamesPerSet: 6,
  deuce: "advantage",
  scoreBy: "points",
  points: [],
})

// A game on the organiser's phone.
const own = (id: string, fields: Partial<SavedEvent> = {}) => {
  const event = game(id, fields)
  fake.saved.set(id, event)
  return event
}

// Let the saves, sends and loads that were started finish.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// What was sent to Firestore for a game, oldest first.
const sent = (id: string) =>
  vi
    .mocked(setDoc)
    .mock.calls.filter(([ref]) => (ref as unknown as { path: string }).path === `live/${id}`)
    .map(([, data]) => data as { owner: string; game: OnlineGame; closed?: true })

// A document as a phone following it receives it.
const received = (fields: Record<string, unknown>) => ({
  exists: () => true,
  metadata: { fromCache: false },
  data: () => fields,
  get: (field: string) => fields[field],
})

// The online copy as a friend's phone receives it.
const copy = (event: SavedEvent, closed = false) => received({ game: toOnline(event), ...(closed && { closed: true }) })

// The game in the online copy.
const onlineGame = (id: string) => fake.online.get(id)!.game as OnlineGame
const deleted = { exists: () => false, metadata: { fromCache: false }, get: () => undefined }
// What Firestore answers with no connection: it has no copy of its own.
const noConnection = { ...deleted, metadata: { fromCache: true } }

const listening = () => fake.listeners.filter((l) => l.open)
const hidePage = (hidden: boolean) => {
  fake.page.hidden = hidden
  fake.pageListeners.forEach((fn) => fn())
}

// Open a game the way a screen does, and collect what the screen is told.
async function open(id: string, fromLink = false, key?: string) {
  const shown: { event: SavedEvent | null; live: boolean }[] = []
  const close = openGame(id, fromLink, (event, live) => shown.push({ event, live }), key)
  await settle()
  return { shown, close, last: () => shown[shown.length - 1] }
}

const HOUR = 60 * 60 * 1000

beforeEach(() => {
  // The games here are created at 0, and so is the clock: none is too old
  // to follow unless a test moves the time on.
  vi.useFakeTimers({ toFake: ["Date"], now: 0 })
  fake.flags.clear()
  fake.saved.clear()
  fake.pageListeners.clear()
  fake.storageListeners.clear()
  fake.listeners.length = 0
  fake.online.clear()
  fake.scorers.clear()
  fake.otherTabs.clear()
  fake.page.hidden = false
  vi.clearAllMocks()
})

describe("broadcasting a game", () => {
  it("sends nothing before the organiser broadcasts it", async () => {
    pushLive(own("a"))
    await settle()
    expect(setDoc).not.toHaveBeenCalled()
    expect(hasLink("a")).toBe(false)
  })

  it("puts the whole game online under the organiser's name", async () => {
    const a = own("a")
    await shareLive(a)
    expect(sent("a")).toEqual([{ owner: "organiser", game: toOnline(a) }])
    expect(isSending("a")).toBe(true)
  })

  it("returns the link friends open: the site, then /t/<id> or /m/<id>", async () => {
    expect(await shareLive(own("a"))).toBe("https://padel.test/t/a")
    expect(await shareLive(match("b"))).toBe("https://padel.test/m/b")
  })

  it("sends the game again after every save", async () => {
    await shareLive(own("a"))
    pushLive(game("a", { name: "renamed" }))
    await settle()
    expect(sent("a")).toHaveLength(2)
    expect(sent("a")[1].game.name).toBe("renamed")
  })

  it("sends the finished game once, then stops sending", async () => {
    await shareLive(own("a"))
    pushLive(game("a", { finished: true }))
    await settle()
    pushLive(game("a", { finished: true }))
    await settle()
    expect(sent("a")).toHaveLength(2)
    expect(isSending("a")).toBe(false)
    expect(hasLink("a")).toBe(true)
  })

  it("keeps sending after a send fails, since the next one carries the whole game", async () => {
    await shareLive(own("a"))
    vi.mocked(setDoc).mockRejectedValueOnce(new Error("offline"))
    pushLive(game("a"))
    await settle()
    expect(isSending("a")).toBe(true)
  })
})

describe("the link of a game", () => {
  it("is the same every time the game is broadcast", async () => {
    const a = own("a")
    expect(await shareLive(a)).toBe(await shareLive(a))
  })

  it("is the same after the broadcast was closed and picked up again", async () => {
    const a = own("a")
    const first = await shareLive(a)
    await shareLive(own("b"))
    expect(await shareLive(a)).toBe(first)
  })

  it("always points at the one online copy of that game", async () => {
    const a = own("a")
    await shareLive(a)
    await shareLive(own("b"))
    await shareLive(a)
    // Sent, closed, sent again: three writes, all to the same copy.
    expect(sent("a")).toHaveLength(3)
  })
})

describe("one broadcast at a time", () => {
  it("asks first when broadcasting would close another game's broadcast", async () => {
    await shareLive(own("a"))
    expect(closesAnother(own("b"))).toBe(true)
  })

  it("does not ask when nothing else is being broadcast", () => {
    expect(closesAnother(own("a"))).toBe(false)
  })

  it("does not ask when the game is the one already being broadcast", async () => {
    const a = own("a")
    await shareLive(a)
    expect(closesAnother(a)).toBe(false)
  })

  it("stops broadcasting the old game when a new one goes live", async () => {
    await shareLive(own("a"))
    await shareLive(own("b"))
    expect(isSending("a")).toBe(false)
    expect(isSending("b")).toBe(true)
  })

  it("marks the old game's online copy closed, with its last score", async () => {
    const a = own("a")
    await shareLive(a)
    await shareLive(own("b"))
    await settle()
    expect(sent("a")[1]).toEqual({ owner: "organiser", game: toOnline(a), closed: true })
  })

  it("keeps the closed game's link", async () => {
    await shareLive(own("a"))
    await shareLive(own("b"))
    expect(hasLink("a")).toBe(true)
  })

  it("sends no more scores for the closed game", async () => {
    const a = own("a")
    await shareLive(a)
    await shareLive(own("b"))
    await settle()
    pushLive(a)
    await settle()
    expect(sent("a")).toHaveLength(2)
  })

  it("takes the broadcast back when the closed game is broadcast again", async () => {
    const a = own("a")
    await shareLive(a)
    await shareLive(own("b"))
    await shareLive(a)
    await settle()
    expect(isSending("a")).toBe(true)
    expect(isSending("b")).toBe(false)
    expect(sent("a")[2].closed).toBeUndefined()
    expect(sent("b")[1].closed).toBe(true)
  })

  it("sends the closed game's final result once when it is finished", async () => {
    await shareLive(own("a"))
    await shareLive(own("b"))
    await settle()
    pushLive(game("a", { finished: true }))
    await settle()
    pushLive(game("a", { finished: true }))
    await settle()
    expect(sent("a")).toHaveLength(3)
    expect(sent("a")[2].game.finished).toBe(true)
  })

  it("leaves the other broadcast on when the closed game's final result goes out", async () => {
    await shareLive(own("a"))
    await shareLive(own("b"))
    await settle()
    pushLive(game("a", { finished: true }))
    await settle()
    expect(isSending("a")).toBe(false)
    expect(isSending("b")).toBe(true)
  })

  it("keeps the old broadcast when the new game can't be put online", async () => {
    await shareLive(own("a"))
    vi.mocked(setDoc).mockRejectedValueOnce(new Error("offline"))
    await expect(shareLive(own("b"))).rejects.toThrow("offline")
    expect(isSending("a")).toBe(true)
    expect(hasLink("b")).toBe(false)
  })

  it("refuses at once with no connection, and sends nothing", async () => {
    const phone = globalThis.navigator
    vi.stubGlobal("navigator", { onLine: false })
    await expect(shareLive(own("a"))).rejects.toThrow("No connection")
    vi.stubGlobal("navigator", phone)
    expect(sent("a")).toEqual([])
    expect(hasLink("a")).toBe(false)
  })

  it("gives up after 5 seconds when the connection is up but nothing gets through", async () => {
    vi.useFakeTimers({ now: 0 })
    vi.mocked(setDoc).mockReturnValueOnce(new Promise(() => {}))
    const sharing = expect(shareLive(own("a"))).rejects.toThrow("No connection")
    await vi.advanceTimersByTimeAsync(4999)
    expect(hasLink("a")).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await sharing
    expect(isSending("a")).toBe(false)
  })

  it("remembers a copy may still go online after giving up, so a delete takes it away", async () => {
    vi.useFakeTimers({ now: 0 })
    vi.mocked(setDoc).mockReturnValueOnce(new Promise(() => {}))
    const sharing = expect(shareLive(own("a"))).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(5000)
    await sharing
    expect(hasLink("a")).toBe(true)
    await deleteLive("a")
    expect(deleteDoc).toHaveBeenCalledTimes(1)
  })

  it("keeps a game on air when broadcasting it again gets nowhere", async () => {
    await shareLive(own("a"))
    vi.useFakeTimers({ now: 0 })
    vi.mocked(setDoc).mockReturnValueOnce(new Promise(() => {}))
    const sharing = expect(shareLive(own("a"))).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(5000)
    await sharing
    expect(isSending("a")).toBe(true)
  })

  it("still switches when only the closing can't be sent", async () => {
    await shareLive(own("a"))
    vi.mocked(setDoc).mockResolvedValueOnce().mockRejectedValueOnce(new Error("offline"))
    await expect(shareLive(own("b"))).resolves.toBe("https://padel.test/t/b")
    await settle()
    expect(isSending("a")).toBe(false)
    expect(isSending("b")).toBe(true)
  })
})

describe("when the app starts", () => {
  it("sends the game being broadcast again, in case its last scores never went out", async () => {
    await shareLive(own("a"))
    own("a", { name: "scored with no connection" })
    resendLive()
    await settle()
    expect(sent("a")).toHaveLength(2)
    expect(sent("a")[1].game.name).toBe("scored with no connection")
  })

  it("sends nothing when no game was ever broadcast", async () => {
    own("a")
    resendLive()
    await settle()
    expect(setDoc).not.toHaveBeenCalled()
  })

  it("sends nothing for a game whose broadcast was closed", async () => {
    await shareLive(own("a"))
    await shareLive(own("b"))
    await settle()
    vi.mocked(setDoc).mockClear()
    resendLive()
    await settle()
    expect(sent("a")).toEqual([])
    expect(sent("b")).toHaveLength(1)
  })

  it("sends a finished game whose result never went out, then no more", async () => {
    await shareLive(own("a"))
    own("a", { finished: true })
    resendLive()
    await settle()
    resendLive()
    await settle()
    expect(sent("a")).toHaveLength(2)
  })

  it("sends nothing for a broadcast game that is no longer on this phone", async () => {
    await shareLive(own("a"))
    fake.saved.delete("a")
    resendLive()
    await settle()
    expect(sent("a")).toHaveLength(1)
  })
})

describe("deleting a broadcast game", () => {
  it("takes the online copy away and forgets the link", async () => {
    await shareLive(own("a"))
    await deleteLive("a")
    expect(deleteDoc).toHaveBeenCalledTimes(1)
    expect(hasLink("a")).toBe(false)
  })

  it("touches nothing online for a game that was never broadcast", async () => {
    await deleteLive("a")
    expect(deleteDoc).not.toHaveBeenCalled()
  })

  it("remembers a delete that could not go through", async () => {
    await shareLive(own("a"))
    vi.mocked(deleteDoc).mockRejectedValueOnce(new Error("offline"))
    await expect(deleteLive("a")).rejects.toThrow("offline")
    expect(fake.flags.get("live:a")).toBe("deleted")
  })

  it("tries the delete again when the app starts, and then forgets it", async () => {
    await shareLive(own("a"))
    vi.mocked(deleteDoc).mockRejectedValueOnce(new Error("offline"))
    await deleteLive("a").catch(() => {})
    finishDeletes()
    await settle()
    expect(deleteDoc).toHaveBeenCalledTimes(2)
    expect(hasLink("a")).toBe(false)
  })

  it("deletes nothing when the app starts with no delete owed", async () => {
    await shareLive(own("a"))
    finishDeletes()
    await settle()
    expect(deleteDoc).not.toHaveBeenCalled()
    expect(isSending("a")).toBe(true)
  })

  it("forgets a delete that is refused: the copy is already gone", async () => {
    await shareLive(own("a"))
    vi.mocked(deleteDoc).mockRejectedValueOnce(Object.assign(new Error("refused"), { code: "permission-denied" }))
    await deleteLive("a")
    expect(hasLink("a")).toBe(false)
  })

  it("sends no score for a game whose delete is still owed", async () => {
    await shareLive(own("a"))
    vi.mocked(deleteDoc).mockRejectedValueOnce(new Error("offline"))
    await deleteLive("a").catch(() => {})
    pushLive(game("a"))
    await settle()
    expect(sent("a")).toHaveLength(1)
  })
})

describe("opening your own game", () => {
  it("shows it without listening to anything", async () => {
    const a = own("a")
    const { shown } = await open("a")
    expect(shown).toEqual([{ event: a, live: false }])
    expect(fake.listeners).toHaveLength(0)
  })

  it("is live while it is being broadcast", async () => {
    await shareLive(own("a"))
    expect((await open("a")).last().live).toBe(true)
  })

  it("is not live once its broadcast was closed", async () => {
    await shareLive(own("a"))
    await shareLive(own("b"))
    expect((await open("a")).last().live).toBe(false)
  })

  it("sends the final result when the game was finished with no connection", async () => {
    await shareLive(own("a"))
    vi.mocked(setDoc).mockRejectedValueOnce(new Error("offline"))
    pushLive(own("a", { finished: true }))
    await settle()
    await open("a")
    expect(sent("a")[2].game.finished).toBe(true)
    expect(isSending("a")).toBe(false)
  })

  it("sends nothing when the final result already went out", async () => {
    await shareLive(own("a"))
    pushLive(own("a", { finished: true }))
    await settle()
    await open("a")
    expect(sent("a")).toHaveLength(2)
  })

  it("sends nothing for a finished game that was never broadcast", async () => {
    own("a", { finished: true })
    await open("a")
    expect(setDoc).not.toHaveBeenCalled()
  })

  it("is your own even when opened from your own link", async () => {
    own("a")
    await open("a", true)
    expect(fake.listeners).toHaveLength(0)
  })
})

describe("your own game open in two tabs", () => {
  it("shows a score entered in the other tab", async () => {
    own("a")
    const { last } = await open("a")
    const scored = own("a", { name: "scored in the other tab" })
    fake.otherTabs.forEach((heard) => heard("a"))
    await settle()
    expect(last().event).toEqual(scored)
  })

  it("shows a score the other tab saved while the game was still being read from the phone", async () => {
    own("a")
    const shown: (SavedEvent | null)[] = []
    openGame("a", false, (event) => shown.push(event))
    const scored = own("a", { name: "scored in the other tab" })
    fake.otherTabs.forEach((heard) => heard("a"))
    await settle()
    expect(shown.at(-1)).toEqual(scored)
  })

  it("stops being live once the other tab finishes it", async () => {
    await shareLive(own("a"))
    const { last } = await open("a")
    expect(last().live).toBe(true)
    own("a", { finished: true })
    fake.otherTabs.forEach((heard) => heard("a"))
    await settle()
    expect(last().live).toBe(false)
  })

  it("leaves it alone when the other tab changes a different game", async () => {
    own("a")
    const { shown } = await open("a")
    fake.otherTabs.forEach((heard) => heard("b"))
    await settle()
    expect(shown).toHaveLength(1)
  })

  it("becomes live once the other tab broadcasts it", async () => {
    own("a")
    const { last } = await open("a")
    expect(last().live).toBe(false)
    fake.flags.set("live:a", "1")
    fake.storageListeners.forEach((heard) => heard({ key: "live:a" }))
    await settle()
    expect(last().live).toBe(true)
  })

  it("stops being live once the other tab broadcasts another game instead", async () => {
    await shareLive(own("a"))
    const { last } = await open("a")
    fake.flags.set("live:a", "closed")
    fake.storageListeners.forEach((heard) => heard({ key: "live:a" }))
    await settle()
    expect(last().live).toBe(false)
  })

  it("shows no game once the other tab deletes it", async () => {
    own("a")
    const { last } = await open("a")
    fake.saved.delete("a")
    fake.otherTabs.forEach((heard) => heard("a"))
    await settle()
    expect(last()).toEqual({ event: null, live: false })
  })

  it("shows what changed while its tab was in the background, once it is back in front", async () => {
    own("a")
    const { last } = await open("a")
    hidePage(true)
    const scored = own("a", { name: "scored in the other tab" })
    hidePage(false)
    await settle()
    expect(last().event).toEqual(scored)
  })

  it("stops listening to the other tab and to the page when its screen closes", async () => {
    own("a")
    const { close } = await open("a")
    close()
    expect(fake.otherTabs.size).toBe(0)
    expect(fake.storageListeners.size).toBe(0)
    expect(fake.pageListeners.size).toBe(0)
  })

  it("shows nothing new for a friend's game when another tab saves it: the online copy is what it follows", async () => {
    fake.saved.set("a", game("a", { shared: true }))
    const { shown } = await open("a")
    const before = shown.length
    fake.saved.set("a", game("a", { shared: true, name: "saved by another tab" }))
    fake.otherTabs.forEach((changed) => changed("a"))
    await settle()
    expect(shown).toHaveLength(before)
  })
})

describe("following a friend's game", () => {
  it("shows nothing for a game that is not on this phone and was not opened from a link", async () => {
    const { shown } = await open("a")
    expect(shown).toEqual([{ event: null, live: false }])
    expect(fake.listeners).toHaveLength(0)
  })

  it("listens to a game opened from a link", async () => {
    await open("a", true)
    expect(listening().map((l) => l.id)).toEqual(["a"])
  })

  it("saves every copy that arrives on this phone, marked shared", async () => {
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a")))
    expect(saveTournament).toHaveBeenCalledWith({ ...game("a"), shared: true })
    expect(last()).toEqual({ event: { ...game("a"), shared: true }, live: true })
  })

  it("shows the saved copy first, not live, until the online one arrives", async () => {
    const saved = own("a", { shared: true })
    const { shown } = await open("a")
    expect(shown).toEqual([{ event: saved, live: false }])
    expect(listening()).toHaveLength(1)
  })

  it("is not live when the organiser moved the broadcast to another game", async () => {
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a"), true))
    expect(last().live).toBe(false)
  })

  it("keeps listening to a closed broadcast, and goes live when it is picked up again", async () => {
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a"), true))
    expect(listening()).toHaveLength(1)
    fake.listeners[0].next(copy(game("a")))
    expect(last().live).toBe(true)
  })

  it("stops listening once the finished game arrives", async () => {
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a", { finished: true })))
    expect(last().live).toBe(false)
    expect(listening()).toHaveLength(0)
  })

  it("does not listen to a saved copy that is already finished", async () => {
    own("a", { shared: true, finished: true })
    await open("a", true)
    expect(fake.listeners).toHaveLength(0)
  })

  it("keeps the saved copy as a finished game and stops listening when the organiser deletes the game", async () => {
    const saved = own("a", { shared: true })
    const { last } = await open("a")
    fake.listeners[0].next(deleted)
    expect(last()).toEqual({ event: { ...saved, finished: true }, live: false })
    expect(saveTournament).toHaveBeenCalledWith({ ...saved, finished: true })
    expect(listening()).toHaveLength(0)
  })

  it("finishes the copy with the last score that arrived before the delete", async () => {
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a", { name: "last score" })))
    fake.listeners[0].next(deleted)
    expect(last()).toEqual({ event: { ...game("a", { name: "last score" }), shared: true, finished: true }, live: false })
  })

  it("finishes a copy whose game was deleted while this phone was away, even 6 hours on", async () => {
    own("a", { shared: true })
    vi.setSystemTime(7 * HOUR)
    const { last } = await open("a")
    fake.listeners[0].next(deleted)
    expect(last().event?.finished).toBe(true)
  })

  it("shows nothing, and saves nothing, for a link whose game is gone", async () => {
    const { last } = await open("a", true)
    fake.listeners[0].next(deleted)
    expect(last()).toEqual({ event: null, live: false })
    expect(saveTournament).not.toHaveBeenCalled()
  })

  it("does not take having no connection for a delete: the copy stays unfinished and is still listened to", async () => {
    const saved = own("a", { shared: true })
    const { last } = await open("a")
    fake.listeners[0].next(noConnection)
    expect(last()).toEqual({ event: saved, live: false })
    expect(saveTournament).not.toHaveBeenCalled()
    expect(listening()).toHaveLength(1)
  })

  it("finishes the copy when the delete is heard of once the connection is back", async () => {
    own("a", { shared: true })
    const { last } = await open("a")
    fake.listeners[0].next(noConnection)
    fake.listeners[0].next(deleted)
    expect(last().event?.finished).toBe(true)
    expect(listening()).toHaveLength(0)
  })

  it("leaves alone a copy it can't read, such as one from a newer build", async () => {
    const saved = own("a", { shared: true })
    const { last } = await open("a")
    fake.listeners[0].next(received({ game: "not a game" }))
    expect(last()).toEqual({ event: saved, live: false })
    expect(saveTournament).not.toHaveBeenCalled()
  })

  // LEGACY, remove after 2026-10-28.
  it("still reads a copy from before 2026-10-14, kept as one JSON string", async () => {
    const { last } = await open("a", true)
    fake.listeners[0].next(received({ json: JSON.stringify(game("a")) }))
    expect(last()).toEqual({ event: { ...game("a"), shared: true }, live: true })
  })

  it("is not live when the connection fails", async () => {
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a")))
    fake.listeners[0].fail()
    expect(last().live).toBe(false)
  })

  it("stops listening when the screen closes", async () => {
    const { close } = await open("a", true)
    close()
    expect(listening()).toHaveLength(0)
  })

  it("never starts listening when the screen closes before the game has loaded", async () => {
    const close = openGame("a", true, () => {})
    close()
    await settle()
    expect(fake.listeners).toHaveLength(0)
  })
})

describe("a friend's game that is 6 hours old", () => {
  it("is finished on this phone the moment it turns 6 hours old, and no longer followed", async () => {
    const { last } = await open("a", true)
    vi.useFakeTimers({ now: HOUR })
    fake.listeners[0].next(copy(game("a")))
    expect(last().live).toBe(true)
    vi.advanceTimersByTime(5 * HOUR - 1)
    expect(listening()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(listening()).toHaveLength(0)
    expect(last()).toEqual({ event: { ...game("a"), shared: true, finished: true }, live: false })
    expect(fake.saved.get("a")).toMatchObject({ finished: true })
  })

  it("has its newest score read once when opened from a link, then is finished and let go", async () => {
    vi.setSystemTime(7 * HOUR)
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a", { name: "newest" })))
    expect(last()).toEqual({ event: { ...game("a", { name: "newest" }), shared: true, finished: true }, live: false })
    expect(listening()).toHaveLength(0)
  })

  it("is not finished online by a phone that only watches", async () => {
    vi.setSystemTime(7 * HOUR)
    await open("a", true)
    fake.listeners[0].next(copy(game("a")))
    await settle()
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it("is finished online, for everyone, by a phone that is one of its organisers", async () => {
    scoring("a")
    vi.setSystemTime(7 * HOUR)
    await open("a")
    fake.listeners[0].next(copy(game("a")))
    await settle()
    expect(onlineGame("a").finished).toBe(true)
    expect(fake.saved.get("a")).toMatchObject({ finished: true, shared: true })
  })

  it("brings the result to a saved copy that never saw the game finish", async () => {
    own("a", { shared: true })
    vi.setSystemTime(7 * HOUR)
    const { last } = await open("a")
    fake.listeners[0].next(copy(game("a", { finished: true })))
    expect(last().event?.finished).toBe(true)
    expect(listening()).toHaveLength(0)
  })

  it("is not listened to again when the page comes back", async () => {
    vi.setSystemTime(7 * HOUR)
    await open("a", true)
    fake.listeners[0].next(copy(game("a")))
    hidePage(true)
    hidePage(false)
    expect(listening()).toHaveLength(0)
  })

  it("tells a screen that has closed nothing when the 6 hours run out", async () => {
    const { close, shown } = await open("a", true)
    vi.useFakeTimers({ now: HOUR })
    fake.listeners[0].next(copy(game("a")))
    close()
    const told = shown.length
    vi.advanceTimersByTime(10 * HOUR)
    expect(shown).toHaveLength(told)
  })
})

describe("your own broadcast game that is 6 hours old", () => {
  it("is finished when it is opened, and its result sent", async () => {
    const a = own("a")
    await shareLive(a)
    vi.setSystemTime(7 * HOUR)
    const { last } = await open("a")
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(fake.saved.get("a")).toEqual({ ...a, finished: true })
    expect(sent("a").at(-1)).toEqual({ owner: "organiser", game: toOnline({ ...a, finished: true }) })
    expect(last()).toEqual({ event: { ...a, finished: true }, live: false })
  })

  it("is finished online when it has an organiser link", async () => {
    await scored("a")
    vi.setSystemTime(7 * HOUR)
    const { last } = await open("a")
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(onlineGame("a").finished).toBe(true)
    expect(last()!.event?.finished).toBe(true)
    expect(isSending("a")).toBe(false)
  })

  it("is left alone when it was never broadcast: only broadcast games end by themselves", async () => {
    const a = own("a")
    vi.setSystemTime(100 * HOUR)
    const { last } = await open("a")
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(last()!.event).toEqual(a)
    expect(saveTournament).not.toHaveBeenCalled()
  })

  it("is left alone before the 6 hours are up", async () => {
    const a = own("a")
    await shareLive(a)
    vi.setSystemTime(5 * HOUR)
    const { last, close } = await open("a")
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(last()!.event).toEqual(a)
    close()
  })
})

describe("while the page is hidden", () => {
  it("stops listening", async () => {
    await open("a", true)
    hidePage(true)
    expect(listening()).toHaveLength(0)
  })

  it("listens again when the page comes back", async () => {
    await open("a", true)
    hidePage(true)
    hidePage(false)
    expect(listening().map((l) => l.id)).toEqual(["a"])
  })

  it("holds one connection per game, however often the page comes and goes", async () => {
    await open("a", true)
    for (let i = 0; i < 3; i++) {
      hidePage(true)
      hidePage(false)
    }
    expect(listening()).toHaveLength(1)
  })

  it("does not start listening for a game opened on a hidden page, until it is shown", async () => {
    fake.page.hidden = true
    await open("a", true)
    expect(listening()).toHaveLength(0)
    hidePage(false)
    expect(listening()).toHaveLength(1)
  })

  it("does not listen again once the screen has closed", async () => {
    const { close } = await open("a", true)
    close()
    hidePage(true)
    hidePage(false)
    expect(listening()).toHaveLength(0)
  })

  it("does not listen again once the finished game has arrived", async () => {
    await open("a", true)
    fake.listeners[0].next(copy(game("a", { finished: true })))
    hidePage(true)
    hidePage(false)
    expect(listening()).toHaveLength(0)
  })

  it("does not listen again once the organiser has deleted the game", async () => {
    await open("a", true)
    fake.listeners[0].next(deleted)
    hidePage(true)
    hidePage(false)
    expect(listening()).toHaveLength(0)
  })
})

// Every document written or deleted, by its path.
const written = () => vi.mocked(setDoc).mock.calls.map(([ref, data]) => [(ref as unknown as { path: string }).path, data])
const removed = () => vi.mocked(deleteDoc).mock.calls.map(([ref]) => (ref as unknown as { path: string }).path)

// Every mark put on, or taken off, a game online without sending the game.
const marked = () => vi.mocked(updateDoc).mock.calls.map(([ref, data]) => [(ref as unknown as { path: string }).path, data])

// The organiser has added an organiser: the game is live, with an organiser link.
async function scored(id: string, fields: Partial<SavedEvent> = {}) {
  const event = own(id, fields)
  await shareScoreLink(event)
  fake.online.set(id, { owner: "organiser", game: toOnline(event) })
  vi.clearAllMocks()
  return event
}

// A friend's game on this phone, opened from its score link before.
function scoring(id: string, fields: Partial<SavedEvent> = {}) {
  const event = game(id, { shared: true, ...fields })
  fake.saved.set(id, event)
  fake.flags.set(`score:${id}`, "k3y00000")
  // Its organiser is somebody else: this phone signs in as "organiser".
  fake.online.set(id, { owner: "a friend", game: toOnline(event) })
  return event
}

describe("adding a scorer", () => {
  it("puts the game online and returns the score link: the watch link, then a key of 8", async () => {
    const a = own("a")
    const link = await shareScoreLink(a)
    expect(link).toMatch(/^https:\/\/padel\.test\/t\/a\/[0-9a-z]{8}$/)
    expect(sent("a")).toEqual([{ owner: "organiser", game: toOnline(a) }])
    expect(isSending("a")).toBe(true)
  })

  it("stores the key online as the name of an empty document, where no friend can read it", async () => {
    const link = await shareScoreLink(own("a"))
    expect(written()).toContainEqual([`live/a/keys/${link.split("/").pop()}`, {}])
  })

  it("gives the same score link every time, and makes the key once", async () => {
    const a = own("a")
    const link = await shareScoreLink(a)
    expect(await shareScoreLink(a)).toBe(link)
    expect(written().filter(([path]) => String(path).startsWith("live/a/keys/"))).toHaveLength(1)
  })

  it("has no score link when the game could not be put online", async () => {
    vi.mocked(setDoc).mockRejectedValueOnce(new Error("refused"))
    await expect(shareScoreLink(own("a"))).rejects.toThrow()
    expect(scoreKey("a")).toBeNull()
  })

  it("does not send the phone's copy again once friends are scoring: theirs may be newer", async () => {
    const a = await scored("a")
    expect(await shareLive(a)).toBe("https://padel.test/t/a")
    await shareScoreLink(a)
    expect(sent("a")).toEqual([])
  })
})

describe("a game friends are scoring", () => {
  it("is changed online, and no longer sent whole after a save", async () => {
    const a = await scored("a")
    expect(changesOnline(a)).toBe(true)
    pushLive({ ...a, name: "renamed" })
    await settle()
    expect(sent("a")).toEqual([])
  })

  it("is not sent whole when the app starts either", async () => {
    await scored("a")
    resendLive()
    await settle()
    expect(sent("a")).toEqual([])
  })

  it("is still changed online while its broadcast is closed, and is only marked closed, never sent", async () => {
    const a = await scored("a")
    await shareLive(own("b"))
    await settle()
    expect(changesOnline(a)).toBe(true)
    expect(marked()).toEqual([["live/a", { closed: true }]])
    expect(sent("a")).toEqual([])
  })

  it("has the mark taken off when it goes live again, and is still not sent", async () => {
    const a = await scored("a")
    await shareLive(own("b"))
    await settle()
    vi.clearAllMocks()
    await shareLive(a)
    expect(marked()).toContainEqual(["live/a", { closed: "no such field" }])
    expect(sent("a")).toEqual([])
    expect(isSending("a")).toBe(true)
  })

  it("has only the field that changed sent: a friend's score, made meanwhile, is kept", async () => {
    const a = await scored("a")
    const online = game("a", { target: 21 } as Partial<SavedEvent>)
    fake.online.set("a", { owner: "organiser", game: toOnline(online) })
    await sendChange(a, { ...a, name: "renamed" })
    expect(marked()).toEqual([["live/a", { "game.name": "renamed" }]])
    expect(onlineGame("a")).toEqual(toOnline({ ...online, name: "renamed" }))
  })

  it("has a field that is gone taken away online: an undone point", async () => {
    const m = { ...match("m"), points: [0, 1] } as SavedEvent
    fake.flags.set("score:m", "k3y00000")
    fake.online.set("m", { owner: "a friend", game: toOnline(m) })
    await sendChange(m, { ...m, points: [0] } as SavedEvent)
    expect(marked()).toEqual([["live/m", { "game.points.1": "no such field" }]])
    expect(onlineGame("m")).toMatchObject({ points: { 0: 0 } })
  })

  it("has nothing sent when nothing changed", async () => {
    const a = await scored("a")
    await sendChange(a, { ...a })
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it("is not marked a friend's copy online when a friend's phone changes it", async () => {
    const a = scoring("a")
    await sendChange(a, { ...a, name: "renamed" })
    expect(onlineGame("a")).toEqual(toOnline(game("a", { name: "renamed" })))
  })

  it("fails the change when Firestore refuses it", async () => {
    const a = await scored("a")
    vi.mocked(updateDoc).mockRejectedValueOnce({ code: "permission-denied" })
    await expect(sendChange(a, { ...a, name: "renamed" })).rejects.toBeDefined()
  })

  it("stops being broadcast once the change that finishes it has gone through", async () => {
    const a = await scored("a")
    await sendChange(a, { ...a, finished: true })
    expect(isSending("a")).toBe(false)
    expect(hasLink("a")).toBe(true)
  })

  it("is still being broadcast when the change that finishes it is refused", async () => {
    const a = await scored("a")
    vi.mocked(updateDoc).mockRejectedValueOnce({ code: "permission-denied" })
    await sendChange(a, { ...a, finished: true }).catch(() => {})
    expect(isSending("a")).toBe(true)
  })
})

// LEGACY, remove after 2026-10-28.
describe("a game whose online copy is still one JSON string", () => {
  const oldCopy = (event: SavedEvent) => received({ json: JSON.stringify(event) })

  it("gets no organiser link from its organiser's phone", async () => {
    const a = await scored("a")
    await open("a")
    fake.listeners[0].next(oldCopy(a))
    expect(canAddOrganiser(a)).toBe(false)
  })

  it("gets none from an added organiser's phone either", async () => {
    const a = scoring("a")
    await open("a")
    fake.listeners[0].next(oldCopy(a))
    expect(canAddOrganiser(a)).toBe(false)
  })

  it("gets one again once its copy is the new fields", async () => {
    const a = await scored("a")
    await open("a")
    fake.listeners[0].next(oldCopy(a))
    fake.listeners[0].next(copy({ ...a, name: "rewritten" }))
    expect(canAddOrganiser(a)).toBe(true)
  })

  it("is rewritten as the new fields by its organiser's phone, once", async () => {
    const a = await scored("a")
    await open("a")
    fake.listeners[0].next(oldCopy({ ...a, name: "scored by a friend" }))
    fake.listeners[0].next(oldCopy({ ...a, name: "scored by a friend" }))
    expect(marked()).toEqual([["live/a", { game: toOnline({ ...a, name: "scored by a friend" }), json: "no such field" }]])
  })

  it("is not rewritten by an added organiser's phone: the rules let only its owner", async () => {
    const a = scoring("a")
    await open("a")
    fake.listeners[0].next(oldCopy(a))
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it("is not rewritten when it is the new fields already", async () => {
    const a = await scored("a")
    await open("a")
    fake.listeners[0].next(copy(a))
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it("does not stop a game made from it with Play again from getting one", async () => {
    const a = await scored("a")
    await open("a")
    fake.listeners[0].next(oldCopy(a))
    expect(canAddOrganiser(game("b"))).toBe(true)
  })
})

describe("the organiser's phone, while friends are scoring", () => {
  it("follows the online copy", async () => {
    await scored("a")
    await open("a")
    expect(listening()).toHaveLength(1)
  })

  it("does not follow a game with no score link: its own copy is the real one", async () => {
    await shareLive(own("a"))
    await open("a")
    expect(listening()).toHaveLength(0)
  })

  it("shows a friend's score as soon as it arrives, and keeps it on the phone", async () => {
    await scored("a")
    const { last } = await open("a")
    const theirs = game("a", { name: "scored by a friend" })
    fake.listeners[0].next(copy(theirs))
    await settle()
    expect(last()).toEqual({ event: theirs, live: true })
    expect(fake.saved.get("a")).toEqual(theirs)
  })

  it("takes the same copy again: after a change Firestore refused, that is what puts the phone back", async () => {
    const a = await scored("a")
    const { last } = await open("a")
    fake.listeners[0].next(copy(a))
    fake.saved.set("a", { ...a, name: "refused" })
    fake.listeners[0].next(copy(a))
    await settle()
    expect(fake.saved.get("a")).toEqual(a)
    expect(last()).toEqual({ event: a, live: true })
  })

  it("ignores what Firestore answers from memory with no connection", async () => {
    const a = await scored("a")
    const { last } = await open("a")
    fake.listeners[0].next({ ...copy(game("a", { name: "stale" })), metadata: { fromCache: true } })
    await settle()
    expect(last()!.event).toEqual(a)
  })

  it("keeps following when the game's broadcast closes in another tab: the online copy is still the real one", async () => {
    await scored("a")
    await open("a")
    fake.flags.set("live:a", "closed")
    fake.storageListeners.forEach((fn) => fn({ key: "live:a" }))
    expect(listening()).toHaveLength(1)
  })

  it("starts following when a scorer is added in another tab", async () => {
    await shareLive(own("a"))
    await open("a")
    fake.flags.set("score:a", "k3y00000")
    fake.storageListeners.forEach((fn) => fn({ key: "score:a" }))
    expect(listening()).toHaveLength(1)
  })

  it("stops following while the page is hidden", async () => {
    await scored("a")
    await open("a")
    hidePage(true)
    expect(listening()).toHaveLength(0)
    hidePage(false)
    expect(listening()).toHaveLength(1)
  })

  it("marks the game as over when it arrives finished", async () => {
    await scored("a")
    await open("a")
    fake.listeners[0].next(copy(game("a", { finished: true })))
    expect(isSending("a")).toBe(false)
  })

  it("does not mark it over for this phone's own finish before that has gone through", async () => {
    await scored("a")
    await open("a")
    const mine = copy(game("a", { finished: true }))
    fake.listeners[0].next({ ...mine, metadata: { fromCache: false, hasPendingWrites: true } })
    expect(isSending("a")).toBe(true)
  })
})

describe("a friend's game this phone is an organiser of", () => {
  it("has its watch link handed out without anything being sent, or this phone's own broadcast being touched", async () => {
    await shareLive(own("mine"))
    vi.clearAllMocks()
    expect(await shareLive(scoring("a"))).toBe("https://padel.test/t/a")
    expect(setDoc).not.toHaveBeenCalled()
    expect(updateDoc).not.toHaveBeenCalled()
    expect(isSending("mine")).toBe(true)
    expect(hasLink("a")).toBe(false)
  })

  it("has the same organiser link handed out, with the key this phone opened it with", async () => {
    expect(await shareScoreLink(scoring("a"))).toBe("https://padel.test/t/a/k3y00000")
    expect(setDoc).not.toHaveBeenCalled()
  })

  it("never asks about closing another broadcast: it is online already", async () => {
    await shareLive(own("mine"))
    expect(closesAnother(scoring("a"))).toBe(false)
  })
})

describe("opening a score link", () => {
  it("signs the phone up to score with the key from the link", async () => {
    await open("a", true, "k3y00000")
    expect(written()).toEqual([["live/a/scorers/organiser", { key: "k3y00000" }]])
    expect(scoreKey("a")).toBe("k3y00000")
  })

  it("shows the game again once it can be scored", async () => {
    vi.mocked(setDoc).mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 5)))
    const { shown } = await open("a", true, "k3y00000")
    fake.listeners[0].next(copy(game("a")))
    const before = shown.length
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(shown.length).toBe(before + 1)
  })

  it("leaves the friend watching when the key is wrong", async () => {
    vi.mocked(setDoc).mockRejectedValueOnce({ code: "permission-denied" })
    const { last } = await open("a", true, "wr0ngkey")
    fake.listeners[0].next(copy(game("a")))
    await settle()
    expect(scoreKey("a")).toBeNull()
    expect(last()).toEqual({ event: game("a", { shared: true }), live: true })
  })

  it("does not sign up twice", async () => {
    scoring("a")
    await open("a", true, "k3y00000")
    expect(setDoc).not.toHaveBeenCalled()
  })

  it("does not sign the organiser up on their own game", async () => {
    await scored("a")
    await open("a", true, "k3y00000")
    expect(setDoc).not.toHaveBeenCalled()
  })

  it("does not sign up from a watch link", async () => {
    await open("a", true)
    expect(setDoc).not.toHaveBeenCalled()
  })
})

describe("going live with another game while friends score the first", () => {
  it("leaves the first to its scorers instead of closing it", async () => {
    await scored("a")
    fake.scorers.set("a", ["friend"])
    await shareLive(own("b"))
    await settle()
    expect(marked()).toEqual([["live/a", { handover: true }]])
    expect(sent("a")).toEqual([])
  })

  it("turns the first into a friend's game on this phone, which can still score it", async () => {
    await scored("a")
    fake.scorers.set("a", ["friend"])
    const key = scoreKey("a")
    await shareLive(own("b"))
    await settle()
    expect(fake.saved.get("a")).toMatchObject({ shared: true })
    expect(hasLink("a")).toBe(false)
    expect(scoreKey("a")).toBe(key)
    expect(written()).toContainEqual(["live/a/scorers/organiser", { key }])
    expect(isSending("b")).toBe(true)
  })

  it("closes the first when no friend has opened its organiser link, with a mark and without sending it", async () => {
    await scored("a")
    await shareLive(own("b"))
    await settle()
    expect(marked()).toEqual([["live/a", { closed: true }]])
    expect(sent("a")).toEqual([])
    expect(fake.flags.get("live:a")).toBe("closed")
    expect(fake.saved.get("a")).not.toHaveProperty("shared")
  })

  it("closes the first when it can't be left to its other organisers", async () => {
    await scored("a")
    fake.scorers.set("a", ["friend"])
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error("no connection"))
    await shareLive(own("b"))
    await settle()
    expect(fake.flags.get("live:a")).toBe("closed")
    expect(sent("a")).toEqual([])
    expect(fake.saved.get("a")).not.toHaveProperty("shared")
  })

  it("closes the first when its other organisers can't be asked after", async () => {
    await scored("a")
    vi.mocked(getDocsFromServer).mockRejectedValueOnce(new Error("no connection"))
    await shareLive(own("b"))
    await settle()
    expect(fake.flags.get("live:a")).toBe("closed")
    expect(sent("a")).toEqual([])
  })

  it("shows the first as a friend's game on a screen of this phone that still has it open", async () => {
    await scored("a")
    fake.scorers.set("a", ["friend"])
    const { last } = await open("a")
    await shareLive(own("b"))
    await settle()
    await settle()
    expect(last()!.event).toMatchObject({ id: "a", shared: true })
  })

  it("no longer saves a friend's score as this phone's own game once the first is left to its scorers", async () => {
    await scored("a")
    fake.scorers.set("a", ["friend"])
    await open("a")
    const ownListener = fake.listeners[0]
    await shareLive(own("b"))
    await settle()
    ownListener.next(copy(game("a", { name: "scored by a friend" })))
    await settle()
    expect(fake.saved.get("a")).toMatchObject({ shared: true })
  })

  it("says beforehand whether the other game will pass to a scorer", async () => {
    await scored("a")
    expect(await passesOn(own("b"))).toBe(false)
    fake.scorers.set("a", ["friend"])
    expect(await passesOn(own("b"))).toBe(true)
  })

  it("passes nothing on when the other game has no score link", async () => {
    await shareLive(own("a"))
    fake.scorers.set("a", ["friend"])
    expect(await passesOn(own("b"))).toBe(false)
  })
})

describe("a friend's game left to its scorers", () => {
  const leftToScorers = (event: SavedEvent) => {
    const online = copy(event)
    return { ...online, get: (field: string) => (field === "handover" ? true : online.get(field)) }
  }
  const leave = (id: string) => fake.online.set(id, { ...fake.online.get(id), handover: true })

  it("is taken over by a phone that can score it", async () => {
    scoring("a")
    leave("a")
    await open("a")
    fake.listeners[0].next(leftToScorers(game("a")))
    await settle()
    // Its organiser was "a friend"; now it is this phone, and the mark is gone.
    expect(fake.online.get("a")).toEqual({ owner: "organiser", game: toOnline(game("a")) })
    expect(fake.saved.get("a")).not.toHaveProperty("shared")
    expect(isSending("a")).toBe(true)
  })

  it("is live again once taken over, when it was closed before it was left", async () => {
    scoring("a")
    fake.online.set("a", { ...fake.online.get("a"), handover: true, closed: true })
    await open("a")
    fake.listeners[0].next(leftToScorers(game("a")))
    await settle()
    expect(fake.online.get("a")).not.toHaveProperty("closed")
  })

  it("stays this phone's game when a friend's copy from before the takeover was saved over it", async () => {
    scoring("a")
    fake.flags.set("live:a", "1")
    const { last } = await open("a")
    await settle()
    expect(last()!.event).not.toHaveProperty("shared")
    expect(fake.saved.get("a")).not.toHaveProperty("shared")
  })

  it("becomes this phone's game in a tab that was following it, when another tab took it over", async () => {
    scoring("a")
    const { last } = await open("a")
    fake.flags.set("live:a", "1")
    fake.saved.set("a", game("a"))
    fake.otherTabs.forEach((changed) => changed("a"))
    await settle()
    await settle()
    expect(last()).toEqual({ event: game("a"), live: true })
  })

  it("is not saved as a friend's copy by a tab still following it after another tab took it over", async () => {
    scoring("a")
    await open("a")
    fake.flags.set("live:a", "1")
    fake.saved.set("a", game("a"))
    fake.listeners[0].next(copy(game("a", { name: "scored" })))
    await settle()
    expect(fake.saved.get("a")).not.toHaveProperty("shared")
  })

  it("is then shown as this phone's own game, live", async () => {
    scoring("a")
    leave("a")
    const { last } = await open("a")
    fake.listeners[0].next(leftToScorers(game("a")))
    await settle()
    await settle()
    expect(last()).toEqual({ event: game("a"), live: true })
  })

  it("is not taken by a phone that can only watch", async () => {
    fake.saved.set("a", game("a", { shared: true }))
    await open("a")
    fake.listeners[0].next(leftToScorers(game("a")))
    await settle()
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it("is not taken by a phone broadcasting a game of its own", async () => {
    await shareLive(own("mine"))
    scoring("a")
    await open("a")
    fake.listeners[0].next(leftToScorers(game("a")))
    await settle()
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it("stays a friend's game when another scorer took it first", async () => {
    scoring("a")
    // The mark is gone by the time this phone asks.
    const { last } = await open("a")
    fake.listeners[0].next(leftToScorers(game("a")))
    await settle()
    expect(fake.saved.get("a")).toMatchObject({ shared: true })
    expect(isSending("a")).toBe(false)
    expect(last()!.event).toMatchObject({ shared: true })
  })

  it("is not taken while its organiser still has it", async () => {
    scoring("a")
    await open("a")
    fake.listeners[0].next(copy(game("a")))
    await settle()
    expect(runTransaction).not.toHaveBeenCalled()
  })
})

describe("deleting a game with a score link", () => {
  it("takes its scorers and its key away before the game itself", async () => {
    await scored("a")
    const key = scoreKey("a")
    fake.scorers.set("a", ["friend", "other"])
    await deleteLive("a")
    expect(removed()).toEqual(["live/a/scorers/friend", "live/a/scorers/other", `live/a/keys/${key}`, "live/a"])
    expect(scoreKey("a")).toBeNull()
    expect(hasLink("a")).toBe(false)
  })

  it("only forgets the key when it is a friend's copy: the game stays online", async () => {
    scoring("a")
    await deleteLive("a")
    expect(deleteDoc).not.toHaveBeenCalled()
    expect(scoreKey("a")).toBeNull()
  })
})

describe("a score Firestore has not confirmed after 3 seconds", () => {
  // A send that waits until the test lets it through.
  const held = () => {
    let confirm = () => {}
    const waiting = new Promise<void>((resolve) => {
      confirm = resolve
    })
    return { waiting, confirm }
  }

  it("counts as sending slowly, until it is confirmed", async () => {
    const a = await scored("a")
    vi.useFakeTimers()
    const send = held()
    vi.mocked(updateDoc).mockReturnValueOnce(send.waiting)
    const change = sendChange(a, { ...a, name: "renamed" })
    await vi.advanceTimersByTimeAsync(2999)
    expect(sendingSlowly()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(sendingSlowly()).toBe(true)
    send.confirm()
    await change
    expect(sendingSlowly()).toBe(false)
  })

  it("restarts the connection by itself", async () => {
    const a = await scored("a")
    vi.useFakeTimers()
    const send = held()
    vi.mocked(updateDoc).mockReturnValueOnce(send.waiting)
    const change = sendChange(a, { ...a, name: "renamed" })
    await vi.advanceTimersByTimeAsync(3000)
    expect(disableNetwork).toHaveBeenCalledTimes(1)
    expect(enableNetwork).toHaveBeenCalledTimes(1)
    send.confirm()
    await change
  })

  it("restarts it once, however many scores are waiting behind it", async () => {
    const a = await scored("a")
    vi.useFakeTimers()
    const first = held()
    const second = held()
    vi.mocked(updateDoc).mockReturnValueOnce(first.waiting).mockReturnValueOnce(second.waiting)
    const changes = [sendChange(a, { ...a, name: "one" }), sendChange(a, { ...a, name: "two" })]
    await vi.advanceTimersByTimeAsync(10_000)
    expect(disableNetwork).toHaveBeenCalledTimes(1)
    first.confirm()
    await changes[0]
    expect(sendingSlowly()).toBe(true)
    second.confirm()
    await changes[1]
    expect(sendingSlowly()).toBe(false)
  })

  it("tells the Live badge when it turns slow, and when it is confirmed", async () => {
    const a = await scored("a")
    vi.useFakeTimers()
    const told = vi.fn()
    const stop = onSlowSend(told)
    const send = held()
    vi.mocked(updateDoc).mockReturnValueOnce(send.waiting)
    const change = sendChange(a, { ...a, name: "renamed" })
    await vi.advanceTimersByTimeAsync(3000)
    expect(told).toHaveBeenCalledTimes(1)
    send.confirm()
    await change
    expect(told).toHaveBeenCalledTimes(2)
    stop()
  })

  it("is the same for a plain broadcast, which sends the whole game", async () => {
    const a = own("a")
    await shareLive(a)
    vi.useFakeTimers()
    const send = held()
    vi.mocked(setDoc).mockReturnValueOnce(send.waiting)
    pushLive({ ...a, name: "renamed" })
    await vi.advanceTimersByTimeAsync(3000)
    expect(sendingSlowly()).toBe(true)
    expect(disableNetwork).toHaveBeenCalledTimes(1)
    send.confirm()
    await vi.advanceTimersByTimeAsync(0)
    expect(sendingSlowly()).toBe(false)
  })

  it("is never slow, and restarts nothing, when it is confirmed in time", async () => {
    const a = await scored("a")
    vi.useFakeTimers()
    await sendChange(a, { ...a, name: "renamed" })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sendingSlowly()).toBe(false)
    expect(disableNetwork).not.toHaveBeenCalled()
  })
})

describe("restarting the connection", () => {
  it("drops it and opens a new one", async () => {
    await restartConnection()
    expect(disableNetwork).toHaveBeenCalledTimes(1)
    expect(enableNetwork).toHaveBeenCalledTimes(1)
  })

  it("happens once when asked for twice at the same moment", async () => {
    await Promise.all([restartConnection(), restartConnection()])
    expect(disableNetwork).toHaveBeenCalledTimes(1)
  })

  it("still opens a new one when the old could not be dropped", async () => {
    vi.mocked(disableNetwork).mockRejectedValueOnce(new Error("already down"))
    await restartConnection()
    expect(enableNetwork).toHaveBeenCalledTimes(1)
  })

  it("happens when the page of a broadcast game comes back to the front", async () => {
    await shareLive(own("a"))
    await open("a")
    hidePage(true)
    expect(disableNetwork).not.toHaveBeenCalled()
    hidePage(false)
    expect(disableNetwork).toHaveBeenCalledTimes(1)
  })

  it("happens when the page of a friend's game comes back to the front", async () => {
    await open("a", true)
    hidePage(true)
    hidePage(false)
    expect(disableNetwork).toHaveBeenCalledTimes(1)
  })

  it("does not happen for a game that was never broadcast: it has no connection", async () => {
    own("a")
    await open("a")
    hidePage(true)
    hidePage(false)
    expect(disableNetwork).not.toHaveBeenCalled()
  })

  it("does not happen just because a game is opened", async () => {
    await shareLive(own("a"))
    await open("a")
    await open("b", true)
    expect(disableNetwork).not.toHaveBeenCalled()
  })
})
