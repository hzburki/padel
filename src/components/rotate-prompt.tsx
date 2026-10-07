import { Smartphone } from "lucide-react"
import { useSyncExternalStore } from "react"
import { shouldAskToRotate } from "@/lib/rotate"

// Older browsers have no screen.orientation; they never see the prompt.
const orientation: ScreenOrientation | undefined = screen.orientation

function onTurn(changed: () => void) {
  orientation?.addEventListener("change", changed)
  return () => orientation?.removeEventListener("change", changed)
}

// Covers the app while a phone is on its side, where there is no room for
// it, and goes away by itself once the phone is upright again.
export function RotatePrompt() {
  const ask = useSyncExternalStore(onTurn, () => shouldAskToRotate(orientation?.type, screen))
  if (!ask) return null
  return (
    <div role="alert" className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-primary text-primary-foreground">
      {/* Drawn on its side, then turned upright, over and over. */}
      <Smartphone className="size-14 animate-[turn-upright_2.4s_ease-in-out_infinite] motion-reduce:animate-none" aria-hidden />
      <p className="text-2xl type-display">Turn your phone upright</p>
    </div>
  )
}
