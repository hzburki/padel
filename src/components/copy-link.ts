import { shareText } from "@/lib/broadcast"
import { shareLive, shareScoreLink } from "@/lib/live"
import type { SavedEvent } from "@/lib/types"
import type { ToastMessage } from "@/components/ui/toast"

// Put a game online and copy the message with its link, for the organiser
// to paste wherever they like: the watch link, or the one that makes a
// friend an organiser too. Returns what to tell the organiser. Call it
// during the tap.
export async function copyLink(link: "watch" | "organise", event: SavedEvent): Promise<ToastMessage> {
  const online = link === "organise" ? shareScoreLink(event) : shareLive(event)
  try {
    // The copy is started during the tap, before the link exists: iOS
    // refuses one that starts after waiting on the network.
    const text = online.then((url) => new Blob([shareText(link, event.name, url)], { type: "text/plain" }))
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": text })])
    return { text: link === "organise" ? "Organiser link copied!" : "Link copied!" }
  } catch {
    // The copy can fail with the game already online.
    const isOnline = await online.then(
      () => true,
      () => false,
    )
    if (isOnline) return { text: "Couldn't copy the link. Try again", failed: true }
    // With a connection, the game was refused or took too long.
    return { text: navigator.onLine ? "Couldn't make the link. Try again" : "No connection. Try again", failed: true }
  }
}
