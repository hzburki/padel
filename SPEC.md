# Spec: Players join and leave a running Americano

## Objective

Friends turn up late and leave early. Today the player list is fixed when the tournament starts. With this
feature the organiser can add a player to a running Americano, or take one out, and the rounds still to
play are rebuilt around the new list.

There is no setting on the New game screen. Every running Americano has **Players** in its menu. The
choices are made at the moment someone joins or leaves, when the organiser knows how much time is left.
If nobody joins or leaves, nothing changes from today.

### During the tournament

**Players** sits in the menu under "Edit names", with the New badge like "Add an organiser". It opens a
sheet with the player list: remove on each player still in, an add field at the bottom.

- **Add a player.** Type a name. They play from the next round on. They rotate in like everyone else and
  sit out as often as the others: for who sits out, they count as having played as many matches as the
  player still in with the fewest when they joined. They end with fewer matches, so their points are scaled
  up at the end like anyone with fewer matches.
- **Remove a player.** Their scored matches and points stay as they are. They play no more rounds. They are
  still in the standings, with a "left" badge. Before removing, a warning says they can't be brought back.
  A removed player can never return.

The sheet asks one or two questions before the organiser confirms:

| Question | When | Options | Default |
| --- | --- | --- | --- |
| How long to play? | Every add and every remove | **Same time** or **Same matches**, each showing its number of rounds left | Same matches |
| Their points? | Remove only | **Scale up** or **Keep as scored** | Scale up |

- **Same time:** the rounds left stay as they are. Everyone plays a little more or a little less than planned.
- **Same matches:** each player still in plays about as many more matches as they were due before the
  change. More players means more rounds, fewer players fewer rounds. A leave that takes the game below 8
  players drops to 1 court, so there the rounds go up. Of the counts near that, the app picks the one
  where everyone still in ends level (ties go to more rounds); if none does, one where nobody is more than
  one match apart.
- **Scale up:** the leaver's points are scaled up at the end, as today for anyone with fewer matches.
- **Keep as scored:** the leaver's points stay as they were scored.

Examples, 4 rounds left, everyone due 4 more matches:

| Change | Same time | Same matches |
| --- | --- | --- |
| 8 players on 2 courts, 1 joins (9) | 4 rounds | 5 rounds |
| 6 players on 1 court, 1 leaves (5), 6 rounds left | 6 rounds | 5 rounds |
| 8 players on 2 courts, 1 leaves (7, 1 court) | 4 rounds | 7 rounds |

### How rounds are rebuilt

- **Which rounds.** Every round after the last round that has any score. Rounds with a score never change.
  So in a round where some courts are scored, the change starts from the next round.
- **The same rules as the first schedule**, made with the players still in:
  - only the players who don't fit sit out, the ones with the most matches, ties at random;
  - partners and opponents rotate so that, as far as the count allows, everyone partners and faces everyone
    once, counting the partners and opponents they already had in the kept rounds;
  - courts used: `min(courts, floor(players in / 4))`. Courts are booked in advance: adding a player never
    uses more courts than were set.
- **Round limit.** The whole tournament never goes over `MAX_ROUNDS`.

### Final standings

The rule stays: points and difference scaled up to the most matches played. A leaver who was set to
**Keep as scored** is left out of the scaling. Everyone else, joiners included, is scaled as today.

### Rules

- At least 4 players must still be in. Remove is not offered at 4.
- A player can't be removed while they are in an unscored match of a round that is kept (the current,
  partly scored round). The screen says to score that match first.
- A new name can't match a player already in the tournament, in or left, ignoring case.
- Not possible once the tournament is finished, or once the last round has any score (nothing is left to
  rebuild). The screen says "All rounds are played. Finish the tournament."
- Only organisers see it, an added organiser too. A friend who only watches doesn't (the screen hides it).

### Broadcast

- With no organiser link: the online copy is overwritten from the phone, as today.
- With added organisers: any organiser can add or remove, **only when online**. Offline the button is
  greyed out and says why (no connection), like rename. The change sends only the fields that changed: the
  new or changed player entries and the rebuilt `rounds`.
- The online copy gains the new player fields, and `zod` in `online-game.ts` checks them. Friends following
  see the player as left as soon as their phone gets the new copy.
- `firestore.rules` today stops an added organiser from changing `rounds`. It must allow it on an Americano.
  The rules deploy to the real project is the user's.
- If two organisers score and change players at the same moment, a score can land on a rebuilt match.
  Nothing guards against this: it is left to the organisers.

### Stored shape (version 3)

```ts
interface Player {
  id: PlayerId
  name: string
  // Removed mid game: their scored matches stay, they play no more rounds and can't come back.
  left?: { scaleUp: boolean }
  joinedAt?: number    // round index they joined at; absent for players there from the start
}
```

`Tournament` gets no new field. "Same time" or "Same matches" is only used to make the rounds, so it isn't
stored. `migrate` has a v2 → v3 step that only bumps `version`. This branch hasn't shipped, so `left`
changing from `true` to `{ scaleUp }` needs no further version.

### Known gap

A joiner's starting count (for who sits out) is worked out again from the rounds at each change, from the
players still in. If someone who was there when they joined leaves later, it can come out one match
higher. It only moves who sits out a little; final scaling uses real matches.

## Tech Stack

No change. React 19, Vite 8, TypeScript 6, Tailwind v4, shadcn/ui, Vitest, Playwright, `zod`, Firebase only
in `live.ts`. No new dependency.

## Commands

```bash
npm test                                          # vitest run
npx vitest run src/lib/americano.test.ts          # one file
npm run lint                                      # oxlint
npm run build                                     # tsc -b && vite build
npm run dev -- --port 5199 --strictPort           # organiser
npm run dev -- --port 5198 --strictPort           # a friend following
npm run emulators                                 # for broadcast tests
npm run shots                                     # screens and played games, Chrome and Safari
```

## Project Structure

| File                                   | What changes                                                              |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `src/lib/types.ts`                     | `Player.left`, `Player.joinedAt`, version 3; no `Tournament.lateChanges`  |
| `src/lib/storage.ts`                   | `CURRENT_VERSION = 3`, v2 → v3 step                                       |
| `src/lib/americano.ts`                 | Rounds left for "Same matches"; build the rounds left from the kept ones  |
| `src/lib/bench.ts`                     | Matches each player counts as having, a joiner's starting count included  |
| `src/lib/tournament.ts`                | `addPlayer`, `removePlayer`, their problems; the setup switch taken out   |
| `src/lib/standings.ts`                 | Leave "Keep as scored" leavers out of scaling                             |
| `src/lib/online-game.ts`               | New player fields in `toOnline` / `fromOnline` / zod                      |
| `src/components/new-tournament-screen.tsx` | The switch and its choices taken out again                            |
| `src/components/players-form.tsx`      | New: the Players sheet                                                    |
| `src/components/tournament-screen.tsx` | "Players" in the menu, offline grey-out                                   |
| `src/components/standings-table.tsx`   | "left" badge                                                              |
| `src/components/new-badge.tsx`         | An `until` date per use                                                   |
| `firestore.rules`, `shots/rules.shots.ts` | Added organisers may change `rounds` on an Americano                   |
| `shots/`                               | A flow that adds and removes mid game; seeds for screen images            |
| `README.md`                            | Players joining and leaving                                               |

## Code Style

As the code around it: pure functions in `src/lib/` that return a new tournament, plain names, a comment
that says the rule. For example:

```ts
// A copy with one more player, who plays from the first round with no score.
// The rounds before that are kept as they are; the rest are made again.
export function addPlayer(tournament: Tournament, name: string, length: "sameTime" | "sameMatches", deps: { newId: () => string; rng?: Rng }): Tournament
```

## Testing Strategy

- **Vitest, `src/lib/`**, next to each file. Test names state the rule, for example:
  - "keeps every round that has a score when a player is added"
  - "rebuilds from the round after a partly scored round"
  - "never benches a player who has left"
  - "a joiner sits out as often as the others"
  - "keeps max(matches) - min(matches) <= 1 among players still in after a change"
  - "counts partners from kept rounds when rebuilding"
  - "keeps the rounds left with Same time"
  - "adds rounds for a joiner with Same matches"
  - "takes rounds away for a leaver with Same matches"
  - "adds rounds when a leave drops to 1 court with Same matches"
  - "won't remove a player below 4 still in"
  - "won't remove a player with an unscored match in a kept round"
  - "leaves a Keep as scored leaver out of the final scaling"
  - online copy round trip with a left player and a joiner; `changedFields` sends only the new player and
    `rounds`
- **Playwright flow** in `shots/flows-*.shots.ts`: start a game, score a round, add a player, score, remove a
  player, finish, check the standings.
- **Screen images**: a new one for the "left" badge. Replacing any stored image needs the user's yes.
- **By hand**: 5199 at 390 × 844; broadcast with an added organiser on 5198 against the emulators.

## Boundaries

- **Always:** keep scored rounds as they are; save after every change; run `npm test` and `npm run lint`
  before saying a slice is done; one slice at a time with a change brief; leave the work uncommitted.
- **Ask first:** anything outside the files above; changing a stored screen image.
- **Never:** change a scored match; send the whole online copy of a game with added organisers; let a
  screen wait for the connection; touch the real Firebase project; commit or branch.

CLAUDE.md says "The whole schedule is made before round 1 and never changes with results." That stays
true for results. It will need one line added: adding or removing a player rebuilds the rounds that have no
score yet.

## Success Criteria

- A tournament where nobody joins or leaves works exactly as today.
- The organiser can add a player and remove one in a running tournament, offline, with one hand.
- No scored match ever changes because of a roster change.
- After any change, among players still in, `max(matches) - min(matches) <= 1` holds after each round,
  counting a joiner's starting count.
- With Same matches, everyone still in ends level where the numbers allow, and at most one match apart
  otherwise.
- With Same time, the rounds left don't change.
- The courts used never go above the courts set.
- A removed player never appears in a rebuilt round. A joiner never appears in a kept round.
- Final standings follow the leaver's points choice.
- A broadcast game with added organisers takes the change online without wiping another organiser's score,
  and friends following see the new rounds.
- Old v2 games still load.

## Decided

1. The choices are made when someone joins or leaves, not on the New game screen. No switch.
2. How long to play: Same time or Same matches, each showing its round count. Default Same matches.
3. A leaver's points: Scale up or Keep as scored. Default Scale up.
4. No catch-up mode: a joiner rotates in evenly and is scaled up at the end.
5. Courts are booked in advance. Adding a player never uses more courts than were set; below 8 players only
   1 court is used.
6. A removed player can't be brought back. The remove sheet warns about this.
7. A score and a player change racing between two organisers is left to them. No lock.
8. Everyone runs the same web app code, so friends see a player leave once their phone gets the new copy.

## Open Questions

None.
