import { useCenterFocusedField } from "@/components/center-focused-field"
import { LegalScreen } from "@/components/legal-screen"
import { NewTournamentScreen } from "@/components/new-tournament-screen"
import { StackNavigator } from "@/components/stack-navigator"
import { TournamentListScreen } from "@/components/tournament-list-screen"
import { TournamentScreen } from "@/components/tournament-screen"
import type { ScoringMode } from "@/lib/types"

export type Route =
  | { name: "home" }
  | { name: "new"; from?: PreviousSetup }
  | { name: "tournament"; id: string }
  | { name: "legal"; page: "privacy" | "terms" }

// A finished tournament's people and settings, to start the next one from.
export interface PreviousSetup {
  playerNames: string[]
  courts: number
  target: number
  scoringMode: ScoringMode
}

const HOME: Route = { name: "home" }

function render(route: Route) {
  switch (route.name) {
    case "home":
      return <TournamentListScreen />
    case "new":
      return <NewTournamentScreen from={route.from} />
    case "tournament":
      return <TournamentScreen id={route.id} />
    case "legal":
      return <LegalScreen page={route.page} />
  }
}

export default function App() {
  useCenterFocusedField()
  return <StackNavigator initial={HOME} render={render} />
}
