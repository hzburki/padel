// The app is laid out for a phone held upright. On its side a phone is
// too short for it: the header and footer leave almost no room between
// them. Tablets and computers have the height either way.

// Below this, the shorter side of a screen is a phone's (CSS pixels).
const PHONE_SHORT_SIDE = 500

// orientation: the device's own (`screen.orientation.type`), not the
// window's shape, which also goes wide and short when the keyboard opens.
// Missing in browsers that can't say; they are never asked.
export function shouldAskToRotate(orientation: string | undefined, screen: { width: number; height: number }): boolean {
  if (!orientation?.startsWith("landscape")) return false
  return Math.min(screen.width, screen.height) < PHONE_SHORT_SIDE
}
