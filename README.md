<p align="center">
  <img src="public/pwa-512.png" alt="Padel logo" width="120" height="120" />
</p>

<h1 align="center">Padel</h1>

<p align="center">
  Americano tournaments and matches with your friends.<br />
  Scored courtside on your phone. Works offline.
</p>

<p align="center">
  <img src="public/og-image.png" alt="Padel: Americano tournaments with your friends" width="600" />
</p>

---

Padel is a small web app for casual padel, used from your phone between games. It installs to your home screen, needs
no account, and keeps everything on your phone, so it works with no connection at all.

## What you can play

- **Americano.** A tournament for 4 or more players on any number of courts. Partners rotate every round, each player
  scores the points their team wins, and the app makes the whole schedule up front with fair sit-outs. Play to any
  target from 8 to 32, as total points or first to.
- **Match.** Two pairs, scored point by point into games and sets. Best of 1, 3 or 5 sets, a tie-break when the games
  are level, advantage or golden point at 40–40, and undo for a mis-tap.

## Also

- Live standings for a tournament; set-by-set stats for a match.
- A results image to share on WhatsApp or save when the game ends.
- Play again with the same people and settings in one tap.
- Saved after every score or point. Lock the phone or close the tab and nothing is lost.
- A history of past games, filtered by kind.

## Install

- **Chrome or Edge** (Android, Windows, Mac): tap **Install** on the home screen.
- **iPhone or iPad:** in Safari, tap Share, then **Add to Home Screen**.

## Running it locally

You need Node.js 20.19 or newer.

```bash
npm install
npm run dev        # start the dev server
npm test           # run the tests
npm run build      # build for production into dist/
npm run preview    # serve the build (needed to try offline mode and installing)
```

Built with React, Vite, TypeScript, Tailwind CSS and shadcn/ui. The rules live in plain functions in
[`src/lib/`](src/lib/), each with a test file whose test names read as the rules themselves.

## License

Free and open source under the [MIT License](LICENSE).
