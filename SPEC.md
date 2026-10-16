# Spec: Players join and leave a running Americano

## Objective

Friends turn up late and leave early. Today the player list is fixed when the tournament starts. With this
feature the organiser can add a player to a running Americano, or take one out, and the rounds still to
play are rebuilt around the new list.

It is chosen per tournament on the New game screen and is **off by default**. With it off, nothing changes
from today.

### On the New game screen (Americano)

At the bottom of the form, one switch: **Allow players to join and leave mid game**, off by default. When
it is on, two choices appear under it:

| Choice                | Options                                                       | Default    |
| --------------------- | ------------------------------------------------------------- | ---------- |
| A player who leaves   | Scale up their points in the final standings, or don't        | Scale up   |
| A player who joins    | Join the rotation evenly (points scaled up at the end), or catch up first (plays every round until level) | Scale up |

These are locked once the tournament starts, like the other settings.

### During the tournament

- **Add a player.** Type a name. They play from the next round on.
- **Remove a player.** Their scored games and points stay as they are. They play no more rounds. They are
  still in the standings, with a "left" badge. Before removing, a warning says they can't be brought back.
  A removed player can never return.
- **Which rounds are rebuilt.** Every round after the last round that has any score. Rounds with a score
  never change. So in a round where some courts are scored, the change starts from the next round.
- **How rounds are rebuilt.** The same rules as the first schedule, made with the players still in:
  - only the players who don't fit sit out, the ones with the most games, ties at random;
  - partners and opponents rotate so that, as far as the count allows, everyone partners and faces everyone
    once, counting the partners and opponents they already had in the kept rounds;
  - courts used: `min(courts, floor(players in / 4))`. The courts setting never changes.
- **How many rounds are left.** Worked out again after every change, by the app, not the organiser. Equal
  games for everyone still in comes first: the rounds left are the count closest to the rounds left before
  the change (ties go to more rounds) after which everyone still in has played the same number of games.
  In *join evenly* mode an even joiner's credit counts as games for this; in *catch up first* mode their
  real games do. The sheet shows the new number of rounds before the organiser confirms.
- **Games played by a joiner** (for who sits out):
  - *Join evenly*: they count as having the fewest games of anyone still in when they join. They sit out as
    often as the others.
  - *Catch up first*: they count their real games (0). They play every round until they have as many as
    the others.
- **Final standings.** The rule stays: points and difference scaled up to the most games played. A player
  who left is left out of the scaling when "don't scale up" was picked. A joiner is scaled like anyone with
  fewer games (in both joiner options, catch-up included, if they never caught up).

### Rules

- At least 4 players must still be in. Remove is not offered at 4.
- A player can't be removed while they are in an unscored match of a round that is kept (the current,
  partly scored round). The screen says to score that match first.
- A new name can't match a player already in the tournament, in or left, ignoring case.
- Not possible once the tournament is finished.
- A friend's copy (`shared`) can't do it.

### Broadcast

- With no organiser link: the online copy is overwritten from the phone, as today.
- With added organisers: any organiser can add or remove, **only when online**. Offline the button is
  greyed out and says why (no connection), like rename. The change sends only the fields that changed: the
  new or changed player entries and the rebuilt `rounds`.
- The online copy gains the new player fields, and `zod` in `online-game.ts` checks them. Friends following
  see the player as left as soon as their phone gets the new copy.
- If two organisers score and change players at the same moment, a score can land on a rebuilt match.
  Nothing guards against this: it is left to the organisers.

### Stored shape (needs a version bump, 2 → 3)

Proposed, final names decided in the plan:

```ts
interface Player {
  id: PlayerId
  name: string
  left?: true          // took no part after they were removed
  joinedAt?: number    // round index they joined at; absent for players there from the start
}

interface Tournament {
  version: 3
  // …as now…
  // Absent: players are fixed (the switch was off). Every tournament saved before v3 migrates to absent.
  lateChanges?: {
    scaleLeavers: boolean
    joiners: "even" | "catchUp"
  }
}
```

`migrate` gets a v2 → v3 step that only bumps `version`: an old tournament has no `lateChanges`, so it
can't take joiners or leavers.

## Tech Stack

No change. React 19, Vite 8, TypeScript 6, Tailwind v4, shadcn/ui (`Switch` if not already added; ask
first), Vitest, Playwright, `zod`, Firebase only in `live.ts`. No new dependency.

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
| `src/lib/types.ts`                     | `Player.left`, `Player.joinedAt`, `Tournament.lateChanges`, version 3     |
| `src/lib/storage.ts`                   | `CURRENT_VERSION = 3`, v2 → v3 step                                       |
| `src/lib/americano.ts`                 | Build the rounds left, starting from the kept rounds' partners/opponents  |
| `src/lib/bench.ts`                     | Games played that credit an even joiner                                   |
| `src/lib/tournament.ts`                | `addPlayer`, `removePlayer`, their problems, setup input for the switch   |
| `src/lib/standings.ts`                 | Leave leavers out of scaling when chosen                                  |
| `src/lib/online-game.ts`               | New player fields in `toOnline` / `fromOnline` / zod                      |
| `src/components/new-tournament-screen.tsx` | The switch and the two choices                                        |
| `src/components/tournament-screen.tsx` | Add / remove in the menu, "left" badge, offline grey-out                  |
| `src/components/standings-table.tsx`   | "left" badge                                                              |
| `shots/`                               | A flow that adds and removes mid game; seeds for screen images            |
| `README.md`                            | The new switch                                                            |

## Code Style

As the code around it: pure functions in `src/lib/` that return a new tournament, plain names, a comment
that says the rule. For example:

```ts
// A copy with one more player, who plays from the first round with no score.
// The rounds before that are kept as they are; the rest are made again.
export function addPlayer(tournament: Tournament, name: string, deps: { newId: () => string; rng?: Rng }): Tournament
```

## Testing Strategy

- **Vitest, `src/lib/`**, next to each file. Test names state the rule, for example:
  - "keeps every round that has a score when a player is added"
  - "rebuilds from the round after a partly scored round"
  - "never benches a player who has left"
  - "an even joiner sits out as often as the others"
  - "a catch-up joiner plays every round until level"
  - "keeps max(games) - min(games) <= 1 among players still in after a change" (even mode)
  - "counts partners from kept rounds when rebuilding"
  - "sets the rounds left so everyone still in ends on the same number of games"
  - "picks the round count closest to the rounds left before the change"
  - "won't remove a player below 4 still in"
  - "won't remove a player with an unscored match in a kept round"
  - "leaves a leaver out of the final scaling when scaleLeavers is false"
  - "migrates a v2 tournament to v3 with no lateChanges"
  - online copy round trip with a left player and a joiner; `changedFields` sends only the new player and
    `rounds`
- **Playwright flow** in `shots/flows-*.shots.ts`: start with the switch on, score a round, add a player,
  score, remove a player, finish, check the standings.
- **Screen images**: new ones for the switch on the New game screen and for the "left" badge. Replacing any
  stored image needs your yes.
- **By hand**: 5199 at 390 × 844; broadcast with an added organiser on 5198 against the emulators.

## Boundaries

- **Always:** keep scored rounds as they are; save after every change; run `npm test` and `npm run lint`
  before saying a slice is done; one slice at a time with a change brief; leave the work uncommitted.
- **Ask first:** adding the shadcn `Switch` component; anything outside the files above; changing a stored
  screen image.
- **Never:** change a scored match; send the whole online copy of a game with added organisers; let a
  screen wait for the connection; touch the real Firebase project; commit or branch.

CLAUDE.md says "The whole schedule is made before round 1 and never changes with results." That stays
true for results. It will need one line added: with the switch on, adding or removing a player rebuilds the
rounds that have no score yet.

## Success Criteria

- With the switch off (and for every tournament saved before this), the app works exactly as today and no
  add/remove is shown.
- With it on, the organiser can add a player and remove one in a running tournament, offline, with one hand.
- No scored match ever changes because of a roster change.
- After any change in even mode, among players still in, `max(games) - min(games) <= 1` holds after each
  round, counting an even joiner's credit.
- After any change, everyone still in ends the tournament on the same number of games (counting an even
  joiner's credit), and the courts setting is unchanged.
- A removed player never appears in a rebuilt round. A joiner never appears in a kept round.
- Final standings follow the two choices.
- A broadcast game with added organisers takes the change online without wiping another organiser's score,
  and friends following see the new rounds.
- Old v2 games still load.

## Decided

1. Rounds left are worked out again after each change, with equal games for everyone still in first. No
   stepper for the organiser.
2. Courts stay as set. Adding a player never adds a court.
3. A removed player can't be brought back. The remove sheet warns about this.
4. A score and a player change racing between two organisers is left to them. No lock.
5. Everyone runs the same web app code, so friends see a player leave once their phone gets the new copy.

## Open Questions

None.
