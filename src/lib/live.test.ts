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

  type Listener = { id: string; next: (snapshot: unknown) => void; fail: () => void; open: boolean }
  return {
    flags,
    page,
    pageListeners,
    saved: new Map<string, unknown>(), // the games on this phone
    listeners: [] as Listener[], // every Firestore listener ever opened
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
  doc: (_db: unknown, _collection: string, id: string) => ({ id }),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((ref: { id: string }, _options: unknown, next: (snapshot: unknown) => void, fail: () => void) => {
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
}))

import { deleteDoc, setDoc } from "firebase/firestore"
import { closesAnother, deleteLive, finishDeletes, hasLink, isSending, openGame, pushLive, shareLive } from "./live"
import { saveTournament } from "./storage"

// Only the fields live.ts reads.
const game = (id: string, fields: Partial<SavedEvent> = {}) =>
  ({ id, kind: "americano", name: id, createdAt: 0, finished: false, ...fields }) as SavedEvent

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
    .mock.calls.filter(([ref]) => (ref as unknown as { id: string }).id === id)
    .map(([, data]) => data as { owner: string; json: string; closed?: true })

// The online copy as a friend's phone receives it.
const copy = (event: SavedEvent, closed = false) => ({
  exists: () => true,
  metadata: { fromCache: false },
  get: (field: string) => (field === "json" ? JSON.stringify(event) : field === "closed" && closed ? true : undefined),
})
const deleted = { exists: () => false, metadata: { fromCache: false }, get: () => undefined }
// What Firestore answers with no connection: it has no copy of its own.
const noConnection = { ...deleted, metadata: { fromCache: true } }

const listening = () => fake.listeners.filter((l) => l.open)
const hidePage = (hidden: boolean) => {
  fake.page.hidden = hidden
  fake.pageListeners.forEach((fn) => fn())
}

// Open a game the way a screen does, and collect what the screen is told.
async function open(id: string, fromLink = false) {
  const shown: { event: SavedEvent | null; live: boolean }[] = []
  const close = openGame(id, fromLink, (event, live) => shown.push({ event, live }))
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
  fake.listeners.length = 0
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
    expect(sent("a")).toEqual([{ owner: "organiser", json: JSON.stringify(a) }])
    expect(isSending("a")).toBe(true)
  })

  it("returns the link friends open: the site, then /t/<id> or /m/<id>", async () => {
    expect(await shareLive(own("a"))).toBe("https://padel.test/t/a")
    expect(await shareLive(own("b", { kind: "match" } as Partial<SavedEvent>))).toBe(
      "https://padel.test/m/b",
    )
  })

  it("sends the game again after every save", async () => {
    await shareLive(own("a"))
    pushLive(game("a", { name: "renamed" }))
    await settle()
    expect(sent("a")).toHaveLength(2)
    expect(JSON.parse(sent("a")[1].json).name).toBe("renamed")
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
    expect(sent("a")[1]).toEqual({ owner: "organiser", json: JSON.stringify(a), closed: true })
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
    expect(JSON.parse(sent("a")[2].json).finished).toBe(true)
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
    expect(JSON.parse(sent("a")[2].json).finished).toBe(true)
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

  it("finishes a copy whose game was deleted while this phone was away, even 4 hours on", async () => {
    own("a", { shared: true })
    vi.setSystemTime(5 * HOUR)
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
    fake.listeners[0].next({ ...copy(game("a")), get: () => "not a game" })
    expect(last()).toEqual({ event: saved, live: false })
    expect(saveTournament).not.toHaveBeenCalled()
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

describe("a friend's game that is 4 hours old", () => {
  it("stops being followed the moment it turns 4 hours old, and is no longer live", async () => {
    const { last } = await open("a", true)
    vi.useFakeTimers({ now: HOUR })
    fake.listeners[0].next(copy(game("a")))
    expect(last().live).toBe(true)
    vi.advanceTimersByTime(3 * HOUR - 1)
    expect(listening()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(listening()).toHaveLength(0)
    expect(last()).toEqual({ event: { ...game("a"), shared: true }, live: false })
  })

  it("has its newest score read once when opened from a link, then is let go", async () => {
    vi.setSystemTime(5 * HOUR)
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a", { name: "newest" })))
    expect(saveTournament).toHaveBeenCalledWith({ ...game("a", { name: "newest" }), shared: true })
    expect(last()).toEqual({ event: { ...game("a", { name: "newest" }), shared: true }, live: false })
    expect(listening()).toHaveLength(0)
  })

  it("brings the result to a saved copy that never saw the game finish", async () => {
    own("a", { shared: true })
    vi.setSystemTime(5 * HOUR)
    const { last } = await open("a")
    fake.listeners[0].next(copy(game("a", { finished: true })))
    expect(last().event?.finished).toBe(true)
    expect(listening()).toHaveLength(0)
  })

  it("is not live even while the organiser is still broadcasting it", async () => {
    vi.setSystemTime(5 * HOUR)
    const { last } = await open("a", true)
    fake.listeners[0].next(copy(game("a")))
    expect(last().live).toBe(false)
  })

  it("is not listened to again when the page comes back", async () => {
    vi.setSystemTime(5 * HOUR)
    await open("a", true)
    fake.listeners[0].next(copy(game("a")))
    hidePage(true)
    hidePage(false)
    expect(listening()).toHaveLength(0)
  })

  it("tells a screen that has closed nothing when the 4 hours run out", async () => {
    const { close, shown } = await open("a", true)
    vi.useFakeTimers({ now: HOUR })
    fake.listeners[0].next(copy(game("a")))
    close()
    const told = shown.length
    vi.advanceTimersByTime(10 * HOUR)
    expect(shown).toHaveLength(told)
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
