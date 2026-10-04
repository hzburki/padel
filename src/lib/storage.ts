import type { Tournament } from "./types"

export const CURRENT_VERSION = 1

// Bring a tournament read from storage up to the current shape. Each future
// version adds one step here (v1 → v2, v2 → v3, …) so old saves keep loading.
export function migrate(raw: unknown): Tournament {
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
  return raw as Tournament
}

// IndexedDB: one database, one store of tournaments keyed by id. Every write
// is a whole tournament — they are small, and it keeps saves atomic.
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

export async function saveTournament(tournament: Tournament): Promise<void> {
  await run("readwrite", (store) => store.put(tournament))
}

export async function loadTournament(id: string): Promise<Tournament | null> {
  const raw = await run("readonly", (store) => store.get(id))
  return raw === undefined ? null : migrate(raw)
}

// Newest first. Saves that can't be migrated are skipped rather than
// breaking the whole list.
export async function listTournaments(): Promise<Tournament[]> {
  const all = await run("readonly", (store) => store.getAll())
  const tournaments: Tournament[] = []
  for (const raw of all) {
    try {
      tournaments.push(migrate(raw))
    } catch {
      // left in storage untouched; a later app version may be able to read it
    }
  }
  return tournaments.sort((x, y) => y.createdAt - x.createdAt)
}

export async function deleteTournament(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id))
}

// Ask the browser not to evict our data under storage pressure. Safari in
// particular may otherwise clear a site's storage after a period of disuse.
export async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false
}
