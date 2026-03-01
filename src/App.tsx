import { useState, useEffect } from 'react';
import type { Settings, Stats, Mistake, Problem } from './types';
import HomeScreen from './components/HomeScreen';
import PracticeScreen from './components/PracticeScreen';
import ResultScreen from './components/ResultScreen';
import ParentView from './components/ParentView';
import './App.css';

export type InputMode = 'voice' | 'keyboard';

const defaultSettings: Settings = {
  mode: 'addition',
  range: 10,
  noNegative: true,
  timerEnabled: false,
  sessionLength: 10,
};

const defaultStats: Stats = {
  attempted: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
};

export default function App() {
  const [screen, setScreen] = useState<'home' | 'practice' | 'result' | 'parent'>('home');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [stats, setStats] = useState<Stats>(defaultStats);

  // ── Session-wide state (survives game resets) ─────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [allMistakes, setAllMistakes] = useState<Mistake[]>([]);
  const [totalCorrect, setTotalCorrect] = useState(0);

  // ── Voice / input preferences (session-wide) ──────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [speakCorrectAnswer, setSpeakCorrectAnswer] = useState(false);
  const [kidFriendlyVoice, setKidFriendlyVoice] = useState(true);

  // ── Auto-transition to result when session length is reached ──────────────
  useEffect(() => {
    if (screen !== 'practice') return;
    if (stats.attempted < settings.sessionLength) return;
    // Give the last feedback card + TTS phrase time to finish, then show results
    const t = setTimeout(() => setScreen('result'), 2800);
    return () => clearTimeout(t);
  }, [screen, stats.attempted, settings.sessionLength]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleStart(s: Settings) {
    setSettings(s);
    setStats(defaultStats);
    setAllMistakes([]);
    setScreen('practice');
  }

  function handleAnswer(correct: boolean, problem: Problem, given: number) {
    setStats((prev) => {
      const newStreak = correct ? prev.streak + 1 : 0;
      return {
        attempted:   prev.attempted + 1,
        correct:     prev.correct + (correct ? 1 : 0),
        streak:      newStreak,
        bestStreak:  Math.max(prev.bestStreak, newStreak),
      };
    });

    if (correct) {
      setTotalCorrect((n) => n + 1);
    } else {
      setAllMistakes((prev) => {
        const next = [
          ...prev,
          { a: problem.a, b: problem.b, op: problem.op, answer: problem.answer, given },
        ];
        return next.slice(-20);
      });
    }
  }

  function handleRestart() {
    setStats(defaultStats);
    setAllMistakes([]);
    setScreen('practice');
  }

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          settings={settings}
          onStart={handleStart}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((v) => !v)}
          onParent={() => setScreen('parent')}
          inputMode={inputMode}
          onToggleInputMode={() =>
            setInputMode((m) => (m === 'voice' ? 'keyboard' : 'voice'))
          }
          voiceOutputEnabled={voiceOutputEnabled}
          speakCorrectAnswer={speakCorrectAnswer}
          kidFriendlyVoice={kidFriendlyVoice}
          onToggleVoiceOutput={() => setVoiceOutputEnabled((v) => !v)}
          onToggleSpeakCorrectAnswer={() => setSpeakCorrectAnswer((v) => !v)}
          onToggleKidFriendlyVoice={() => setKidFriendlyVoice((v) => !v)}
        />
      )}

      {screen === 'practice' && (
        <PracticeScreen
          settings={settings}
          stats={stats}
          totalCorrect={totalCorrect}
          onAnswer={handleAnswer}
          onHome={() => setScreen('home')}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((v) => !v)}
          inputMode={inputMode}
          onToggleInputMode={() =>
            setInputMode((m) => (m === 'voice' ? 'keyboard' : 'voice'))
          }
          voiceOutputEnabled={voiceOutputEnabled}
          speakCorrectAnswer={speakCorrectAnswer}
          kidFriendlyVoice={kidFriendlyVoice}
        />
      )}

      {screen === 'result' && (
        <ResultScreen
          stats={stats}
          sessionLength={settings.sessionLength}
          voiceOutputEnabled={voiceOutputEnabled}
          kidFriendlyVoice={kidFriendlyVoice}
          onRestart={handleRestart}
          onHome={() => setScreen('home')}
        />
      )}

      {screen === 'parent' && (
        <ParentView
          stats={stats}
          allMistakes={allMistakes}
          totalCorrect={totalCorrect}
          onClose={() => setScreen('home')}
        />
      )}
    </div>
  );
}
