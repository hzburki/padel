---
name: shots
description: Run the screenshot check, look at every screen that no longer matches its stored image, fix the ones that are bugs and ask before accepting the ones that are meant. Only runs when the user types /shots.
disable-model-invocation: true
---

Run `npm run shots` and deal with what it reports. It walks the app at phone, tablet and desktop size and
compares each screen with its image in `shots/images/`. The walk is `shots/screens.shots.ts`, the games it
starts from are `shots/seed.ts`.

It starts its own dev server on port 5199, or uses the one already there. It needs no emulators.

## 1. Run it

`npm run shots`. All passed: say so and stop.

## 2. Look at every failure

A failure is one of three things. Tell them apart before touching anything.

- **A screen changed.** The output names the stored image and a diff image under `test-results/`. Open all
  three (`-expected`, `-actual`, `-diff`) and look at them. Then read `git diff` and `git log` to see what
  changed in the code behind that screen.
- **A screen has no stored image yet.** The run writes one and fails once. Open the new image and check it
  as you would in a design review: nothing cut off, nothing overlapping, nothing off-screen, tap targets a
  thumb can hit. A new screen usually shows up at all three sizes; look at each.
- **The walk broke.** A button it taps was renamed or moved, so it timed out. Fix the selector in
  `shots/screens.shots.ts`. This is the walk being out of date, not the app being wrong.

## 3. Decide: bug or meant

For each changed screen, say which it is and why, in one line.

- **A bug**: nobody asked for this change, or it breaks the layout. Fix the app, not the image, and run
  again.
- **Meant**: it is what a recent change set out to do, and it looks right at every size.
- **Can't tell**: say so and ask.

The same change often shows up on many screens (a header, a font, a colour). Group those and judge them
once.

## 4. Ask before replacing a stored image

A stored image is what "correct" means from then on, so replacing one is the user's call. List the screens
you judged as meant, with what changed in each, and ask. Only after a yes:

```bash
npm run shots -- --update-snapshots
```

Add `-g "part of the test name"` or `--project phone` to replace only some. Then run `npm run shots` once
more with no flags and see it pass.

New images written for screens that had none need no flag, but do need the same look and the same yes
before they are left in the working tree for the user to commit.

Don't loosen the comparison (no `maxDiffPixels`, no `threshold`), don't delete a screen from the walk and
don't skip a test to get a pass. If a screen differs from run to run with no code change, find what moves
(a scroll still running, a late font, the clock) and make the walk wait for it.

## Report

- **Result:** how many screens matched, out of how many.
- **Bugs fixed:** one line each: the screen, what was wrong, what changed.
- **Waiting on you:** the screens that changed on purpose, with what changed, until the user says yes.
- **Replaced:** the stored images replaced after a yes.
- **Watch out:** anything you could not judge, and any change to the walk itself.
