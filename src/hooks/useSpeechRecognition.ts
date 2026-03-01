import { useState, useRef, useCallback } from 'react';

export type RecognitionState = 'idle' | 'listening' | 'heard' | 'error';

/** Subset of SpeechRecognitionErrorCode values we surface in the UI. */
export type RecognitionError = SpeechRecognitionErrorCode | 'start-failed';

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// Resolved once at module load; null on unsupported browsers.
const RecognitionCtor = getRecognitionCtor();

export interface UseSpeechRecognitionResult {
  supported: boolean;
  state: RecognitionState;
  transcript: string;
  error: RecognitionError | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const supported = RecognitionCtor !== null;
  const [state, setState] = useState<RecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<RecognitionError | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const activeRef = useRef(false);

  /** Abort any in-flight recognition instance without changing React state. */
  const abortCurrent = useCallback(() => {
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch { /* already ended */ }
      recogRef.current = null;
    }
    activeRef.current = false;
  }, []);

  /** Stop listening and return to idle (does not clear transcript/error). */
  const stop = useCallback(() => {
    abortCurrent();
    setState(prev => (prev === 'listening' ? 'idle' : prev));
  }, [abortCurrent]);

  /** Full reset: abort, clear transcript, error, return to idle. */
  const reset = useCallback(() => {
    abortCurrent();
    setState('idle');
    setTranscript('');
    setError(null);
  }, [abortCurrent]);

  const start = useCallback(() => {
    if (!supported || !RecognitionCtor || activeRef.current) return;
    abortCurrent();
    setError(null);

    const recog = new RecognitionCtor();
    recog.lang = 'zh-CN';
    recog.interimResults = false;
    recog.maxAlternatives = 3;
    recog.continuous = true;

    recog.onstart = () => {
      activeRef.current = true;
      setState('listening');
    };

    recog.onresult = (ev: SpeechRecognitionEvent) => {
      activeRef.current = false;
      // Use the most recent (last) result's best alternative.
      const r = ev.results[ev.results.length - 1];
      setTranscript(r[0].transcript);
      setState('heard');
      // Stop continuous session after first heard result to prevent double-captures.
      try { recog.stop(); } catch { /* already ended */ }
    };

    recog.onerror = (ev: SpeechRecognitionErrorEvent) => {
      activeRef.current = false;
      setError(ev.error);
      setState('error');
    };

    recog.onend = () => {
      activeRef.current = false;
      // If we never got a result or error, fall back to idle.
      setState(prev => (prev === 'listening' ? 'idle' : prev));
    };

    recogRef.current = recog;
    try {
      recog.start();
    } catch {
      setState('error');
      setError('start-failed');
      activeRef.current = false;
    }
  }, [supported, abortCurrent]);

  return { supported, state, transcript, error, start, stop, reset };
}
