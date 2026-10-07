import { useEffect } from "react"

// A short notice at the bottom centre that goes away on its own. Taps pass
// through it, so the score buttons under it still work.
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDone, 2500)
    return () => clearTimeout(timer)
  }, [message, onDone])

  if (!message) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-50 flex justify-center px-4"
    >
      <span className="animate-in fade-in slide-in-from-bottom-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
        {message}
      </span>
    </div>
  )
}
