import { useCenterFocusedField } from "@/components/center-focused-field"
import { LegalScreen } from "@/components/legal-screen"
import { MatchScreen } from "@/components/match-screen"
import { NewGameScreen } from "@/components/new-game-screen"
import { StackNavigator } from "@/components/stack-navigator"
import { TournamentListScreen } from "@/components/tournament-list-screen"
import { TournamentScreen } from "@/components/tournament-screen"
import { legalPageAt, legalPath, type LegalPage } from "@/lib/paths"
import type { PreviousMatchSetup } from "@/lib/set-match-setup"
import type { PreviousSetup } from "@/lib/tournament"

export type Route =
  | { name: "home" }
  | { name: "new"; from?: PreviousSetup; fromMatch?: PreviousMatchSetup }
  | { name: "tournament"; id: string }
  | { name: "match"; id: string }
  | { name: "legal"; page: LegalPage }

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
  }
}

// Only the legal pages have an address of their own, so they can be linked.
function pathOf(route: Route): string {
  return route.name === "legal" ? legalPath(route.page) : "/"
}

function routeAt(pathname: string): Route | null {
  const page = legalPageAt(pathname)
  return page ? { name: "legal", page } : null
}

export default function App() {
  useCenterFocusedField()
  return <StackNavigator initial={HOME} render={render} pathOf={pathOf} routeAt={routeAt} />
}
