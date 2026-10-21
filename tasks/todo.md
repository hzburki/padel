# Tasks: Less repeated code in `src/components/`

Each task is one slice and ends with:

- `npm test` and `npm run lint` passing
- a change brief
- the work left uncommitted

**Nothing a player sees changes.** For UI tasks, `npm run shots` must match every stored image.

## Phase 1: Small shared parts

- [x] **T1: Move shared form parts out of the screens** (S, plain moves)
  - Acceptance:
    - New files:
      - `section.tsx` (`Section`, `Hint`)
      - `name-taken.tsx`
      - `stepper.tsx`
      - `left-badge.tsx`
    - No component imports from another screen's file (`new-tournament-screen`, `players-form`)
    - No code changes inside the moved components
  - Verify: `npm run build`; `npm run shots`
  - Files:
    - `new-tournament-screen.tsx`, `new-match-screen.tsx`, `rename-form.tsx`, `players-form.tsx`,
      `standings-table.tsx`
    - the 4 new files
  - Depends on: none

- [x] **T2: `ConfirmSheet`** (M)
  - Acceptance:
    - `ConfirmSheet` in `sheet.tsx`. Props:
      - `open`, `onClose`, `title`
      - `children`: the text
      - `confirmLabel`, `onConfirm`, `destructive?`
      - `cancelLabel?`: left out means no Cancel button
    - It replaces all 8 copies:
      - tournament: finish, broadcast, delete
      - match: finish, broadcast, delete
      - discard, on both New game forms
  - Verify: `npm run build`; `npm run shots`; on 5199, open and confirm each sheet once
  - Files: `sheet.tsx`, `tournament-screen.tsx`, `match-screen.tsx`, `new-tournament-screen.tsx`,
    `new-match-screen.tsx`
  - Depends on: none

- [x] **T3: `Menu` and `MenuItem`** (S)
  - Acceptance:
    - `menu.tsx` has `Menu` (the rounded list) and `MenuItem`. `MenuItem` props:
      - `icon`, `label`, `onClick`
      - `disabled?`, `offline?`: shows `WifiOff`
      - `destructive?`
      - `badge?`
    - Both game menus use them. No menu-row className is left in either screen.
  - Verify: `npm run shots`; on 5199, open the menu online and offline (DevTools)
  - Files: `menu.tsx`, `tournament-screen.tsx`, `match-screen.tsx`
  - Depends on: none

### Checkpoint A

- [x] `npm test`, `npm run lint`, `npm run build`, `npm run shots` pass
- [ ] You review T1–T3

## Phase 2: Lib

- [x] **T4: `playerNames` and `finalStandings`** (named `playerNames`: `nameOf` is the local name it is stored in) (S)
  - Acceptance:
    - `lib/standings.ts` exports `nameOf(players)` and `finalStandings(tournament)`, each with a test
      named as a plain sentence
    - All 5 `new Map(players.map(...))` and all 3 final-standings calls use them
    - `Congrats` uses `winners(standings)`, without computing them again
    - `RoundsList` gets `nameOf` as a prop
  - Verify: `npx vitest run src/lib/standings.test.ts`; `npm run shots`
  - Files: `lib/standings.ts`, `lib/standings.test.ts`, `tournament-screen.tsx`,
    `tournament-list-screen.tsx`, `share-card.ts`
  - Depends on: none

## Phase 3: Game screens

- [x] **T5: `useGame`: open and save** (M)
  - Acceptance:
    - `use-game.ts` holds the shared parts of both screens:
      - the game state
      - the `openGame` effect, with the same deps as today
      - the 404 redirect and the "This game is yours now" toast
      - `update`, `saveError`, `toast`
    - Args: `kind`, `id`, `watch`, `scoreKey`, and `check?`, which the tournament uses for
      `scoresMadeAgain`
    - Both screens use the hook and drop their copies
  - Verify:
    - `npm run shots`, including the flows
    - on 5199: score, reload mid-game, the score is still there
    - follow from 5198 with emulators: scores arrive
  - Files: `use-game.ts`, `tournament-screen.tsx`, `match-screen.tsx`
  - Depends on: T2, T4

- [x] **T6: `useGame`: broadcast and delete** (M)
  - Acceptance:
    - These move into the hook: `live`, `links`, `sharing`, `asked`, `shareLink`, `askOrShare`, `remove`
    - `copyLink` is still called before any `await`
    - Broadcast sheet and link spinner each written once
  - Verify:
    - with emulators, on 5199: Broadcast live, Add an organiser, and a second game going live
      (passes or closes)
    - Delete, online and offline
  - Files: `use-game.ts`, `tournament-screen.tsx`, `match-screen.tsx`, one new file for the broadcast
    sheet and spinner
  - Depends on: T5

- [x] **T7: Shared screen parts** (M)
  - Acceptance:
    - Written once:
      - the loading and "Not found" returns
      - the More button
      - the finished footer (Play again + Share)
      - the share-image effect and `share()` with its filename
    - The hook takes `render` for the image
  - Verify: `npm run shots`; Share on a finished tournament and match in Safari
  - Files: `use-game.ts`, `tournament-screen.tsx`, `match-screen.tsx`, `game-parts.tsx`
  - Depends on: T6

### Checkpoint B

- [x] `npm run shots` passes (images and flows)
- [ ] Broadcast with a second organiser checked on 5199 + 5198
- [ ] You review T4–T7

## Phase 4: Split big files

- [x] **T8: Split `tournament-screen.tsx`** (S, plain moves)
  - Acceptance:
    - `RoundsList` and `MatchRow` go to `rounds-list.tsx`; the scaling sheet goes to `scaling-sheet.tsx`
    - `tournament-screen.tsx` is under 400 lines
  - Verify: `npm run shots`
  - Files: `tournament-screen.tsx`, the 2 new files
  - Depends on: T7

- [x] **T9: Split `match-screen.tsx`** (S, plain moves)
  - Acceptance:
    - `Scoreboard`, `Stats` and `SetGames` go to their own files
    - `match-screen.tsx` holds only the screen
  - Verify: `npm run shots`
  - Files: `match-screen.tsx`, the new files
  - Depends on: T7

### Checkpoint C

- [x] All checks pass; `README.md` / `CLAUDE.md` updated only if something in them is now wrong
- [ ] You review the whole set

## Asked for during the build

- [x] **T13: Screens in `src/screens/`**: the 8 `*-screen.tsx` files; CLAUDE.md table updated
- [x] **T14: Generic parts in `src/components/ui/`**: sheet, confirm-sheet, menu, segmented, stepper,
  section, toast moved there; new `select` (History filter) and generic `tabs`

## Phase 5: Optional (only on your yes)

- [ ] **T10: `SpotlightCard`** (S)
  - Acceptance: the two "Playing now" cards share one shell
  - Verify: `npm run shots`
  - Files: `tournament-list-screen.tsx`, `spotlight-card.tsx`
  - Depends on: none

- [ ] **T11: One check for "may change it"** (XS)
  - Acceptance: both screens use the same check (`isOrganiser` or the lock) for the footer and menu
  - Verify: `npm run shots`; on 5198, watch-only from a broadcast
  - Files: `tournament-screen.tsx`, `match-screen.tsx`
  - Depends on: T7

- [ ] **T12: Colour tokens** (XS)
  - Acceptance:
    - `sheet.tsx` uses a theme token for its backdrop
    - `congrats.tsx` takes its colours from the theme
  - Verify: `npm run shots`
  - Files: `sheet.tsx`, `congrats.tsx`, `index.css`
  - Depends on: none
