import { Podium } from "lucide-react"
import { useState, type ComponentType, type SVGProps } from "react"
import type { PreviousMatchSetup } from "@/lib/set-match-setup"
import type { PreviousSetup } from "@/lib/tournament"
import type { SavedEvent } from "@/lib/types"
import { CourtIcon } from "./court-icon"
import { NewMatchScreen } from "./new-match-screen"
import { NewTournamentScreen } from "./new-tournament-screen"

type Kind = SavedEvent["kind"]

// Setup for either kind of game. The two cards at the top pick which form
// shows below them.
export function NewGameScreen({ from, fromMatch }: { from?: PreviousSetup; fromMatch?: PreviousMatchSetup }) {
  const [kind, setKind] = useState<Kind>(fromMatch ? "match" : "americano")
  const picker = (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <KindCard
        icon={Podium}
        name="Americano"
        about="4 or more players, partners rotate"
        chosen={kind === "americano"}
        onChoose={() => setKind("americano")}
      />
      <KindCard
        icon={CourtIcon}
        name="Match"
        about="2 v 2, games and sets"
        chosen={kind === "match"}
        onChoose={() => setKind("match")}
      />
    </div>
  )

  // Both forms stay mounted, so names typed into one survive a look at the
  // other.
  return (
    <>
      <div className="h-full" hidden={kind !== "americano"}>
        <NewTournamentScreen from={from} top={picker} active={kind === "americano"} />
      </div>
      <div className="h-full" hidden={kind !== "match"}>
        <NewMatchScreen from={fromMatch} top={picker} active={kind === "match"} />
      </div>
    </>
  )
}

function KindCard({
  icon: Icon,
  name,
  about,
  chosen,
  onChoose,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  name: string
  about: string
  chosen: boolean
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onChoose}
      className={`flex flex-col items-start rounded-3xl p-4 text-left transition-colors active:scale-[0.98] ${
        chosen ? "bg-primary text-primary-foreground" : "bg-card shadow-[inset_0_0_0_1.5px_var(--border)]"
      }`}
    >
      <span
        className={`flex size-11 items-center justify-center rounded-2xl ${
          chosen ? "bg-accent text-accent-foreground" : "bg-secondary text-primary"
        }`}
      >
        <Icon className="size-6" strokeWidth={2.5} aria-hidden />
      </span>
      <span className="mt-3 block text-[1.375rem] type-display">{name}</span>
      <span className={`mt-1 block text-sm leading-snug ${chosen ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
        {about}
      </span>
    </button>
  )
}
