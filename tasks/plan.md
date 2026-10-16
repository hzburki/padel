# Plan: Players join and leave a running Americano

Spec: `SPEC.md`. Tasks: `tasks/todo.md`.

## Overview

With a new switch on the New game screen, an organiser can add or remove a player in a running Americano.
Rounds with a score stay as they are. The rounds after them are rebuilt, and their number is worked out
again so everyone still in ends on the same number of games. All the rules are pure functions in
`src/lib/`. The screens only show them.

## What depends on what

```
T1 stored shape v3 + migrate
 ├── T2 setup switch (New game screen)
 ├── T3 rounds needed to level games      (americano.ts)
 │    └── T4 rebuild rounds from kept rounds (americano.ts, bench.ts)
 │         └── T5 addPlayer / removePlayer   (tournament.ts)
 │              ├── T7 Add a player       (screen)
 │              └── T8 Remove a player    (screen, "left" badge)
 ├── T6 final scaling leaves leavers out  (standings.ts + call sites)
 └── T9 online copy carries the new fields (online-game.ts)
      └── T10 rules let organisers rebuild rounds (firestore.rules)
           └── T11 played game in shots + README + CLAUDE.md
```

## Decisions

- **Version 3 for both kinds.** `CURRENT_VERSION` is shared, so `SetMatch` goes to 3 too. The v2 → v3 step
  only changes the number. A tournament from before v3 has no `lateChanges`, so the feature is off for it.
- **Stored fields** as in the spec: `Player.left?: true`, `Player.joinedAt?: number` (the round index they
  joined at), `Tournament.lateChanges?: { scaleLeavers: boolean; joiners: "even" | "catchUp" }`.
- **An even joiner's credit is not stored.** It is the fewest games of anyone still in at `joinedAt`,
  worked out from the rounds when needed. Nothing to keep in step.
- **Rounds needed to level games** is a pure function of the games each player still in has (credit
  included), the places each round fills (`4 × courts in play`) and the rounds left before the change. A
  count `k` levels the games when `(k × places + total games)` divides evenly by the player count, the
  level reached is at least the most games anyone has, and `level - fewest games <= k` (a player gets at
  most one game a round). It picks the `k` closest to the rounds left before, ties to more, capped at
  `MAX_ROUNDS` in all.
- **Rebuilding reuses `buildSchedule`.** It gets the kept rounds as history: their partners and opponents
  are counted first, and games played start from them. A new export, not a second copy of the loop.
- **Which rounds are kept:** every round up to and including the last round with any score.
- **Scaling.** `computeStandings` gets an option listing players who are not scaled. Called the same way
  wherever final standings are drawn (tournament screen, list screen).
- **Online copy.** `lateChanges` is a new top-level field of the game, only there when set. Each player
  entry gets `left` and `joinedAt` when set. A rebuild sends `game.rounds` whole (it is a list) and one
  entry per changed player, through `changedFields` as now.
- **Rules.** `firestore.rules` today stops an added organiser from changing `rounds`. With `lateChanges`
  on, they may change `rounds` too. The rules deploy to the real project is yours.

## Risks

| Risk | Impact | What we do |
| --- | --- | --- |
| No round count levels the games within `MAX_ROUNDS` (catch-up joiner far behind) | Med | Fall back to the closest count where the gap is at most 1; tested |
| An even joiner's credit makes `max - min <= 1` hold for credited games but not real ones | Low | That's the spec. Final scaling covers it; the test states it |
| A score lands on a rebuilt match when two organisers race | Low | Left to the organisers, as decided |
| Rules change not deployed before the app ships | High for added organisers | Rules slice before the UI ships with broadcast; you deploy |
| Screen images change (New game form gets a switch) | Low | Need your yes before replacing any image in `shots/images` |

## Decided

- **The switch** reuses `segmented.tsx` as an Off / On pair. No new component.
- **The menu item** is "Players", under "Edit names", with the New badge like "Add an organiser". It opens a
  sheet with the player list: remove on each player, an add field at the bottom.
- **The New badge has one date for all its uses** (2026-10-21) and would be gone before "Players" ships.
  T7 gives `NewBadge` an `until` date, so each menu item ends on its own: "Add an organiser" keeps
  2026-10-21, "Players" gets the day 2 weeks after T7 is done.
