import { Download } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

// Chrome's install event; TypeScript's DOM types don't have it.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

// Chrome can fire this before React mounts, so it's caught as soon as this
// module loads and kept until the banner asks for it. Browsers without it
// (iOS Safari, Firefox) never show the banner.
let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault() // our banner replaces Chrome's own mini bar
  deferred = e as InstallPromptEvent
  changed()
})
window.addEventListener("appinstalled", () => {
  deferred = null
  changed()
})

// "Not now" hides the banner for a week, not forever.
const DISMISSED_KEY = "installDismissedAt"
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY))
    return at > 0 && Date.now() - at < SNOOZE_MS
  } catch {
    return false
  }
}

export function InstallBanner() {
  const [event, setEvent] = useState(deferred)
  const [hidden, setHidden] = useState(snoozed)

  useEffect(() => {
    const update = () => setEvent(deferred)
    listeners.add(update)
    update()
    return () => {
      listeners.delete(update)
    }
  }, [])

  if (!event || hidden) return null

  // Chrome lets each event open its dialog once; after that it's spent.
  const install = async () => {
    deferred = null
    setEvent(null)
    await event.prompt()
  }

  const notNow = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // Private mode: it just comes back next time.
    }
    setHidden(true)
  }

  return (
    <section className="mt-6 rounded-3xl border-[1.5px] bg-card p-4">
      <p className="text-[1.0625rem] type-label">Install Padel</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Open it from your home screen. It works offline, even with no signal at the court.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" size="lg" className="px-3" onClick={notNow}>
          Not now
        </Button>
        <Button size="lg" className="px-3" onClick={install}>
          <Download className="size-5" />
          Install
        </Button>
      </div>
    </section>
  )
}
