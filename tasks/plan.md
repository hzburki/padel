# Plan: Less repeated code in `src/components/`

Source: the code review of 2026-10-21. Tasks: `tasks/todo.md`. The old plan is in `tasks/done/`.

## Overview

`src/lib/` stays as it is. The work is in `src/components/`:

- The tournament and match screens share about 150 lines word for word.
- The confirm sheet is pasted 8 times and the menu row 10 times.
- Shared form parts live inside a screen file.

Every task is a refactor: **nothing a player sees changes.** The proof is that every stored screen image
in `npm run shots` still matches and the played-game flows still pass.

## Decisions

- **Few new pieces, each with one job.** Two small components (`ConfirmSheet`, `MenuItem`), one hook
  (`useGame`), two lib functions (`nameOf`, `finalStandings`). No context, no state library, no new
  dependency, no stored shape change.
- **One component per file, named after it**, like `live-badge.tsx` and `new-badge.tsx` today. `Section`
  and `Hint` share a file because they are always used together.
- **`useGame` is shared by only two screens.** CLAUDE.md says no helper before the third use. This is an
  exception because about 150 lines are the same in both screens. If you'd rather not, skip T5–T7.
- **The hook knows nothing about either kind of game.** What differs is passed in:
  - `render`: how to draw the share image
  - `check(before, after)`: an optional toast when a copy comes in from online. The tournament uses it
    for "That match was made again".
  - `kind`: which saved games this screen opens

  No `if (kind === "americano")` inside the hook.
- **Taps keep doing their work during the tap.** iOS refuses a share or a clipboard write that starts
  after a wait. So:
  - `copyLink` is still called before any `await` in `shareLink`.
  - The share image is still made ahead of time.
- **The rename** (`saveTournament` → `saveGame`, `TournamentListScreen` → `HomeScreen`) is not in this
  plan. If you want it, it is its own slice later.

## Dependency graph

```
T1 form parts move ─────────────┐
T2 ConfirmSheet ────────────────┤ (independent, any order)
T3 MenuItem ────────────────────┤
T4 nameOf / finalStandings ─────┘
                │
                ▼
T5 useGame: open + save        (T2, T4 make the screens smaller first)
                │
                ▼
T6 useGame: broadcast + delete
                │
                ▼
T7 shared screen parts: loading, More, finished footer, share image
                │
                ▼
T8 split tournament-screen.tsx    T9 split match-screen.tsx
                │
                ▼
T10–T12 optional, each only on your yes
```

## Phases

1. **Small shared parts** (T1–T3): moves and two components. Low risk.
2. **Lib** (T4): two pure functions with tests.
3. **Game screens** (T5–T7): the hook. This is the risky part, because it touches opening, saving and
   broadcasting.
4. **Split files** (T8–T9): plain moves.
5. **Optional** (T10–T12).

There is a checkpoint after phases 1, 3 and 4.

## Risks

| Risk | Impact | What we do |
| ---- | ------ | ---------- |
| A screen looks different after the refactor | Med | `npm run shots` after every UI task. A changed image means a bug in the refactor; an image is never replaced without your yes. |
| The hook re-runs `openGame` too often (effect deps, `nav.replace` identity) | High | Keep the same deps as today (`id, watch, scoreKey, toNotFound, links`). Check the flows, then follow a broadcast on 5198. |
| Share or copy link stops working on iOS | High | Keep the tap rules above. Check Share and Broadcast live in Safari (`npm run shots` runs WebKit). |
| A score is lost when saving moves into the hook | High | `update` moves over line for line. Check with a reload mid-game on 5199. |
| `ConfirmSheet` can't express the finish sheet's "no Cancel when all scored" | Low | Leaving out `cancelLabel` hides Cancel. |

## Open questions

- Should T5–T7 (the hook) go ahead despite the third-use rule? The plan assumes yes.
- Do you want T10–T12 at all? They are listed but not started without your yes.
