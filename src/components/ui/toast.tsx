import { Check, TriangleAlert } from "lucide-react"
import { useEffect } from "react"

// What a toast says, and whether it reports something that did not work.
export type ToastMessage = { text: string; failed?: boolean }

// A short notice at the bottom centre that goes away on its own. Taps pass
// through it, so the score buttons under it still work.
export function Toast({ message, onDone }: { message: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDone, 2500)
    return () => clearTimeout(timer)
  }, [message, onDone])

  if (!message) return null
  const Icon = message.failed ? TriangleAlert : Check
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-50 flex justify-center px-4"
    >
      <span className="flex animate-in items-center gap-2.5 rounded-full bg-foreground px-5 py-3.5 text-base font-semibold text-background shadow-lg fade-in slide-in-from-bottom-2">
        <Icon className="size-5 shrink-0 text-accent" strokeWidth={3} aria-hidden />
        {message.text}
      </span>
    </div>
  )
}
