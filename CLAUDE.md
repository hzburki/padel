# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Writing style

This is about answers to the user in chat, not code or comments.

- **Short answer first.** Lead with the result or the direct answer. Don't build up to it, don't restate
  the question, don't preview what you're about to say.
- **Plain words only.** Use the simplest word that does the job: "I thought of", not "I conceived". Avoid
  leverage, utilize, facilitate, robust, comprehensive, delve, ensure that.
- **Explain only when asked.** No reasoning walkthrough, no step-by-step account of how the solution was
  reached, unless the user asks for it. If something is genuinely risky or surprising, one sentence is
  enough.
- No filler openers or closing summaries.

## Project

A mobile-first PWA for running casual padel tournaments among friends. One format only: **Americano**. No
other padel format (no Mexicano, no classic draws, no box leagues) is in scope.

**Local-only.** There is no backend, no accounts, no sync, no network calls. All tournament state lives in
the browser (IndexedDB for tournament data; `localStorage` is fine for small UI prefs). This is a hard
constraint, not a v1 shortcut — the app must fully work offline, including a cold start with no connection.
Do not introduce a server, an API client, or a hosted database. Treat "export/import a tournament as a JSON
file" as the sharing mechanism if sharing is ever needed.

**Mobile-first.** The primary surface is a phone held one-handed, courtside, by someone entering scores
between games. Design for thumb reach, large tap targets, and glanceable standings. Desktop is a
nice-to-have that falls out of a responsive layout.

## Stack

- React 19 + Vite 8 + TypeScript 6
- **Tailwind v4** — CSS-first. There is no `tailwind.config.js`; theme tokens live in `src/index.css`
  under `@theme`. Don't reach for a config file that isn't there.
- **shadcn/ui**, `radix-nova` preset, Lucide icons, Geist font. Components are copied into
  `src/components/ui/` — they are project source, not a dependency. Edit them directly rather than
  wrapping them to change a style. Add more with `npx shadcn@latest add <name>`.
- **oxlint**, not ESLint — that is what the Vite template ships now.
- **Vitest** for the pure logic in `src/lib/`.
- `vite-plugin-pwa` (autoUpdate) for the service worker and manifest.
- Path alias `@/` → `src/`. TypeScript 6 dropped `baseUrl`, so `paths` are relative to the tsconfig; the
  same alias is repeated in `vite.config.ts`.

## Commands

```bash
npm run dev          # dev server
npm run build        # tsc -b && vite build
npm run preview      # serve the build — the only way to exercise the service worker
npm run lint         # oxlint
npm test             # vitest run
npm run test:watch

npx vitest run src/lib/americano.test.ts           # one file
npx vitest run -t "benches the player"             # one test by name
```

## Domain: Americano

This is the core of the app and the part that is easy to get wrong. Americano scores **individual
players**, not teams — teams exist only for the duration of one round.

- Players are paired into doubles teams each round; a player's score for a round is the number of points
  *their team* scored.
- Games are played to a **point target**, not to games/sets. The organiser picks any target from 8 to 32 at
  setup. Two scoring modes, both required:
  - **Total points** — the two scores always sum to the target. In an 8-point game, 4–4 and 6–2 are both
    valid. Invariant: `teamA + teamB === target`.
  - **First to** — a team wins by reaching the target. Scores do not sum to anything fixed; the winner's
    score equals the target. Invariant: `max(teamA, teamB) === target && min(teamA, teamB) < target`.

  The mode is one tournament-level setting, fixed for the whole tournament. Do not hardcode the
  total-points invariant into score entry or validation — it is wrong in first-to mode, and that is the
  easiest bug to ship here.
- Standings rank by total points scored. Tiebreakers in order: point difference (scored − conceded), then
  head-to-head, then wins.
- Any number of players from 4 up, no upper bound. A match is always 4 players. The organiser sets the
  **number of courts** available at setup (1 or more). Courts in play per round is
  `min(courts, floor(playerCount / 4))`; everyone else sits out that round. 9 players on 2 courts: two
  matches at once, one player sits. 12 players on 2 courts: four sit. 4 players is the minimum tournament:
  one court, nobody sits. Never assume `playerCount % 4 === 0` or that every player fits on a court.
- **Nobody sits out unless the maths forces it** — players beyond `4 × courts in play` sit, nobody else.
  Bench the players with the **most** games played so far, ties broken randomly. The rule to hold after
  every round is `max(gamesPlayed) - min(gamesPlayed) <= 1`. This is a game between friends: everyone gets
  the same court time and the same chance to enjoy it.
- Pairings are *fixed up front*. The full schedule is generated before round 1, rotating partners so that,
  as far as the player count allows, everyone partners with everyone else once and faces everyone. The
  schedule does not react to results.

Keep the scheduling logic in a pure, framework-free module (`src/lib/americano.ts`) that takes players and
returns pairings. It is the highest-value thing to unit test; the React layer should only read and render
its output.

## Delivering code the user can review

The user wants to understand every change. Big mixed diffs make that impossible. These rules keep review
cheap; none of them cost time at write time, so they are not a reason to deliver slower or in smaller
scope than asked.

**Ship one slice at a time.** A slice is one thing the user can open the app and try, or one pure module
plus its tests. Finish it, commit it, write the change brief, then start the next. Don't stack three
features into one delivery and hand over 800 lines at once.

**Never mix kinds of change in one commit.** A rename, a reformat, a refactor and a feature are four
commits. Mixed diffs are where understanding dies — the five lines that matter get buried in four hundred
that don't. In particular, don't reformat or rename things you happen to be passing through.

**One commit, one idea.** The message says *why*; the diff already says what.

**After every slice, post a change brief** in chat — plain words, short, this shape:

- **Works now:** one line, what the user can do that they couldn't before.
- **Read this first:** the one file carrying the idea. Everything else is named as wiring.
- **Files:** one line each, why it changed.
- **Watch out:** anything guessed at, stubbed, hardcoded, or that you'd do differently. If this is empty,
  you didn't look hard enough.

**Tests are the explanation.** Every pure module in `src/lib/` gets a test file whose test names are plain
sentences stating the rule — "benches the player with the most games when 6 players are entered". The user
should be able to read the test names alone and know what the code does, without reading the code.

**Keep the rules out of the components.** Tournament logic lives in pure functions in `src/lib/`; React
reads them and renders. A pure function can be checked against a worked example in your head; a rule
tangled into a component can only be checked by running the app.

**No abstraction until the third use.** A wrapper with one caller is a layer the reviewer has to hold in
their head for nothing.

**Stop and ask before anything structural** — a new dependency, a new folder layer, a state library, or a
change to the shape of a stored tournament. These are the changes that are expensive to undo later.

`/walkthrough` explains the last change in plain words; `/walkthrough <ref>` targets a specific commit.

## Persistence

A tournament is the unit of persistence: players, number of courts, point target, scoring mode, the rounds played so
far, their scores, and the sit-out history. Persist after every score entry — the phone will be backgrounded, locked, and
reloaded mid-tournament, and losing a round's scores is the worst failure mode this app has. Schema changes
need a migration path for tournaments already saved in a user's browser; version the stored shape from the
start.

## Shareable result image

When a tournament ends the app produces a PNG of the final standings, meant for WhatsApp and social feeds.
It has to be a real image file the user can share or save — `navigator.share` with a `File`, falling back
to a download when the Web Share API is unavailable — not something the user has to screenshot.

Render it client-side (canvas, or DOM-to-canvas over a hidden fixed-width node). Keep the share layout as
its own component, separate from the on-screen standings: the screen is a scrollable phone-width list,
while the image is a fixed-aspect card that still has to be readable as a chat thumbnail.
