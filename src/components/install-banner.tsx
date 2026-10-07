import { Download } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useInstallPrompt } from "./install-prompt"

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
  const { install } = useInstallPrompt()
  const [hidden, setHidden] = useState(snoozed)

  if (!install || hidden) return null

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

// For when the browser supports installing but isn't offering the dialog
// right now: its own menu still can.
export function InstallHelp({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <p className="text-2xl type-display">Install Padel</p>
      <p className="mt-1 text-muted-foreground">It opens like an app and works offline.</p>
      <ol className="mt-5 space-y-3">
        {[
          "Open your browser's menu (⋮).",
          "Choose Install app or Add to home screen. On a computer, the install icon at the right of the address bar does the same.",
        ].map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground type-display">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <Button size="lg" className="mt-6" onClick={onClose}>
        Got it
      </Button>
    </div>
  )
}
