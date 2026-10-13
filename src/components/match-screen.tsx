import { Ellipsis, LoaderCircle, Radio, Repeat, Share, Trash2, Undo2, UserPlus, WifiOff } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import {
  canAddOrganiser,
  canShare,
  canShareLive,
  changesOnline,
  closesAnother,
  deleteLive,
  hasLink,
  isSending,
  openGame,
  passesOn,
  pushLive,
  scoreLockOn,
  sendChange,
} from "@/lib/live"
import {
  addPoint,
  gameSummary,
  pointLabels,
  replay,
  teamName,
  undoPoint,
  type MatchState,
  type SetState,
} from "@/lib/set-match"
import { previousMatchSetup } from "@/lib/set-match-setup"
import { matchStats } from "@/lib/set-match-stats"
import { deleteTournament, saveTournament } from "@/lib/storage"
import type { SetMatch, Side } from "@/lib/types"
import { Congrats } from "./congrats"
import { copyLink } from "./copy-link"
import { LiveBadge } from "./live-badge"
import { useOnline } from "./online"
import { renderMatchShareCard } from "./match-share-card"
import { Screen } from "./screen"
import { shareOrDownload } from "./share-card"
import { Sheet } from "./sheet"
import { ScoreNote } from "./shared-tag"
import { useNav } from "./nav"
import { Toast, type ToastMessage } from "./toast"

// watch: opened from a shared link, so the match may not be on this phone
// yet. scoreKey: the end of that link when it makes a friend an organiser.
export function MatchScreen({ id, watch = false, scoreKey }: { id: string; watch?: boolean; scoreKey?: string }) {
  const nav = useNav<Route>()
  const toNotFound = nav.replace
  const [match, setMatch] = useState<SetMatch | null | undefined>(undefined)
  // Which sheet is open.
  const [confirm, setConfirm] = useState<"menu" | "broadcast" | "finish" | "delete" | "congrats" | null>(null)
  const [saveError, setSaveError] = useState(false)
  // The full card to share, and a score-only preview for the screen.
  const [image, setImage] = useState<{ blob: Blob; previewUrl: string } | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  // Being sent from this phone, or followed on a friend's.
  const [live, setLive] = useState(false)
  // The link is being made.
  const [sharing, setSharing] = useState(false)
  // Which link the organiser asked for, while they are asked about their
  // other broadcast, and whether that one passes to another organiser.
  const [asked, setAsked] = useState<{ link: "watch" | "organise"; passes: boolean }>({ link: "watch", passes: false })
  // Counts the links made here: the game is opened again after each, since
  // an organiser link changes how it is followed.
  const [links, setLinks] = useState(0)
  const online = useOnline()
  const wasShared = useRef(false)

  useEffect(
    () =>
      openGame(
        id,
        watch,
        (saved, following) => {
          // A tournament has its own screen; here it counts as not found.
          const m = saved?.kind === "match" ? saved : null
          // A link that leads nowhere gets the 404 page, saying why.
          if (!m && watch) return toNotFound({ name: "notFound", path: location.pathname, message: "This link doesn't lead to a game. The organiser may have deleted it, or part of the link is missing." })
          // A friend's game that became this phone's: its owner left it to
          // the other organisers.
          if (wasShared.current && m && !m.shared) setToast({ text: "This game is yours now" })
          wasShared.current = m?.shared === true
          setMatch(m)
          setLive(following)
        },
        scoreKey,
      ),
    [id, watch, scoreKey, toNotFound, links],
  )

  // Render the share image ahead of time, so the Share tap can hand it to
  // the share sheet immediately (iOS only allows that during the tap).
  useEffect(() => {
    if (!match?.finished) return
    let url = ""
    let cancelled = false
    Promise.all([renderMatchShareCard(match), renderMatchShareCard(match, { scoreOnly: true })]).then(
      ([blob, preview]) => {
        if (cancelled) return
        url = URL.createObjectURL(preview)
        setImage({ blob, previewUrl: url })
      },
    )
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
      setImage(null)
    }
  }, [match])

  if (match === undefined) {
    return (
      <Screen title="">
        {/* A friend's game has to be fetched first. */}
      {watch && <LoaderCircle className="mx-auto mt-24 size-9 animate-spin text-primary" />}
      </Screen>
    )
  }
  if (match === null) {
    return (
      <Screen title="Not found">
        <p className="pt-16 text-center text-muted-foreground">This match is no longer on this phone.</p>
      </Screen>
    )
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

  // Save straight away: the phone may be locked or the tab killed any moment.
  // A match with other organisers also sends just what changed online, so
  // what they entered meanwhile is kept; the change shows here at once.
  const update = async (change: (m: SetMatch) => SetMatch) => {
    const next = change(match)
    if (next === match) return
    setMatch(next)
    const scoredOnline = changesOnline(match)
    // Not waited for. If it is refused, the online copy puts the screen back.
    if (scoredOnline) sendChange(match, next).catch(() => setToast({ text: "Not saved. Try again", failed: true }))
    try {
      await saveTournament(next)
      setSaveError(false)
      if (!scoredOnline) pushLive(next)
    } catch {
      setSaveError(true)
    }
  }

  const finish = () => {
    setConfirm("congrats")
    update((m) => ({ ...m, finished: true }))
  }

  const share = () => {
    if (!image) return
    const filename = `${match.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "padel"}.png`
    shareOrDownload(image.blob, filename, match.name)
  }

  // Put a copy online and copy the message with its link: the one for
  // watching, or the one that makes a friend an organiser too.
  const shareLink = async (link: "watch" | "organise") => {
    setConfirm(null)
    setSharing(true)
    setToast(await copyLink(link, match))
    // The badge follows the game, not the copy.
    setLive(isSending(match.id))
    setSharing(false)
    setLinks((n) => n + 1)
  }

  // Going live takes the broadcast from any other game: say so first.
  const askOrShare = (link: "watch" | "organise") => {
    if (!closesAnother(match)) return shareLink(link)
    setAsked({ link, passes: false })
    setConfirm("broadcast")
    passesOn(match).then(
      (passes) => setAsked({ link, passes }),
      () => {},
    )
  }

  const playAgain = () => {
    setConfirm(null)
    nav.push({ name: "new", fromMatch: previousMatchSetup(match) })
  }

  const remove = async () => {
    setConfirm(null)
    await deleteTournament(match.id)
    // Not waited for: with no connection it would never come back.
    deleteLive(match.id).catch(() => {})
    nav.back()
  }

  return (
    <Screen
      title={match.name}
      homeButton={match.finished}
      action={
        <button
          type="button"
          aria-label="More"
          onClick={() => setConfirm("menu")}
          className="flex size-11 items-center justify-center rounded-full text-primary active:bg-muted"
        >
          <Ellipsis className="size-6" />
        </button>
      }
      footer={
        match.finished ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="px-3"
              onClick={playAgain}
            >
              <Repeat className="size-5" />
              Play again
            </Button>
            <Button variant="ball" size="lg" className="px-3" disabled={!image} onClick={share}>
              <Share className="size-5" />
              Share
            </Button>
          </div>
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
      {/* Putting the game online can take a moment; nothing else can be
          tapped until the link is ready. */}
      {sharing && (
        <div role="status" aria-label="Creating the link" className="fixed inset-0 z-50 flex items-center justify-center bg-background/70">
          <LoaderCircle className="size-9 animate-spin text-primary" />
        </div>
      )}

      <Sheet open={confirm === "finish"} onClose={() => setConfirm(null)}>
        <p className="text-2xl type-display">Finish the match?</p>
        <p className="mt-1 text-muted-foreground">The score can't be changed once a match is finished.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" className="px-3" onClick={() => setConfirm(null)}>
            Not yet
          </Button>
          <Button size="lg" className="px-3" onClick={finish}>
            Finish
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirm === "congrats"} onClose={() => setConfirm(null)}>
        <Congrats
          winnerNames={state.winner === null ? [] : match.teams[state.winner]}
          canShare={image !== null}
          onShare={share}
          onClose={() => setConfirm(null)}
        />
      </Sheet>

      <Sheet open={confirm === "menu"} onClose={() => setConfirm(null)}>
        <div className="divide-y overflow-hidden rounded-3xl bg-card border-[1.5px]">
          {canShareLive && canShare(match) && (
            <>
              <button
                type="button"
                // A game can't be put online with no connection.
                disabled={!online}
                onClick={() => askOrShare("watch")}
                className="flex w-full items-center gap-3 px-4 py-4 text-left font-medium active:bg-muted disabled:text-muted-foreground"
              >
                <Radio className={`size-5 ${online ? "text-primary" : ""}`} />
                Broadcast live
                {!online && <WifiOff className="ml-auto size-4.5" aria-label="Offline" />}
              </button>
              {canAddOrganiser(match) && (
                <button
                  type="button"
                  // A game can't be put online with no connection.
                  disabled={!online}
                  onClick={() => askOrShare("organise")}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left font-medium active:bg-muted disabled:text-muted-foreground"
                >
                  <UserPlus className={`size-5 ${online ? "text-primary" : ""}`} />
                  Add an organiser
                  {!online && <WifiOff className="ml-auto size-4.5" aria-label="Offline" />}
                </button>
              )}
            </>
          )}
          {/* A finished match has this in its footer. */}
          {!match.finished && (
            <button
              type="button"
              onClick={playAgain}
              className="flex w-full items-center gap-3 px-4 py-4 text-left font-medium active:bg-muted"
            >
              <Repeat className="size-5 text-primary" />
              Play again
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            className="flex w-full items-center gap-3 px-4 py-4 text-left font-medium text-destructive active:bg-muted"
          >
            <Trash2 className="size-5" />
            Delete match
          </button>
        </div>
      </Sheet>

      <Sheet open={confirm === "broadcast"} onClose={() => setConfirm(null)}>
        <p className="text-2xl type-display">Broadcast this game?</p>
        <p className="mt-1 text-muted-foreground">
          {asked.passes ? "Your other game passes to another organiser." : "Your other broadcast closes. Its link keeps the last score."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" className="px-3" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button size="lg" className="px-3" onClick={() => shareLink(asked.link)}>
            Broadcast
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirm === "delete"} onClose={() => setConfirm(null)}>
        <p className="text-2xl type-display">Delete {match.name}?</p>
        <p className="mt-1 text-muted-foreground">
          This can't be undone.{" "}
          {!mine
            ? "Only your copy is removed; the organiser still has the match."
            : hasLink(match.id)
              ? "The link stops working, but friends who opened it keep their copy until they delete it themselves."
              : `Every ${unit} will be removed from this phone.`}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" className="px-3" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button variant="destructive" size="lg" className="px-3" onClick={remove}>
            Delete
          </Button>
        </div>
      </Sheet>
    </Screen>
  )
}

// Like a TV scoreboard: one row per team, a column of games per set, and
// the points of the game in progress on the right. A match scored by games
// has no points to show.
function Scoreboard({ match, state }: { match: SetMatch; state: MatchState }) {
  const points = pointLabels(state)
  const live = state.winner === null
  const showPoints = live && match.scoreBy === "points"
  return (
    <div className="overflow-hidden rounded-3xl border-[1.5px] bg-card">
      <div className="flex items-center gap-1 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
        <span className="flex-1">
          {!live ? "Final score" : state.current.tiebreak ? "Tie-break" : `Set ${state.sets.length}`}
        </span>
        {state.sets.map((_, i) => (
          <span key={i} className="w-7 text-center">
            S{i + 1}
          </span>
        ))}
        {showPoints && <span className="ml-2 w-14 text-center">Points</span>}
      </div>
      <div className="divide-y">
        {([0, 1] as const).map((side: Side) => (
          <div key={side} className="flex items-center gap-1 px-4 py-3">
            <span
              className={`min-w-0 flex-1 text-lg leading-tight type-label ${
                !live && state.winner !== side ? "text-muted-foreground" : ""
              }`}
            >
              <span className="block truncate">{match.teams[side][0]}</span>
              <span className="block truncate">{match.teams[side][1]}</span>
            </span>
            {state.sets.map((set, i) => (
              <span
                key={i}
                className={`w-7 text-center text-[1.75rem] type-display ${
                  set.winner !== null && set.winner !== side ? "text-muted-foreground" : ""
                }`}
              >
                {set.games[side]}
              </span>
            ))}
            {showPoints && (
              <span className="ml-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-[1.75rem] text-primary-foreground type-display">
                {points[side]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// The two teams side by side, one number per row, the better one in bold.
function Stats({ match, state }: { match: SetMatch; state: MatchState }) {
  const [first, second] = matchStats(state)
  const rows: [label: string, a: number, b: number][] = [
    ["Sets", first.sets, second.sets],
    ["Games", first.games, second.games],
    // Only known when every point was entered.
    ...(match.scoreBy === "points"
      ? ([
          ["Points", first.points, second.points],
          [match.deuce === "golden" ? "Golden points" : "Deuce games", first.deuceGames, second.deuceGames],
        ] as [string, number, number][])
      : []),
    ["Best run of games", first.bestRun, second.bestRun],
  ]
  return (
    <section className="mt-8">
      <h2 className="mb-3 px-1 text-[1.375rem] type-display">Match stats</h2>
      <div className="overflow-hidden rounded-3xl border-[1.5px] bg-card">
        <div className="flex items-center gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{teamName(match.teams[0])}</span>
          <span className="min-w-0 flex-1 truncate text-right">{teamName(match.teams[1])}</span>
        </div>
        <dl className="divide-y">
          {rows.map(([label, a, b]) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <dd className={`w-12 text-[1.75rem] type-display ${a < b ? "text-muted-foreground" : ""}`}>{a}</dd>
              <dt className="flex-1 text-center text-sm text-muted-foreground">{label}</dt>
              <dd className={`w-12 text-right text-[1.75rem] type-display ${b < a ? "text-muted-foreground" : ""}`}>{b}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

// One set's games. While it is being played the newest is on top; once the
// match is over they read in order, with the set score beside the title.
function SetGames({
  match,
  set,
  number,
  newestFirst = false,
}: {
  match: SetMatch
  set: SetState
  number: number
  newestFirst?: boolean
}) {
  const games = set.played.map((game, i) => ({ game, number: i + 1 }))
  if (newestFirst) games.reverse()
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-baseline gap-2 px-1 text-[1.375rem] type-display">
        <span className="flex-1">{newestFirst ? `Set ${number} games` : `Set ${number}`}</span>
        {set.winner !== null && (
          <span className="text-primary">
            {set.games[0]}–{set.games[1]}
          </span>
        )}
      </h2>
      {games.length === 0 ? (
        <p className="px-1 text-muted-foreground">No game finished yet in this set.</p>
      ) : (
        <ol className="divide-y overflow-hidden rounded-3xl border-[1.5px] bg-card">
          {games.map(({ game, number }) => (
            <li key={number} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xl text-primary type-display">
                {number}
              </span>
              <span className="min-w-0 flex-1 truncate text-[1.0625rem] type-label">{teamName(match.teams[game.winner])}</span>
              <span className="shrink-0 text-sm text-muted-foreground">{gameSummary(game)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
