// The two pages with an address of their own. Every other screen lives at "/".
export type LegalPage = "privacy" | "terms"

export function legalPath(page: LegalPage): string {
  return `/${page}`
}

// Whether an address is the app's front door. Anything else that is not a
// legal page is an address the app does not have.
export function isHomePath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "").toLowerCase()
  return path === "" || path === "/index.html"
}

// The page an address opens, or null when it is not one of them.
export function legalPageAt(pathname: string): LegalPage | null {
  const path = pathname.replace(/\/+$/, "").toLowerCase()
  if (path === "/privacy") return "privacy"
  if (path === "/terms") return "terms"
  return null
}

// The address friends open to watch a shared game: /t/<id> for a
// tournament, /m/<id> for a match. Kept short: it is pasted into chats.
export function livePath(kind: "americano" | "match", id: string): string {
  return `/${kind === "match" ? "m" : "t"}/${id}`
}

// The address that also lets a friend score: the watch address, then the
// game's score key.
export function scorePath(kind: "americano" | "match", id: string, key: string): string {
  return `${livePath(kind, id)}/${key}`
}

// The shared game an address points at, or null when it is not a live link.
// `key` is there when the address is one for scoring.
// Links sent before they were shortened start with /live and still open.
export function liveAt(pathname: string): { kind: "americano" | "match"; id: string; key?: string } | null {
  const found = /^(?:\/live)?\/([tm])\/([0-9a-z]+)(?:\/([0-9a-z]+))?\/*$/.exec(pathname)
  return found && { kind: found[1] === "m" ? "match" : "americano", id: found[2], ...(found[3] && { key: found[3] }) }
}
