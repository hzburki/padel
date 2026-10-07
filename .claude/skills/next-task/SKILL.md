---
name: next-task
description: Take the next task from TASKS.md and carry it from questions to a tested, ticked-off change. Only runs when the user types /next-task.
disable-model-invocation: true
argument-hint: "[nothing | 'plan' to stop after the questions]"
---

Take one task from `TASKS.md` and finish it: pick it, understand it, ask about it, build it, test it in the
browser, tick it off, report. One task per run, start to finish.

Running this skill is the user's go-ahead to read and edit `TASKS.md` for this run. The note at the top of
that file ("do not read, act on or edit") still holds everywhere else.

## 1. Pick the task

Read `TASKS.md`. It has four headings: **In Progress**, **To Do**, **Backlog**, **Done**.

- If **In Progress** has any unchecked task, take the top one. It was started or queued on purpose, so it
  wins over anything in To Do.
- Otherwise take the top task of **To Do** and move that line, word for word, to **In Progress**.
- Never take from **Backlog**. If In Progress and To Do are both empty, say so and stop.

Take exactly one task, even when the next one down looks related or tiny. The user reviews one change at a
time; two tasks in one run is the mixed diff CLAUDE.md warns about. If a neighbouring task overlaps, mention
it in the questions and leave it where it is.

Don't reword, reorder or tidy any other line in the file. It is the user's notes.

Tell the user in one line which task you took.

## 2. Read the code before asking anything

Questions the code could have answered waste the user's time, so read first.

- Find every file the task touches and the ones that call into them. Read them fully, not excerpts.
- Rules live in `src/lib/` with tests beside them; read the tests, they state the rules in plain sentences.
- If the task goes anywhere near broadcasting, read `src/lib/live.ts`, `src/lib/broadcast.ts`,
  `firestore.rules` and the stored types in `src/lib/types.ts`. Together they are the Firebase data schema:
  what a document holds, who may write it, what is subscribed to and when it is closed. Use the local
  emulator if you need to see real documents. The hosted project is off limits (see CLAUDE.md), and so are
  the Firebase CLI and MCP tools, which are signed in with the wrong account.
- If the task touches a stored shape, read `src/lib/storage.ts` for the version and migrations.
- Note what already exists that the task can reuse, and what the task would break.

## 3. Ask, as a senior product manager would

The task lines are short notes jotted mid-thought. Your job here is to turn one into a feature that fully
solves the problem behind it, and to find the holes before the code does.

Work out, then ask about whatever is still open:

- **The problem behind the note.** What went wrong for whom, courtside? A note that asks a question ("Should
  we…?") wants a recommendation first, then a decision.
- **Every actor.** Organiser and viewer see different things. So do an Americano and a Match.
- **Every state.** Game not started, mid-round, decided but not confirmed, finished, deleted. Broadcast
  never started, live, stopped, replaced by another broadcast. Online, offline, back online. App
  backgrounded, phone locked, tab reloaded, cold start with no connection, two tabs open.
- **Old data.** Games already saved on phones and documents already in Firestore, made before this change.
- **What the user sees.** The exact words, icon or badge, and where. Few words, more visuals.
- **What is out of scope**, so it is agreed rather than assumed.

Ask everything that changes what you would build, and nothing that doesn't. Use the question tool, in rounds
of up to four, options where they fit, your recommended option first. Give each question the one fact from
the code that makes it a real choice. Keep going round by round until nothing open would change the code;
answers often open new questions. If a task mentions a screenshot or anything else you don't have, ask for
it.

Before coding, post a short spec: what will be built, as a list of behaviours, plus what is left out. If
`$ARGUMENTS` is `plan`, stop here.

CLAUDE.md says to stop and ask before anything structural (a new dependency, a new folder layer, a state
library, a change to a stored shape). Raise those here, in this round, not halfway through the code.

## 4. Sub-points

When the task turns out to need several pieces, or the answers add work, write them as indented checkboxes
under the task in `TASKS.md`:

```markdown
- [ ] Do not allow to broadcast finished games.
  - [x] Hide the Broadcast button once a game is finished
  - [ ] Stop a live broadcast when its game is finished
```

Each sub-point is one slice: something the user can open the app and try, or one pure module with its
tests. Tick each as it is built and tested. The parent is done only when every sub-point is ticked. New work
found along the way that belongs to this task becomes another sub-point; work that doesn't belong goes in
your report, not in the file.

## 5. Build

Follow CLAUDE.md: rules in pure functions in `src/lib/` with tests named as plain sentences, React only
reads and renders, one slice at a time, no drive-by renames or reformatting. Do not commit and do not create
a branch; leave the work in the working tree.

Run `npm test`, `npm run lint` and `npm run build` before moving on to the browser.

## 6. Test it yourself, in the browser

Passing unit tests show the rules are right. They don't show that the screen works. Open the app and use it
the way the organiser would.

- Start `npm run dev`, and `npm run emulators` for anything that broadcasts. Check first whether either is
  already running and reuse it. Emulators only, never the hosted project.
- Drive it with the Chrome tools at phone size (about 390 × 844).
- Go through the spec behaviour by behaviour, then every edge case raised in step 3. Don't stop at the happy
  path: reload mid-flow, go offline (stop the emulator or use the browser's offline switch), use old saved
  data, and for a broadcast open the viewer link in a second tab and watch both sides.
- Check the features next to the change still work: the ones that share its code, screen or stored data.
- Read the browser console; an error there is a failed test.
- Take a screenshot of each behaviour that matters so the report can show it.

If something fails, fix it and run the affected checks again. Stop the servers you started when you are
done; leave running the ones you found running.

Some things can't be checked from desktop Chrome: the iOS keyboard, the share sheet, an installed PWA. Don't
tick those. Add a sub-point such as "Check on a real iPhone", leave the task in In Progress, and say exactly
what to try on the phone.

## 7. Tick it off

Only when every behaviour in the spec has been seen working:

- Change the task to `- [x]` and move it, with its sub-points, to the bottom of **Done**.
- Leave everything else in `TASKS.md` as it was.

If anything is unverified, failing or waiting on the user, the task stays in In Progress with its sub-points
showing what is left. A task ticked without being seen working is worse than one left open, because the
user stops looking at it.

## 8. Report

Reply as after any other task, with the change brief from CLAUDE.md (Works now, Read this first, Files,
Watch out), and add:

- **Tested:** each behaviour and edge case you ran in the browser, and what you saw. Name anything you could
  not test.
- **TASKS.md:** where the task is now, and what is next in line.

Then stop. The next task waits for the next `/next-task`.
