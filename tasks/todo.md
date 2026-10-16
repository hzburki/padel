# Tasks: Players join and leave a running Americano

Each task is one slice with a change brief at the end. Each one ends with `npm test` and `npm run lint`
passing, and the work left uncommitted.

## Phase 1: Shape

- [x] **T1: Stored shape v3 and migrate** (S)
  - Acceptance:
    - `types.ts` has `Player.left`, `Player.joinedAt`, `version: 3` on both kinds
    - `CURRENT_VERSION = 3`; v1 and v2 records load as v3
    - New games are made as v3
  - Verify: `npx vitest run src/lib/storage.test.ts`; `npm run build`
  - Files: `src/lib/types.ts`, `src/lib/storage.ts`, `src/lib/storage.test.ts`, `src/lib/tournament.ts`,
    `src/lib/set-match-setup.ts`, `src/lib/online-game.ts` (version literal only)
  - Depends on: none

- [x] **T2: Take out the switch; `left` holds the points choice** (S)
  - Acceptance:
    - The New game form is back to how it was before the switch
    - `Tournament.lateChanges`, `SetupInput.lateChanges`, `PreviousSetup.lateChanges` are gone, with their tests
    - `Player.left` is `{ scaleUp: boolean }`
  - Verify: `npx vitest run src/lib/tournament.test.ts`; `npm run build`; 5199 at 390 × 844; screen image
    matches the old one again
  - Files: `src/lib/types.ts`, `src/lib/tournament.ts`, `src/lib/tournament.test.ts`,
    `src/components/new-tournament-screen.tsx`
  - Depends on: T1

### Checkpoint A
- [ ] Old games load; a new game saves as v3 with no extra field; build passes

## Phase 2: The rules (pure)

- [x] **T3: Rounds left for Same matches** (S)
  - Acceptance:
    - Replaces `roundsToLevel`: aims for the matches each player was due before the change
    - More rounds for a join, fewer for a leave, more when a leave drops to 1 court
    - Picks a count where everyone ends level, ties to more; falls back to within one; never over the limit
  - Verify: `npx vitest run src/lib/americano.test.ts`
  - Files: `src/lib/americano.ts`, `src/lib/americano.test.ts`
  - Depends on: T2

- [x] **T4: Rebuild rounds from kept rounds** (S, mostly done)
  - Acceptance:
    - `continueSchedule` counts the kept partners and opponents first (done)
    - The bench count drops the catch-up flag; renamed so it doesn't say "credit"
    - Only players still in are placed or benched; courts used `min(courts, floor(in / 4))` (done)
  - Verify: `npx vitest run src/lib/americano.test.ts src/lib/bench.test.ts`
  - Files: `src/lib/americano.ts`, `src/lib/americano.test.ts`, `src/lib/bench.ts`, `src/lib/bench.test.ts`
  - Depends on: T3

- [x] **T5: addPlayer and removePlayer** (M)
  - Acceptance:
    - Both take Same time or Same matches; remove also takes Scale up or Keep as scored
    - Both keep every round up to the last one with a score, rebuild the rest, and set the round count
      with T3
    - A function gives the rounds left for each option, for the sheet to show before confirming
    - Problems: finished, shared copy, name taken (in or left), below 4 still in, unscored match in a kept
      round
    - Removed players get `left`; joiners get `joinedAt`
    - "Play again" drops players who left
  - Verify: `npx vitest run src/lib/tournament.test.ts`
  - Files: `src/lib/tournament.ts`, `src/lib/tournament.test.ts`
  - Depends on: T4

- [x] **T6: Final scaling leaves Keep as scored leavers out** (S)
  - Acceptance:
    - A leaver with `scaleUp: false` keeps their raw points in final standings; others as now
    - `placesMovedByScaling` and every final standings call site use the same option
  - Verify: `npx vitest run src/lib/standings.test.ts`
  - Files: `src/lib/standings.ts`, `src/lib/standings.test.ts`, `src/components/tournament-screen.tsx`,
    `src/components/tournament-list-screen.tsx`
  - Depends on: T2

### Checkpoint B
- [ ] All rules tested: kept rounds never change, rounds follow the option, scaling follows the choice

## Phase 3: In the app

- [x] **T7: Add a player** (M)
  - Acceptance:
    - "Players" in the menu under "Edit names", with the New badge (organisers, not finished), opens a
      sheet with the list and an add field
    - `NewBadge` takes an `until` date; "Add an organiser" keeps 2026-10-21, "Players" ends 2 weeks after this
      task
    - The sheet shows Same time and Same matches, each with its rounds left; Same matches picked; saves at once
    - With added organisers and no connection: greyed out with the offline icon
  - Verify: 5199 at 390 × 844, add a player mid game, reload, check rounds and saved game
  - Files: `src/components/tournament-screen.tsx`, a new `src/components/players-form.tsx`,
    `src/components/new-badge.tsx`
  - Depends on: T5

- [x] **T8: Remove a player** (M)
  - Acceptance:
    - Remove on each player still in; the warning says they can't come back
    - Asks how long to play (with rounds left) and their points (Scale up picked)
    - Blocked with a short reason when it would leave 3, or they have an unscored match in this round
    - "left" badge in the standings table
  - Verify: 5199, remove mid round, check standings and rounds after reload
  - Files: `src/components/players-form.tsx`, `src/components/tournament-screen.tsx`,
    `src/components/standings-table.tsx`
  - Depends on: T7, T6

### Checkpoint C
- [ ] Whole game played on 5199 with a join and a leave, offline; review with you

## Phase 4: Broadcast and wrap-up

- [x] **T9: Online copy carries the new fields** (S)
  - Acceptance:
    - `toOnline` / `fromOnline` / zod carry `left` and `joinedAt`; round trip tested
    - `changedFields` after a change sends only the changed player entries and `game.rounds`
  - Verify: `npx vitest run src/lib/online-game.test.ts`
  - Files: `src/lib/online-game.ts`, `src/lib/online-game.test.ts`
  - Depends on: T2

- [x] **T10: Rules let organisers rebuild rounds** (S)
  - Acceptance:
    - An added organiser may change `rounds` on an Americano
  - Verify: `npm run emulators` + `shots/rules.shots.ts`; by hand, 5199 organiser + 5198 added organiser,
    add and remove, the friend sees it
  - Files: `firestore.rules`, `shots/rules.shots.ts`
  - Depends on: T9, T8

- [x] **T11: Played game, README and CLAUDE.md** (S)
  - Acceptance:
    - A flow in `shots/flows-americano.shots.ts` plays a game, adds, removes, finishes
    - README mentions players joining and leaving; CLAUDE.md's Americano section says a roster change
      rebuilds unscored rounds
  - Verify: `npm run shots`
  - Files: `shots/flows-americano.shots.ts`, `shots/taps.ts`, `README.md`, `CLAUDE.md`
  - Depends on: T10

### Checkpoint D
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run shots` pass
- [ ] You deploy the rules
