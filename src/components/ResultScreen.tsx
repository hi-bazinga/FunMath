/**
 * ResultScreen
 *
 * Score screen shown after the session ends:
 *   - Correct / wrong / total questions
 *   - Ratio-based star rating (0–3 stars)
 *   - Chinese TTS summary
 *   - "Try again" and "Go home" buttons
 */

import { useEffect } from 'react';
import type { Stats } from '../types';
import { calcStars } from '../types';
import { useKidSpeechSynthesis } from '../hooks/useKidSpeechSynthesis';
import { getResultSummary } from '../utils/phrases';

interface Props {
  stats: Stats;
  sessionLength: number;
  voiceOutputEnabled: boolean;
  kidFriendlyVoice: boolean;
  onRestart: () => void;
  onHome: () => void;
}

export default function ResultScreen({
  stats,
  sessionLength,
  voiceOutputEnabled,
  kidFriendlyVoice,
  onRestart,
  onHome,
}: Props) {
  const { speak } = useKidSpeechSynthesis(kidFriendlyVoice);

  const wrong  = stats.attempted - stats.correct;
  const stars  = calcStars(stats.correct, stats.attempted);

  // ── Speak summary when screen mounts ─────────────────────────────────────
  useEffect(() => {
    if (!voiceOutputEnabled) return;
    // Short delay so the transition animation has a moment to render first
    const t = setTimeout(() => {
      speak(getResultSummary(stats.correct, stats.attempted, stars));
    }, 600);
    return () => clearTimeout(t);
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="result-screen">

      {/* ── Title ─────────────────────────────────────────── */}
      <h2 className="result-title">
        {stars === 3 ? '🎉 完美！' : stars >= 2 ? '👏 做得好！' : stars === 1 ? '💪 继续加油！' : '🌱 再练练！'}
      </h2>

      {/* ── Stats ─────────────────────────────────────────── */}
      <div className="result-stats">
        <div className="result-stat correct">
          <span className="result-stat-icon">✅</span>
          <span className="result-stat-value">{stats.correct}</span>
          <span className="result-stat-label">答对</span>
        </div>
        <div className="result-stat wrong">
          <span className="result-stat-icon">❌</span>
          <span className="result-stat-value">{wrong}</span>
          <span className="result-stat-label">答错</span>
        </div>
        <div className="result-stat total">
          <span className="result-stat-icon">📌</span>
          <span className="result-stat-value">{stats.attempted}</span>
          <span className="result-stat-label">总题数</span>
        </div>
      </div>

      {/* ── Star rating ───────────────────────────────────── */}
      <div className="result-stars-section">
        <div className="result-stars" aria-label={`获得 ${stars} 颗星`}>
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`result-star ${stars >= s ? 'star-on' : 'star-off'}`}
            >
              ★
            </span>
          ))}
        </div>
        <p className="result-stars-label">
          {stars === 3 && '三颗星！你太厉害了！'}
          {stars === 2 && '两颗星！非常棒！'}
          {stars === 1 && '一颗星！下次会更好！'}
          {stars === 0 && '继续练习，你能做到的！'}
        </p>
      </div>

      {/* ── Star calculation note ────────────────────────── */}
      <p className="result-rate-note">
        正确率：{stats.attempted > 0
          ? Math.round((stats.correct / stats.attempted) * 100)
          : 0}%（共 {sessionLength} 题）
      </p>

      {/* ── Action buttons ────────────────────────────────── */}
      <div className="result-actions">
        <button className="result-restart-btn" onClick={onRestart}>
          🔄 再来一次
        </button>
        <button className="result-home-btn" onClick={onHome}>
          🏠 回主页
        </button>
      </div>
    </div>
  );
}
