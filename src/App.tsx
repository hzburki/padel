import { useCenterFocusedField } from "@/components/center-focused-field"
import { NewTournamentScreen } from "@/components/new-tournament-screen"
import { StackNavigator } from "@/components/stack-navigator"
import { TournamentListScreen } from "@/components/tournament-list-screen"
import { TournamentScreen } from "@/components/tournament-screen"

export type Route = { name: "home" } | { name: "new" } | { name: "tournament"; id: string }

const HOME: Route = { name: "home" }

function render(route: Route) {
  switch (route.name) {
    case "home":
      return <TournamentListScreen />
    case "new":
      return <NewTournamentScreen />
    case "tournament":
      return <TournamentScreen id={route.id} />
  }
}

export default function App() {
  useCenterFocusedField()
  return <StackNavigator initial={HOME} render={render} />
}
