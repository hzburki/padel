---
name: check
description: Run the linter and the unit tests, fix everything they report, and repeat until both are clean. Only runs when the user types /check.
disable-model-invocation: true
---

Get `npm run lint` and `npm test` both passing, fixing whatever stands in the way. Nothing else: no new
features, no tidying, no commit.

## The loop

1. Run `npm run lint`. Fix every error and every warning it reports, then run it again until it is clean.
2. Run `npm test`. Fix every failing test, then run it again until it passes.
3. If step 2 changed any file, go back to step 1. A fix for a test can break the linter, and the other way
   round.

Done means one run of `npm run lint` followed by one run of `npm test`, both clean, with no edit in between.
Read the output of each run; don't assume a fix worked.

## Fix the cause, not the report

The point of this skill is working code, not a green tick. A check that passes because it was switched off
tells the user nothing, and they will stop trusting it. So:

- Don't silence the linter: no disable comments, no rules turned off or loosened in the config, no files
  added to an ignore list.
- Don't silence a test: no `.skip`, `.only` or `.todo`, no deleting it, no loosening what it expects just to
  make it pass.
- When a test fails, work out which side is wrong before touching either. The test names state the rules,
  and CLAUDE.md has the same rules in words (the two Domain sections). If the code breaks the rule, fix the
  code. If the rule itself was changed on purpose and the test is out of date, update the test. If you
  can't tell which, stop and ask; guessing here can quietly change how a game is scored.
- If a fix leaves code with nothing using it, delete it (CLAUDE.md, "Leave no dead code").

Keep each fix as small as the problem. Don't rename, reformat or restructure things on the way past.

## When to stop and ask

- The same failure is still there after three different attempts at fixing it.
- The fix needs something structural: a new dependency, or a change to the shape of a stored game.
- A test and CLAUDE.md disagree about a rule.

Say what fails, what you tried and what you think the choice is.

## Report

Short, in this shape:

- **Lint:** clean, or what is still failing.
- **Tests:** how many passed, or what is still failing.
- **Fixed:** one line per fix: the file, what was wrong, what changed. Say "nothing to fix" if both were
  clean on the first run.
- **Watch out:** any fix that changed behaviour rather than style, any test you edited and why, anything
  you left alone.
