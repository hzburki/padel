import { Ellipsis, LoaderCircle, Repeat, Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmSheet } from "@/components/ui/confirm-sheet"
import { Screen } from "./screen"

// The parts the tournament and match screens share.

// While the game loads, or when it isn't on this phone. A friend's game has
// to be fetched first, so it shows a spinner meanwhile.
export function GameMissing({ loading, watch, text }: { loading: boolean; watch: boolean; text: string }) {
  if (loading) {
    return <Screen title="">{watch && <LoaderCircle className="mx-auto mt-24 size-9 animate-spin text-primary" />}</Screen>
  }
  return (
    <Screen title="Not found">
      <p className="pt-16 text-center text-muted-foreground">{text}</p>
    </Screen>
  )
}

// Opens the game's menu, top right.
export function MoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="More"
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full text-primary active:bg-muted"
    >
      <Ellipsis className="size-6" />
    </button>
  )
}

// A finished game's footer: the same players again, or the result image.
export function FinishedFooter({
  onPlayAgain,
  onShare,
  canShare,
}: {
  onPlayAgain: () => void
  onShare: () => void
  canShare: boolean // the share image is ready
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" size="lg" className="px-3" onClick={onPlayAgain}>
        <Repeat className="size-5" />
        Play again
      </Button>
      <Button variant="ball" size="lg" className="px-3" disabled={!canShare} onClick={onShare}>
        <Share className="size-5" />
        Share
      </Button>
    </div>
  )
}

// Putting the game online can take a moment; nothing else can be tapped
// until the link is ready.
export function LinkSpinner() {
  return (
    <div role="status" aria-label="Creating the link" className="fixed inset-0 z-50 flex items-center justify-center bg-background/70">
      <LoaderCircle className="size-9 animate-spin text-primary" />
    </div>
  )
}

// Going live takes the broadcast from the organiser's other game: asked first.
// passes: that game goes to another organiser instead of closing.
export function BroadcastSheet({
  open,
  passes,
  onClose,
  onConfirm,
}: {
  open: boolean
  passes: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmSheet
      open={open}
      onClose={onClose}
      title="Broadcast this game?"
      cancelLabel="Cancel"
      confirmLabel="Broadcast"
      onConfirm={onConfirm}
    >
      {passes ? "Your other game passes to another organiser." : "Your other broadcast closes. Its link keeps the last score."}
    </ConfirmSheet>
  )
}
