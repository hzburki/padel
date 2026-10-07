# Firebase setup: what you do, what Claude does next

Live sharing works against local emulators today. To make it work on the real site, a Firebase project has
to exist and the app has to know about it. The steps below need your Google account, so they are yours.
Everything after them is Claude's.

The free plan (Spark) is enough. Do not add a billing account.

## Your part (about 10 minutes)

### 1. Create the project

1. Open <https://console.firebase.google.com> and choose **Create a project**.
2. Name it (for example `padel`). Turn **Google Analytics off**; the app does not use it.

### 2. Turn on anonymous sign-in

**Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**

The organiser's phone signs in this way, silently. It is what makes them the only one who can change a
shared game.

### 3. Create the database

**Build → Firestore Database → Create database.**

- Edition: **Standard**.
- Location: the one closest to where you play. **This cannot be changed later.**
- Rules: **Start in production mode** (everything locked). Claude replaces these with the app's rules.

### 4. Register the web app

**Project settings (gear icon) → General → Your apps → Web (`</>`).** Give it a nickname. Leave
"Firebase Hosting" unticked; the site stays on Cloudflare Pages.

The console then shows a `firebaseConfig` block. Copy four values from it into the `.env` file in the
project root (create it if it is not there; it is already git-ignored):

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

These are not passwords. Every Firebase website sends them to the browser; the security rules are what
protect the data. Still, type them into `.env` yourself rather than pasting them into the chat.

### 5. Sign the command line in

In a terminal, in the project folder:

```bash
npx firebase-tools login
```

A browser window opens; pick the same Google account. This lets Claude publish the security rules. Claude
cannot do this step for you.

### 6. Tell Claude three things

| What | Example |
| --- | --- |
| The project ID | `padel-1a2b3` (it is also the `VITE_FIREBASE_PROJECT_ID` value) |
| The live site's address | `https://padel.example.com` |
| How a deploy happens | "Cloudflare Pages builds when `main` is pushed" |

Then say "Firebase is ready" and Claude carries on.

## Claude's part, once you are done

1. **Point the app at the project.** `src/lib/live.ts` uses the emulators in development and the real
   project in a production build, read from the four `.env` values. With the values missing, the share
   row is hidden rather than broken.
2. **Publish the rules** in `firestore.rules` to the project, and check them the way they were checked
   locally: only the sharer can write or delete, anyone with the link can read one game, nobody can list.
3. **Test against the real project** from a local build: share, watch from a second browser, finish,
   delete.
4. **Update the words that are no longer true:** the "Local-only, no network calls" paragraph in
   `CLAUDE.md`, the README, and the privacy page, which today says "Your tournaments live on this phone
   and nowhere else. There's no server".
5. **Hand you the Cloudflare step** (below), then push and merge when you say so.

## One more step for you, at deploy time

Cloudflare Pages builds the site on its own servers, so it needs the same four values. In the Cloudflare
dashboard: **Workers & Pages → your project → Settings → Environment variables**, add the four
`VITE_FIREBASE_*` names with the same values as in `.env`, for the Production environment.

## Good to know

- **Free plan limits:** 20,000 writes and 50,000 reads a day. One point or score saved is one write; each
  friend watching reads once per change. A match of 150 points watched by 10 friends is about 150 writes
  and 1,500 reads.
- **What is stored:** one document per shared game (names, scores) and one anonymous account per
  organiser's browser. Nothing is stored for a game that is never shared.
- **Not built yet:** shared games are never cleaned up by themselves. A game stays online until its
  organiser deletes it.
- **Optional, later:** in Google Cloud's "Credentials" page the API key can be limited to your site's
  address, so other sites cannot use it.
