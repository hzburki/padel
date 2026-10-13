# Store a broadcast game online as proper fields, not one JSON string

## Context

A game with more than one organiser failed on two phones on 2026-10-13: scores arrived late, one round
behind, and the owner's last score disappeared from their own phone.

Plain "Broadcast live" worked for two hours with 15 people on the same kind of phones, so the network and
Firestore's stream are fine. What only the several-organisers path has is the cause:

- The game is one JSON string (`json`) in the Firestore document. Changing one score means reading the
  whole game, changing it and writing it all back, in a transaction (`changeLive`).
- A transaction goes around Firestore's own handling of local writes. `live.ts` then imitates that
  handling by hand: `isChanging`, `seen`, a queue of changes, a 5-second limit, and a "read from the
  server" after each change (`catchUp`).
- That read is answered from the stream whenever a listener is open (checked in the SDK source), so it can
  return the copy from before the phone's own score. The app showed that copy and saved it over the good
  one.

## What we agreed (2026-10-14)

- The online copy becomes proper fields. A score is one field write: no read first, no waiting.
- The screen is optimistic: send to Firestore, and on the next line save on the phone and show it.
- Updates reach other phones by the stream only. Coming back from the background reopens the listener,
  which pulls the newest copy once.
- No long polling setting, no reads on a timer, no Lite SDK.
- The copy on the phone (IndexedDB) keeps its shape. Only the online shape changes.
- Zod checks what arrives from Firestore before it is shown or saved. Already installed (`zod` ^4.6.7).
- The user publishes `firestore.rules`.

## The online document

`live/{id}`:

```
owner: uid
closed?: true            as now
handover?: true          as now
game: {                  everything an organiser may change is inside this one map
  kind: "americano"
  name, createdAt, finished
  scoringMode, target, courts
  players: { <playerId>: { name, order } }
  rounds:  [ { matches: [ { court, teamA: [id, id], teamB: [id, id] } ], benched: [id] } ]
  scores:  { "<round>_<court>": { a, b } }      one entry per scored match; none when not scored
}
```

A match:

```
game: {
  kind: "match"
  name, createdAt, finished
  teams: { "0": [name, name], "1": [name, name] }   Firestore can't hold a list inside a list
  bestOf, setsAs, gamesPerSet, deuce, scoreBy
  points: { "0": 0, "1": 1, ... }                   one entry per point (or game), keyed by its number
}
```

Why maps and not lists for scores, player names and points: Firestore can't change one item of a list. A
write replaces the whole list, so two organisers scoring different courts would wipe each other. With a map,
each writes its own key.

What that gives:

- Two organisers scoring different courts: both kept.
- Two organisers scoring the same court: the last one wins.
- Two organisers tapping the same match point at the same moment: counted once (same key).
- A phone never sees a copy from before its own write: Firestore guarantees that for ordinary writes.

## The code

**New pure module `src/lib/online-game.ts`** (with tests):

- `toOnline(event)`: the phone's game as the `game` map above.
- `fromOnline(id, document)`: the other way, checked with a Zod schema; throws on anything malformed. A game
  must survive `fromOnline(id, { game: toOnline(event) })` unchanged.
- `changedFields(before, after)`: compares two `game` maps and returns the field paths that differ
  (`"game.scores.2_1"`, `"game.finished"`, `"game.points.14"`), with a marker for a field that was
  removed. Maps are walked into; lists and plain values are written whole. This keeps `setScore`,
  `renameTournament`, `addPoint` and `undoPoint` as they are: the screen applies them on the phone, and the
  difference is what goes online.

**`src/lib/live.ts`:**

- `send` (whole document, plain broadcast only) writes `{ owner, game: toOnline(event) }`.
- New `sendChange(before, after)` for a game with an organiser link: one `updateDoc` with
  `changedFields`. Not waited for by the screen. It rejects only when Firestore refuses the write; the
  listener then puts the screen back by itself, and the screen says "Not saved. Try again".
- Readers use one function for a snapshot: `game` map through `fromOnline`, or an old `json` string through
  `migrate` (see Migration).
- `takeOver` keeps its transaction: it changes who owns the game, which must happen once.
- Deleted: `changeLive`, the `changes` and `waiting` maps, `isChanging`, `inTime` around changes,
  `catchUp`, `followers` / `followed` and the `getDocFromServer` import.
- Kept as it is: closing a broadcast, handing a game over, the 6-hour finish, delete, the offline lock for a
  game with several organisers.

**Screens (`tournament-screen.tsx`, `match-screen.tsx`):** `update` becomes: work out `next`, show it, save
it on the phone, then `pushLive(next)` or `sendChange(current, next)`. No `await` before the screen changes.

## Rules (`firestore.rules`, tested in `shots/rules.shots.ts`)

- The document may hold only `owner`, `game`, `closed`, `handover`.
- `game` must be a map with a known `kind`, a short `name`, numbers and booleans of the right type, and
  `players` / `rounds` / `scores` / `points` of the right kind and a bounded size. Rules can't walk into
  every entry of a map; Zod does that on the phones.
- An added organiser may change only `game`, and inside it only `name`, `finished`, `players`, `scores`
  (Americano) or `name`, `finished`, `points` (match). Not the schedule, the rules of the match, `kind` or
  `createdAt`.
- An added organiser can't change a copy that has no `game` map yet (an old `json` copy).
- During the changeover the old shape (`owner`, `json`, `closed`, `handover`) is still accepted, so the
  rules can be published before the new build. Remove that branch, and the rest of the old-shape support, after
  2026-10-28 (two weeks, decided 2026-10-14).

## Migration

- Nothing changes on the phones.
- A reader accepts an old `json` copy as well as the new one.
- A plain broadcast is sent whole on every save and when the app starts, so it becomes the new shape by
  itself.
- A game with an organiser link is never sent whole: the owner's phone rewrites an old copy once, when it
  opens the game (`game` set, `json` removed).
- A phone still on the old build can't read a new copy until it reloads. The app updates itself on the
  next visit.

## Tests

- `online-game.test.ts`: round trip for an Americano and a match; every kind of change gives exactly the
  field it should; malformed copies are refused.
- `live.test.ts`: the several-organisers parts are rewritten. Its fake games must become whole, valid
  games, since `toOnline` reads every field.
- `shots/flows-scoring.shots.ts`: existing flows must still pass. Add one where a phone's stream is silent
  (`page.route` holding back `GET .../Listen/channel`): the phone's own scores must stay on its screen.
- `shots/rules.shots.ts`: rewritten for the new fields.
- To see a late stream locally: a small proxy in front of the Firestore emulator that holds back the body of
  `GET .../Listen/channel`, with `page.route` sending one phone's stream through it.

## Order of work

1. `online-game.ts` and its tests. Nothing uses it yet.
2. Rules and their tests, accepting both shapes.
3. `live.ts`: write and read the new shape for a plain broadcast. Old flows pass.
4. `live.ts` and the two screens: `sendChange` replaces `changeLive`; delete what the list above names.
5. Owner upgrades an old copy; README and CLAUDE.md.

## Where the work stands (2026-10-14)

How to work, from the user: stop after each slice, post the change brief and wait. Don't commit. Unit
tests, lint, the tapped flows and the rules tests may be run, on the local emulators (ports 5199, 8080,
9099). No stored image is compared or replaced. The rules are the user's to publish: give console steps
after slice 2.

**Slice 1 is done** (`src/lib/online-game.ts` and its tests; 462 unit tests pass). Nothing uses it yet.
Slice 2 is next. What slice 1 does differently from the text above:

- `fromOnline(id, document)` takes the game's id and the whole document (`{ game?, json? }`), not the
  `game` map. An old `json` string is read through `migrate` there, and wins when both are present. Marked
  `LEGACY, remove after 2026-10-28` in the code and its tests. So `live.ts` needs no reader of its own.
- `changedFields` walks one level into `game`: an entry of a map (one score, one player, one point) is sent
  whole. That is what makes "the latest write stays" true for two organisers on the same court.
- It returns `{ path: value }` with the `REMOVED` symbol for a field that is gone; `live.ts` turns that into
  `deleteField()`.
- The online copy has no `id`, `version` or `shared`.

**Slice 2 is done** (`firestore.rules` and `shots/rules.shots.ts`; 29 rules tests pass, and the sharing and
scoring flows still pass in both engines with the app still writing `json`). Not published: that is the
user's to do, in the console. Slice 3 is next. What slice 2 does beyond the note below:

- A takeover may change `owner`, `handover` and `closed` only. Before, the scorer taking a game could
  rewrite the game in the same write.
- The owner may turn an old copy into the new one (`game` set, `json` removed) in one write; an added
  organiser may not. That is what slice 5 needs.
- Whole numbers with a top: `target` 1 to 64, `courts` 1 to 50, `gamesPerSet` 1 to 12 (the app offers 8 to
  32, up to players / 4, and 2 to 9). `createdAt` is any number.

Decided by the user: when organisers act on the same round, match or game, the latest write stays. No
merging, no repair. Edge cases are collected in `EDGE-CASES-online-game-fields.md` for review at the end;
add to it, and correct the ones marked with a slice number if the code turns out different.

Notes for the slices to come:

- **Slice 2, rules.** A document is the new shape or the old one, never both (`json` beside `game` is
  refused). An added organiser on a new copy: only `game` changes, and in it only `name`, `finished`,
  `players`, `scores` (Americano) or `name`, `finished`, `points` (match); use `'game' in resource.data` so an
  old copy is refused for them. On an old copy an old build may still change `json` only. Takeover: let it
  change `owner`, `handover` and `closed` only, which fits the old build's `set({ owner, json })` and the new
  build's update. Sizes: name 200, players 200, rounds 100, `scores` and `points` 5,000. In
  `shots/rules.shots.ts` the REST body needs maps, lists and whole numbers, and a path in `updateMask` that
  starts with a digit needs backticks: ``game.scores.`0_1` ``. The emulator warm-up in `shots/taps.ts` writes
  the old shape and can stay until the old shape goes.
- **Slice 3, plain broadcast.** `send` writes `{ owner, game: toOnline(event) }`. Adding an organiser puts
  the game online with `send` first, so `changeLive` would find no `json`: until slice 4 removes it, it must
  read with `fromOnline` and write `{ game: toOnline(next) }`. The fake games in `live.test.ts` become whole
  games here. Three things in `live.ts` read `json` straight from the snapshot and break on a new copy, so
  they change in this slice, not later:
  - `takeOver` writes `{ owner, json: online.get("json") }`: on a new copy `json` is undefined and the write
    throws. Make it the update of `owner` with `handover` removed now (the rules already allow only that).
  - `openOwn` skips a snapshot whose `json` equals the last one `seen`: on a new copy both are undefined, so
    every snapshot after the first is skipped. Compare the `game` map instead (as a string), or drop the
    check here if slice 4's reason for dropping it already holds.
  - `openOwn` and `openFriends` read with `migrate(JSON.parse(snapshot.get("json")))`: both become
    `fromOnline(id, snapshot.data())`.

  The hosted rules must be published before a build with this slice is deployed: the old rules refuse a
  copy with `game`. The tapped flows were last run before the number limits went into the rules; this
  slice runs them anyway. The two games in `shots/rules.shots.ts` are written by hand and not type-checked:
  if the online shape changes, change them too.
- **Slice 4, `sendChange`.** `takeOver` becomes an update of `owner` with `handover` removed, so it works on
  either shape. The owner's listener keeps ignoring a snapshot that is `fromCache`: reopened after the page
  was hidden, it can hand back an older copy than the phone has. Drop its `seen` check: after a refused
  write the copy that comes back equals the last one seen, and would be skipped, leaving the refused score
  on the phone. The 6-hour finish becomes a `sendChange` of `finished`. Mark the game ended once the write
  that finishes it has gone through.
- **Slice 5.** The owner's phone rewrites an old copy when its listener first sees one (`game` set, `json`
  removed). The paragraph in `CLAUDE.md` about a game with more than one organiser names `changeLive`.

`shots/tmp-hosted.shots.ts`, `tmp-hosted.config.ts` and the change to `src/components/copy-link.ts` are older
and not part of this.

## Still open

- A score made just as the connection drops is on the phone but not yet online. If the app is closed before
  the connection is back, it never goes online, and the next open takes the online copy. Planned in
  `PLAN-offline-scores.md`.
- Firestore indexes every field of a map by default. `scores` and `points` add a few hundred index entries
  a game: harmless at this size, and it can be switched off for `game` in the console.
- `PLAN-players-mid-game.md` lets added organisers change the schedule. When that is built, the rules must
  let them write `rounds` too; `changedFields` already sends a changed schedule whole.
