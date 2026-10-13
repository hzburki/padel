# Keep a score that has not reached Firestore yet

Builds on `PLAN-online-game-fields.md`. Do that one first: this plan assumes a score is one field write.

## The gap

In a game with several organisers the online copy is the real one. After the fields plan, a tap is shown and
saved on the phone at once and sent to Firestore without waiting. Firestore keeps a write that has not gone
out yet in the page's memory only. So:

1. An organiser enters a score as the connection drops, or on a connection that is up but dead.
2. The phone shows the score. It is saved on the phone. It is not online.
3. The app is closed, or the phone kills the tab, before the connection is back.
4. The unsent write is gone. The next time the game is opened, the online copy is taken, and it does not
   have the score. Nobody is told.

How often: rarely, because the app already locks scoring when the phone knows it has no connection. It
needs a dead connection the phone has not noticed, and the app closed soon after. But courtside is where
connections are worst, and a lost score with no warning is the worst thing this app can do.

## Two ways to close it

**A. Firestore's stored cache (recommended).** One setting when Firestore starts
(`persistentLocalCache` with `persistentMultipleTabManager`). Unsent writes are kept on the phone, in order,
and sent when the app next starts with a connection. This is what the setting is for: it handles order,
retries, the sign-in and several tabs.

**B. Our own outbox.** Save each unsent change beside the game and send it again on start, as `resendLive`
does for a plain broadcast. About 40 lines, fully ours. But it repeats what Firestore already does, and a
change sent twice, once by us and once by Firestore, can put an old value over a newer one from another
organiser.

A is the better long-term choice. It costs:

- Firestore keeps its own copy of each followed game on the phone, next to ours. Small.
- A cold start reads that cache first: a few milliseconds.
- Where the stored cache can't open (private browsing), the SDK falls back to memory by itself and logs a
  warning (checked in the installed SDK). The app then behaves as it does today.

## Slice 1: unsent scores survive closing the app

- `src/lib/live.ts`: start Firestore with the stored cache and the many-tabs manager.
- Opening a game: the first answer may now come from the stored cache, with the phone's own unsent writes
  already in it. Show it; it is never older than the phone's own copy. The server's answer follows.
- Check that a missing document answered from the cache is still not taken for a delete (already handled;
  keep its test).
- Rules: once a game is finished, an added organiser may change only its `name`. A write that sat on a
  phone for a day must not land in a finished game.
- Tests:
  - `live.test.ts`: a copy from the cache with unsent writes is shown and saved; a missing copy from the
    cache is not a delete.
  - Flow: score with the connection cut, reload the page, restore the connection, and the other phone gets
    the score.
  - Flow: the app still starts cold with no connection (port 5301).
  - Rules: a scorer can't change the scores of a finished game.

## Slice 2: show what has not been sent

Firestore says whether a copy holds writes that are still waiting (`hasPendingWrites`).

- `openGame` passes that on to the screen as a third value.
- The screen shows a small "not sent" icon next to the Live badge while it is true. No words.
- Test: the icon shows while the connection is cut and goes when it is back.

This is what tells an organiser not to pocket the phone yet.

## Slice 3, only if you want it: several organisers scoring with no connection

With slices 1 and 2 the offline lock is no longer needed to keep data safe. Lifting it is a product
decision, not a fix, because of what happens when two phones change the same thing while apart:

- **Americano, different courts:** both kept. Safe.
- **Americano, same court:** whichever phone reconnects last wins, even if its score was entered first.
- **Match:** two phones adding points while apart both write "point 15", "point 16"… and the logs
  overwrite each other into a score nobody played. Not safe.

So if the lock is lifted, lift it for Americano only and keep it for a match. It would change the rule in
`CLAUDE.md` ("changing that game needs a connection") and the offline message.

## What this does not fix

- A phone that is never opened again never sends. Slice 2 is the warning for that.
- Site data cleared on the phone: the unsent writes go with everything else.

## Order

Slice 1, then 2. Each can be tried on its own. Slice 3 waits for your yes.
