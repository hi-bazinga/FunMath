/**
 * parseTranscript
 *
 * Extracts the most-likely intended integer (−100–100) from a zh-CN or
 * en-US speech-recognition transcript.
 *
 * Strategy (tried in order):
 *   1. Digit sequences — STT often returns Arabic numerals directly
 *   2. Chinese number characters — 五, 十五, 二十三, 一百, …
 *   3. English two-word combos — "twenty one", "one hundred"
 *   4. English single words — "fifteen"
 *
 * Negative numbers: look for "负" (Chinese) or a leading minus sign.
 */

// ── English word tables ───────────────────────────────────────────────────

const ONES: Record<string, number> = {
  zero: 0, oh: 0,
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

export function wordsToNumber(phrase: string): number | null {
  const words = phrase.trim().split(/\s+/);

  if (words.length === 1) {
    const w = words[0];
    if (w === 'hundred') return 100;
    if (w in ONES) return ONES[w];
    if (w in TENS) return TENS[w];
    return null;
  }

  if (words.length === 2) {
    if (words[0] === 'one' && words[1] === 'hundred') return 100;
    const tens = TENS[words[0]];
    const ones = ONES[words[1]];
    if (tens !== undefined && ones !== undefined && ones > 0) return tens + ones;
  }

  return null;
}

// ── Chinese number characters ─────────────────────────────────────────────

const ZH_DIGIT: Record<string, number> = {
  '零': 0, '〇': 0,
  '一': 1, '壹': 1,
  '二': 2, '两': 2, '貳': 2,
  '三': 3, '叁': 3,
  '四': 4, '肆': 4,
  '五': 5, '伍': 5,
  '六': 6, '陆': 6,
  '七': 7, '柒': 7,
  '八': 8, '捌': 8,
  '九': 9, '玖': 9,
};

/**
 * Parse a short string of Chinese number characters into an integer (0–100),
 * or return null if the string cannot be recognised as a number.
 *
 * Handles: 零–九, 十, 十一–十九, 二十–九十, 二十一–九十九, 一百/百
 */
function parseZhToken(t: string): number | null {
  if (!t) return null;

  // 百 / 一百
  if (t === '百' || t === '一百') return 100;

  // 十 alone
  if (t === '十') return 10;

  // 十X  →  10 + X  (e.g. 十五 = 15)
  if (t.length === 2 && t[0] === '十') {
    const ones = ZH_DIGIT[t[1]];
    if (ones !== undefined) return 10 + ones;
  }

  // X十  →  X * 10  (e.g. 二十 = 20)
  if (t.length === 2 && t[1] === '十') {
    const tens = ZH_DIGIT[t[0]];
    if (tens !== undefined && tens >= 2) return tens * 10;
  }

  // X十Y  →  X*10 + Y  (e.g. 二十三 = 23)
  if (t.length === 3 && t[1] === '十') {
    const tens = ZH_DIGIT[t[0]];
    const ones = ZH_DIGIT[t[2]];
    if (tens !== undefined && tens >= 2 && ones !== undefined) {
      return tens * 10 + ones;
    }
  }

  // Single digit character
  if (t.length === 1) {
    const d = ZH_DIGIT[t[0]];
    if (d !== undefined) return d;
  }

  return null;
}

/**
 * Scan a string for Chinese number substrings and return the first valid
 * integer found in the 0–100 range.
 */
function findZhNumber(text: string): number | null {
  // Try longest possible substrings first (up to 3 chars for X十Y)
  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i <= text.length - len; i++) {
      const slice = text.slice(i, i + len);
      const n = parseZhToken(slice);
      if (n !== null && n >= 0 && n <= 100) return n;
    }
  }
  // Special case: 百 or 一百 (length 1 or 2 already covered above; 一百 is 2)
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * Extract the most-likely intended number from a speech transcript.
 * Works with both zh-CN (Chinese characters / Arabic digits) and
 * en-US (English words / Arabic digits) recognition output.
 * Returns null if no valid number can be found.
 */
export function parseTranscript(transcript: string): number | null {
  const raw = transcript.trim();

  // ── Check for negation prefix ────────────────────────────────────────────
  const isNegative =
    raw.startsWith('-') ||
    raw.startsWith('负') ||
    raw.includes('负');

  const normalized = raw
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff ]/g, ' ');

  // ── 1. Arabic digit sequences ────────────────────────────────────────────
  const digitMatches = normalized.match(/\b\d+\b/g);
  if (digitMatches) {
    for (const m of digitMatches) {
      const n = parseInt(m, 10);
      if (n >= 0 && n <= 100) {
        return isNegative ? -n : n;
      }
    }
  }

  // ── 2. Chinese number characters ─────────────────────────────────────────
  // Work on the original (un-lowercased, un-replaced) text so Chinese chars survive
  const zhSource = transcript.replace(/[^\u4e00-\u9fff]/g, '');
  if (zhSource.length > 0) {
    const n = findZhNumber(zhSource);
    if (n !== null) return isNegative ? -n : n;
  }

  // ── 3. English two-word combos ───────────────────────────────────────────
  const words = normalized.split(/\s+/).filter(Boolean);
  for (let i = 0; i + 1 < words.length; i++) {
    const n = wordsToNumber(`${words[i]} ${words[i + 1]}`);
    if (n !== null && n >= 0 && n <= 100) return isNegative ? -n : n;
  }

  // ── 4. English single words ──────────────────────────────────────────────
  for (const w of words) {
    const n = wordsToNumber(w);
    if (n !== null && n >= 0 && n <= 100) return isNegative ? -n : n;
  }

  return null;
}
