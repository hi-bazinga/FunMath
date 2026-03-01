/**
 * useSpeechRecognition — low-level always-on continuous recognition hook.
 *
 * Design:
 *  - continuous = true  → recognition stays open across utterances.
 *  - interimResults = true → interim callbacks fire quickly for short syllables.
 *  - Recognition does NOT stop after receiving a result; callers own that decision.
 *  - Streams results via `result` state; callers consume with `clearResult()`.
 *  - `error` persists until the next `start()` call so callers can see fatal errors.
 */

import { useState, useRef, useCallback } from 'react';

/** Subset of SpeechRecognitionErrorCode values surfaced to callers. */
export type RecognitionError = SpeechRecognitionErrorCode | 'start-failed';

/** One recognition event — may be interim (isFinal=false) or finalised (isFinal=true). */
export interface RecognitionResult {
  transcript: string;
  isFinal: boolean;
}

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const RecognitionCtor = getRecognitionCtor();

export interface UseSpeechRecognitionResult {
  supported: boolean;
  /** True while a recognition session is open. */
  active: boolean;
  /** Latest result (interim or final). Null when nothing pending. */
  result: RecognitionResult | null;
  /**
   * Latest error. NOT cleared by clearResult() — persists so callers can
   * detect fatal errors (permission denied etc.) across result cycles.
   */
  error: RecognitionError | null;
  start: () => void;
  stop: () => void;
  /** Consume and discard the latest result without touching error state. */
  clearResult: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const supported = RecognitionCtor !== null;

  const [active, setActive]   = useState(false);
  const [result, setResult]   = useState<RecognitionResult | null>(null);
  const [error,  setError]    = useState<RecognitionError | null>(null);

  // Synchronous refs — needed inside callbacks where React state would be stale.
  const recogRef  = useRef<SpeechRecognition | null>(null);
  const activeRef = useRef(false); // mirrors `active` for synchronous guard in start()

  const abortCurrent = useCallback(() => {
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch { /* already ended */ }
      recogRef.current = null;
    }
    activeRef.current = false;
  }, []);

  const stop = useCallback(() => {
    abortCurrent();
    setActive(false);
  }, [abortCurrent]);

  const clearResult = useCallback(() => {
    // Only clears result — error intentionally survives so callers see fatal errors.
    setResult(null);
  }, []);

  const start = useCallback(() => {
    if (!supported || !RecognitionCtor) return;
    // Guard against double-start using the synchronous ref (React state lags by one render).
    if (recogRef.current || activeRef.current) return;

    setError(null);

    const recog = new RecognitionCtor();
    recog.lang            = 'zh-CN';
    recog.interimResults  = true;  // stream partial results immediately
    recog.maxAlternatives = 3;
    recog.continuous      = true;  // keep session open across utterances

    recog.onstart = () => {
      activeRef.current = true;
      setActive(true);
    };

    recog.onresult = (ev: SpeechRecognitionEvent) => {
      // With continuous=true, ev.results accumulates across utterances.
      // Always take the latest (last) entry.
      const r = ev.results[ev.results.length - 1];
      const t = r[0].transcript.trim();
      if (t) {
        setResult({ transcript: t, isFinal: r.isFinal });
      }
    };

    recog.onerror = (ev: SpeechRecognitionErrorEvent) => {
      // onerror fires before onend — set error here, let onend clean up active state.
      setError(ev.error);
    };

    recog.onend = () => {
      activeRef.current = false;
      recogRef.current  = null;
      setActive(false);
      // Callers (useAutoListenRecognition) watch `active` and restart as needed.
    };

    recogRef.current = recog;
    try {
      recog.start();
    } catch {
      setError('start-failed');
      recogRef.current  = null;
      activeRef.current = false;
    }
  }, [supported, abortCurrent]);

  return { supported, active, result, error, start, stop, clearResult };
}
