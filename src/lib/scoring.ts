import type { Score, ScoringMode } from "./types"

export const MIN_TARGET = 8
export const MAX_TARGET = 32

export function isValidTarget(target: number): boolean {
  return Number.isInteger(target) && target >= MIN_TARGET && target <= MAX_TARGET
}

// Whether a finished game's score is possible under the tournament's mode.
// total: the two scores sum to the target, so a draw (4–4 of 8) is fine.
// firstTo: exactly one team reached the target, so there is no draw.
export function isValidScore(score: Score, target: number, mode: ScoringMode): boolean {
  const { a, b } = score
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false

  if (mode === "total") return a + b === target
  return Math.max(a, b) === target && Math.min(a, b) < target
}
