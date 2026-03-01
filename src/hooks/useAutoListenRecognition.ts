/**
 * useAutoListenRecognition
 *
 * Always-on voice-input state machine built on useSpeechRecognition.
 *
 * State machine:
 *   idle  ──(recognition starts)──▶  listening
 *   listening  ──(result locked)──▶  processing  ──(reset())──▶  listening
 *   listening  ──(pause())───────▶  paused  ──(resume())─────▶  idle → listening
 *
 * Key behaviours:
 *  • Recognition keeps running continuously in voice mode — no cold-start per question.
 *  • `blocked=true` means "ignore results", NOT "stop the microphone".
 *    The mic stays warm so the next question is captured immediately.
 *  • Interim results: accepted instantly for unambiguous single digits (0–9).
 *    (Avoids the premature-capture problem for multi-digit numbers like "二十三"
 *    where the first interim "二" would otherwise trigger early submission.)
 *  • Final results: always passed to processing so PracticeScreen can parse them.
 *  • Per-question submission lock (lockedRef) prevents double-submit from
 *    the interim + final pair of the same utterance.
 *  • 500 ms cooldown after any submission protects the brief window between
 *    reset() and blocked becoming true in the parent component.
 *  • Fatal errors (permission denied, audio capture failure) block auto-restart.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import type { RecognitionError } from './useSpeechRecognition';

export type AutoListenState = 'idle' | 'listening' | 'processing' | 'paused';

interface Options {
  /** Set false to disable all recognition (keyboard mode). */
  enabled: boolean;
  /**
   * When true, incoming results are silently ignored.
   * Recognition keeps running — the mic stays warm.
   * Typically: isSpeaking || feedback !== 'idle'
   */
  blocked: boolean;
}

export interface UseAutoListenRecognitionResult {
  state: AutoListenState;
  transcript: string;
  error: RecognitionError | null;
  supported: boolean;
  permissionDenied: boolean;
  /** Suspend auto-start until resume() is called. */
  pause: () => void;
  /** Re-enable auto-start after pause(). */
  resume: () => void;
  /**
   * Acknowledge a processed result: clears per-question lock and returns
   * state to 'listening'. Does NOT stop recognition.
   */
  reset: () => void;
}

// Errors that should never trigger auto-restart — user or hardware must resolve them.
const FATAL_ERRORS = new Set<string>([
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'language-not-supported',
]);

// Chinese single-digit characters 零–九.
const ZH_SINGLE_DIGITS = new Set('零一二三四五六七八九');

// Filler sounds that may precede a digit ("嗯七" → "七").
const FILLER_RE = /^[嗯呃啊哦哇噢]+\s*/u;

/**
 * Returns true only if `raw` is an unambiguous single digit (0–9).
 * Used to immediately lock interim results without waiting for the final event.
 * Multi-digit numbers (e.g. the interim "二" from "二十三") are intentionally
 * rejected here — they will arrive correctly as final results.
 */
function isUnambiguousSingleDigit(raw: string): boolean {
  const t = raw.replace(FILLER_RE, '').trim();
  if (/^\d$/.test(t)) return true;
  if (t.length === 1 && ZH_SINGLE_DIGITS.has(t)) return true;
  return false;
}

export function useAutoListenRecognition({
  enabled,
  blocked,
}: Options): UseAutoListenRecognitionResult {
  const {
    supported,
    active,
    result,
    error,
    start,
    stop,
    clearResult,
  } = useSpeechRecognition();

  const [userPaused, setUserPaused]   = useState(false);
  const [state, setState]             = useState<AutoListenState>('idle');
  const [transcript, setTranscript]   = useState('');

  // ── Synchronous refs — always current inside async callbacks / effects ──────

  /** Mirrors `blocked` prop for synchronous checks. */
  const blockedRef = useRef(blocked);
  useEffect(() => { blockedRef.current = blocked; }, [blocked]);

  /** Mirrors `state` for synchronous checks. */
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  /**
   * Per-question submission lock.
   * Set when a result is locked for processing; cleared by reset().
   * Prevents the interim + final pair of the same utterance from double-submitting.
   */
  const lockedRef = useRef(false);

  /**
   * Frozen transcript captured at lock time.
   * The live `result.transcript` may keep updating (continuous mode) between
   * the lock and when PracticeScreen reads `transcript` — this ref holds the
   * stable value we actually want to expose.
   */
  const lockedTranscriptRef = useRef('');

  /**
   * 500 ms cooldown after any submission.
   * Covers the brief window between reset() clearing lockedRef and the parent
   * component's `blocked` prop becoming true after setFeedback / setIsSpeaking.
   */
  const inCooldownRef    = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Keep recognition running when enabled ─────────────────────────────────
  useEffect(() => {
    if (enabled && supported && !userPaused) {
      start(); // no-op if already active
    } else {
      stop();
      if (!enabled || !supported) {
        lockedRef.current = false;
        setState('idle');
      }
    }
  }, [enabled, supported, userPaused, start, stop]);

  // ── Auto-restart after unexpected session end ─────────────────────────────
  useEffect(() => {
    if (!enabled || !supported || userPaused) return;
    if (active) return;
    if (stateRef.current === 'processing') return; // wait for reset() first
    if (error && FATAL_ERRORS.has(error))  return; // never retry fatal errors

    // Brief delay before retry; longer pause for non-speech errors.
    const delay = error === 'no-speech' ? 800 : error ? 1500 : 100;
    const t = setTimeout(() => start(), delay);
    return () => clearTimeout(t);
  }, [enabled, supported, userPaused, active, error, start]);

  // ── idle → listening once recognition session is open ─────────────────────
  useEffect(() => {
    if (active && !userPaused && stateRef.current === 'idle') {
      setState('listening');
    }
  }, [active, userPaused]);

  // ── Process incoming recognition results ──────────────────────────────────
  //
  // stateRef update effect MUST be defined before this effect so that in the
  // same render where both deps change, stateRef is updated first.
  useEffect(() => {
    if (!result) return;
    const { transcript: raw, isFinal } = result;

    // Consume immediately to prevent re-processing the same result.
    clearResult();

    // ── Gate: ignore results in these situations ──────────────────────────
    if (
      lockedRef.current        ||  // already submitted for this question
      inCooldownRef.current    ||  // brief post-submit protection window
      blockedRef.current       ||  // TTS speaking / feedback visible
      stateRef.current !== 'listening'
    ) {
      return;
    }

    // ── Interim filter: only accept unambiguous single digits immediately ──
    // Multi-digit numbers wait for the final event to avoid premature capture
    // (e.g. "二" from "二十三" interim must NOT be treated as answer 2).
    if (!isFinal && !isUnambiguousSingleDigit(raw)) return;

    // ── Lock this question ────────────────────────────────────────────────
    lockedRef.current         = true;
    lockedTranscriptRef.current = raw;
    inCooldownRef.current     = true;

    // Cooldown timer: NOT cancelled by reset() — lets it run its full 500 ms
    // to protect against late-arriving results from the same utterance.
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      inCooldownRef.current    = false;
      cooldownTimerRef.current = null;
    }, 500);

    setTranscript(raw);
    setState('processing');
  }, [result, clearResult]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const pause = useCallback(() => {
    setUserPaused(true);
    stop();
    setState('paused');
  }, [stop]);

  const resume = useCallback(() => {
    setUserPaused(false);
    lockedRef.current = false;
    // Recognition will restart via the keep-running effect.
    // State returns to 'idle', then 'listening' once session opens.
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    // Clear per-question lock so the next result can be accepted.
    // Cooldown timer is intentionally left running — it expires naturally
    // after 500 ms to guard the window before `blocked` updates in the parent.
    lockedRef.current           = false;
    lockedTranscriptRef.current = '';
    setTranscript('');
    setState((prev) => (prev === 'processing' ? 'listening' : prev));
  }, []);

  const permissionDenied =
    error === 'not-allowed' || error === 'service-not-allowed';

  return {
    state,
    transcript,
    error,
    supported,
    permissionDenied,
    pause,
    resume,
    reset,
  };
}
