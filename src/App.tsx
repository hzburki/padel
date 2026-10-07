import { useCenterFocusedField } from "@/components/center-focused-field"
import { LegalScreen } from "@/components/legal-screen"
import { MatchScreen } from "@/components/match-screen"
import { NotFoundScreen } from "@/components/not-found-screen"
import { NewGameScreen } from "@/components/new-game-screen"
import { RotatePrompt } from "@/components/rotate-prompt"
import { StackNavigator } from "@/components/stack-navigator"
import { TournamentListScreen } from "@/components/tournament-list-screen"
import { TournamentScreen } from "@/components/tournament-screen"
import { isHomePath, legalPageAt, legalPath, liveAt, livePath, type LegalPage } from "@/lib/paths"
import type { PreviousMatchSetup } from "@/lib/set-match-setup"
import type { PreviousSetup } from "@/lib/tournament"

export type Route =
  | { name: "home" }
  | { name: "new"; from?: PreviousSetup; fromMatch?: PreviousMatchSetup }
  // watch: opened from a shared link — read-only, following the live copy.
  | { name: "tournament"; id: string; watch?: boolean }
  | { name: "match"; id: string; watch?: boolean }
  | { name: "legal"; page: LegalPage }
  // path: the address that was asked for. message: what went wrong, when
  // it is more than a mistyped address.
  | { name: "notFound"; path: string; message?: string }

const HOME: Route = { name: "home" }

function render(route: Route) {
  switch (route.name) {
    case "home":
      return <TournamentListScreen />
    case "new":
      return <NewGameScreen from={route.from} fromMatch={route.fromMatch} />
    case "tournament":
      return <TournamentScreen id={route.id} watch={route.watch} />
    case "match":
      return <MatchScreen id={route.id} watch={route.watch} />
    case "legal":
      return <LegalScreen page={route.page} />
    case "notFound":
      return <NotFoundScreen message={route.message} />
  }
}

// Only the legal pages and shared games have an address of their own, so
// they can be linked.
// A wrong address keeps showing in the bar while its 404 screen is up.
function pathOf(route: Route): string {
  if (route.name === "legal") return legalPath(route.page)
  if (route.name === "tournament" && route.watch) return livePath("americano", route.id)
  if (route.name === "match" && route.watch) return livePath("match", route.id)
  return route.name === "notFound" ? route.path : "/"
}

// The host serves the app for every address, so the app is what says an
// address does not exist.
function routeAt(pathname: string): Route | null {
  const page = legalPageAt(pathname)
  if (page) return { name: "legal", page }
  const live = liveAt(pathname)
  if (live) return { name: live.kind === "match" ? "match" : "tournament", id: live.id, watch: true }
  return isHomePath(pathname) ? null : { name: "notFound", path: pathname }
}

export default function App() {
  useCenterFocusedField()
  return (
    <>
      <StackNavigator initial={HOME} render={render} pathOf={pathOf} routeAt={routeAt} />
      <RotatePrompt />
    </>
  )
}
