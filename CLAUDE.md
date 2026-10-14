# CLAUDE.md

## How to answer in chat

- **Short answer first.** No build-up, no restating the question.
- **Plain words.** "I thought of", not "I conceived". Avoid leverage, utilize, facilitate, robust,
  comprehensive, delve, ensure that.
- **Explain only when asked.** If something is risky or surprising, one sentence is enough.
- No filler at the start, no summary at the end.

## The app

A phone-first PWA for casual padel among friends. Two kinds of game, picked on the New game screen:

- **Americano**: a tournament for 4 or more players, partners change every round.
- **Match**: one 2 v 2 match, scored in points, games and sets.

No other format (no Mexicano, no draws, no box leagues).

- **Works offline, always.** Every game lives in the browser (IndexedDB; `localStorage` only for small UI
  settings). No accounts, no sync. The app must work with no connection, even on a cold start.
- **Made for one hand, courtside.** Big tap targets within thumb reach, standings you can read at a glance.
  Desktop just gets the same layout.
- **Few words, more pictures.** Show an icon, a number, a badge or a worked example instead of text. If a
  sentence is needed, write one short one.

## Broadcasting a game

The only time anything goes online. All network code is in `src/lib/live.ts`. The rules are in
`src/lib/broadcast.ts` (pure, tested) and `firestore.rules` (tested in `shots/rules.shots.ts`).

- **Broadcast live** sends a copy of the game to Firestore, so friends with the link (`/t/<id>` or `/m/<id>`)
  can follow it. Nothing is sent before that tap, and the tap is the organiser's OK to store it online. The
  phone's copy is the real one; the online copy is only ever overwritten from it. The organiser signs in
  anonymously, which is what lets only them change or delete it.
- **Add an organiser** gives a second link (the watch link plus a key) that makes a friend an organiser too:
  they score, undo, rename, share both links and finish the game. Only the person who made the game can
  delete it for everyone. In the code the key is the score key and the added organisers are `scorers`.
  - From then on the online copy is the real one. Every organiser's phone, the first one's too, sends only
    the fields it changed (`sendChange`) and follows the online copy. No phone ever sends its whole copy:
    that wipes another organiser's score. When two change the same thing, the later write stays.
  - The online copy is a map of fields (`src/lib/online-game.ts`), not the stored game, so each score,
    player and point can be written on its own.
  - The screen shows and saves a change at once and never waits for the send. With no connection it says
    so and greys out what that phone may do. What a phone may never do is not shown at all.
  - If the first organiser goes live with another game, this one passes to another organiser.
  - A game with no organiser link is untouched by any of this and works fully offline.
- **A broadcast game finishes by itself 6 hours after `createdAt`** (`followTimeLeft`). No server: each phone
  works it out when it opens the game, and an organiser's phone finishes it online for everyone. A game
  that was never broadcast never ends by itself.
- The dev server uses the local emulators (`npm run emulators`). A build uses the `VITE_FIREBASE_*` values;
  without them the broadcast button is hidden.

## Stack

- React 19, Vite 8, TypeScript 6. `zod` checks what is read back from online.
- **Tailwind v4**, set up in CSS only: there is no `tailwind.config.js`. Theme tokens are in `src/index.css`
  under `@theme`.
- **shadcn/ui** (`radix-nova`), Lucide icons, Archivo font (the only one). `src/components/ui/` is our own code: edit it
  directly, don't wrap it. Add a component with `npx shadcn@latest add <name>`.
- **oxlint**, not ESLint. **Vitest** for `src/lib/`.
- **Firebase** (anonymous Auth + Firestore) for broadcasting only. The site is hosted on Cloudflare Pages.
- `vite-plugin-pwa` (autoUpdate) for the service worker and manifest.
- **Playwright**, only for `npm run shots`, in Chrome and Safari. `shots/screens.shots.ts` compares each
  screen with a stored image, starting from the games in `shots/seed.ts`. `shots/flows-*.shots.ts` play whole
  games by tapping, with shared steps in `shots/taps.ts`; a new feature or game variant gets a flow there.
  `shots/images` stays on this machine (gitignored).
- `@/` means `src/`. It is set in the tsconfig `paths` (TypeScript 6 has no `baseUrl`) and again in
  `vite.config.ts`.

## Commands

```bash
npm run dev          # dev server
npm run build        # tsc -b && vite build
npm run preview      # serve the build: the only way to try the service worker
npm run lint         # oxlint
npm test             # vitest run
npm run test:watch
npm run shots        # Chrome and Safari: compare every screen with its image, and play whole games
npm run emulators    # local Firebase, needed to broadcast in dev

npx vitest run src/lib/americano.test.ts           # one file
npx vitest run -t "benches the player"             # one test by name
```

## Where things live

| Path                 | What it holds                                                                  |
| -------------------- | ------------------------------------------------------------------------------ |
| `src/lib/`           | All the rules, pure and tested: each `x.ts` sits next to its `x.test.ts`.      |
| `src/lib/types.ts`   | The stored shapes: `Tournament`, `SetMatch`, `SavedEvent`.                     |
| `src/lib/storage.ts` | IndexedDB, the stored version (`CURRENT_VERSION`) and `migrate`.               |
| `src/components/`    | Screens (`*-screen.tsx`) and the parts they share. No router: `stack-navigator.tsx` and `nav.ts`. |
| `src/components/ui/` | shadcn components.                                                             |
| `shots/`             | Playwright: screen images, played games, Firestore rules tests.                |
| `public/`            | Icons, the link preview image, and `_headers` for Cloudflare Pages.            |
| `firestore.rules`    | Who may write a broadcast game online.                                         |

## Never do these

- Never use port 5173: it is the user's own dev server.
- Never broadcast on 5301: a build reads `.env`, which points at the real Firebase project.
- Never read, write or deploy to the real Firebase project (rules, data, config) unless the user says so for
  that task. A yes covers that one task only.
- Never add a network call, server or database outside `src/lib/live.ts`, or make a screen wait for the
  connection.
- Never build in `teamA + teamB === target`: it is wrong in first-to mode.
- Never store a second copy of a match's score.
- Never send a game's whole online copy once it has a second organiser.
- Never change a stored shape without bumping `version` and adding a step to `migrate`.
- Never replace an image in `shots/images` without the user's yes.
- Never add a dependency, folder layer or state library, or change a stored shape, without asking first.

## Testing in the browser

Only these ports:

| Port | Start it with                                 | Use it for                                  |
| ---- | --------------------------------------------- | ------------------------------------------- |
| 5199 | `npm run dev -- --port 5199 --strictPort`     | The organiser: every feature, start to end  |
| 5198 | `npm run dev -- --port 5198 --strictPort`     | A friend following a broadcast from 5199    |
| 5301 | `npm run preview -- --port 5301 --strictPort` | The build: service worker, offline, install |

- Always pass `--strictPort`, or Vite quietly moves to another port. If a port is taken, find what holds it
  and reuse or stop it.
- Each port has its own IndexedDB and its own sign-in, so the friend must be on 5198. Old games stay there
  too: clear the site data or start a new game before trusting the screen.
- Broadcasting needs `npm run emulators` (Auth 9099, Firestore 8080).
- Test at phone size (390 × 844) first.
- Stop the servers you started when you are done.

## Americano

The core of the app and the easiest part to get wrong. It scores **players**, not teams: a team lasts one
round.

- A player's score for a round is the points their team scored.
- Games go to a point target, 8 to 32, set at the start. Two modes, both needed, fixed for the tournament:
  - **Total points**: the two scores add up to the target (8-point game: 4–4 or 6–2).
  - **First to**: the winner's score is the target, the loser's is below it.
- Standings: points, then point difference, then head-to-head, then wins.
- In the **final** standings only, a player with fewer games has points and difference scaled up to the most
  games played: `points × most games ÷ their games`.
- 4 players or more, no top limit. A match is always 4 players. Courts used each round:
  `min(courts, floor(players / 4))`. 9 players on 2 courts: 1 sits. 12 on 2 courts: 4 sit. Never assume the
  player count divides by 4.
- Only the players who don't fit sit out: those with the most games so far, ties picked at random. After
  every round, `max(games) - min(games) <= 1`.
- The whole schedule is made before round 1 and never changes with results. Partners rotate so that, as far
  as the count allows, everyone partners and faces everyone once.
- The schedule is made in `src/lib/americano.ts` (sitting out in `bench.ts`). React only shows it.

## Match

Two fixed pairs, tennis scoring. The rules are in `src/lib/set-match.ts`. The stored type is `SetMatch`,
because `Match` already means one Americano game.

- Only who won each point is stored, in order. Games, sets, winner and stats come from replaying it
  (`replay`). Undo drops the last point.
- `scoreBy`: **points** (default) or **games**. By games, each entry is one game (the tie-break too), and
  there are no points or 40–40 to show. Don't assume a game has points.
- Game: 0, 15, 30, 40. At 40–40: **advantage** (default) or **golden point**.
- Set: first to N games, two clear, N from 2 to 9 (default 6). At N–N a tie-break: first to 7 points, two
  clear, counts as 7–6. No golden point in a tie-break.
- Length: 1, 3 or 5 sets, worded as "best of" or "first to" (`setsAs`). Only the wording changes. The last
  set has the same tie-break.
- The rules are locked once the match starts.
- A won match isn't finished until the organiser confirms it, so the last point can still be undone.
- Not tracked: who serves, how long it took.

## Saving

Each game is one saved record, `kind` `"americano"` or `"match"`, in the same IndexedDB store. Save after
every score or point: the phone will be locked and reloaded mid-game, and losing scores is the worst thing
that can happen. Games already saved in a browser must still load after any change.

## Result image

When a game ends the app makes a PNG of the standings or the match score, for WhatsApp. It must be a real
file: `navigator.share` with a `File`, or a download when sharing isn't there. It is drawn on a canvas
(`share-card.ts`, `match-share-card.ts`), apart from the on-screen standings, and must stay readable as a
chat thumbnail.

## Writing code

- Easy to read: clear names, short functions, no tricks.
- The simplest thing that works. Nothing "for later".
- No dead code: delete whatever a change leaves unused, in the same change.
- Rules live in pure functions in `src/lib/`. Components only read and show them.
- No wrapper or helper until the third use.
- When you change a rule in `src/lib/`, update its tests in the same change. Test names are plain
  sentences that state the rule ("benches the player with the most games when 6 players are entered"), so
  the names alone explain the code.
- Before saying it is done, run `npm test` and `npm run lint`. Report a failure as a failure.
- When a feature is done, update `README.md` for anything a player or developer would notice. Update this
  file only if a rule in it is now wrong or missing.

## Delivering work

The user wants to understand every change.

- Never commit and never make a branch. The user reviews and commits. Leave the work uncommitted on the
  current branch.
- One slice at a time: one thing to try in the app, or one pure module with its tests. Finish it, post the
  brief, then start the next.
- Keep each slice to one idea. A rename, a reformat, a refactor and a feature are four slices. Don't
  reformat or rename code you are only passing through.
- After each slice, post a change brief:
  - **Works now:** one line, what the user can do now.
  - **Read this first:** the one file with the idea. The rest is wiring.
  - **Files:** one line each, why it changed.
  - **Watch out:** anything guessed, stubbed, hardcoded, or that you'd do differently. If this is empty,
    you didn't look hard enough.
