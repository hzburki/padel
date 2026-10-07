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
  onSnapshot: vi.fn((ref: { id: string }, next: (snapshot: unknown) => void, fail: () => void) => {
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
import { closesAnother, deleteLive, hasLink, isSending, openGame, pushLive, shareLive } from "./live"
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
  get: (field: string) => (field === "json" ? JSON.stringify(event) : field === "closed" && closed ? true : undefined),
})
const deleted = { get: () => undefined }

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

beforeEach(() => {
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

  it("returns the link friends open: the site, then /live/t/<id> or /live/m/<id>", async () => {
    expect(await shareLive(own("a"))).toBe("https://padel.test/live/t/a")
    expect(await shareLive(own("b", { kind: "match", finished: true } as Partial<SavedEvent>))).toBe(
      "https://padel.test/live/m/b",
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

  it("puts a finished game's result online without calling it live", async () => {
    await shareLive(own("a", { finished: true }))
    expect(sent("a")).toHaveLength(1)
    expect(isSending("a")).toBe(false)
    expect(hasLink("a")).toBe(true)
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

  it("does not ask for a finished game's link", async () => {
    await shareLive(own("a"))
    expect(closesAnother(own("b", { finished: true }))).toBe(false)
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

  it("closes nothing when a finished game's result is put online", async () => {
    await shareLive(own("a"))
    await shareLive(own("b", { finished: true }))
    expect(isSending("a")).toBe(true)
  })

  it("keeps the old broadcast when the new game can't be put online", async () => {
    await shareLive(own("a"))
    vi.mocked(setDoc).mockRejectedValueOnce(new Error("offline"))
    await expect(shareLive(own("b"))).rejects.toThrow("offline")
    expect(isSending("a")).toBe(true)
    expect(hasLink("b")).toBe(false)
  })

  it("still switches when only the closing can't be sent", async () => {
    await shareLive(own("a"))
    vi.mocked(setDoc).mockResolvedValueOnce().mockRejectedValueOnce(new Error("offline"))
    await expect(shareLive(own("b"))).resolves.toBe("https://padel.test/live/t/b")
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

  it("keeps the saved copy and stops listening when the organiser deletes the game", async () => {
    const saved = own("a", { shared: true })
    const { last } = await open("a")
    fake.listeners[0].next(deleted)
    expect(last()).toEqual({ event: saved, live: false })
    expect(listening()).toHaveLength(0)
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
