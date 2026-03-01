import type { Stats, Mistake } from '../types';

interface Props {
  stats: Stats;
  allMistakes: Mistake[];
  totalCorrect: number;
  onClose: () => void;
}

export default function ParentView({ stats, allMistakes, totalCorrect, onClose }: Props) {
  const accuracy =
    stats.attempted === 0 ? 100 : Math.round((stats.correct / stats.attempted) * 100);

  const stickersEarned = Math.floor(totalCorrect / 10);
  const recentMistakes = allMistakes.slice(-5);

  return (
    <div className="parent-view">
      <div className="parent-header">
        <h2 className="parent-title">家长报告 👨‍👩‍👧</h2>
        <button className="home-btn" onClick={onClose}>✕ 关闭</button>
      </div>

      <div className="parent-stats-grid">
        <div className="parent-stat-card">
          <div className="parent-stat-value">{stats.attempted}</div>
          <div className="parent-stat-label">答题总数</div>
        </div>
        <div className="parent-stat-card">
          <div className="parent-stat-value">{stats.correct}</div>
          <div className="parent-stat-label">答对</div>
        </div>
        <div className="parent-stat-card">
          <div className="parent-stat-value">{accuracy}%</div>
          <div className="parent-stat-label">正确率</div>
        </div>
        <div className="parent-stat-card">
          <div className="parent-stat-value">{stats.bestStreak}</div>
          <div className="parent-stat-label">最长连对</div>
        </div>
      </div>

      <div className="parent-section">
        <h3 className="parent-section-title">获得贴纸：{stickersEarned} ⭐</h3>
      </div>

      <div className="parent-section">
        <h3 className="parent-section-title">近期错题</h3>
        {recentMistakes.length === 0 ? (
          <p className="no-mistakes">暂无错题！🎉</p>
        ) : (
          <ul className="mistake-list">
            {recentMistakes.map((m, i) => (
              <li key={i} className="mistake-item">
                {m.a} {m.op} {m.b} = {m.answer} &nbsp;
                <span className="mistake-given">
                  （你答的是{isNaN(m.given) ? '⏰ 超时' : m.given}）
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
