import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

// A phone-style screen stack. Screens slide in from the right, slide out on
// back, and the top screen can be dragged away from the left edge. Every
// screen is a browser history entry, so the Android back button, the browser
// back button and a reload all land on the right screen.
//
// The whole stack is stored in each history entry's state; on popstate the
// stack is simply read back from there.

interface Entry<R> {
  key: string
  route: R
}

interface NavApi<R> {
  push: (route: R) => void
  replace: (route: R) => void // swap the top screen, animated like a push
  // Go back one step: closes whatever is open on top (see useBackHandler)
  // before leaving the screen. `force` leaves the screen regardless.
  back: (options?: { force?: boolean }) => void
  depth: number
  registerBackHandler: (onBack: () => void) => () => void
}

const NavContext = createContext<NavApi<unknown> | null>(null)
const ScreenContext = createContext({ isTop: true })

export function useNav<R>(): NavApi<R> {
  const nav = useContext(NavContext)
  if (!nav) throw new Error("useNav must be used inside <StackNavigator>")
  return nav as NavApi<R>
}

// While `enabled`, a back action — Android back button, browser back, the
// on-screen back button, an edge swipe or Esc — calls `onBack` instead of
// leaving the screen. Sheets use it to close themselves; a half-filled form
// uses it to ask before throwing the input away. The latest one wins.
export function useBackHandler(enabled: boolean, onBack: () => void) {
  const nav = useContext(NavContext)
  const latest = useRef(onBack)
  useLayoutEffect(() => {
    latest.current = onBack
  })
  const register = nav?.registerBackHandler
  useEffect(() => {
    if (!enabled || !register) return
    return register(() => latest.current())
  }, [enabled, register])
}

// True while this screen is the one showing. Lets a screen refresh its data
// when the user comes back to it.
export function useIsTopScreen(): boolean {
  return useContext(ScreenContext).isTop
}

const DURATION = 350
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)" // fast start, soft landing, like iOS
const UNDER_SHIFT = 30 // % the screen underneath sits to the left
const EDGE = 24 // px from the left edge where a back swipe can start

const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
const isStandalone = window.matchMedia("(display-mode: standalone)").matches
// Safari in a normal tab animates its own edge swipe; animating again would
// show the screen leave twice.
const browserAnimatesBack = isIOS && !isStandalone

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

function slide(el: HTMLElement, from: string, to: string, duration = DURATION): Promise<void> {
  const animation = el.animate([{ transform: from }, { transform: to }], {
    duration: reducedMotion() ? 0 : duration,
    easing: EASE,
    fill: "forwards",
  })
  return animation.finished.then(() => {
    el.style.transform = to === "translateX(0)" ? "" : to
    animation.cancel()
  })
}

let keyCounter = 0
const newKey = () => `s${++keyCounter}-${Date.now()}`

function readStack<R>(state: unknown): Entry<R>[] | null {
  const stack = (state as { stack?: Entry<R>[] } | null)?.stack
  return Array.isArray(stack) && stack.length > 0 ? stack : null
}

export function StackNavigator<R>({
  initial,
  render,
}: {
  initial: R
  render: (route: R) => ReactNode
}) {
  const [stack, setStack] = useState<Entry<R>[]>(
    () => readStack<R>(history.state) ?? [{ key: newKey(), route: initial }],
  )
  const stackRef = useRef(stack)
  // Event handlers read the stack through this ref; keep it current before
  // any other layout effect (the enter animation) runs.
  useLayoutEffect(() => {
    stackRef.current = stack
  }, [stack])

  const layers = useRef(new Map<string, HTMLDivElement>())
  const busy = useRef(false) // an animation or drag is running
  const pendingEnter = useRef(false) // animate the new top screen in after render
  const skipNextPopAnimation = useRef(false)

  // Back handlers, newest last. While any exist, one extra "guard" history
  // entry sits on top, so a system back pops the guard instead of the screen.
  const handlers = useRef<{ onBack: () => void }[]>([])
  const guard = useRef({ inHistory: false, removing: false, afterRemove: null as (() => void) | null })

  const syncGuard = () => {
    const g = guard.current
    if (g.removing) return
    const wanted = handlers.current.length > 0
    if (wanted && !g.inHistory) {
      history.pushState({ stack: stackRef.current, guard: true }, "")
      g.inHistory = true
    } else if (!wanted && g.inHistory) {
      g.removing = true
      history.back()
    }
  }

  // Run a navigation once the guard entry is out of history, so it never
  // ends up buried under the new screen.
  const withoutGuard = (fn: () => void) => {
    const g = guard.current
    if (!g.inHistory && !g.removing) return fn()
    g.afterRemove = fn
    if (!g.removing) {
      g.removing = true
      history.back()
    }
  }

  const registerBackHandler = useCallback((onBack: () => void) => {
    const entry = { onBack }
    handlers.current.push(entry)
    syncGuard()
    return () => {
      handlers.current = handlers.current.filter((h) => h !== entry)
      syncGuard()
    }
  }, [])

  // Make sure the current history entry carries the stack (first load).
  useEffect(() => {
    history.replaceState({ ...history.state, stack: stackRef.current }, "")
  }, [])

  const topAndUnder = () => {
    const s = stackRef.current
    return {
      top: layers.current.get(s[s.length - 1]?.key),
      under: layers.current.get(s[s.length - 2]?.key),
    }
  }

  // Slide the newly pushed screen in over the one below.
  useLayoutEffect(() => {
    if (!pendingEnter.current) return
    pendingEnter.current = false
    const { top, under } = topAndUnder()
    if (!top) return
    busy.current = true
    if (under) under.style.visibility = "visible"
    Promise.all([
      slide(top, "translateX(100%)", "translateX(0)"),
      under ? slide(under, "translateX(0)", `translateX(-${UNDER_SHIFT}%)`) : null,
    ]).then(() => {
      if (under) {
        under.style.visibility = ""
        under.style.transform = ""
      }
      busy.current = false
    })
  }, [stack])

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const g = guard.current
      if (g.removing) {
        // Our own removal of the guard entry finished.
        g.removing = false
        g.inHistory = false
        const after = g.afterRemove
        g.afterRemove = null
        if (after) after()
        else syncGuard()
        return
      }
      if (g.inHistory) {
        // A system back popped the guard: hand it to the newest handler, and
        // put the guard back if something still wants to catch back.
        g.inHistory = false
        handlers.current.at(-1)?.onBack()
        setTimeout(syncGuard, 0)
        return
      }

      const next = readStack<R>(event.state) ?? [{ key: newKey(), route: initial }]
      const current = stackRef.current
      if (next.length === current.length && next.at(-1)?.key === current.at(-1)?.key) {
        // A leftover guard entry (e.g. from before a reload): nothing to show, skip it.
        history.back()
        return
      }
      const goingBack = next.length < current.length
      const animate = goingBack && !skipNextPopAnimation.current && !browserAnimatesBack
      skipNextPopAnimation.current = false

      if (!animate) {
        setStack(next)
        return
      }
      const { top, under } = topAndUnder()
      if (!top) {
        setStack(next)
        return
      }
      busy.current = true
      if (under) under.style.visibility = "visible"
      Promise.all([
        slide(top, "translateX(0)", "translateX(100%)"),
        under ? slide(under, `translateX(-${UNDER_SHIFT}%)`, "translateX(0)") : null,
      ]).then(() => {
        if (under) under.style.visibility = ""
        busy.current = false
        setStack(next)
      })
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [initial])

  const push = useCallback((route: R) => {
    if (busy.current) return
    withoutGuard(() => {
      const next = [...stackRef.current, { key: newKey(), route }]
      history.pushState({ stack: next }, "")
      pendingEnter.current = true
      setStack(next)
    })
  }, [])

  const replace = useCallback((route: R) => {
    if (busy.current) return
    withoutGuard(() => {
      const next = [...stackRef.current.slice(0, -1), { key: newKey(), route }]
      history.replaceState({ stack: next }, "")
      pendingEnter.current = true
      setStack(next)
    })
  }, [])

  const back = useCallback((options?: { force?: boolean }) => {
    if (busy.current) return
    const handler = handlers.current.at(-1)
    if (handler && !options?.force) return handler.onBack()
    if (stackRef.current.length < 2) return
    withoutGuard(() => history.back())
  }, [])

  // Esc on a keyboard means back, like everywhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && back()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [back])

  // Edge swipe: the top screen follows the finger; let go past 40% of the
  // width (or with a quick flick) to go back.
  const drag = useRef<{ x: number; y: number; lastX: number; lastT: number; v: number; locked: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy.current || stackRef.current.length < 2 || e.clientX > EDGE) return
    drag.current = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: e.timeStamp, v: 0, locked: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null // it's a scroll, not a swipe
        return
      }
      if (dx < 10) return
      d.locked = true
      busy.current = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const { under } = topAndUnder()
      if (under) under.style.visibility = "visible"
    }
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.v = (e.clientX - d.lastX) / dt
    d.lastX = e.clientX
    d.lastT = e.timeStamp

    const { top, under } = topAndUnder()
    const width = window.innerWidth
    const x = Math.max(0, dx)
    const progress = x / width
    if (top) top.style.transform = `translateX(${x}px)`
    if (under) under.style.transform = `translateX(-${UNDER_SHIFT * (1 - progress)}%)`
  }

  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d?.locked) return
    const { top, under } = topAndUnder()
    const width = window.innerWidth
    const x = Math.max(0, e.clientX - d.x)
    const progress = x / width
    const released = e.type !== "pointercancel" && (progress > 0.4 || (d.v > 0.5 && x > 30))
    // If something wants to catch back (e.g. unsaved input), snap the screen
    // back and let it ask instead of leaving.
    const handler = released ? handlers.current.at(-1) : undefined
    const goBack = released && !handler
    const remaining = DURATION * (goBack ? 1 - progress : progress)

    if (goBack) {
      Promise.all([
        top ? slide(top, `translateX(${x}px)`, "translateX(100%)", remaining) : null,
        under ? slide(under, under.style.transform || "translateX(0)", "translateX(0)", remaining) : null,
      ]).then(() => {
        if (under) under.style.visibility = ""
        busy.current = false
        skipNextPopAnimation.current = true
        history.back()
      })
    } else {
      Promise.all([
        top ? slide(top, `translateX(${x}px)`, "translateX(0)", remaining) : null,
        under ? slide(under, under.style.transform, `translateX(-${UNDER_SHIFT}%)`, remaining) : null,
      ]).then(() => {
        if (under) {
          under.style.visibility = ""
          under.style.transform = ""
        }
        busy.current = false
        handler?.onBack()
      })
    }
  }

  const api = useMemo(
    () => ({ push, replace, back, depth: stack.length - 1, registerBackHandler }),
    [push, replace, back, stack.length, registerBackHandler],
  )

  return (
    <NavContext.Provider value={api as NavApi<unknown>}>
      <div
        className="relative h-full w-full overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {stack.map((entry, i) => {
          const isTop = i === stack.length - 1
          return (
            <div
              key={entry.key}
              ref={(el) => {
                if (el) layers.current.set(entry.key, el)
                else layers.current.delete(entry.key)
              }}
              // Screens below the top stay mounted (keeping scroll and form
              // state) but hidden until a transition needs them.
              className={`absolute inset-0 touch-pan-y bg-background ${isTop ? "shadow-[-12px_0_32px_rgba(16,37,27,0.14)]" : "invisible"}`}
              aria-hidden={!isTop}
              inert={!isTop}
            >
              <ScreenContext.Provider value={{ isTop }}>{render(entry.route)}</ScreenContext.Provider>
            </div>
          )
        })}
      </div>
    </NavContext.Provider>
  )
}
