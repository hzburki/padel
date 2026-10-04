import { useEffect } from "react"

// Keeps the text field being typed into in the middle of the visible screen,
// above the on-screen keyboard, in every form and sheet.
//
// 1. The app is sized to the visual viewport (the part the keyboard doesn't
//    cover), exposed as --app-height. Android resizes the page itself
//    (interactive-widget in index.html); iOS needs this.
// 2. When a field gets focus, its scroll container scrolls it to the centre.
// 3. While it stays focused, any change in the form's size (e.g. another
//    player added above it) re-centres it.
// 4. html[data-typing] lets the CSS add room at the bottom of scroll areas,
//    so fields near the end can still reach the centre.

const isField = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === "auto" || overflowY === "scroll") return p
  }
  return null
}

function centre(field: HTMLElement, behavior: ScrollBehavior) {
  const container = scrollParent(field)
  if (!container) return
  const c = container.getBoundingClientRect()
  const f = field.getBoundingClientRect()
  // Only the part of the container that's actually visible counts.
  const visibleBottom = Math.min(c.bottom, window.visualViewport?.height ?? window.innerHeight)
  const middle = (c.top + visibleBottom) / 2
  const delta = f.top + f.height / 2 - middle
  if (Math.abs(delta) > 4) container.scrollBy({ top: delta, behavior })
}

export function useCenterFocusedField() {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport

    const fitToViewport = () => {
      if (!vv) return
      root.style.setProperty("--app-height", `${vv.height}px`)
      // iOS pans the whole page to show the field; undo that, we scroll ourselves.
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }

    let observer: ResizeObserver | null = null
    let clearTyping = 0

    const onFocusIn = (e: FocusEvent) => {
      const field = e.target as Element
      if (!isField(field) || (field as HTMLInputElement).disabled) return
      window.clearTimeout(clearTyping)
      root.dataset.typing = ""
      // Centre now, and again once the keyboard has finished sliding up.
      requestAnimationFrame(() => centre(field, "smooth"))
      window.setTimeout(() => document.activeElement === field && centre(field, "smooth"), 350)

      observer?.disconnect()
      const content = scrollParent(field)?.firstElementChild
      if (content) {
        observer = new ResizeObserver(() => document.activeElement === field && centre(field, "smooth"))
        observer.observe(content)
      }
    }

    const onFocusOut = () => {
      observer?.disconnect()
      observer = null
      // Wait a moment: moving to the next field fires focusout then focusin.
      clearTyping = window.setTimeout(() => {
        if (!isField(document.activeElement)) delete root.dataset.typing
      }, 150)
    }

    const onViewportResize = () => {
      fitToViewport()
      const active = document.activeElement
      if (isField(active)) centre(active, "auto")
    }

    fitToViewport()
    vv?.addEventListener("resize", onViewportResize)
    vv?.addEventListener("scroll", fitToViewport)
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      vv?.removeEventListener("resize", onViewportResize)
      vv?.removeEventListener("scroll", fitToViewport)
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
      observer?.disconnect()
    }
  }, [])
}
