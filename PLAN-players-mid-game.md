# Add or remove players during an Americano tournament

## Context

Friends turn up late or leave early. Today the player list is fixed once a tournament starts, so the
organiser has to start a new one and lose the scores. This adds a way to add or remove a player while
the tournament is on, keeping every score already entered.

Mockup agreed in chat: https://claude.ai/artifact/7yWoKYVPSuDkkk15Qr8u6Z (the setup form in it is not
exact; it gets fixed against the real screen while coding).

## The rules we agreed

**Scope**
- Americano only. A Match (2 v 2) never gets this.
- Off by default. The organiser turns it on at setup, under "Advanced". It can't be turned on later.
- The organiser and scorers can both add and remove. Watchers can't.

**Setup, under "Advanced"** (closed by default, at the bottom of the form, below Rounds)
- Switch: "Add or remove players", off by default. A plain row, no border or rounded box.
- Shown only when the switch is on, each with its default picked:
  - A player who joins late: **Rotates in** (default) or **Catches up**.
  - A player who leaves keeps their: **Real points** (default) or **Scaled points**.

**What a change does to the schedule**
- Rounds up to and including the last round with any score stay exactly as they are.
- Every round after that is made again with the new list of players. The number of rounds stays the same.
- New rounds still put "partner someone new" first, counting who already partnered in the kept rounds.
- A half-scored round is left alone. The scorers enter whatever they want there.
- Nobody is left in a match of three: a leaver's partner and opponents get new matches. Fewer players
  can mean fewer courts in play (8 on 2 courts losing one becomes 7 on 1 court, 3 sitting).
- Removing is blocked at 4 players. Changes are blocked when no unscored round is left, and once finished.

**Joiners**
- Start on 0 points.
- Rotates in: for sitting out, they count as having the fewest games anyone has now, so they take
  turns like everyone else. At the end their points are scaled up for fewer games (rule that exists).
- Catches up: they start on 0 games, so the "most games sits" rule keeps them on court until level.
  If they can't get level by the end, they are scaled up like "Rotates in". When nobody sits out
  (say 8 players on 2 courts) there is nothing to catch up with; they just play every round.

**Leavers**
- Stay in the standings, greyed, with a "Left" badge.
- Real points: never scaled. Scaled points: scaled at the end like anyone with fewer games.
- Can't come back. The confirm sheet says so before the tap. Their name can't be reused either.

**Menu and badges**
- New line in the tournament's ••• menu: "Add or remove players". Hidden when the switch was off, when
  the tournament is finished, and for watchers. Greyed when the game is scored online and the phone is
  offline (the existing offline note says why).
- A small lime "New" badge (same look as "Playing now") on "Add or remove players" and on
  "Add a scorer". No coloured row. Both badges stop showing from the start of 20 Oct 2026. A comment by
  the date says the badge code can be removed, and only that code, once the date has passed.
- Not in this plan: Play again and Delete for an offline scorer (another feature).

**Players sheet**
- The same chips, × and "Next player" field as the setup form. A player who left has no ×.
- × or + opens a confirm: a strip of round numbers (grey: scores stay, blue: new matches), one short
  line, Cancel and the action.
- After: a toast, like "Finn added. Rounds 4 to 7 changed".

## Stored tournament

Three optional additions in `src/lib/types.ts`. Old saves load as they are, so no version bump and no
migration (same reasoning as the `setsAs` / `scoreBy` note in `src/lib/storage.ts`).

```ts
interface Player {
  left?: true         // removed mid-tournament; kept for old rounds and the standings
  headStart?: number  // games counted for sitting out only, for a joiner who rotates in
}
interface Tournament {
  // Missing: the players are fixed once it starts.
  playerChanges?: { joiner: "rotate" | "catchUp"; leaver: "real" | "scaled" }
}
```

## Slices

One at a time. After each: `npm test`, `npm run lint`, a change brief, then I wait for your review.
Nothing is committed (your standing rule); the work sits on `dev` on top of what is already there.

### 1. The scheduler carries on from played rounds
- `src/lib/americano.ts`: `generateSchedule` takes the rounds already played and a head-start map.
  `buildSchedule` starts its partner and opponent counts from those rounds (the counting loop in
  `scheduleCost` already does this; reuse it) and adds the head start to `countGamesPlayed` before
  `pickBench`. It returns only the new rounds.
- `src/lib/americano.test.ts`: new rounds don't repeat a partner from the played rounds when a new one
  is free; a head start makes a joiner sit in turn; without one the joiner is not benched until level;
  games stay within one of each other among the players who were there from the start.

### 2. Adding and removing, as pure functions
- `src/lib/tournament.ts`:
  - `SetupInput.playerChanges`, copied by `createTournament`; `previousSetup` carries it and leaves out
    players who left.
  - `roundsKept(t)`: how many rounds stay.
  - `addPlayerProblem(t, name)` and `canRemovePlayer(t, id)`: the blocks listed above, reusing
    `cleanPlayerName` and `duplicateName`.
  - `addPlayer(t, name, { newId, rng })` and `removePlayer(t, id, { rng })`: keep the first rounds,
    call `generateSchedule` for the rest with the players still in.
- `src/lib/tournament.test.ts`: one plain-sentence test per rule in "What a change does".

### 3. Standings for leavers
- `src/lib/standings.ts`: `computeStandings` takes the ids that are never scaled.
  `placesMovedByScaling` passes it on.
- `src/lib/tournament.ts`: `neverScaled(t)`: the leavers when `leaver` is "real", otherwise nobody.
- `src/components/tournament-screen.tsx`, `src/components/standings-table.tsx`: pass it in; grey row and
  "Left" badge.
- `src/components/share-card.ts`: same standings, no badge on the image.
- Tests in `src/lib/standings.test.ts`.

### 4. Setup form
- `src/components/new-tournament-screen.tsx`: the "Advanced" heading that opens and closes, the switch
  row, and two `Segmented` questions with a `Hint` under each (all three already exist there).
- `shots/taps.ts`: `fillAmericano` learns the switch.

### 5. Menu, Players sheet and "New" badges
- `src/components/players-sheet.tsx` (new): chips, field, confirm with the round strip.
- `src/components/tournament-screen.tsx`: the menu line, the sheet, the toast. Changes go through the
  existing `update()`, so a game scored online is changed online on top of friends' scores.
  No change to `firestore.rules`: a scorer may already change the whole game.
- `src/components/new-badge.tsx` (new): the badge and its end date, used on both menu lines (and in
  `match-screen.tsx` if "Add a scorer" is there too).
- `shots/flows-americano.shots.ts`: a flow that plays three rounds, removes one player, adds another and
  finishes. `shots/flows-sharing.shots.ts`: a scorer adds a player and the organiser sees it.

### 6. Docs
- `README.md`: the feature, for players and developers.
- `CLAUDE.md`: "Pairings are fixed up front" gets its one exception; Persistence mentions the new fields.

## Checking it works

- `npm test` and `npm run lint` after every slice.
- In the browser at 390 × 844 on port 5199: start with 5 players and the switch on, score 3 rounds,
  remove one, add one, finish. Check the kept scores, the new rounds, the "Left" row and the image.
- With `npm run emulators`: organiser on 5199, scorer on 5198. The scorer adds a player; both phones
  show the same rounds. Turn the scorer's connection off: the menu line is greyed.
- A tournament saved before this change still opens and has no menu line.
- `npm run shots`. New and changed screen images are shown to you first; none is replaced without your yes.

## Watch out

- With "Catches up" and nobody sitting out, the option does nothing. No extra matches are invented.
- A leaver's unscored match in a kept, half-scored round stays unscored unless someone enters a score.
- The share image lists a leaver like any other player.
- The setup "Advanced" layout is the least settled part of the design; expect a round of changes there.
