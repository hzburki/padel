import type { SavedEvent } from "./types"

export const CURRENT_VERSION = 2

// Bring a tournament or match read from storage up to the current shape.
// Each version adds one step here (v1 → v2, v2 → v3, …) so old saves keep
// loading.
export function migrate(raw: unknown): SavedEvent {
  if (typeof raw !== "object" || raw === null || !("version" in raw)) {
    throw new Error("Not a saved tournament")
  }
  const { version } = raw as { version: unknown }
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error(`Unknown tournament version: ${String(version)}`)
  }
  if (version > CURRENT_VERSION) {
    throw new Error(`Tournament was saved by a newer version of the app (v${version})`)
  }
  // v1 → v2: matches arrived, so every record now says what kind it is.
  // Everything saved before that was an Americano tournament.
  const record = version === 1 ? { ...raw, version: 2, kind: "americano" } : raw

  const { kind } = record as { kind?: unknown }
  if (kind !== "americano" && kind !== "match") {
    throw new Error(`Unknown kind of saved event: ${String(kind)}`)
  }
  // Matches saved before "first to" existed were all chosen as a best of,
  // and those saved before scoring by games were all scored point by point.
  // Filled in here rather than with a version bump: no match scored by games
  // was saved before this, so there is nothing an older build could misread.
  if (kind === "match") return { setsAs: "bestOf", scoreBy: "points", ...record } as SavedEvent
  return record as SavedEvent
}

// IndexedDB: one database, one store keyed by id. It is named for
// tournaments but holds matches too. Every write is a whole record — they
// are small, and it keeps saves atomic.
const DB_NAME = "padel"
const STORE = "tournaments"

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = op(tx.objectStore(STORE))
    // Resolve on commit, not on request success, so a save is on disk before
    // the caller moves on.
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function saveTournament(event: SavedEvent): Promise<void> {
  await run("readwrite", (store) => store.put(event))
}

export async function loadTournament(id: string): Promise<SavedEvent | null> {
  const raw = await run("readonly", (store) => store.get(id))
  return raw === undefined ? null : migrate(raw)
}

// Newest first. Saves that can't be migrated are skipped rather than
// breaking the whole list.
export async function listTournaments(): Promise<SavedEvent[]> {
  const all = await run("readonly", (store) => store.getAll())
  const events: SavedEvent[] = []
  for (const raw of all) {
    try {
      events.push(migrate(raw))
    } catch {
      // left in storage untouched; a later app version may be able to read it
    }
  }
  return events.sort((x, y) => y.createdAt - x.createdAt)
}

export async function deleteTournament(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id))
}

// Ask the browser not to evict our data under storage pressure. Safari in
// particular may otherwise clear a site's storage after a period of disuse.
// Best effort: never throws (it's missing on plain-http pages).
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
