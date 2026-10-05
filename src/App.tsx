import { useCenterFocusedField } from "@/components/center-focused-field"
import { LegalScreen } from "@/components/legal-screen"
import { MatchScreen } from "@/components/match-screen"
import { NotFoundScreen } from "@/components/not-found-screen"
import { NewGameScreen } from "@/components/new-game-screen"
import { StackNavigator } from "@/components/stack-navigator"
import { TournamentListScreen } from "@/components/tournament-list-screen"
import { TournamentScreen } from "@/components/tournament-screen"
import { isHomePath, legalPageAt, legalPath, type LegalPage } from "@/lib/paths"
import type { PreviousMatchSetup } from "@/lib/set-match-setup"
import type { PreviousSetup } from "@/lib/tournament"

export type Route =
  | { name: "home" }
  | { name: "new"; from?: PreviousSetup; fromMatch?: PreviousMatchSetup }
  | { name: "tournament"; id: string }
  | { name: "match"; id: string }
  | { name: "legal"; page: LegalPage }
  | { name: "notFound"; path: string } // the address that was asked for

const HOME: Route = { name: "home" }

function render(route: Route) {
  switch (route.name) {
    case "home":
      return <TournamentListScreen />
    case "new":
      return <NewGameScreen from={route.from} fromMatch={route.fromMatch} />
    case "tournament":
      return <TournamentScreen id={route.id} />
    case "match":
      return <MatchScreen id={route.id} />
    case "legal":
      return <LegalScreen page={route.page} />
    case "notFound":
      return <NotFoundScreen />
  }
}

// Only the legal pages have an address of their own, so they can be linked.
// A wrong address keeps showing in the bar while its 404 screen is up.
function pathOf(route: Route): string {
  if (route.name === "legal") return legalPath(route.page)
  return route.name === "notFound" ? route.path : "/"
}

// The host serves the app for every address, so the app is what says an
// address does not exist.
function routeAt(pathname: string): Route | null {
  const page = legalPageAt(pathname)
  if (page) return { name: "legal", page }
  return isHomePath(pathname) ? null : { name: "notFound", path: pathname }
}

export default function App() {
  useCenterFocusedField()
  return <StackNavigator initial={HOME} render={render} pathOf={pathOf} routeAt={routeAt} />
}
