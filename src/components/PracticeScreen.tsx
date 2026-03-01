/**
 * PracticeScreen（练习界面）
 *
 * 两种互斥的答题方式：
 *   🎤 语音 — 自动聆听，无需按钮
 *   ⌨️ 键盘 — 数字键盘 + 确认按钮
 *
 * 会话结束（答题数达到 sessionLength）后由 App.tsx 跳转到成绩页面。
 * 此组件负责：不再自动翻页最后一题，等待 App.tsx 计时跳转。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Settings, Stats, Problem, Feedback } from '../types';
import { MAX_DIGITS_FOR_RANGE, modeInvolvesSubtraction } from '../types';
import { generateProblem } from '../generateProblem';
import NumberPad from './NumberPad';
import { useSound } from '../hooks/useSound';
import { useAutoListenRecognition } from '../hooks/useAutoListenRecognition';
import { useKidSpeechSynthesis } from '../hooks/useKidSpeechSynthesis';
import { parseTranscript } from '../utils/parseTranscript';
import {
  getPraisePhrase,
  getIncorrectPhrase,
  NO_MATCH_PHRASE,
} from '../utils/phrases';
import type { InputMode } from '../App';

interface Props {
  settings: Settings;
  stats: Stats;
  totalCorrect: number;
  onAnswer: (correct: boolean, problem: Problem, given: number) => void;
  onHome: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  inputMode: InputMode;
  onToggleInputMode: () => void;
  voiceOutputEnabled: boolean;
  speakCorrectAnswer: boolean;
  kidFriendlyVoice: boolean;
}

const STICKERS = ['⭐', '🏆', '🦄', '🌈', '🎯', '🚀', '💎', '🎪', '🦋', '🎉'];

export default function PracticeScreen({
  settings,
  stats,
  totalCorrect,
  onAnswer,
  onHome,
  soundEnabled,
  onToggleSound,
  inputMode,
  onToggleInputMode,
  voiceOutputEnabled,
  speakCorrectAnswer,
  kidFriendlyVoice,
}: Props) {
  const [problem, setProblem]       = useState<Problem>(() => generateProblem(settings));
  const [input, setInput]           = useState('0');
  const [feedback, setFeedback]     = useState<Feedback>('idle');
  const [timeLeft, setTimeLeft]     = useState(10);
  const [newSticker, setNewSticker] = useState<string | null>(null);
  const [voiceMsg, setVoiceMsg]     = useState<string | null>(null);

  const prevCorrectRef = useRef(totalCorrect);
  const isVoiceMode    = inputMode === 'voice';

  // 当 stats.attempted 即将达到 sessionLength 时，不再自动翻页
  // App.tsx 监听 stats.attempted 达到上限后负责跳转
  const isLastQuestion = stats.attempted >= settings.sessionLength - 1;

  // ── 音效 / 语音 hooks ─────────────────────────────────────────────────────
  const { playCorrect, playWrong, playTick, playSticker } = useSound(soundEnabled);
  const { speak, cancel: cancelSpeech, isSpeaking } = useKidSpeechSynthesis(kidFriendlyVoice);

  // TTS 播报或有反馈时阻止语音识别自动启动
  const recognitionBlocked = isSpeaking || feedback !== 'idle';

  const {
    state: voiceState,
    transcript,
    error: voiceError,
    supported: voiceSupported,
    permissionDenied,
    pause: pauseListen,
    resume: resumeListen,
    reset: resetVoice,
  } = useAutoListenRecognition({
    enabled:  isVoiceMode,
    blocked:  recognitionBlocked,
  });

  // ── submitGuess：语音和键盘的共用提交路径 ────────────────────────────────
  const submitGuess = useCallback(
    (guess: number) => {
      if (feedback !== 'idle') return;

      const isCorrect = guess === problem.answer;
      onAnswer(isCorrect, problem, guess);

      if (isCorrect) {
        playCorrect();
        if (voiceOutputEnabled) {
          speak(getPraisePhrase(stats.streak + 1, totalCorrect + 1));
        }
        setFeedback('correct');
      } else {
        playWrong();
        if (voiceOutputEnabled) {
          speak(getIncorrectPhrase(speakCorrectAnswer, problem.answer));
        }
        setFeedback('wrong');
      }
    },
    [
      feedback, problem, onAnswer,
      playCorrect, playWrong,
      voiceOutputEnabled, speakCorrectAnswer, speak,
      stats.streak, totalCorrect,
    ],
  );

  // 用 ref 保证识别回调中总拿到最新版 submitGuess
  const submitGuessRef = useRef(submitGuess);
  useEffect(() => { submitGuessRef.current = submitGuess; }, [submitGuess]);

  // ── 进入下一题 ────────────────────────────────────────────────────────────
  const next = useCallback(() => {
    cancelSpeech();
    setVoiceMsg(null);
    setProblem(generateProblem(settings));
    setInput('0');
    setFeedback('idle');
    setTimeLeft(10);
  }, [settings, cancelSpeech]);

  // ── 计时器 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings.timerEnabled || feedback !== 'idle') return;
    if (timeLeft <= 0) {
      onAnswer(false, problem, NaN);
      setFeedback('timeout');
      return;
    }
    if (timeLeft <= 3) playTick();
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, feedback, settings.timerEnabled, problem, onAnswer, playTick]);

  // ── 答对后自动翻页（最后一题除外，由 App.tsx 跳转）────────────────────────
  useEffect(() => {
    if (feedback !== 'correct' || isLastQuestion) return;
    const t = setTimeout(next, 1200);
    return () => clearTimeout(t);
  }, [feedback, next, isLastQuestion]);

  // ── 超时后自动翻页（最后一题除外）────────────────────────────────────────
  useEffect(() => {
    if (feedback !== 'timeout' || isLastQuestion) return;
    const t = setTimeout(next, 1500);
    return () => clearTimeout(t);
  }, [feedback, next, isLastQuestion]);

  // ── 语音模式：答错后 TTS 播完自动翻页（最后一题除外）─────────────────────
  useEffect(() => {
    if (!isVoiceMode || feedback !== 'wrong' || isSpeaking || isLastQuestion) return;
    const t = setTimeout(next, 900);
    return () => clearTimeout(t);
  }, [isVoiceMode, feedback, isSpeaking, next, isLastQuestion]);

  // ── 贴纸里程碑（每累计答对 10 题）────────────────────────────────────────
  useEffect(() => {
    if (
      totalCorrect > 0 &&
      totalCorrect % 10 === 0 &&
      totalCorrect > prevCorrectRef.current
    ) {
      const idx = (totalCorrect / 10 - 1) % STICKERS.length;
      setNewSticker(STICKERS[idx]);
      playSticker();
      setTimeout(() => setNewSticker(null), 2500);
    }
    prevCorrectRef.current = totalCorrect;
  }, [totalCorrect, playSticker]);

  // ── 处理语音识别结果 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (voiceState !== 'processing') return;

    const num = parseTranscript(transcript);

    if (num === null) {
      setVoiceMsg(NO_MATCH_PHRASE);
      const t = setTimeout(() => setVoiceMsg(null), 2200);
      resetVoice();
      return () => clearTimeout(t);
    }

    setVoiceMsg(null);
    submitGuessRef.current(num);
    resetVoice();
  }, [voiceState, transcript, resetVoice]);

  // ── 识别错误时显示提示 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!voiceError || permissionDenied) return;
    const msg =
      voiceError === 'no-speech'
        ? '我没听到，请再说一次！😊'
        : '麦克风出错了，稍后重试！';
    setVoiceMsg(msg);
    return () => setVoiceMsg(null);
  }, [voiceError, permissionDenied]);

  // ── 麦克风权限被拒时自动切换为键盘模式 ──────────────────────────────────
  useEffect(() => {
    if (!isVoiceMode || !permissionDenied) return;
    const t = setTimeout(() => onToggleInputMode(), 4000);
    return () => clearTimeout(t);
  }, [isVoiceMode, permissionDenied, onToggleInputMode]);

  // ── 键盘提交 ──────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (feedback !== 'idle') return;
    const guess = parseInt(input, 10);
    if (isNaN(guess)) return;
    submitGuess(guess);
  }

  // ── 派生显示数据 ──────────────────────────────────────────────────────────
  const wrong      = stats.attempted - stats.correct;
  const maxDigits  = MAX_DIGITS_FOR_RANGE[settings.range];
  const allowNeg   = modeInvolvesSubtraction(settings.mode) && !settings.noNegative;
  const timerColor = timeLeft <= 3 ? 'danger' : timeLeft <= 6 ? 'warning' : '';

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <div className="practice">

      {/* ── 贴纸动画 ──────────────────────────────────────── */}
      {newSticker && (
        <div className="sticker-overlay">
          <div className="sticker-popup">
            <div className="sticker-emoji">{newSticker}</div>
            <div className="sticker-label">新贴纸！🎉</div>
          </div>
        </div>
      )}

      {/* ── 顶部状态栏 ────────────────────────────────────── */}
      <div className="top-bar">
        <button className="home-btn" onClick={onHome}>🏠 回家</button>

        {/* 仅显示：答对 / 答错 / 进度，不显示准确率 */}
        <div className="stats-bar">
          <span className="stat">✅ 答对：{stats.correct}</span>
          <span className="stat">❌ 答错：{wrong}</span>
          <span className="stat">📌 {stats.attempted}/{settings.sessionLength}</span>
        </div>

        <div className="top-bar-right">
          <button
            className={`mode-toggle-btn ${isVoiceMode ? 'voice' : 'keyboard'}`}
            onClick={onToggleInputMode}
            title={isVoiceMode ? '切换为键盘' : '切换为语音'}
            aria-label={isVoiceMode ? '切换为键盘' : '切换为语音'}
          >
            {isVoiceMode ? '🎤' : '⌨️'}
          </button>
          <button
            className="sound-btn"
            onClick={onToggleSound}
            aria-label="切换声音"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </div>

      {/* ── 计时条 ────────────────────────────────────────── */}
      {settings.timerEnabled && (
        <div className="timer-bar-container">
          <div
            className={`timer-bar ${timerColor}`}
            style={{ width: `${timeLeft * 10}%` }}
          />
        </div>
      )}

      {/* ── 题目卡片（无连对星星）─────────────────────────── */}
      <div className={`problem-card ${feedback}`}>
        {feedback === 'correct' && (
          <div className="feedback-msg correct-msg">🎉 答对了！</div>
        )}
        {feedback === 'wrong' && (
          <div className="feedback-msg wrong-msg">
            再试试！答案：{problem.answer}
          </div>
        )}
        {feedback === 'timeout' && (
          <div className="feedback-msg wrong-msg">
            ⏰ 时间到！答案：{problem.answer}
          </div>
        )}
        <div className="problem-text">
          {problem.a} {problem.op} {problem.b} = ?
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          语音模式 — 自动聆听，无需按钮
         ══════════════════════════════════════════════════════ */}
      {isVoiceMode && (
        <div className="voice-section">

          {!voiceSupported ? (
            <div className="voice-unsupported">
              <p>🎤 此浏览器不支持语音输入。</p>
              <p>请使用 Chrome 或 Edge，或切换为键盘模式。</p>
            </div>

          ) : permissionDenied ? (
            <div className="mic-permission-hint">
              <p>🎤 <strong>麦克风被禁止了！</strong></p>
              <p>
                解决方法：点击浏览器地址栏 🔒 →
                允许麦克风 → 刷新页面。
              </p>
              <p className="permission-switching">
                即将自动切换为键盘模式……
              </p>
            </div>

          ) : (
            <>
              {/* 聆听状态动画指示器 */}
              <div className={`listen-indicator state-${voiceState}`}>

                {voiceState === 'listening' && (
                  <div className="listen-active">
                    <div className="listen-waves" aria-hidden="true">
                      <span /><span /><span /><span /><span />
                    </div>
                    <p className="listen-hint">说出答案就好 😊</p>
                  </div>
                )}

                {voiceState === 'processing' && (
                  <p className="listen-hint processing-hint">
                    ✨ 听到了！核对中……
                  </p>
                )}

                {voiceState === 'idle' && feedback === 'idle' && !voiceMsg && (
                  <p className="listen-hint idle-hint">
                    准备聆听……
                  </p>
                )}

                {voiceState === 'paused' && (
                  <p className="listen-hint paused-hint">
                    ⏸️ 已暂停聆听
                  </p>
                )}

                {voiceMsg && (
                  <p className="listen-hint msg-hint">{voiceMsg}</p>
                )}
              </div>

              {/* 暂停 / 继续（家长使用）*/}
              {feedback === 'idle' && (
                <button
                  className="pause-listen-btn"
                  onClick={voiceState === 'paused' ? resumeListen : pauseListen}
                  aria-label={voiceState === 'paused' ? '继续聆听' : '暂停聆听'}
                >
                  {voiceState === 'paused' ? '▶️ 继续' : '⏸️ 暂停'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          键盘模式 — 数字键盘 + 确认按钮
         ══════════════════════════════════════════════════════ */}
      {!isVoiceMode && (
        <div className="keyboard-section">
          <NumberPad
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            maxDigits={maxDigits}
            allowNegative={allowNeg}
          />
          <p className="keyboard-voice-hint">
            提示：点击上方 🎤 改为语音答题
          </p>
        </div>
      )}

      {/* 键盘模式答错时显示"下一题"按钮（语音模式自动翻页，最后一题不显示）*/}
      {feedback === 'wrong' && !isVoiceMode && !isLastQuestion && (
        <button className="next-btn" onClick={next}>下一题 →</button>
      )}

    </div>
  );
}
