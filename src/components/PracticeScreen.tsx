/**
 * PracticeScreen
 *
 * Two mutually exclusive input modes:
 *   🎤 Voice    — auto-listens, no button required
 *   ⌨️ Keyboard — number pad + confirm button
 *
 * After the session ends (answered questions reaches sessionLength),
 * App.tsx handles the transition to the results screen.
 * This component skips auto-advance on the last question and
 * waits for App.tsx to trigger the timed transition.
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

  // Skip auto-advance on the last question; App.tsx handles the transition
  const isLastQuestion = stats.attempted >= settings.sessionLength - 1;

  // ── Sound / TTS hooks ─────────────────────────────────────────────────────
  const { playCorrect, playWrong, playTick, playSticker } = useSound(soundEnabled);
  const { speak, cancel: cancelSpeech, isSpeaking } = useKidSpeechSynthesis(kidFriendlyVoice);

  // Block auto-start when TTS is speaking or feedback is displayed
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

  // ── submitGuess: shared submission path for voice and keyboard ────────────
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

  // Stable ref so the recognition callback always holds the latest submitGuess
  const submitGuessRef = useRef(submitGuess);
  useEffect(() => { submitGuessRef.current = submitGuess; }, [submitGuess]);

  // ── Advance to next question ───────────────────────────────────────────────
  const next = useCallback(() => {
    cancelSpeech();
    setVoiceMsg(null);
    setProblem(generateProblem(settings));
    setInput('0');
    setFeedback('idle');
    setTimeLeft(10);
  }, [settings, cancelSpeech]);

  // ── Countdown timer ───────────────────────────────────────────────────────
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

  // ── Auto-advance after correct answer (skip on last question) ─────────────
  useEffect(() => {
    if (feedback !== 'correct' || isLastQuestion) return;
    const t = setTimeout(next, 1200);
    return () => clearTimeout(t);
  }, [feedback, next, isLastQuestion]);

  // ── Auto-advance after timeout (skip on last question) ────────────────────
  useEffect(() => {
    if (feedback !== 'timeout' || isLastQuestion) return;
    const t = setTimeout(next, 1500);
    return () => clearTimeout(t);
  }, [feedback, next, isLastQuestion]);

  // ── Voice mode: auto-advance after wrong + TTS finishes (skip last) ───────
  useEffect(() => {
    if (!isVoiceMode || feedback !== 'wrong' || isSpeaking || isLastQuestion) return;
    const t = setTimeout(next, 900);
    return () => clearTimeout(t);
  }, [isVoiceMode, feedback, isSpeaking, next, isLastQuestion]);

  // ── Sticker milestone (every 10 cumulative correct answers) ───────────────
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

  // ── Handle speech recognition results ─────────────────────────────────────
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

  // ── Show hint on recognition error ────────────────────────────────────────
  useEffect(() => {
    if (!voiceError || permissionDenied) return;
    const msg =
      voiceError === 'no-speech'
        ? '我没听到，请再说一次！😊'
        : '麦克风出错了，稍后重试！';
    setVoiceMsg(msg);
    return () => setVoiceMsg(null);
  }, [voiceError, permissionDenied]);

  // ── Auto-switch to keyboard mode when mic permission is denied ────────────
  useEffect(() => {
    if (!isVoiceMode || !permissionDenied) return;
    const t = setTimeout(() => onToggleInputMode(), 4000);
    return () => clearTimeout(t);
  }, [isVoiceMode, permissionDenied, onToggleInputMode]);

  // ── Keyboard submit ────────────────────────────────────────────────────────
  function handleSubmit() {
    if (feedback !== 'idle') return;
    const guess = parseInt(input, 10);
    if (isNaN(guess)) return;
    submitGuess(guess);
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const wrong      = stats.attempted - stats.correct;
  const maxDigits  = MAX_DIGITS_FOR_RANGE[settings.range];
  const allowNeg   = modeInvolvesSubtraction(settings.mode) && !settings.noNegative;
  const timerColor = timeLeft <= 3 ? 'danger' : timeLeft <= 6 ? 'warning' : '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="practice">

      {/* ── Sticker animation ─────────────────────────────── */}
      {newSticker && (
        <div className="sticker-overlay">
          <div className="sticker-popup">
            <div className="sticker-emoji">{newSticker}</div>
            <div className="sticker-label">新贴纸！🎉</div>
          </div>
        </div>
      )}

      {/* ── Top status bar ────────────────────────────────── */}
      <div className="top-bar">
        <button className="home-btn" onClick={onHome}>🏠 回家</button>

        {/* Show only: correct / wrong / progress (no accuracy %) */}
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

      {/* ── Timer bar ─────────────────────────────────────── */}
      {settings.timerEnabled && (
        <div className="timer-bar-container">
          <div
            className={`timer-bar ${timerColor}`}
            style={{ width: `${timeLeft * 10}%` }}
          />
        </div>
      )}

      {/* ── Problem card (no streak stars) ────────────────── */}
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
          Voice mode — auto-listens, no button required
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
              {/* Listening state animated indicator */}
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

              {/* Pause / resume (for parent use) */}
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
          Keyboard mode — number pad + confirm button
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

      {/* Show "next question" button when wrong in keyboard mode (voice auto-advances; hidden on last question) */}
      {feedback === 'wrong' && !isVoiceMode && !isLastQuestion && (
        <button className="next-btn" onClick={next}>下一题 →</button>
      )}

    </div>
  );
}
