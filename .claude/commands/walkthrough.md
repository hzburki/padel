---
description: Explain a change in plain words so the user can review it quickly
argument-hint: "[commit ref or file — defaults to uncommitted changes, else HEAD]"
allowed-tools: Bash(git:*), Read
---

Explain a change so the user understands it without reading all the code themselves.

Target: $ARGUMENTS — if empty, use the uncommitted changes when the working tree is dirty, otherwise HEAD.

1. Get the shape first (`git diff --stat` / `git show --stat`), then the full diff.
2. Explain it in this order, and keep the whole thing short:

**Works now** — one line: what the user can do that they couldn't before.
**The idea** — the one thing to understand. Usually one function or one decision. Two or three sentences.
**Read this first** — the single file that carries the idea, with the line range. Name the rest as wiring.
**File by file** — one line each, why it changed. Skip files that are pure boilerplate and say so.
**Watch out** — anything guessed at, stubbed, hardcoded, or that you'd do differently. Never leave empty
without having actually looked for something to put there.

Rules:
- Plain words. Short. Follow the writing style in CLAUDE.md.
- Do not paste the diff back at them. They can read the diff; they want the parts it doesn't show.
- Do not explain lines that explain themselves. Spend the words on the non-obvious choice.
- If the change is bigger than one idea, say so and suggest how it should have been split.
- End by offering a line-by-line pass on any one file.
