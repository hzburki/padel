import { useEffect, useRef, useState, type ReactNode } from "react"
import { useBackHandler } from "./stack-navigator"

const DURATION = 300
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"

// A panel that slides up from the bottom, in thumb reach. Close by tapping
// the dimmed backdrop, dragging the panel down, or going back.
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const panel = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)

  // Any back action (Android back, swipe, Esc, …) closes the sheet first.
  useBackHandler(open, onClose)

  // Mount as soon as it opens; unmount only after the slide-out finishes.
  if (open && !mounted) setMounted(true)

  // Slide in once mounted; slide out before unmounting.
  useEffect(() => {
    const p = panel.current
    const b = backdrop.current
    if (!mounted || !p || !b) return
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : DURATION
    const opts = { duration: ms, easing: EASE, fill: "forwards" as const }
    if (open) {
      p.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], opts)
      b.animate([{ opacity: 0 }, { opacity: 1 }], opts)
    } else {
      const from = p.style.transform || "translateY(0)"
      p.animate([{ transform: from }, { transform: "translateY(100%)" }], opts)
      b.animate([{ opacity: 1 }, { opacity: 0 }], opts).finished.then(() => setMounted(false))
    }
  }, [open, mounted])

  if (!mounted) return null

  return (
    // Fills its screen (not the window), so it shrinks with the keyboard.
    // Stops pointer events so the screen behind doesn't start a back swipe.
    <div className="absolute inset-0 z-50" onPointerDown={(e) => e.stopPropagation()}>
      <div ref={backdrop} className="absolute inset-0 bg-[#0e2240]/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[92%] max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-background pb-[env(safe-area-inset-bottom)] shadow-2xl"
      >
        {/* Drag handle: pull down to dismiss. */}
        <div
          className="flex touch-none justify-center pt-2.5 pb-3"
          onPointerDown={(e) => {
            drag.current = { y: e.clientY, dy: 0 }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const p = panel.current
            if (!drag.current || !p) return
            drag.current.dy = Math.max(0, e.clientY - drag.current.y)
            p.getAnimations().forEach((a) => a.cancel())
            p.style.transform = `translateY(${drag.current.dy}px)`
          }}
          onPointerUp={() => {
            const d = drag.current
            const p = panel.current
            drag.current = null
            if (!d || !p) return
            if (d.dy > 80) onClose()
            else {
              p.style.transform = ""
              p.animate([{ transform: `translateY(${d.dy}px)` }, { transform: "translateY(0)" }], {
                duration: 200,
                easing: EASE,
              })
            }
          }}
        >
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}
