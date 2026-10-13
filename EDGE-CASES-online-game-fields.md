# Edge cases: a broadcast game stored online as fields

For review once `PLAN-online-game-fields.md` is built. Nothing here is handled beyond what "Today" says.
Each one is yours to decide: fix it, or leave it.

Decided on 2026-10-14: when organisers act on the same round, match or game, the latest write stays in
Firestore. Keeping scores right is up to the organisers. Cases 1 to 4 follow from that.

Cases marked *(slice N)* are about code not written yet; I'll correct them if the code turns out different.

## Two organisers at once

| # | What happens | Today |
| --- | --- | --- |
| 1 | Both correct the same court at the same moment. | The later score stays, whole. Never a mix of the two. |
| 2 | Both tap the same point of a match at the same moment. | Counted once. If they tapped different teams, the later tap stays. |
| 3 | One undoes while the other adds a point. The online log gets a gap: points 0, 1, 3. | The gap is closed when read, so the match shows 3 points. That phone's next point is written as number 3, over the one there: one point is lost. |
| 4 | Both rename the same player, or the game. | The later name stays. |
| 5 | One finishes the game while the other's score is on its way. | The score lands on a finished game and shows in the result. The rules don't stop a change to a finished game. |

## A write that doesn't arrive

| # | What happens | Today |
| --- | --- | --- |
| 6 | A score is made just as the connection drops, and the app is closed before it is back. | The score is on the phone, never online. The next open takes the online copy and the score is gone. Planned in `PLAN-offline-scores.md`. |
| 7 | Firestore refuses a score (the organiser link was deleted, say). | The phone shows and saves the score first, then says "Not saved. Try again" and goes back to the online copy. For a moment the phone holds a score nobody else has. An added organiser's phone goes back only while the game is open and followed; a game that was deleted online is finished there instead. |
| 8 | The same game is open in two tabs of one browser and one tab's stream runs late. | The late tab can save an older copy on the phone until its stream catches up. The online copy is not touched, so nothing is lost. Every copy that arrives is saved, the same one too, and each save wakes the other tab to read the game again. |

## What is checked

| # | What happens | Today |
| --- | --- | --- |
| 9 | Someone with the organiser link writes junk into one score or point, by hand, not through the app. *(slice 2)* | The rules can't look inside every entry of a map, so it gets in. Zod then refuses the whole copy on every phone: the game stops updating for everyone until the entry is fixed. |
| 10 | The online copy has a number out of range (a target of 500), or a team naming a player who isn't there. | The rules refuse a target over 64, more than 50 courts or more than 12 games a set. A team naming a player who isn't there is shown as it is: Zod checks types only. |
| 11 | The online copy has a score for a match that isn't in the schedule. | Ignored, not refused. |

## Old games and old builds (until the old shape is removed, 2026-10-28)

| # | What happens | Today |
| --- | --- | --- |
| 12 | A game with an organiser link is still in the old shape. | The owner's phone rewrites it as fields the first time it opens the game with a connection, once per opening. Until then no organiser can change it on the new build: "Not saved. Try again", and "Add an organiser" is not shown on it. A score the owner taps in the moment before the rewrite is refused the same way. |
| 13 | A phone still runs the old build after the game was rewritten. | It can't read the new copy and stops following, until the page is reloaded. |
| 14 | An old-shape game is never opened again by its owner. | It stays in the old shape. Once old-shape support is removed, its link shows nothing new. |

## Size

| # | What happens | Today |
| --- | --- | --- |
| 15 | Firestore indexes every field of a map. | A few hundred index entries a game. Harmless. Can be switched off for `game` in the console. |
| 16 | A very long match, or very many rounds. *(slice 2)* | The rules will cap `scores` and `points` at 5,000 entries each. Past that a write is refused. |
