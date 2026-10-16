# Tasks: Players join and leave a running Americano

Each task is one slice with a change brief at the end. Each one ends with `npm test` and `npm run lint`
passing, and the work left uncommitted.

## Phase 1: Shape and setup

- [x] **T1: Stored shape v3 and migrate** (S)
  - Acceptance:
    - `types.ts` has `Player.left`, `Player.joinedAt`, `Tournament.lateChanges`, `version: 3` on both kinds
    - `CURRENT_VERSION = 3`; v1 and v2 records load as v3 with no `lateChanges`
    - New games are made as v3
  - Verify: `npx vitest run src/lib/storage.test.ts`; `npm run build`
  - Files: `src/lib/types.ts`, `src/lib/storage.ts`, `src/lib/storage.test.ts`, `src/lib/tournament.ts`,
    `src/lib/set-match-setup.ts`, `src/lib/online-game.ts` (version literal only)
  - Depends on: none

- [ ] **T2: Switch on the New game screen** (M)
  - Acceptance:
    - At the bottom of the Americano form: "Allow players to join and leave mid game", off by default
    - The switch is an Off / On pair from `segmented.tsx`
    - On: two choices, leaver scaled up (default) or not, joiner even (default) or catch up
    - `createTournament` stores `lateChanges` only when the switch is on; "Play again" carries it over
  - Verify: `npx vitest run src/lib/tournament.test.ts`; 5199 at 390 × 844; screen image diff (ask before
    replacing)
  - Files: `src/lib/tournament.ts`, `src/lib/tournament.test.ts`, `src/components/new-tournament-screen.tsx`
  - Depends on: T1

### Checkpoint A
- [ ] Old games load; a new game with the switch on saves `lateChanges`; build passes

## Phase 2: The rules (pure)

- [ ] **T3: Rounds needed to level games** (S)
  - Acceptance:
    - `roundsToLevel(games, places, roundsBefore)` returns the count closest to `roundsBefore` (ties to
      more) after which everyone has the same games
    - Respects one game a round per player and `MAX_ROUNDS`; falls back to a gap of at most 1
  - Verify: `npx vitest run src/lib/americano.test.ts`
  - Files: `src/lib/americano.ts`, `src/lib/americano.test.ts`
  - Depends on: T1

- [ ] **T4: Rebuild rounds from kept rounds** (M)
  - Acceptance:
    - Rounds made after kept rounds count the kept partners and opponents first
    - Games played start from the kept rounds, plus an even joiner's credit
    - Only players still in are placed or benched; courts used `min(courts, floor(in / 4))`
  - Verify: `npx vitest run src/lib/americano.test.ts src/lib/bench.test.ts`
  - Files: `src/lib/americano.ts`, `src/lib/americano.test.ts`, `src/lib/bench.ts`, `src/lib/bench.test.ts`
  - Depends on: T3

- [ ] **T5: addPlayer and removePlayer** (M)
  - Acceptance:
    - Both keep every round up to the last one with a score, rebuild the rest, and set the round count
      with T3
    - Problems: switch off, finished, shared copy, name taken (in or left), below 4 still in, unscored
      match in a kept round
    - Removed players get `left: true`; joiners get `joinedAt`
  - Verify: `npx vitest run src/lib/tournament.test.ts`
  - Files: `src/lib/tournament.ts`, `src/lib/tournament.test.ts`
  - Depends on: T4

- [ ] **T6: Final scaling leaves leavers out when chosen** (S)
  - Acceptance:
    - With `scaleLeavers: false`, a left player keeps their raw points in final standings; others as now
    - `placesMovedByScaling` and every final standings call site use the same option
  - Verify: `npx vitest run src/lib/standings.test.ts`
  - Files: `src/lib/standings.ts`, `src/lib/standings.test.ts`, `src/components/tournament-screen.tsx`,
    `src/components/tournament-list-screen.tsx`
  - Depends on: T1

### Checkpoint B
- [ ] All rules tested: kept rounds never change, games level after any change, scaling follows the choice

## Phase 3: In the app

- [ ] **T7: Add a player** (M)
  - Acceptance:
    - "Players" in the menu under "Edit names", with the New badge (only with `lateChanges`, organisers, not
      finished), opens a sheet with the list and an add field
    - `NewBadge` takes an `until` date; "Add an organiser" keeps 2026-10-21, "Players" ends 2 weeks after this
      task
    - The sheet shows the new number of rounds before confirming; saves at once
    - With added organisers and no connection: greyed out with the offline icon
  - Verify: 5199 at 390 × 844, add a player mid game, reload, check rounds and saved game
  - Files: `src/components/tournament-screen.tsx`, a new `src/components/players-form.tsx`,
    `src/components/new-badge.tsx`
  - Depends on: T5

- [ ] **T8: Remove a player** (M)
  - Acceptance:
    - Remove on each player still in; the warning says they can't come back, and shows the new rounds
    - Blocked with a short reason when it would leave 3, or they have an unscored match in this round
    - "left" badge in the standings table
  - Verify: 5199, remove mid round, check standings and rounds after reload
  - Files: `src/components/players-form.tsx`, `src/components/tournament-screen.tsx`,
    `src/components/standings-table.tsx`
  - Depends on: T7, T6

### Checkpoint C
- [ ] Whole game played on 5199 with a join and a leave, offline; review with you

## Phase 4: Broadcast and wrap-up

- [ ] **T9: Online copy carries the new fields** (S)
  - Acceptance:
    - `toOnline` / `fromOnline` / zod carry `lateChanges`, `left`, `joinedAt`; round trip tested
    - `changedFields` after a change sends only the changed player entries and `game.rounds`
  - Verify: `npx vitest run src/lib/online-game.test.ts`
  - Files: `src/lib/online-game.ts`, `src/lib/online-game.test.ts`
  - Depends on: T1

- [ ] **T10: Rules let organisers rebuild rounds** (S)
  - Acceptance:
    - `lateChanges` allowed (not required) on an Americano game
    - An added organiser may change `rounds` only when the game has `lateChanges`
  - Verify: `npm run emulators` + `shots/rules.shots.ts`; by hand, 5199 organiser + 5198 added organiser,
    add and remove, the friend sees it
  - Files: `firestore.rules`, `shots/rules.shots.ts`
  - Depends on: T9, T8

- [ ] **T11: Played game, README and CLAUDE.md** (S)
  - Acceptance:
    - A flow in `shots/flows-americano.shots.ts` plays a game with the switch on, adds, removes, finishes
    - README mentions the switch; CLAUDE.md's Americano section says a roster change rebuilds unscored rounds
  - Verify: `npm run shots`
  - Files: `shots/flows-americano.shots.ts`, `shots/taps.ts`, `README.md`, `CLAUDE.md`
  - Depends on: T10

### Checkpoint D
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run shots` pass
- [ ] You deploy the rules
