import { House } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BallIcon } from "./ball-icon"
import { Screen } from "./screen"
import { useNav } from "./nav"

// Shown for an address the app does not have. Space instead of a court:
// navy sky, a few stars, and a droid whose body is a padel ball.
// message: what went wrong, in plain words, when the app knows.
export function NotFoundScreen({ message }: { message?: string }) {
  const nav = useNav()
  return (
    <Screen
      title="Not found"
      bare
      footer={
        <Button variant="ball" size="lg" onClick={() => nav.home()}>
          <House className="size-5" strokeWidth={2.5} />
          Back to the court
        </Button>
      }
    >
      <div className="relative -mx-4 overflow-hidden rounded-b-2xl bg-foreground px-5 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-8 text-center text-primary-foreground">
        <Stars />
        <div className="relative">
          <p className="text-sm font-semibold text-accent">A long time ago, on a court far, far away…</p>
          <p className="mt-4 text-[6.5rem] leading-none type-display" aria-label="Error 404">
            4<span className="text-accent">0</span>4
          </p>
          <BallDroid />
          <h1 className="mx-auto mt-6 max-w-72 text-[2rem] type-display">
            These are not the droids you are looking for.
          </h1>
        </div>
      </div>
      {message && <p className="mx-auto mt-6 max-w-80 text-center text-lg font-bold">{message}</p>}
    </Screen>
  )
}

// Fixed positions, so the sky looks the same on every visit.
const STARS = [
  [8, 12, 2], [22, 30, 1], [78, 26, 2], [91, 14, 1],
  [5, 48, 1], [16, 70, 2], [30, 56, 1], [72, 52, 1], [86, 66, 2], [95, 44, 1],
  [10, 90, 1], [42, 94, 1], [58, 84, 2], [80, 92, 1],
] as const

function Stars() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {STARS.map(([left, top, size], i) => (
        <span
          key={i}
          className={`absolute rounded-full ${i % 4 === 0 ? "bg-accent/80" : "bg-white/60"}`}
          style={{ left: `${left}%`, top: `${top}%`, width: size * 2, height: size * 2 }}
        />
      ))}
    </div>
  )
}

// A round droid, drawn in the app's own colours: the body is the logo's
// ball, the head a white dome with one eye.
function BallDroid() {
  return (
    <svg viewBox="0 0 160 190" className="mx-auto mt-2 h-44" fill="none" aria-hidden>
      <ellipse cx="80" cy="180" rx="46" ry="6" className="fill-black/30" />
      {/* body: the app's own ball, the one in the logo */}
      <BallIcon x="24" y="64" width="112" height="112" />
      {/* antennas */}
      <path d="M92 30V10M102 34V20" stroke="white" strokeWidth="3" strokeLinecap="round" />
      {/* head */}
      <path d="M40 72a40 40 0 0 1 80 0Z" className="fill-white" />
      <path d="M43 60h74" className="stroke-primary" strokeWidth="5" />
      <rect x="38" y="70" width="84" height="6" rx="3" className="fill-secondary" />
      {/* eye */}
      <circle cx="80" cy="48" r="11" fill="#0e2240" />
      <circle cx="84" cy="44" r="3.5" className="fill-accent" />
      <circle cx="104" cy="62" r="4" fill="#0e2240" />
    </svg>
  )
}
