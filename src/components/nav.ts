import { createContext, useContext, useEffect, useLayoutEffect, useRef } from "react"

// What a screen can ask of the stack it sits in (see <StackNavigator>).

export interface NavApi<R> {
  push: (route: R) => void
  replace: (route: R) => void // swap the top screen, animated like a push
  // Go back one step: closes whatever is open on top (see useBackHandler)
  // before leaving the screen. `force` leaves the screen regardless.
  back: (options?: { force?: boolean }) => void
  home: () => void // leave every screen and show the first one
  depth: number
  registerBackHandler: (onBack: () => void) => () => void
}

export const NavContext = createContext<NavApi<unknown> | null>(null)
export const ScreenContext = createContext({ isTop: true })

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
