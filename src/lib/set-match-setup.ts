import { MAX_GAMES_PER_SET, MIN_GAMES_PER_SET, type MatchRules } from "./set-match"
import { cleanPlayerName, duplicateName } from "./tournament"
import type { SetMatch } from "./types"

type Teams = SetMatch["teams"]

export interface MatchSetupInput extends MatchRules {
  setsAs: SetMatch["setsAs"]
  name: string
  teams: Teams // player names as typed
}

function cleanTeams(teams: Teams): Teams {
  return [
    [cleanPlayerName(teams[0][0]), cleanPlayerName(teams[0][1])],
    [cleanPlayerName(teams[1][0]), cleanPlayerName(teams[1][1])],
  ]
}

// What stops the match from starting, worded for the organiser.
export function matchSetupProblems(input: MatchSetupInput): string[] {
  const problems: string[] = []
  const names = cleanTeams(input.teams).flat()
  const entered = names.filter((n) => n !== "")

  if (input.name.trim() === "") problems.push("Give the match a name.")
  if (entered.length < 4) {
    const missing = 4 - entered.length
    problems.push(`Add ${missing} more player${missing === 1 ? "" : "s"}. A match needs 4.`)
  }
  const duplicate = duplicateName(entered)
  if (duplicate) problems.push(`Two players are called ${duplicate}. Give them different names.`)
  if (![1, 3, 5].includes(input.bestOf)) problems.push("Pick 1 set, best of 3 or best of 5.")
  if (
    !Number.isInteger(input.gamesPerSet) ||
    input.gamesPerSet < MIN_GAMES_PER_SET ||
    input.gamesPerSet > MAX_GAMES_PER_SET
  ) {
    problems.push(`Pick between ${MIN_GAMES_PER_SET} and ${MAX_GAMES_PER_SET} games a set.`)
  }
  return problems
}

// Build a ready-to-play match with no points yet. Call only once
// matchSetupProblems() is empty.
export function createSetMatch(input: MatchSetupInput, { now, newId }: { now: number; newId: () => string }): SetMatch {
  return {
    version: 2,
    kind: "match",
    id: newId(),
    name: input.name.trim(),
    createdAt: now,
    teams: cleanTeams(input.teams),
    bestOf: input.bestOf,
    setsAs: input.setsAs,
    gamesPerSet: input.gamesPerSet,
    deuce: input.deuce,
    points: [],
    finished: false,
  }
}

// What a rematch starts from: the same people on the same sides and the
// same rules, not the points.
export interface PreviousMatchSetup extends MatchRules {
  setsAs: SetMatch["setsAs"]
  teams: Teams
}

export function previousMatchSetup(match: SetMatch): PreviousMatchSetup {
  return {
    teams: match.teams,
    bestOf: match.bestOf,
    setsAs: match.setsAs,
    gamesPerSet: match.gamesPerSet,
    deuce: match.deuce,
  }
}
