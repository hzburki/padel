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

## Status

The repository is empty — nothing is scaffolded yet. Everything below describes the intended project and
stack, not discovered code. Once the app exists, replace the "Scaffolding" section with real commands and
update the architecture notes to match what was actually built.

## Project

A mobile-first PWA for running casual padel tournaments among friends. Two formats only: **Americano** and
**Mexicano**. No other padel format (no classic draws, no box leagues) is in scope.

**Local-only.** There is no backend, no accounts, no sync, no network calls. All tournament state lives in
the browser (IndexedDB for tournament data; `localStorage` is fine for small UI prefs). This is a hard
constraint, not a v1 shortcut — the app must fully work offline, including a cold start with no connection.
Do not introduce a server, an API client, or a hosted database. Treat "export/import a tournament as a JSON
file" as the sharing mechanism if sharing is ever needed.

**Mobile-first.** The primary surface is a phone held one-handed, courtside, by someone entering scores
between games. Design for thumb reach, large tap targets, and glanceable standings. Desktop is a
nice-to-have that falls out of a responsive layout.

## Stack

- React + Vite (TypeScript)
- Tailwind CSS
- shadcn/ui for components — these are copied into the repo (typically `src/components/ui/`), so they are
  project source, not a dependency. Edit them freely; don't wrap them in another abstraction layer just to
  change a style.
- `vite-plugin-pwa` for the service worker / installability

## Scaffolding

Not yet run. The intended sequence:

```bash
npm create vite@latest . -- --template react-ts
npm install
npx shadcn@latest init          # sets up Tailwind, CSS vars, and the @/* path alias
npx shadcn@latest add button card dialog   # add components as needed, one at a time
npm install -D vite-plugin-pwa
```

shadcn requires the `@/*` path alias in both `tsconfig.json` and `vite.config.ts` — `init` writes it, but
verify both after running it.

Once scaffolded, the standard commands are `npm run dev`, `npm run build`, `npm run preview`. Add a test
runner (Vitest pairs with Vite) and record the single-test invocation here when you do.

## Domain: how the two formats differ

This is the core of the app and the part that is easy to get wrong. Both formats score **individual
players**, not teams — teams exist only for the duration of one round.

**Shared mechanics**

- Players are paired into doubles teams each round; a player's score for a round is the number of points
  *their team* scored.
- Rounds are point-capped rather than played to games/sets: a round runs to a fixed total (commonly 21, 24,
  or 32 points). This gives a strong validation invariant — `teamAScore + teamBScore === pointsPerRound`.
  Enforce it at score entry.
- Standings rank by total points scored. Tiebreakers in order: point difference (scored − conceded), then
  head-to-head, then wins.
- Player counts are cleanest at multiples of 4 (one court per 4 players). Non-multiples require a sit-out
  rotation that distributes byes evenly — this is a real case, friends' tournaments rarely have exactly 8
  or 12 players. Don't assume `players.length % 4 === 0`.

**Americano** — pairings are *fixed up front*. The full schedule is generated before round 1, rotating
partners so that, as far as the player count allows, everyone partners with everyone else once and faces
everyone. The schedule does not react to results.

**Mexicano** — pairings are *generated one round at a time from the current standings*. After each round,
re-rank all players, group them into courts by rank (ranks 1–4 on court 1, 5–8 on court 2, …), and within
each court pair 1st+4th against 2nd+3rd. Round 1 has no standings yet, so it is seeded randomly or by a
manual seeding. The scheduler therefore cannot be a pure up-front function — it must be callable after
every completed round.

Keep the scheduling logic in pure, framework-free modules (e.g. `src/lib/formats/americano.ts`,
`src/lib/formats/mexicano.ts`) that take players/results and return pairings. They are the highest-value
thing to unit test; the React layer should only read and render their output.

## Persistence

A tournament is the unit of persistence: players, format, points-per-round, court count, the rounds played
so far, and their scores. Persist after every score entry — the phone will be backgrounded, locked, and
reloaded mid-tournament, and losing a round's scores is the worst failure mode this app has. Schema changes
need a migration path for tournaments already saved in a user's browser; version the stored shape from the
start.
