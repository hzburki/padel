<p align="center">
  <img src="public/pwa-512.png" alt="Padel logo" width="120" height="120" />
</p>

<h1 align="center">Padel</h1>

<p align="center">
  Run Americano padel tournaments with your friends.<br />
  Fair schedules, live standings, a shareable results card. Works offline.
</p>

<p align="center">
  <img src="public/og-image.png" alt="Padel: Americano tournaments with your friends" width="600" />
</p>

---

## What it is

Padel is a small web app for running a casual **Americano** padel tournament from your phone, courtside, between
games. Enter the players, pick the courts and the point target, and the app makes the whole schedule. After each game
you type in the score and the standings update.

It installs to your home screen like a normal app (it's a PWA). There are no accounts and no server: everything is
stored on your phone, and it works with no connection at all.

## Features

- **Americano, done right.** Rotating partners, individual scoring, fair sit-outs.
- **Any number of players**, from 4 up, on as many courts as you have.
- **Two scoring modes:** total points or first to. Any point target from 8 to 32.
- **Suggested round count** so everyone partners everyone and plays the same number of games. The app warns you if you
  pick a count where some players would get one game fewer.
- **Live standings** after every score, with clear tiebreakers.
- **Shareable results card.** When the tournament ends, share a PNG of the final standings straight to WhatsApp or
  anywhere else, or download it.
- **Saves after every score.** Lock your phone, close the tab, lose signal: nothing is lost.
- **Several tournaments** kept on the device. Rename the tournament or fix a player's name at any time; delete it when
  you're done.
- **Offline and private.** No sign-up, no tracking, no network calls. Your data never leaves your phone.

## How Americano works

Americano scores **players, not teams**. Teams only last for one game.

### The schedule

- Every game is doubles: 4 players on a court, two teams of two.
- Partners rotate every round. Over the tournament, everyone partners with everyone else once (as far as the player
  count allows) and faces as many different opponents as possible.
- The whole schedule is made **before round 1** and never changes based on results.
- Courts in play each round = `min(courts, floor(players / 4))`. Everyone else sits out that round.
  - 4 players, 1 court: nobody sits.
  - 9 players, 2 courts: two games at once, one player sits.
  - 12 players, 2 courts: two games at once, four players sit.

### Sitting out

Nobody sits unless the maths forces it. When someone has to, the app benches the players who have played the **most**
games so far (ties picked at random). After every round, no player is more than one game ahead of anyone else.

### Scoring a game

Games are played to a point target (8 to 32), not to sets. Each player gets the points **their team** scored in that
game. Pick one mode for the whole tournament:

| Mode             | Rule                                                 | Valid in an 8-point game | Not valid |
| ---------------- | ---------------------------------------------------- | ------------------------ | --------- |
| **Total points** | The two scores add up to the target.                 | 6–2, 4–4, 8–0            | 8–3       |
| **First to**     | The winner reaches the target; the loser stays below. | 8–3, 8–7                 | 8–8, 7–5  |

### Standings

Players are ranked by **total points scored**. Ties are broken in this order:

1. Point difference (points scored minus points conceded)
2. Head-to-head between the tied players
3. Wins

If the round count means some players played one game fewer, their points are scaled up in the **final** standings to
keep it fair. 12 points from 4 games, when others played 5, counts as 15. Live standings during the tournament are never
scaled.

## Running it locally

You need Node.js 20.19 or newer.

```bash
npm install
npm run dev        # start the dev server
npm test           # run the tests
npm run build      # build for production into dist/
npm run preview    # serve the build (needed to try the offline/PWA bits)
```

Built with React, Vite, TypeScript, Tailwind CSS and shadcn/ui. All tournament rules live in plain functions in
[`src/lib/`](src/lib/), each with a test file whose test names read as the rules themselves. Start with
[`americano.test.ts`](src/lib/americano.test.ts) and [`standings.test.ts`](src/lib/standings.test.ts).

## Open source

Padel is free and open source under the [MIT License](LICENSE). Anyone can use it, copy it, change it, sell it, or do
anything else with it. It comes with no warranty, and the author isn't liable for anything that happens from using it.
