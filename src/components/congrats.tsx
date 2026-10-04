import { Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import { joinNames } from "@/lib/standings"

// Shown once, right after a tournament is finished.
export function Congrats({
  winnerNames,
  onShare,
  canShare,
  onClose,
}: {
  winnerNames: string[] // more than one on a shared first place
  onShare: () => void
  canShare: boolean // the share image is ready
  onClose: () => void
}) {
  const names = joinNames(winnerNames)
  const owe = winnerNames.length > 1 ? "owe" : "owes"

  return (
    <div className="relative overflow-hidden text-center">
      <Confetti />
      <div className="relative z-10 pt-4">
        <div className="text-6xl" aria-hidden>
          🏆
        </div>
        {winnerNames.length === 0 ? (
          <p className="mt-3 text-2xl font-bold">Tournament finished</p>
        ) : (
          <>
            <p className="mt-3 text-2xl font-bold">Congrats, {names}!</p>
            <p className="mx-auto mt-2 max-w-72 text-lg text-muted-foreground">
              {names} {owe} everyone a treat 😄
            </p>
          </>
        )}
      </div>
      <Button variant="ball" size="lg" className="relative z-10 mt-6" disabled={!canShare} onClick={onShare}>
        <Share className="size-5" />
        Share results
      </Button>
      <Button variant="ghost" className="relative z-10 mt-1 h-12 w-full text-base font-semibold" onClick={onClose}>
        Close
      </Button>
    </div>
  )
}

// One burst of court-coloured pieces falling behind the message.
const COLOURS = ["#dceb3a", "#1d4f91", "#7fa6d8", "#dceb3a"]

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => {
        const left = (i * 37) % 100
        const delay = (i % 7) * 70
        const size = 6 + (i % 3) * 3
        return (
          <span
            key={i}
            className="confetti-piece absolute top-0 rounded-[2px]"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 1.6,
              background: COLOURS[i % COLOURS.length],
              animationDelay: `${delay}ms`,
              ["--drift" as string]: `${((i % 5) - 2) * 18}px`,
              ["--spin" as string]: `${(i % 2 ? 1 : -1) * (240 + (i % 4) * 90)}deg`,
            }}
          />
        )
      })}
    </div>
  )
}
