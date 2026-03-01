/**
 * 儿童友好短语库（简体中文）
 * Kid-friendly phrase library — Simplified Chinese throughout.
 */

// ── 答对 ───────────────────────────────────────────────────────────────────

const CORRECT_BASIC = [
  '太棒了！',
  '你真厉害！',
  '哇哦！答对了！',
  '我为你骄傲！',
  '超级棒！',
  '好厉害呀！',
  '你好聪明！',
  '太赞了！',
  '完美！',
  '你真棒！',
];

const CORRECT_STREAK_3 = [
  '三连对！你是小明星！',
  '答对三个啦！继续加油！',
];

const CORRECT_STREAK_5 = [
  '五连对！你太厉害了！',
  '哇！连续五个！真了不起！',
];

const CORRECT_STREAK_10 = [
  '十连对！你是数学冠军！',
  '超厉害！十连对！你是天才！',
];

// 累计答对里程碑
const MILESTONE_10  = ['答对了十题！你真是数学小英雄！'];
const MILESTONE_20  = ['答对了二十题！太了不起了！'];
const MILESTONE_50  = ['答对了五十题！简直不可思议！'];
const MILESTONE_100 = ['答对了一百题！你是数学超级明星！'];

/**
 * 根据新连对数和累计答对数返回表扬短语。
 * 调用时传入 (stats.streak + 1) 和 (totalCorrect + 1)。
 */
export function getPraisePhrase(newStreak: number, newTotal: number): string {
  // 累计里程碑优先
  if (newTotal % 100 === 0) return pick(MILESTONE_100);
  if (newTotal % 50  === 0) return pick(MILESTONE_50);
  if (newTotal % 20  === 0) return pick(MILESTONE_20);
  if (newTotal % 10  === 0) return pick(MILESTONE_10);

  // 连对里程碑
  if (newStreak >= 10) return pick(CORRECT_STREAK_10);
  if (newStreak === 5) return pick(CORRECT_STREAK_5);
  if (newStreak === 3) return pick(CORRECT_STREAK_3);

  return pick(CORRECT_BASIC);
}

// ── 答错（温柔，不批评）─────────────────────────────────────────────────────

const INCORRECT_BASIC = [
  '哎呀，差一点！再来一次吧。',
  '这次很努力哦。再试一次！',
  '快答对了，再来！',
  '没关系，我们一起做！',
  '快到了！再试一次吧。',
  '加油！你可以的！',
];

/**
 * 返回温柔的答错提示语。
 * 若 speakAnswer 为 true，先说出正确答案。
 */
export function getIncorrectPhrase(speakAnswer: boolean, answer: number): string {
  const base = pick(INCORRECT_BASIC);
  if (speakAnswer) {
    return `答案是${answer}。${base}`;
  }
  return base;
}

// ── 结果总结（会话结束时播报）─────────────────────────────────────────────

/**
 * 生成会话结束时的语音总结文字（中文）。
 * stars: 0-3
 */
export function getResultSummary(
  correct: number,
  total: number,
  stars: number,
): string {
  switch (stars) {
    case 3:
      return `太棒了！你答对了${correct}题，一共${total}题。你获得了三颗星！`;
    case 2:
      return `做得好！你答对了${correct}题，一共${total}题。你获得了两颗星！`;
    case 1:
      return `继续加油！你答对了${correct}题，一共${total}题。你获得了一颗星！`;
    default:
      return `没关系，我们再练一练就会更厉害！你答对了${correct}题，一共${total}题。`;
  }
}

// ── 聆听提示 ───────────────────────────────────────────────────────────────

export const NO_MATCH_PHRASE  = '我没听清楚，再说一次好吗？';
export const LISTENING_READY  = '我在听哦……';
export const LISTENING_PROMPT = '说出答案就好。';

// ── 工具 ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
