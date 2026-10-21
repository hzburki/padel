import { useEffect, useRef, useState } from "react"
import type { Route } from "@/App"
import { changesOnline, closesAnother, deleteLive, isSending, openGame, passesOn, pushLive, sendChange } from "@/lib/live"
import { deleteTournament, saveTournament } from "@/lib/storage"
import type { SavedEvent } from "@/lib/types"
import { copyLink } from "./copy-link"
import { useNav } from "./nav"
import { shareOrDownload } from "./share-card"
import type { ToastMessage } from "@/components/ui/toast"

type Link = "watch" | "organise"

// What the tournament and match screens share: the game, from this phone or
// followed online; saving each change to it; its links, its result image,
// and deleting it.
// kind: the kind this screen shows; a game of the other kind counts as not found.
// check: what to say when a copy comes in from online, if anything.
// render: the result image, full and as the on-screen preview.
// Keep check and render outside the component, so they are the same
// functions every render.
export function useGame<G extends SavedEvent>({
  kind,
  id,
  watch,
  scoreKey,
  check,
  render,
}: {
  kind: G["kind"]
  id: string
  watch: boolean
  scoreKey?: string
  check?: (before: G, after: G) => ToastMessage | null
  render: (game: G) => Promise<[full: Blob, preview: Blob]>
}) {
  const nav = useNav<Route>()
  const toNotFound = nav.replace
  const [game, setGame] = useState<G | null | undefined>(undefined)
  const [saveError, setSaveError] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  // Being sent from this phone, or followed on a friend's.
  const [live, setLive] = useState(false)
  // Counts the links made here: the game is opened again after each, since
  // an organiser link changes how it is followed.
  const [links, setLinks] = useState(0)
  // The link is being made.
  const [sharing, setSharing] = useState(false)
  // The organiser is asked about their other broadcast: which link they
  // asked for, and whether that game passes to another organiser.
  const [asking, setAsking] = useState(false)
  const [asked, setAsked] = useState<{ link: Link; passes: boolean }>({ link: "watch", passes: false })
  const [image, setImage] = useState<{ blob: Blob; previewUrl: string } | null>(null)
  const wasShared = useRef(false)
  // What the screen showed last, to tell what a copy from online took away.
  const lastShown = useRef<G | null>(null)
  useEffect(() => {
    lastShown.current = game ?? null
  }, [game])

  useEffect(
    () =>
      openGame(
        id,
        watch,
        (saved, following) => {
          const g = saved?.kind === kind ? (saved as G) : null
          // A link that leads nowhere gets the 404 page, saying why.
          if (!g && watch) return toNotFound({ name: "notFound", path: location.pathname, message: "This link doesn't lead to a game. The organiser may have deleted it, or part of the link is missing." })
          // A friend's game that became this phone's: its owner left it to
          // the other organisers.
          if (wasShared.current && g && !g.shared) setToast({ text: "This game is yours now" })
          wasShared.current = g?.shared === true
          const warning = lastShown.current && g && check ? check(lastShown.current, g) : null
          if (warning) setToast(warning)
          setGame(g)
          setLive(following)
        },
        scoreKey,
      ),
    [kind, id, watch, scoreKey, check, toNotFound, links],
  )

  // Render the share image ahead of time, so the Share tap can hand it to
  // the share sheet immediately (iOS only allows that during the tap).
  useEffect(() => {
    if (!game?.finished) return
    let url = ""
    let cancelled = false
    render(game).then(([blob, preview]) => {
      if (cancelled) return
      url = URL.createObjectURL(preview)
      setImage({ blob, previewUrl: url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
      setImage(null)
    }
  }, [game, render])

  // Save straight away: the phone may be locked or the tab killed any moment.
  // A game with other organisers also sends just what changed online, so
  // what they entered meanwhile is kept; the change shows here at once.
  const update = async (change: (g: G) => G) => {
    if (!game) return
    const next = change(game)
    if (next === game) return
    setGame(next)
    const scoredOnline = changesOnline(game)
    // Not waited for. If it is refused, the online copy puts the screen back.
    if (scoredOnline) sendChange(game, next).catch(() => setToast({ text: "Not saved. Try again", failed: true }))
    try {
      await saveTournament(next)
      setSaveError(false)
      if (!scoredOnline) pushLive(next)
    } catch {
      setSaveError(true)
    }
  }

  const share = () => {
    if (!game || !image) return
    const filename = `${game.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "padel"}.png`
    shareOrDownload(image.blob, filename, game.name)
  }

  // Put a copy online and copy the message with its link: the one for
  // watching, or the one that makes a friend an organiser too. copyLink
  // must start during the tap: nothing is waited for before it.
  const shareLink = async (link: Link) => {
    if (!game) return
    setAsking(false)
    setSharing(true)
    setToast(await copyLink(link, game))
    // The badge follows the game, not the copy.
    setLive(isSending(game.id))
    setSharing(false)
    setLinks((n) => n + 1)
  }

  // Going live takes the broadcast from any other game: say so first.
  const askOrShare = (link: Link) => {
    if (!game) return
    if (!closesAnother(game)) return shareLink(link)
    setAsked({ link, passes: false })
    setAsking(true)
    passesOn(game).then(
      (passes) => setAsked({ link, passes }),
      () => {},
    )
  }

  const remove = async () => {
    if (!game) return
    await deleteTournament(game.id)
    // Not waited for: with no connection it would never come back.
    deleteLive(game.id).catch(() => {})
    nav.back()
  }

  return {
    game,
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
    stopAsking: () => setAsking(false),
    shareLink,
    askOrShare,
    remove,
  }
}
