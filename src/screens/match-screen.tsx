import { Radio, Repeat, Trash2, Undo2, UserPlus } from "lucide-react"
import { useState } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import {
  canAddOrganiser,
  canShare,
  canShareLive,
  hasLink,
  scoreLockOn,
} from "@/lib/live"
import {
  addPoint,
  replay,
  teamName,
  undoPoint,
} from "@/lib/set-match"
import { previousMatchSetup } from "@/lib/set-match-setup"
import type { SetMatch } from "@/lib/types"
import { ConfirmSheet } from "@/components/ui/confirm-sheet"
import { Congrats } from "@/components/congrats"
import { BroadcastSheet, FinishedFooter, GameMissing, LinkSpinner, MoreButton } from "@/components/game-parts"
import { LiveBadge } from "@/components/live-badge"
import { Menu, MenuItem } from "@/components/ui/menu"
import { NewBadge } from "@/components/new-badge"
import { useOnline } from "@/components/online"
import { renderMatchShareCard } from "@/components/match-share-card"
import { Stats } from "@/components/match-stats"
import { Scoreboard } from "@/components/scoreboard"
import { Screen } from "@/components/screen"
import { SetGames } from "@/components/set-games"
import { Sheet } from "@/components/ui/sheet"
import { ScoreNote } from "@/components/shared-tag"
import { useNav } from "@/components/nav"
import { Toast } from "@/components/ui/toast"
import { useGame } from "@/components/use-game"

// The result image: the whole card, and the score alone for the screen.
const renderImages = (m: SetMatch) => Promise.all([renderMatchShareCard(m), renderMatchShareCard(m, { scoreOnly: true })])

// watch: opened from a shared link, so the match may not be on this phone
// yet. scoreKey: the end of that link when it makes a friend an organiser.
export function MatchScreen({ id, watch = false, scoreKey }: { id: string; watch?: boolean; scoreKey?: string }) {
  const nav = useNav<Route>()
  const {
    game: match,
    update,
    saveError,
    toast,
    setToast,
    live,
    image,
    share,
    sharing,
    asking,
    asked,
    stopAsking,
    shareLink,
    askOrShare,
    remove,
  } = useGame<SetMatch>({ kind: "match", id, watch, scoreKey, render: renderImages })
  // Which sheet is open.
  const [confirm, setConfirm] = useState<"menu" | "finish" | "delete" | "congrats" | null>(null)
  const online = useOnline()

  if (!match) {
    return <GameMissing loading={match === undefined} watch={watch} text="This match is no longer on this phone." />
  }

  const state = replay(match, match.points)
  const decided = state.winner !== null
  const byGames = match.scoreBy === "games"
  // What one tap adds to the log, and so what undo takes back.
  const unit = byGames ? "game" : "point"
  // A friend's game: deleting it here removes only this phone's copy.
  const mine = match.shared !== true
  // Why the match can't be changed here right now, if it can't. Only an
  // organiser gets the buttons at all.
  const lock = scoreLockOn(match, online)
  // With no connection what this phone may do stays on screen, greyed out;
  // what it may never do is not shown at all.
  const offline = lock === "offline"
  // Scores are still being sent. Once finished, nothing changes any more.
  const showLive = live && !match.finished

  const finish = () => {
    setConfirm("congrats")
    update((m) => ({ ...m, finished: true }))
  }

  const playAgain = () => {
    setConfirm(null)
    nav.push({ name: "new", fromMatch: previousMatchSetup(match) })
  }

  return (
    <Screen
      title={match.name}
      homeButton={match.finished}
      action={<MoreButton onClick={() => setConfirm("menu")} />}
      footer={
        match.finished ? (
          <FinishedFooter onPlayAgain={playAgain} onShare={share} canShare={image !== null} />
        ) : lock === "watch" ? undefined : (
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="mx-auto flex h-11 px-4 text-base font-medium text-primary"
              disabled={offline || match.points.length === 0}
              onClick={() => update(undoPoint)}
            >
              <Undo2 className="size-5" strokeWidth={2.5} />
              Undo last {unit}
            </Button>
            {/* Finishing asks first, so a second tap meant as a point can't end
                the match; until then the last point can still be undone. */}
            {decided ? (
              <Button variant="ball" size="lg" disabled={offline} onClick={() => setConfirm("finish")}>
                Finish match
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {([0, 1] as const).map((side) => (
                  // touch-manipulation: no double-tap zoom, so quick taps all count.
                  <button
                    key={side}
                    type="button"
                    disabled={offline}
                    onClick={() => update((m) => addPoint(m, side))}
                    className="flex h-20 min-w-0 touch-manipulation flex-col items-center justify-center rounded-2xl bg-accent px-3 text-accent-foreground shadow-[inset_0_-3px_0_rgb(14_34_64/0.16)] transition-transform active:scale-[0.97] active:shadow-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                  >
                    <span className="text-sm font-medium opacity-70">
                      {!byGames ? "Point for" : state.current.tiebreak ? "Tie-break for" : "Game for"}
                    </span>
                    <span className="max-w-full truncate text-lg type-label">{teamName(match.teams[side])}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      }
    >
      {saveError && (
        <p className="mt-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          The last {unit} isn't saved on this phone yet. It's still shown here, and the next {unit} will try again.
        </p>
      )}
      <ScoreNote shared={!mine} lock={lock} />
      {/* Room above the card for the badge that sits on its border. */}
      <div className={showLive ? "pt-4" : "pt-2"}>
        <div className="relative">
          {showLive && <LiveBadge />}
          {match.finished ? (
            // The share image's own scoreboard stands in for the live one.
            <div className="min-h-48 overflow-hidden rounded-3xl bg-primary">
              {image && <img src={image.previewUrl} alt="Final score" className="block w-full" />}
            </div>
          ) : (
            <Scoreboard match={match} state={state} />
          )}
        </div>
      </div>
      {decided ? (
        <>
          <Stats match={match} state={state} />
          {/* Every set in the order it was played. */}
          {state.sets.map((set, i) => (
            <SetGames key={i} match={match} set={set} number={i + 1} />
          ))}
        </>
      ) : (
        <SetGames match={match} set={state.sets[state.sets.length - 1]} number={state.sets.length} newestFirst />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
      {sharing && <LinkSpinner />}

      <ConfirmSheet
        open={confirm === "finish"}
        onClose={() => setConfirm(null)}
        title="Finish the match?"
        cancelLabel="Not yet"
        confirmLabel="Finish"
        onConfirm={finish}
      >
        The score can't be changed once a match is finished.
      </ConfirmSheet>

      <Sheet open={confirm === "congrats"} onClose={() => setConfirm(null)}>
        <Congrats
          winnerNames={state.winner === null ? [] : match.teams[state.winner]}
          canShare={image !== null}
          onShare={share}
          onClose={() => setConfirm(null)}
        />
      </Sheet>

      <Sheet open={confirm === "menu"} onClose={() => setConfirm(null)}>
        <Menu>
          {/* A game can't be put online with no connection. */}
          {canShareLive && canShare(match) && (
            <>
              <MenuItem icon={Radio} label="Broadcast live" offline={!online} onClick={() => {
                  setConfirm(null)
                  askOrShare("watch")
                }} />
              {canAddOrganiser(match) && (
                <MenuItem
                  icon={UserPlus}
                  label="Add an organiser"
                  offline={!online}
                  badge={<NewBadge until="2026-10-21" />}
                  onClick={() => {
                    setConfirm(null)
                    askOrShare("organise")
                  }}
                />
              )}
            </>
          )}
          {/* A finished match has this in its footer. */}
          {!match.finished && <MenuItem icon={Repeat} label="Play again" onClick={playAgain} />}
          <MenuItem icon={Trash2} label="Delete match" destructive onClick={() => setConfirm("delete")} />
        </Menu>
      </Sheet>

      <BroadcastSheet open={asking} passes={asked.passes} onClose={stopAsking} onConfirm={() => shareLink(asked.link)} />

      <ConfirmSheet
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title={`Delete ${match.name}?`}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirm(null)
          remove()
        }}
        destructive
      >
        This can't be undone.{" "}
        {!mine
          ? "Only your copy is removed; the organiser still has the match."
          : hasLink(match.id)
            ? "The link stops working, but friends who opened it keep their copy until they delete it themselves."
            : `Every ${unit} will be removed from this phone.`}
      </ConfirmSheet>
    </Screen>
  )
}
