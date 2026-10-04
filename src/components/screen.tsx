import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"
import { useNav } from "./stack-navigator"

// One full-height screen: a header, a body that scrolls on its own, and an
// optional footer pinned above the home indicator, where the thumb rests.
export function Screen({
  title,
  large = false,
  action,
  footer,
  children,
}: {
  title: string
  large?: boolean // big left-aligned title, for the home screen
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  const nav = useNav()
  const canGoBack = nav.depth > 0

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-md items-center gap-1 px-2">
          {canGoBack && (
            <button
              type="button"
              onClick={nav.back}
              aria-label="Back"
              className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-full text-primary active:bg-muted"
            >
              <ChevronLeft className="size-7" strokeWidth={2.25} />
            </button>
          )}
          {!large && <h1 className="min-w-0 flex-1 truncate px-1 text-lg font-semibold">{title}</h1>}
          {large && <div className="flex-1" />}
          {action}
        </div>
        {large && (
          <h1 className="mx-auto max-w-md px-4 pb-2 text-[2.125rem] leading-tight font-bold tracking-tight">
            {title}
          </h1>
        )}
      </header>

      <main className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-md px-4 pb-6">{children}</div>
      </main>

      {footer && (
        <footer className="shrink-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto max-w-md px-4 py-3">{footer}</div>
        </footer>
      )}
    </div>
  )
}
