export type Mode = 'addition' | 'subtraction' | 'mixed';
export type Range = 10 | 20 | 50 | 100;
export type Feedback = 'idle' | 'correct' | 'wrong' | 'timeout';
export type SessionLength = 10 | 20 | 30;

export interface Settings {
  mode: Mode;
  range: Range;
  noNegative: boolean;
  timerEnabled: boolean;
  /** Number of questions per session (practice ends after this many). */
  sessionLength: SessionLength;
}

export interface Mistake {
  a: number;
  b: number;
  op: '+' | '-';
  answer: number;
  given: number;
}

export interface Problem {
  a: number;
  b: number;
  op: '+' | '-';
  answer: number;
}

export interface Stats {
  attempted: number;
  correct: number;
  streak: number;
  bestStreak: number;
}

export const MAX_DIGITS_FOR_RANGE: Record<Range, number> = {
  10: 2,
  20: 2,
  50: 2,
  100: 3,
};

export function modeInvolvesSubtraction(mode: Mode): boolean {
  return mode === 'subtraction' || mode === 'mixed';
}

/**
 * Ratio-based star calculation — works for any session length N.
 *
 *   r = correct / total
 *   r < 0.5        → 0 stars
 *   0.5 ≤ r < 0.8  → 1 star
 *   0.8 ≤ r < 1.0  → 2 stars
 *   r === 1.0      → 3 stars
 */
export function calcStars(correct: number, total: number): number {
  if (total === 0) return 0;
  const r = correct / total;
  if (r >= 1.0) return 3;
  if (r >= 0.8) return 2;
  if (r >= 0.5) return 1;
  return 0;
}
