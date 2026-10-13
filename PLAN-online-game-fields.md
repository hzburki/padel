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
- `fromOnline(raw)`: the other way, checked with a Zod schema; throws on anything malformed. A game must
  survive `fromOnline(toOnline(event))` unchanged.
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

## Where the working tree stands

The first fix from 2026-10-13 (the `rev` count, the 3-second reads, the Lite SDK, forced long polling) was
removed on 2026-10-14: `src/lib/live.ts`, `src/lib/broadcast.ts`, their tests, `README.md`, `CLAUDE.md` and
`shots/flows-scoring.shots.ts` are back at their committed versions. So the code this plan starts from still
has `changeLive`, `catchUp` and the JSON string, and step 4 removes them.

The only uncommitted change that belongs to this plan is `zod` in `package.json` and `package-lock.json`.

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
