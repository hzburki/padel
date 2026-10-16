// Who may change a game put online: firestore.rules, asked directly.
// Each phone here is an anonymous sign-in on the local emulators, and
// talks to Firestore the plain way (REST), so the rules are all that
// stands between it and the game. Nothing goes to the hosted project.
import { expect, test, type APIRequestContext } from "@playwright/test"
import type { OnlineGame } from "../src/lib/online-game"
import { emulatorsReady } from "./taps"

const AUTH = "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo"
const DOCS = "http://localhost:8080/v1/projects/demo-padel/databases/(default)/documents"
const KEY = "k3y00000"

type Phone = { uid: string; headers: { Authorization: string } }
type Value = string | number | boolean | Value[] | { [name: string]: Value }
type Fields = { [name: string]: Value }

// The two kinds of game, as the app puts them online (toOnline).
const americano = {
  kind: "americano",
  name: "Friday",
  createdAt: 1760000000000,
  finished: false,
  scoringMode: "total",
  target: 16,
  courts: 1,
  players: {
    p1: { name: "Ana", order: 0 },
    p2: { name: "Ben", order: 1 },
    p3: { name: "Cy", order: 2 },
    p4: { name: "Di", order: 3 },
  },
  rounds: [{ matches: [{ court: 1, teamA: ["p1", "p2"], teamB: ["p3", "p4"] }], benched: [] }],
  scores: { "0_1": { a: 10, b: 6 } },
} satisfies OnlineGame

const match = {
  kind: "match",
  name: "Final",
  createdAt: 1760000000000,
  finished: false,
  teams: { 0: ["Ana", "Ben"], 1: ["Cy", "Di"] },
  bestOf: 3,
  setsAs: "bestOf",
  gamesPerSet: 6,
  deuce: "advantage",
  scoreBy: "points",
  points: { 0: 0, 1: 1 },
} satisfies OnlineGame

test.beforeAll(({ playwright }) => emulatorsReady(playwright))

let games = 0
const newGame = () => `rules${Date.now()}${games++}`

async function signIn(request: APIRequestContext): Promise<Phone> {
  const reply = await (await request.post(AUTH, { data: { returnSecureToken: true } })).json()
  return { uid: reply.localId, headers: { Authorization: `Bearer ${reply.idToken}` } }
}

// A value the way Firestore's REST API wants it. Every number here is a whole one.
function value(of: Value): object {
  if (typeof of === "string") return { stringValue: of }
  if (typeof of === "boolean") return { booleanValue: of }
  if (typeof of === "number") return { integerValue: String(of) }
  if (Array.isArray(of)) return { arrayValue: { values: of.map(value) } }
  return { mapValue: body(of) }
}

const body = (fields: Fields) => ({
  fields: Object.fromEntries(Object.entries(fields).map(([name, of]) => [name, value(of)])),
})

// Writes the whole document, or only `only` of its fields: one of those
// that `fields` leaves out is removed. True when the rules let it through.
async function write(request: APIRequestContext, phone: Phone, path: string, fields: Fields, only?: string[]) {
  const mask = only ? `?${only.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&")}` : ""
  return (await request.patch(`${DOCS}/${path}${mask}`, { headers: phone.headers, data: body(fields) })).ok()
}

// Changes only the parts of the game named in `only`, as the app does
// (changedFields). A name that starts with a digit goes in backticks.
const change = (request: APIRequestContext, phone: Phone, id: string, game: Fields, only: string[]) =>
  write(
    request,
    phone,
    `live/${id}`,
    { game },
    only.map((part) => `game.${part}`),
  )

const remove = async (request: APIRequestContext, phone: Phone, path: string) =>
  (await request.delete(`${DOCS}/${path}`, { headers: phone.headers })).ok()

const read = async (request: APIRequestContext, phone: Phone, path: string) =>
  (await request.get(`${DOCS}/${path}`, { headers: phone.headers })).ok()

const ownerOf = async (request: APIRequestContext, id: string) =>
  (await (await request.get(`${DOCS}/live/${id}`)).json()).fields.owner.stringValue

// Whether a phone may put this online as a new game: `document` without its owner.
async function accepted(request: APIRequestContext, document: Fields) {
  const phone = await signIn(request)
  return write(request, phone, `live/${newGame()}`, { owner: phone.uid, ...document })
}

// A game put online by an organiser, with a score link. `document` is all
// of it but its owner.
async function sharedGame(request: APIRequestContext, document: Fields = { game: americano }) {
  const id = newGame()
  const organiser = await signIn(request)
  expect(await write(request, organiser, `live/${id}`, { owner: organiser.uid, ...document })).toBe(true)
  expect(await write(request, organiser, `live/${id}/keys/${KEY}`, {})).toBe(true)
  return { id, organiser }
}

// A friend who opened the score link.
async function scorer(request: APIRequestContext, id: string) {
  const friend = await signIn(request)
  expect(await write(request, friend, `live/${id}/scorers/${friend.uid}`, { key: KEY })).toBe(true)
  return friend
}

// `count` entries of a map, named 0, 1, 2...
const entries = (count: number, entry: Value): Fields => Object.fromEntries(Array.from({ length: count }, (_, i) => [i, entry]))

test("anyone can read a game, signed in or not", async ({ request }) => {
  const { id } = await sharedGame(request)
  expect((await request.get(`${DOCS}/live/${id}`)).ok()).toBe(true)
})

test("an americano and a match are accepted as the app sends them", async ({ request }) => {
  expect(await accepted(request, { game: americano })).toBe(true)
  expect(await accepted(request, { game: match })).toBe(true)
  expect(await accepted(request, { game: americano, closed: true })).toBe(true)
})

test("a game is refused with a field missing, a field too many, or no known kind", async ({ request }) => {
  const { scores: _scores, ...noScores } = americano
  const { points: _points, ...noPoints } = match
  expect(await accepted(request, { game: noScores })).toBe(false)
  expect(await accepted(request, { game: noPoints })).toBe(false)
  expect(await accepted(request, { game: { ...americano, extra: 1 } })).toBe(false)
  expect(await accepted(request, { game: { ...match, extra: 1 } })).toBe(false)
  expect(await accepted(request, { game: americano, extra: 1 })).toBe(false)
  expect(await accepted(request, { game: { ...americano, kind: "mexicano" } })).toBe(false)
  // An americano's fields under a match's name.
  expect(await accepted(request, { game: { ...americano, kind: "match" } })).toBe(false)
  expect(await accepted(request, { game: "{}" })).toBe(false)
  expect(await accepted(request, {})).toBe(false)
})

test("a game is refused when a field is not the kind of value it should be", async ({ request }) => {
  const wrong: Fields[] = [
    { ...americano, name: 5 },
    { ...americano, createdAt: "today" },
    { ...americano, finished: "no" },
    { ...americano, scoringMode: "golden" },
    { ...americano, target: "16" },
    { ...americano, courts: "1" },
    { ...americano, players: [] },
    { ...americano, rounds: {} },
    { ...americano, scores: [] },
    { ...match, teams: [] },
    { ...match, teams: { 0: ["Ana", "Ben"] } },
    { ...match, teams: { 0: ["Ana", "Ben"], 1: ["Cy", "Di", "Ed"] } },
    { ...match, teams: { 0: ["Ana", "Ben"], 1: ["Cy", "Di"], 2: ["Ed", "Flo"] } },
    { ...match, bestOf: 4 },
    { ...match, setsAs: "upTo" },
    { ...match, gamesPerSet: "6" },
    { ...match, deuce: "silver" },
    { ...match, scoreBy: "sets" },
    { ...match, points: [] },
  ]
  for (const game of wrong) expect(await accepted(request, { game }), JSON.stringify(game)).toBe(false)
  expect(await accepted(request, { game: americano, closed: false })).toBe(false)
  expect(await accepted(request, { game: americano, handover: "yes" })).toBe(false)
})

test("a game holds a name of 200 letters, 200 players, 100 rounds and 5,000 scores or points, and no more", async ({ request }) => {
  const player = { name: "Ana", order: 0 }
  const round = americano.rounds[0]
  const score = { a: 10, b: 6 }
  const sized = (name: number, players: number, rounds: number, scores: number): Fields => ({
    ...americano,
    name: "n".repeat(name),
    players: entries(players, player),
    rounds: Array.from({ length: rounds }, () => round),
    scores: entries(scores, score),
  })
  expect(await accepted(request, { game: sized(200, 200, 100, 5000) })).toBe(true)
  expect(await accepted(request, { game: sized(201, 4, 1, 1) })).toBe(false)
  expect(await accepted(request, { game: sized(1, 201, 1, 1) })).toBe(false)
  expect(await accepted(request, { game: sized(1, 4, 101, 1) })).toBe(false)
  expect(await accepted(request, { game: sized(1, 4, 1, 5001) })).toBe(false)
  expect(await accepted(request, { game: { ...match, points: entries(5000, 1) } })).toBe(true)
  expect(await accepted(request, { game: { ...match, points: entries(5001, 1) } })).toBe(false)
  expect(await accepted(request, { game: { ...match, name: "n".repeat(201) } })).toBe(false)
})

test("a target runs from 1 to 64, courts from 1 to 50 and games a set from 1 to 12", async ({ request }) => {
  expect(await accepted(request, { game: { ...americano, target: 1, courts: 1 } })).toBe(true)
  expect(await accepted(request, { game: { ...americano, target: 64, courts: 50 } })).toBe(true)
  expect(await accepted(request, { game: { ...americano, target: 0 } })).toBe(false)
  expect(await accepted(request, { game: { ...americano, target: 65 } })).toBe(false)
  expect(await accepted(request, { game: { ...americano, courts: 0 } })).toBe(false)
  expect(await accepted(request, { game: { ...americano, courts: 51 } })).toBe(false)
  expect(await accepted(request, { game: { ...match, gamesPerSet: 1 } })).toBe(true)
  expect(await accepted(request, { game: { ...match, gamesPerSet: 12 } })).toBe(true)
  expect(await accepted(request, { game: { ...match, gamesPerSet: 0 } })).toBe(false)
  expect(await accepted(request, { game: { ...match, gamesPerSet: 13 } })).toBe(false)
})

test("a phone cannot put a game online in another phone's name", async ({ request }) => {
  const phone = await signIn(request)
  const other = await signIn(request)
  expect(await write(request, phone, `live/${newGame()}`, { owner: other.uid, game: americano })).toBe(false)
  expect(await request.patch(`${DOCS}/live/${newGame()}`, { data: body({ owner: "nobody", game: americano }) }).then((reply) => reply.ok())).toBe(false)
})

test("a friend with the watch link cannot change the game", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const watcher = await signIn(request)
  expect(await change(request, watcher, id, { scores: { "0_1": { a: 16, b: 0 } } }, ["scores.`0_1`"])).toBe(false)
  expect(await change(request, watcher, id, { finished: true }, ["finished"])).toBe(false)
  expect(await write(request, watcher, `live/${id}`, { owner: watcher.uid, game: americano })).toBe(false)
  expect(await ownerOf(request, id)).toBe(organiser.uid)
})

test("a friend cannot become a scorer with a wrong key, or with no key", async ({ request }) => {
  const { id } = await sharedGame(request)
  const friend = await signIn(request)
  expect(await write(request, friend, `live/${id}/scorers/${friend.uid}`, { key: "wr0ngkey" })).toBe(false)
  expect(await write(request, friend, `live/${id}/scorers/${friend.uid}`, {})).toBe(false)
  expect(await change(request, friend, id, { finished: true }, ["finished"])).toBe(false)
})

test("a friend cannot sign another phone up as a scorer", async ({ request }) => {
  const { id } = await sharedGame(request)
  const friend = await signIn(request)
  const other = await signIn(request)
  expect(await write(request, friend, `live/${id}/scorers/${other.uid}`, { key: KEY })).toBe(false)
})

test("a friend with the score link can score an americano, clear a score, rename a player or the game, and finish it", async ({ request }) => {
  const { id } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await change(request, friend, id, { scores: { "0_1": { a: 9, b: 7 } } }, ["scores.`0_1`"])).toBe(true)
  expect(await change(request, friend, id, {}, ["scores.`0_1`"])).toBe(true)
  expect(await change(request, friend, id, { players: { p1: { name: "Anna", order: 0 } } }, ["players.p1"])).toBe(true)
  expect(await change(request, friend, id, { name: "Saturday" }, ["name"])).toBe(true)
  expect(await change(request, friend, id, { finished: true }, ["finished"])).toBe(true)
})

test("a friend with the score link can add or remove a player in an americano, which makes the rounds again", async ({ request }) => {
  const { id } = await sharedGame(request)
  const friend = await scorer(request, id)
  const players = { p5: { name: "Eli", order: 4, joinedAt: 1 } }
  expect(await change(request, friend, id, { players, rounds: americano.rounds }, ["players.p5", "rounds"])).toBe(true)
  const leaver = { p1: { name: "Ana", order: 0, left: { scaleUp: false } } }
  expect(await change(request, friend, id, { players: leaver, rounds: [] }, ["players.p1", "rounds"])).toBe(true)
})

test("a friend with the score link cannot change an americano's rules, its kind or when it was made", async ({ request }) => {
  const { id } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await change(request, friend, id, { target: 24 }, ["target"])).toBe(false)
  expect(await change(request, friend, id, { courts: 2 }, ["courts"])).toBe(false)
  expect(await change(request, friend, id, { scoringMode: "firstTo" }, ["scoringMode"])).toBe(false)
  expect(await change(request, friend, id, { createdAt: 1 }, ["createdAt"])).toBe(false)
  // Not along with something they may change, and not as another kind of game.
  expect(await change(request, friend, id, { name: "Saturday", target: 24 }, ["name", "target"])).toBe(false)
  expect(await write(request, friend, `live/${id}`, { game: match }, ["game"])).toBe(false)
})

test("a friend with the score link can add a point to a match, undo it, rename the match and finish it", async ({ request }) => {
  const { id } = await sharedGame(request, { game: match })
  const friend = await scorer(request, id)
  expect(await change(request, friend, id, { points: { 2: 1 } }, ["points.`2`"])).toBe(true)
  expect(await change(request, friend, id, {}, ["points.`2`"])).toBe(true)
  expect(await change(request, friend, id, { name: "Semi" }, ["name"])).toBe(true)
  expect(await change(request, friend, id, { finished: true }, ["finished"])).toBe(true)
})

test("a friend with the score link cannot change a match's teams, its rules, its kind or when it was made", async ({ request }) => {
  const { id } = await sharedGame(request, { game: match })
  const friend = await scorer(request, id)
  expect(await change(request, friend, id, { teams: { 0: ["Ed", "Flo"] } }, ["teams.`0`"])).toBe(false)
  expect(await change(request, friend, id, { bestOf: 1 }, ["bestOf"])).toBe(false)
  expect(await change(request, friend, id, { setsAs: "firstTo" }, ["setsAs"])).toBe(false)
  expect(await change(request, friend, id, { gamesPerSet: 4 }, ["gamesPerSet"])).toBe(false)
  expect(await change(request, friend, id, { deuce: "golden" }, ["deuce"])).toBe(false)
  expect(await change(request, friend, id, { scoreBy: "games" }, ["scoreBy"])).toBe(false)
  expect(await change(request, friend, id, { createdAt: 1 }, ["createdAt"])).toBe(false)
  expect(await write(request, friend, `live/${id}`, { game: americano }, ["game"])).toBe(false)
})

test("a friend with the score link cannot leave a game malformed", async ({ request }) => {
  const { id } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await change(request, friend, id, { scores: [] }, ["scores"])).toBe(false)
  expect(await change(request, friend, id, { players: "nobody" }, ["players"])).toBe(false)
  expect(await change(request, friend, id, { name: "n".repeat(201) }, ["name"])).toBe(false)
  expect(await change(request, friend, id, { finished: "yes" }, ["finished"])).toBe(false)
  expect(await change(request, friend, id, {}, ["scores"])).toBe(false)
  expect(await change(request, friend, id, { extra: 1 }, ["extra"])).toBe(false)
})

test("a friend with the score link cannot change who owns the game, close it, leave it to others or delete it", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await write(request, friend, `live/${id}`, { owner: friend.uid }, ["owner"])).toBe(false)
  expect(await write(request, friend, `live/${id}`, { closed: true }, ["closed"])).toBe(false)
  expect(await write(request, friend, `live/${id}`, { handover: true }, ["handover"])).toBe(false)
  expect(await remove(request, friend, `live/${id}`)).toBe(false)
  expect(await ownerOf(request, id)).toBe(organiser.uid)
})

test("the organiser can change every part of the game but who owns it", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await change(request, organiser, id, { rounds: [] }, ["rounds"])).toBe(true)
  expect(await change(request, organiser, id, { target: 24 }, ["target"])).toBe(true)
  expect(await change(request, organiser, id, { target: 500 }, ["target"])).toBe(false)
  expect(await write(request, organiser, `live/${id}`, { owner: organiser.uid, game: match })).toBe(true)
  // Still only as a well-formed game.
  expect(await change(request, organiser, id, { points: [] }, ["points"])).toBe(false)
  expect(await write(request, organiser, `live/${id}`, { owner: friend.uid }, ["owner"])).toBe(false)
})

test("nobody can read the score key, and only the organiser can make one", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  for (const phone of [organiser, friend]) {
    expect(await read(request, phone, `live/${id}/keys/${KEY}`)).toBe(false)
    expect(await read(request, phone, `live/${id}/keys`)).toBe(false)
  }
  expect(await write(request, friend, `live/${id}/keys/the1r0wn`, {})).toBe(false)
  expect(await remove(request, friend, `live/${id}/keys/${KEY}`)).toBe(false)
})

test("only the organiser can see who scores", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await read(request, organiser, `live/${id}/scorers`)).toBe(true)
  expect(await read(request, friend, `live/${id}/scorers`)).toBe(false)
  expect(await read(request, friend, `live/${id}/scorers/${friend.uid}`)).toBe(false)
})

test("the organiser can close the game, leave it to its scorers, and delete it with its key and scorers", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await write(request, organiser, `live/${id}`, { closed: true }, ["closed"])).toBe(true)
  expect(await write(request, organiser, `live/${id}`, {}, ["closed"])).toBe(true)
  expect(await write(request, organiser, `live/${id}`, { handover: true }, ["handover"])).toBe(true)
  // Not to somebody they pick: a scorer takes it.
  expect(await write(request, organiser, `live/${id}`, { owner: friend.uid }, ["owner"])).toBe(false)
  expect(await remove(request, organiser, `live/${id}/scorers/${friend.uid}`)).toBe(true)
  expect(await remove(request, organiser, `live/${id}/keys/${KEY}`)).toBe(true)
  expect(await remove(request, organiser, `live/${id}`)).toBe(true)
})

test("a scorer cannot take a game its organiser still has", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await write(request, friend, `live/${id}`, { owner: friend.uid }, ["owner", "handover"])).toBe(false)
  expect(await ownerOf(request, id)).toBe(organiser.uid)
})

test("a game left to its scorers is taken by one of them, never by a watcher", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const first = await scorer(request, id)
  const second = await scorer(request, id)
  const watcher = await signIn(request)
  expect(await write(request, organiser, `live/${id}`, { handover: true }, ["handover"])).toBe(true)

  expect(await write(request, watcher, `live/${id}`, { owner: watcher.uid }, ["owner", "handover"])).toBe(false)
  // Not for somebody else, not leaving it up for grabs, and not changing the game on the way.
  expect(await write(request, first, `live/${id}`, { owner: second.uid }, ["owner", "handover"])).toBe(false)
  expect(await write(request, first, `live/${id}`, { owner: first.uid }, ["owner"])).toBe(false)
  expect(await write(request, first, `live/${id}`, { owner: first.uid, game: { ...americano, target: 24 } })).toBe(false)
  expect(await write(request, first, `live/${id}`, { owner: first.uid }, ["owner", "handover"])).toBe(true)
  // Taken: the other scorer is too late.
  expect(await write(request, second, `live/${id}`, { owner: second.uid }, ["owner", "handover"])).toBe(false)
  expect(await ownerOf(request, id)).toBe(first.uid)
})

test("a closed game left to its scorers is live again once one of them takes it", async ({ request }) => {
  const { id, organiser } = await sharedGame(request, { game: americano, closed: true })
  const friend = await scorer(request, id)
  expect(await write(request, organiser, `live/${id}`, { handover: true }, ["handover"])).toBe(true)
  expect(await write(request, friend, `live/${id}`, { owner: friend.uid }, ["owner", "handover", "closed"])).toBe(true)
})

test("after a takeover the new organiser can delete the game and the old one cannot", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  // The old organiser stays on as a scorer.
  expect(await write(request, organiser, `live/${id}/scorers/${organiser.uid}`, { key: KEY })).toBe(true)
  expect(await write(request, organiser, `live/${id}`, { handover: true }, ["handover"])).toBe(true)
  expect(await write(request, friend, `live/${id}`, { owner: friend.uid }, ["owner", "handover"])).toBe(true)

  expect(await change(request, organiser, id, { scores: { "0_1": { a: 8, b: 8 } } }, ["scores.`0_1`"])).toBe(true)
  expect(await change(request, organiser, id, { target: 24 }, ["target"])).toBe(false)
  expect(await remove(request, organiser, `live/${id}`)).toBe(false)
  expect(await remove(request, organiser, `live/${id}/keys/${KEY}`)).toBe(false)
  expect(await remove(request, friend, `live/${id}/scorers/${organiser.uid}`)).toBe(true)
  expect(await remove(request, friend, `live/${id}/keys/${KEY}`)).toBe(true)
  expect(await remove(request, friend, `live/${id}`)).toBe(true)
})

// LEGACY, remove after 2026-10-28: until 2026-10-14 the whole game was one
// JSON string, `json`. A phone on a build from before still writes it.
test.describe("an old copy, the game as one JSON string", () => {
  const old = { json: "{}" }

  test("is still accepted, and its organiser can still change and close it", async ({ request }) => {
    const { id, organiser } = await sharedGame(request, old)
    expect(await write(request, organiser, `live/${id}`, { owner: organiser.uid, json: '{"score":1}', closed: true })).toBe(true)
    expect(await accepted(request, { json: 5 })).toBe(false)
  })

  test("is refused beside the new fields: a copy is one shape or the other", async ({ request }) => {
    expect(await accepted(request, { json: "{}", game: americano })).toBe(false)
    const { id, organiser } = await sharedGame(request)
    expect(await write(request, organiser, `live/${id}`, { json: "{}" }, ["json"])).toBe(false)
  })

  test("is rewritten as the new fields by its organiser, and by nobody else", async ({ request }) => {
    const { id, organiser } = await sharedGame(request, old)
    const friend = await scorer(request, id)
    expect(await write(request, friend, `live/${id}`, { game: americano }, ["game", "json"])).toBe(false)
    expect(await write(request, organiser, `live/${id}`, { game: americano }, ["game", "json"])).toBe(true)
    expect(await change(request, friend, id, { finished: true }, ["finished"])).toBe(true)
  })

  test("lets a friend with the score link change the string, and nothing else", async ({ request }) => {
    const { id } = await sharedGame(request, old)
    const friend = await scorer(request, id)
    expect(await write(request, friend, `live/${id}`, { json: '{"score":1}' }, ["json"])).toBe(true)
    expect(await write(request, friend, `live/${id}`, { closed: true }, ["closed"])).toBe(false)
    expect(await write(request, friend, `live/${id}`, { owner: friend.uid }, ["owner"])).toBe(false)
  })

  test("cannot be put back by a friend with the score link once the game is fields", async ({ request }) => {
    const { id } = await sharedGame(request)
    const friend = await scorer(request, id)
    expect(await write(request, friend, `live/${id}`, { json: "{}" }, ["json", "game"])).toBe(false)
  })

  test("is taken over the old build's way: the whole copy written again with its new owner", async ({ request }) => {
    const { id, organiser } = await sharedGame(request, old)
    const friend = await scorer(request, id)
    expect(await write(request, organiser, `live/${id}`, { handover: true }, ["handover"])).toBe(true)
    expect(await write(request, friend, `live/${id}`, { owner: friend.uid, json: '{"score":9}' })).toBe(false)
    expect(await write(request, friend, `live/${id}`, { owner: friend.uid, json: "{}" })).toBe(true)
    expect(await ownerOf(request, id)).toBe(friend.uid)
  })
})
