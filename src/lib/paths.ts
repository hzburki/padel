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
