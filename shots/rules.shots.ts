// Who may change a game put online: firestore.rules, asked directly.
// Each phone here is an anonymous sign-in on the local emulators, and
// talks to Firestore the plain way (REST), so the rules are all that
// stands between it and the game. Nothing goes to the hosted project.
import { expect, test, type APIRequestContext } from "@playwright/test"
import { emulatorsReady } from "./taps"

const AUTH = "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo"
const DOCS = "http://localhost:8080/v1/projects/demo-padel/databases/(default)/documents"
const KEY = "k3y00000"

type Phone = { uid: string; headers: { Authorization: string } }
type Fields = Record<string, string | boolean>

test.beforeAll(({ playwright }) => emulatorsReady(playwright))

let games = 0
const newGame = () => `rules${Date.now()}${games++}`

async function signIn(request: APIRequestContext): Promise<Phone> {
  const reply = await (await request.post(AUTH, { data: { returnSecureToken: true } })).json()
  return { uid: reply.localId, headers: { Authorization: `Bearer ${reply.idToken}` } }
}

const body = (fields: Fields) => ({
  fields: Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [name, typeof value === "boolean" ? { booleanValue: value } : { stringValue: value }]),
  ),
})

// Writes the whole document, or only `only` of its fields. True when the
// rules let it through.
async function write(request: APIRequestContext, phone: Phone, path: string, fields: Fields, only?: string[]) {
  const mask = only ? `?${only.map((field) => `updateMask.fieldPaths=${field}`).join("&")}` : ""
  return (await request.patch(`${DOCS}/${path}${mask}`, { headers: phone.headers, data: body(fields) })).ok()
}

const remove = async (request: APIRequestContext, phone: Phone, path: string) =>
  (await request.delete(`${DOCS}/${path}`, { headers: phone.headers })).ok()

const read = async (request: APIRequestContext, phone: Phone, path: string) =>
  (await request.get(`${DOCS}/${path}`, { headers: phone.headers })).ok()

const ownerOf = async (request: APIRequestContext, id: string) =>
  (await (await request.get(`${DOCS}/live/${id}`)).json()).fields.owner.stringValue

// A game put online by an organiser, with a score link.
async function sharedGame(request: APIRequestContext) {
  const id = newGame()
  const organiser = await signIn(request)
  expect(await write(request, organiser, `live/${id}`, { owner: organiser.uid, json: "{}" })).toBe(true)
  expect(await write(request, organiser, `live/${id}/keys/${KEY}`, {})).toBe(true)
  return { id, organiser }
}

// A friend who opened the score link.
async function scorer(request: APIRequestContext, id: string) {
  const friend = await signIn(request)
  expect(await write(request, friend, `live/${id}/scorers/${friend.uid}`, { key: KEY })).toBe(true)
  return friend
}

test("anyone can read a game, signed in or not", async ({ request }) => {
  const { id } = await sharedGame(request)
  expect((await request.get(`${DOCS}/live/${id}`)).ok()).toBe(true)
})

test("a friend with the watch link cannot change the game", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const watcher = await signIn(request)
  expect(await write(request, watcher, `live/${id}`, { json: '{"hacked":1}' }, ["json"])).toBe(false)
  expect(await write(request, watcher, `live/${id}`, { owner: watcher.uid, json: "{}" })).toBe(false)
  expect(await ownerOf(request, id)).toBe(organiser.uid)
})

test("a friend cannot become a scorer with a wrong key, or with no key", async ({ request }) => {
  const { id } = await sharedGame(request)
  const friend = await signIn(request)
  expect(await write(request, friend, `live/${id}/scorers/${friend.uid}`, { key: "wr0ngkey" })).toBe(false)
  expect(await write(request, friend, `live/${id}/scorers/${friend.uid}`, {})).toBe(false)
  expect(await write(request, friend, `live/${id}`, { json: "{}" }, ["json"])).toBe(false)
})

test("a friend cannot sign another phone up as a scorer", async ({ request }) => {
  const { id } = await sharedGame(request)
  const friend = await signIn(request)
  const other = await signIn(request)
  expect(await write(request, friend, `live/${id}/scorers/${other.uid}`, { key: KEY })).toBe(false)
})

test("a friend with the score link can change the game, and nothing else about it", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  expect(await write(request, friend, `live/${id}`, { json: '{"score":1}' }, ["json"])).toBe(true)
  // Not who owns it, not whether it is closed, not whether it is up for a new organiser.
  expect(await write(request, friend, `live/${id}`, { owner: friend.uid }, ["owner"])).toBe(false)
  expect(await write(request, friend, `live/${id}`, { closed: true }, ["closed"])).toBe(false)
  expect(await write(request, friend, `live/${id}`, { handover: true }, ["handover"])).toBe(false)
  expect(await remove(request, friend, `live/${id}`)).toBe(false)
  expect(await ownerOf(request, id)).toBe(organiser.uid)
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
  expect(await write(request, organiser, `live/${id}`, { owner: organiser.uid, json: "{}", closed: true })).toBe(true)
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
  expect(await write(request, friend, `live/${id}`, { owner: friend.uid, json: "{}" })).toBe(false)
  expect(await ownerOf(request, id)).toBe(organiser.uid)
})

test("a game left to its scorers is taken by one of them, never by a watcher", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const first = await scorer(request, id)
  const second = await scorer(request, id)
  const watcher = await signIn(request)
  expect(await write(request, organiser, `live/${id}`, { handover: true }, ["handover"])).toBe(true)

  expect(await write(request, watcher, `live/${id}`, { owner: watcher.uid, json: "{}" })).toBe(false)
  // Not for somebody else, and not leaving it up for grabs.
  expect(await write(request, first, `live/${id}`, { owner: second.uid, json: "{}" })).toBe(false)
  expect(await write(request, first, `live/${id}`, { owner: first.uid, json: "{}", handover: true })).toBe(false)
  expect(await write(request, first, `live/${id}`, { owner: first.uid, json: "{}" })).toBe(true)
  // Taken: the other scorer is too late.
  expect(await write(request, second, `live/${id}`, { owner: second.uid, json: "{}" })).toBe(false)
  expect(await ownerOf(request, id)).toBe(first.uid)
})

test("after a takeover the new organiser can delete the game and the old one cannot", async ({ request }) => {
  const { id, organiser } = await sharedGame(request)
  const friend = await scorer(request, id)
  // The old organiser stays on as a scorer.
  expect(await write(request, organiser, `live/${id}/scorers/${organiser.uid}`, { key: KEY })).toBe(true)
  expect(await write(request, organiser, `live/${id}`, { handover: true }, ["handover"])).toBe(true)
  expect(await write(request, friend, `live/${id}`, { owner: friend.uid, json: "{}" })).toBe(true)

  expect(await write(request, organiser, `live/${id}`, { json: '{"score":2}' }, ["json"])).toBe(true)
  expect(await remove(request, organiser, `live/${id}`)).toBe(false)
  expect(await remove(request, organiser, `live/${id}/keys/${KEY}`)).toBe(false)
  expect(await remove(request, friend, `live/${id}/scorers/${organiser.uid}`)).toBe(true)
  expect(await remove(request, friend, `live/${id}/keys/${KEY}`)).toBe(true)
  expect(await remove(request, friend, `live/${id}`)).toBe(true)
})
