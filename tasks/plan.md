# Plan: Players join and leave a running Americano

Spec: `SPEC.md`. Tasks: `tasks/todo.md`.

## Overview

Every running Americano gets **Players** in its menu. The organiser can add or remove a player. Rounds with
a score stay as they are. The rounds after them are rebuilt. At the moment of the change the organiser
picks how long to play (Same time or Same matches), and for a leaver whether their points are scaled up.
All the rules are pure functions in `src/lib/`. The screens only show them.

## What changed from the first plan

The first plan put the choices on the New game screen behind a switch, with a catch-up mode for joiners.
That is gone:

- T2 (the switch) is undone: the form goes back to how it was, `lateChanges` is removed.
- T3 (`roundsToLevel`) is redone for Same matches.
- T4 (rebuild) stays, minus the catch-up flag.

## What depends on what

```
T1 stored shape v3 + migrate                      (done)
 └── T2 take out the switch; left = { scaleUp }
      ├── T3 rounds left for Same matches         (americano.ts)
      │    └── T4 rebuild rounds from kept rounds (americano.ts, bench.ts)
      │         └── T5 addPlayer / removePlayer   (tournament.ts)
      │              ├── T7 Add a player          (screen)
      │              └── T8 Remove a player       (screen, "left" badge)
      ├── T6 final scaling leaves Keep as scored leavers out (standings.ts + call sites)
      └── T9 online copy carries the new fields   (online-game.ts)
           └── T10 rules let organisers rebuild rounds (firestore.rules)
                └── T11 played game in shots + README + CLAUDE.md
```

## Decisions

- **Version 3 for both kinds.** `CURRENT_VERSION` is shared, so `SetMatch` goes to 3 too. The v2 → v3 step
  only changes the number. Already done in T1.
- **Stored fields:** `Player.left?: { scaleUp: boolean }`, `Player.joinedAt?: number` (the round index
  they joined at). No field on `Tournament`. T1 stored `left?: true` and `lateChanges`; T2 changes both.
  The branch hasn't shipped, so no further version.
- **Same time / Same matches is not stored.** It only decides how many rounds are made.
- **Which rounds are kept:** every round up to and including the last round with any score.
- **Rounds left, Same time:** the rounds left before the change.
- **Rounds left, Same matches:** each player still in was due `rounds left × places before ÷ players
  before` more matches. The target is that many matches for each player still in: `due × players after ÷
  places after` rounds. Then the rounds are played out as the bench plays them (fewest matches first, one a
  round), and of the counts from 1 to the round limit, the one closest to the target where everyone ends
  level wins (ties to more rounds); failing that, the closest within one match; failing that, the limit.
  `places` is `4 × courts in play`.
- **A joiner's starting count:** for who sits out, a joiner counts as having the fewest matches of anyone
  still in who was there before them, counted up to the round they joined (plus that player's own starting
  count if they joined too). Not stored, worked out from the rounds. Known gap in the spec.
- **Rebuilding reuses `buildSchedule`** through `continueSchedule`: kept rounds count as partners and
  opponents already had, and each player starts from their count.
- **Scaling.** `computeStandings` gets an option listing players who are not scaled: leavers with
  `scaleUp: false`. Called the same way wherever final standings are drawn (tournament screen, list screen).
- **Online copy.** Each player entry gets `left` and `joinedAt` when set. A rebuild sends `game.rounds`
  whole (it is a list) and one entry per changed player, through `changedFields` as now.
- **Rules.** `firestore.rules` today stops an added organiser from changing `rounds`. On an Americano they
  may change `rounds` too. The rules deploy to the real project is the user's.
- **New badge.** `NewBadge` has one date for all its uses (2026-10-21). T7 gives it an `until` date:
  "Add an organiser" keeps 2026-10-21, "Players" gets the day 2 weeks after T7 is done.

## Risks

| Risk | Impact | What we do |
| --- | --- | --- |
| Same matches can't come out level within the round limit | Med | Fall back to within one match; tested |
| A joiner's count can come out one higher after a later leave | Low | Known gap in the spec; final scaling uses real matches |
| A score lands on a rebuilt match when two organisers race | Low | Left to the organisers, as decided |
| Rules change not deployed before the app ships | High for added organisers | Rules slice before the UI ships with broadcast; you deploy |
| The New game screen image changed in T2 and changes back | Low | Run shots after T2; need your yes before replacing any image |

## Decided

- The choices are made at the moment of the change. No switch, no setup choices, no catch-up.
- "Players" is in the menu under "Edit names", with the New badge like "Add an organiser". It opens a sheet
  with the player list: remove on each player, an add field at the bottom.
- Defaults: Same matches; Scale up.
