import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"

// How points are evened out when players played fewer games, with a worked
// example. It only applies once the tournament is finished.
export function ScalingSheet({ open, onClose, finished }: { open: boolean; onClose: () => void; finished: boolean }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <p className="text-2xl type-display">Fewer games played</p>
      <p className="mt-1 text-muted-foreground">Points are scaled up to the most games anyone played.</p>
      {/* A worked example, set out like one in a textbook. */}
      <div className="mt-4 overflow-hidden rounded-3xl border-[1.5px] bg-card">
        <p className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          Example: 12 points in 4 games, others played 5
        </p>
        <dl className="divide-y">
          {(
            [
              ["12 ÷ 4", "3", "points a game"],
              ["3 × 5", "15", "points that count"],
            ] as const
          ).map(([sum, result, unit]) => (
            <div key={sum} className="flex items-baseline gap-2 px-4 py-3">
              <dt className="text-[1.75rem] text-muted-foreground type-display">{sum} =</dt>
              <dd className="text-[1.75rem] type-display">{result}</dd>
              <dd className="ml-auto text-sm text-muted-foreground">{unit}</dd>
            </div>
          ))}
        </dl>
      </div>
      {!finished && (
        <p className="mt-3 text-sm text-muted-foreground">Only once the tournament is finished.</p>
      )}
      <Button size="lg" className="mt-5" onClick={onClose}>
        Got it
      </Button>
    </Sheet>
  )
}
