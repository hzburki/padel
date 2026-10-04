---
description: Explain a change or an area of the code in plain words, for review
argument-hint: "[nothing | commit ref | file | plain description, e.g. 'americano scoring']"
allowed-tools: Bash(git:*), Read, Grep, Glob
---

Explain something so the user understands it without reading all the code themselves.

## Work out what they mean by: $ARGUMENTS

1. **Empty** → the uncommitted changes if the working tree is dirty, otherwise `HEAD`.
2. **Resolves as a git ref** (check with `git rev-parse --verify`) → explain that commit's diff.
3. **An existing file path** → explain that file as it stands now, plus how it got there
   (`git log --oneline -- <path>`).
4. **Anything else — a plain description of an area, like "the americano points system"** → find the code
   yourself with Grep/Glob, then explain how that area works today. Say which files you decided it covers
   before explaining, so they can correct you if you looked in the wrong place.

Never ask which they meant — pick the best reading, state it in one line, and go.

## Shape of the answer

For a **change** (cases 1–2):

**Works now** — one line: what the user can do that they couldn't before.
**The idea** — the one thing to understand. Usually one function or one decision. Two or three sentences.
**Read this first** — the single file carrying the idea, with line numbers. Name the rest as wiring.
**File by file** — one line each, why it changed. Skip pure boilerplate and say you skipped it.
**Watch out** — anything guessed at, stubbed, hardcoded, or that you'd do differently.

For a **file or an area** (cases 3–4), same shape with two swaps: **What it does** instead of "Works now",
and **Where it lives** — the files involved and which one to start from — instead of "File by file".

## Rules

- Plain words. Short. Follow the writing style in CLAUDE.md.
- Don't paste the code or the diff back at them. They can read it; they want what it doesn't show.
- Don't explain lines that explain themselves. Spend the words on the non-obvious choice.
- **Watch out** is never empty without having genuinely hunted for something to put in it.
- If a change turns out to be bigger than one idea, say so and how it should have been split.
- End by offering a line-by-line pass on any one file.
