import { ChevronDown, Pencil, Radio, Repeat, Scale, Trash2, UserPlus, Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { Route } from "@/App"
import { Button } from "@/components/ui/button"
import {
  canAddOrganiser,
  canShare,
  canShareLive,
  hasLink,
  isOrganiser,
  scoreLockOn,
} from "@/lib/live"
import { computeStandings, finalStandings, keptAsScored, placesMovedByScaling, playerNames, winners } from "@/lib/standings"
import { randomId } from "@/lib/ids"
import {
  addPlayer,
  cleanPlayerName,
  removePlayer,
  previousSetup,
  renameTournament,
  scoresMadeAgain,
  setScore,
  unscoredMatchCount,
  type HowLong,
} from "@/lib/tournament"
import type { PlayerId, Score, Tournament } from "@/lib/types"
import { Screen } from "@/components/screen"
import { ScoreEntry } from "@/components/score-entry"
import { ConfirmSheet } from "@/components/ui/confirm-sheet"
import { Congrats } from "@/components/congrats"
import { BroadcastSheet, FinishedFooter, GameMissing, LinkSpinner, MoreButton } from "@/components/game-parts"
import { LiveBadge } from "@/components/live-badge"
import { Menu, MenuItem } from "@/components/ui/menu"
import { NewBadge } from "@/components/new-badge"
import { useOnline } from "@/components/online"
import { PlayersForm } from "@/components/players-form"
import { RenameForm } from "@/components/rename-form"
import { RoundsList } from "@/components/rounds-list"
import { ScalingSheet } from "@/components/scaling-sheet"
import { renderShareCard } from "@/components/share-card"
import { Sheet } from "@/components/ui/sheet"
import { ScoreNote } from "@/components/shared-tag"
import { useNav } from "@/components/nav"
import { Toast, type ToastMessage } from "@/components/ui/toast"
import { useGame } from "@/components/use-game"
import { StandingsTable } from "@/components/standings-table"
import { Tabs } from "@/components/ui/tabs"

type Tab = "rounds" | "standings"
type Editing = { round: number; court: number }

// Scored here just as another organiser made that round again.
const madeAgain = (before: Tournament, after: Tournament): ToastMessage | null =>
  scoresMadeAgain(before, after) > 0 ? { text: "That match was made again. Score it again.", failed: true } : null

// The result image: every player, and the top three for the screen.
const renderImages = (t: Tournament) => {
  const rows = finalStandings(t)
  return Promise.all([renderShareCard(t, rows), renderShareCard(t, rows, { podiumOnly: true })])
}

// watch: opened from a shared link, so the tournament may not be on this
// phone yet. scoreKey: the end of that link when it makes a friend an organiser.
export function TournamentScreen({ id, watch = false, scoreKey }: { id: string; watch?: boolean; scoreKey?: string }) {
  const nav = useNav<Route>()
  const {
    game: tournament,
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
  } = useGame<Tournament>({ kind: "americano", id, watch, scoreKey, check: madeAgain, render: renderImages })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [tab, setTab] = useState<Tab>("rounds")
  // Which sheet (other than score entry) is open.
  const [confirm, setConfirm] = useState<
    "menu" | "rename" | "players" | "finish" | "delete" | "congrats" | "scaling" | null
  >(null)
  // The last opened match, kept after closing so the sheet still has
  // content while it slides away.
  const [shown, setShown] = useState<Editing | null>(null)
  const fullStandings = useRef<HTMLHeadingElement>(null)
  const online = useOnline()

  // A finished tournament opens on its standings, and so does one that
  // gets finished.
  const finished = tournament?.finished === true
  const [wasFinished, setWasFinished] = useState(false)
  if (finished !== wasFinished) {
    setWasFinished(finished)
    if (finished) setTab("standings")
  }

  // Rounds scrolls itself to the round being played; standings always
  // start at the top, whatever the scroll was.
  useEffect(() => {
    if (tab === "standings") fullStandings.current?.closest("main")?.scrollTo({ top: 0 })
  }, [tab])

  if (!tournament) {
    return <GameMissing loading={tournament === undefined} watch={watch} text="This tournament is no longer on this phone." />
  }

  const nameOf = playerNames(tournament.players)
  const team = (ids: PlayerId[]) => ids.map((i) => nameOf.get(i)).join(" & ")
  const unscored = unscoredMatchCount(tournament)
  // A friend's game: deleting it here removes only this phone's copy.
  const mine = tournament.shared !== true
  // Organisers score, rename, finish and hand out the links; anyone else
  // only watches, and is never shown what they can't do.
  const organiser = isOrganiser(tournament)
  // Why the game can't be changed here right now, if it can't.
  const lock = scoreLockOn(tournament, online)
  // With no connection what this phone may do stays on screen, greyed out;
  // what it may never do is not shown at all.
  const offline = lock === "offline"
  // Scores are still being sent. Once finished, nothing changes any more.
  const showLive = live && !tournament.finished
  const playerIds = tournament.players.map((p) => p.id)
  const final = tournament.finished || unscored === 0
  const notScaled = keptAsScored(tournament.players)
  const standings = computeStandings(playerIds, tournament.rounds, { final, notScaled })
  // Who the scaling for fewer games moved up or down; nobody before the end.
  const moved = final ? placesMovedByScaling(playerIds, tournament.rounds, notScaled) : undefined
  // Not everyone has played the same number of games, or might not have by
  // the end: worth explaining how that is evened out.
  const unevenGames = unscored > 0 || new Set(standings.map((r) => r.played)).size > 1

  const saveScore = (score: Score | null) => {
    if (!editing) return
    const { round, court } = editing
    update((t) => setScore(t, round, court, score))
    setEditing(null)
  }

  const finish = () => {
    setConfirm("congrats")
    setTab("standings")
    update((t) => ({ ...t, finished: true }))
  }

  const shownMatch = shown && tournament.rounds[shown.round]?.matches.find((m) => m.court === shown.court)

  const add = (name: string, howLong: HowLong) => {
    setConfirm(null)
    update((t) => addPlayer(t, name, howLong, { newId: randomId }))
    setToast({ text: `${cleanPlayerName(name)} is in` })
  }

  const leave = (playerId: PlayerId, howLong: HowLong, scaleUp: boolean) => {
    setConfirm(null)
    update((t) => removePlayer(t, playerId, howLong, scaleUp))
  }

  const playAgain = () => {
    setConfirm(null)
    nav.push({ name: "new", from: previousSetup(tournament) })
  }

  const footer = tournament.finished ? (
    <FinishedFooter onPlayAgain={playAgain} onShare={share} canShare={image !== null} />
  ) : !organiser ? undefined : tab === "standings" || unscored === 0 ? (
    <Button
      size="lg"
      variant={unscored === 0 ? "ball" : "secondary"}
      disabled={offline}
      onClick={() => setConfirm("finish")}
    >
      Finish tournament
    </Button>
  ) : undefined

  return (
    <Screen
      title={tournament.name}
      // A tournament always opens straight from home, so back is home; once
      // it's finished, say so with a home icon.
      homeButton={tournament.finished}
      toolbar={
        <Tabs
          options={[
            ["rounds", "Rounds"],
            ["standings", "Standings"],
          ]}
          value={tab}
          onChange={setTab}
        />
      }
      action={<MoreButton onClick={() => setConfirm("menu")} />}
      footer={footer}
    >
      {saveError && (
        <p className="mt-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          The last score couldn't be saved on this phone. It's still shown here; enter it again to retry.
        </p>
      )}
      <ScoreNote shared={!mine} lock={lock} />
      {tab === "rounds" ? (
        <RoundsList
          tournament={tournament}
          locked={tournament.finished || lock === "watch"}
          disabled={offline}
          live={showLive}
          nameOf={nameOf}
          team={team}
          onEdit={(round, court) => {
            setEditing({ round, court })
            setShown({ round, court })
          }}
        />
      ) : (
        <div className="pt-4">
          {tournament.finished && (
            <div className="mb-6">
              <div className="min-h-48 overflow-hidden rounded-3xl bg-primary">
                {image && <img src={image.previewUrl} alt="Top three" className="block w-full" />}
              </div>
              {/* The card can fill a small screen; make it obvious there's more below. */}
              <button
                type="button"
                onClick={() => fullStandings.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="mx-auto mt-1 flex items-center gap-1 py-3 text-sm font-medium text-primary"
              >
                Full standings
                <ChevronDown className="size-4" />
              </button>
            </div>
          )}
          <div className="mb-1 flex items-center justify-between">
            <h2 ref={fullStandings} className="scroll-mt-2 px-1 text-[1.375rem] type-display">
              {tournament.finished ? "Full standings" : "Standings so far"}
            </h2>
            {unevenGames ? (
              // Scales: points are evened out between players. The label says for whom.
              <button
                type="button"
                aria-label="How points are counted when players have played fewer games"
                onClick={() => setConfirm("scaling")}
                className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary active:bg-muted"
              >
                <Scale className="size-4.5" strokeWidth={2.5} />
                Fewer games
              </button>
            ) : (
              // Keeps the heading where it is when there is nothing to explain.
              <span className="h-11" />
            )}
          </div>
          <div className="relative">
            {showLive && <LiveBadge />}
            <StandingsTable
              rows={standings}
              nameOf={nameOf}
              moved={moved}
              left={new Set(tournament.players.filter((p) => p.left).map((p) => p.id))}
            />
          </div>
        </div>
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
      {sharing && <LinkSpinner />}

      <Sheet open={editing !== null} onClose={() => setEditing(null)}>
        {shown && shownMatch && (
          <ScoreEntry
            key={`${shown.round}-${shown.court}`}
            match={shownMatch}
            teamName={(s) => team(s === "a" ? shownMatch.teamA : shownMatch.teamB)}
            target={tournament.target}
            mode={tournament.scoringMode}
            onSave={saveScore}
            onClear={() => saveScore(null)}
          />
        )}
      </Sheet>

      <Sheet open={confirm === "menu"} onClose={() => setConfirm(null)}>
        <Menu>
          {organiser && (
            <>
              {/* Names and players are changed online once there are other
                  organisers: not offline. */}
              <MenuItem icon={Pencil} label="Edit names" offline={offline} onClick={() => setConfirm("rename")} />
              {!tournament.finished && (
                <MenuItem
                  icon={Users}
                  label="Add or remove players"
                  offline={offline}
                  badge={<NewBadge until="2026-10-30" />}
                  onClick={() => setConfirm("players")}
                />
              )}
              {/* A game can't be put online with no connection. */}
              {canShareLive && canShare(tournament) && (
                <>
                  <MenuItem icon={Radio} label="Broadcast live" offline={!online} onClick={() => {
                      setConfirm(null)
                      askOrShare("watch")
                    }} />
                  {canAddOrganiser(tournament) && (
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
            </>
          )}
          {/* A finished tournament has this in its footer. */}
          {!tournament.finished && <MenuItem icon={Repeat} label="Play again" onClick={playAgain} />}
          <MenuItem icon={Trash2} label="Delete tournament" destructive onClick={() => setConfirm("delete")} />
        </Menu>
      </Sheet>

      <Sheet open={confirm === "rename"} onClose={() => setConfirm(null)}>
        {confirm === "rename" && (
          <RenameForm
            tournament={tournament}
            onSave={(name, playerNames) => {
              setConfirm(null)
              update((t) => renameTournament(t, name, playerNames))
            }}
          />
        )}
      </Sheet>

      <Sheet open={confirm === "players"} onClose={() => setConfirm(null)}>
        {confirm === "players" && <PlayersForm tournament={tournament} onAdd={add} onRemove={leave} />}
      </Sheet>

      {/* With every match scored there's nothing left to keep playing. */}
      <ConfirmSheet
        open={confirm === "finish"}
        onClose={() => setConfirm(null)}
        title="Finish the tournament?"
        cancelLabel={unscored > 0 ? "Keep playing" : undefined}
        confirmLabel="Finish"
        onConfirm={finish}
      >
        Scores can't be changed once a tournament is finished.
        {unscored > 0 &&
          ` ${unscored} ${unscored === 1 ? "match still has" : "matches still have"} no score; anyone left with fewer games gets their points scaled up.`}
      </ConfirmSheet>

      <ScalingSheet open={confirm === "scaling"} onClose={() => setConfirm(null)} finished={tournament.finished} />

      <Sheet open={confirm === "congrats"} onClose={() => setConfirm(null)}>
        <Congrats
          winnerNames={winners(standings).map((id) => nameOf.get(id) ?? "")}
          canShare={image !== null}
          onShare={share}
          onClose={() => setConfirm(null)}
        />
      </Sheet>

      <BroadcastSheet open={asking} passes={asked.passes} onClose={stopAsking} onConfirm={() => shareLink(asked.link)} />

      <ConfirmSheet
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title={`Delete ${tournament.name}?`}
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
          ? "Only your copy is removed; the organiser still has the tournament."
          : hasLink(tournament.id)
            ? "The link stops working, but friends who opened it keep their copy until they delete it themselves."
            : "The schedule and every score will be removed from this phone."}
      </ConfirmSheet>
    </Screen>
  )
}
