import type { Settings, Problem } from './types';
import { modeInvolvesSubtraction } from './types';

export function generateProblem(settings: Settings): Problem {
  const { mode, range, noNegative } = settings;

  const useSubtraction =
    modeInvolvesSubtraction(mode) && (mode === 'subtraction' || Math.random() < 0.5);

  const op = useSubtraction ? '-' : '+';

  const a = Math.floor(Math.random() * (range + 1));
  let b: number;

  if (op === '+') {
    // Keep answer within range
    b = Math.floor(Math.random() * (range - a + 1));
  } else {
    b = Math.floor(Math.random() * (range + 1));
    // Ensure a >= b when noNegative is on
    if (noNegative && b > a) {
      return { a: b, b: a, op, answer: b - a };
    }
  }

  const answer = op === '+' ? a + b : a - b;
  return { a, b, op, answer };
}
