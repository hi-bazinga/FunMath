import { useState } from 'react';
import type { Mode, Range, Settings, SessionLength } from '../types';
import { modeInvolvesSubtraction } from '../types';
import type { InputMode } from '../App';

interface Props {
  settings: Settings;
  onStart: (s: Settings) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onParent: () => void;
  inputMode: InputMode;
  onToggleInputMode: () => void;
  voiceOutputEnabled: boolean;
  speakCorrectAnswer: boolean;
  kidFriendlyVoice: boolean;
  onToggleVoiceOutput: () => void;
  onToggleSpeakCorrectAnswer: () => void;
  onToggleKidFriendlyVoice: () => void;
}

const MODES: { value: Mode; label: string; emoji: string }[] = [
  { value: 'addition',    label: '加法', emoji: '➕' },
  { value: 'subtraction', label: '减法', emoji: '➖' },
  { value: 'mixed',       label: '混合', emoji: '🎲' },
];

const RANGES: Range[] = [10, 20, 50, 100];

const SESSION_LENGTHS: SessionLength[] = [10, 20, 30];

export default function HomeScreen({
  settings,
  onStart,
  soundEnabled,
  onToggleSound,
  onParent,
  inputMode,
  onToggleInputMode,
  voiceOutputEnabled,
  speakCorrectAnswer,
  kidFriendlyVoice,
  onToggleVoiceOutput,
  onToggleSpeakCorrectAnswer,
  onToggleKidFriendlyVoice,
}: Props) {
  const [draft, setDraft] = useState<Settings>(settings);

  const isVoice = inputMode === 'voice';

  return (
    <div className="home">
      <div className="home-top-bar">
        <h1 className="title">数学真有趣！🌟</h1>
        <button className="sound-btn" onClick={onToggleSound} aria-label="切换声音">
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {/* ── Problem type ────────────────────────────────────── */}
      <section className="section">
        <h2 className="section-label">题目类型</h2>
        <div className="btn-group">
          {MODES.map((m) => (
            <button
              key={m.value}
              className={`choice-btn ${draft.mode === m.value ? 'active' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, mode: m.value }))}
            >
              <span className="choice-emoji">{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Number range ─────────────────────────────────────── */}
      <section className="section">
        <h2 className="section-label">数字范围（最大）</h2>
        <div className="btn-group">
          {RANGES.map((r) => (
            <button
              key={r}
              className={`choice-btn ${draft.range === r ? 'active' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, range: r }))}
            >
              {r}
            </button>
          ))}
        </div>
      </section>

      {modeInvolvesSubtraction(draft.mode) && (
        <section className="section">
          <button
            className={`toggle-btn ${draft.noNegative ? 'active' : ''}`}
            onClick={() => setDraft((d) => ({ ...d, noNegative: !d.noNegative }))}
          >
            <span className="toggle-icon">{draft.noNegative ? '✅' : '⬜'}</span>
            不出负数答案
          </button>
        </section>
      )}

      {/* ── Questions per session ───────────────────────────── */}
      <section className="section">
        <h2 className="section-label">每次题数</h2>
        <div className="btn-group">
          {SESSION_LENGTHS.map((n) => (
            <button
              key={n}
              className={`choice-btn ${draft.sessionLength === n ? 'active' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, sessionLength: n }))}
            >
              {n} 题
            </button>
          ))}
        </div>
      </section>

      {/* ── Timer ────────────────────────────────────────────── */}
      <section className="section">
        <button
          className={`toggle-btn ${draft.timerEnabled ? 'active' : ''}`}
          onClick={() => setDraft((d) => ({ ...d, timerEnabled: !d.timerEnabled }))}
        >
          <span className="toggle-icon">{draft.timerEnabled ? '✅' : '⬜'}</span>
          每题10秒计时 ⏱️
        </button>
      </section>

      {/* ── Input mode ───────────────────────────────────────── */}
      <section className="section">
        <h2 className="section-label">答题方式</h2>
        <div className="btn-group">
          <button
            className={`choice-btn ${isVoice ? 'active' : ''}`}
            onClick={() => { if (!isVoice) onToggleInputMode(); }}
          >
            <span className="choice-emoji">🎤</span>
            <span>语音</span>
          </button>
          <button
            className={`choice-btn ${!isVoice ? 'active' : ''}`}
            onClick={() => { if (isVoice) onToggleInputMode(); }}
          >
            <span className="choice-emoji">⌨️</span>
            <span>键盘</span>
          </button>
        </div>
        {isVoice && (
          <p className="input-mode-hint">
            说出答案就好，不用按按钮！😊
          </p>
        )}
      </section>

      {/* ── Voice feedback ───────────────────────────────────── */}
      <section className="section">
        <h2 className="section-label">语音反馈</h2>
        <div className="toggle-stack">
          <button
            className={`toggle-btn ${voiceOutputEnabled ? 'active' : ''}`}
            onClick={onToggleVoiceOutput}
          >
            <span className="toggle-icon">{voiceOutputEnabled ? '✅' : '⬜'}</span>
            开启语音鼓励 🔈
          </button>

          {voiceOutputEnabled && (
            <>
              <button
                className={`toggle-btn ${speakCorrectAnswer ? 'active' : ''}`}
                onClick={onToggleSpeakCorrectAnswer}
              >
                <span className="toggle-icon">{speakCorrectAnswer ? '✅' : '⬜'}</span>
                说出正确答案 📣
              </button>

              <button
                className={`toggle-btn ${kidFriendlyVoice ? 'active' : ''}`}
                onClick={onToggleKidFriendlyVoice}
              >
                <span className="toggle-icon">{kidFriendlyVoice ? '✅' : '⬜'}</span>
                儿童友好语音 🎵
              </button>
            </>
          )}
        </div>
      </section>

      <button className="start-btn" onClick={() => onStart(draft)}>
        开始！🚀
      </button>

      <button className="parent-btn" onClick={onParent}>
        👨‍👩‍👧 家长查看
      </button>
    </div>
  );
}
