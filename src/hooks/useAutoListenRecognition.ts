/**
 * useAutoListenRecognition
 *
 * A higher-level voice-recognition hook that implements a small state machine:
 *
 *   idle  →  listening  →  processing  →  (back to idle after reset)
 *              ↑                  ↓
 *           (auto-restart after reset / error cleared)
 *              ↑
 *           paused  ←→  (user toggles pause/resume)
 *
 * Key behaviours:
 *  • Auto-starts when `enabled=true` and `blocked=false` and `rawState='idle'`
 *  • Auto-restarts after no-speech errors (after a brief delay)
 *  • Stops immediately when `enabled=false` or `blocked=true`
 *  • `pause()` / `resume()` let a parent disable auto-start without switching modes
 *  • Expose `reset()` so callers can return rawState to 'idle' after a result,
 *    which triggers the next auto-start cycle
 */

import { useState, useEffect, useCallback } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import type { RecognitionError } from './useSpeechRecognition';

export type AutoListenState = 'idle' | 'listening' | 'processing' | 'paused';

interface Options {
  /** Set false to disable all recognition (keyboard mode). */
  enabled: boolean;
  /**
   * Set true while TTS is speaking or answer feedback is displayed.
   * Prevents recognition from starting / restarts from happening.
   */
  blocked: boolean;
}

export interface UseAutoListenRecognitionResult {
  state: AutoListenState;
  transcript: string;
  error: RecognitionError | null;
  supported: boolean;
  permissionDenied: boolean;
  /** User-facing pause: stops auto-start until resume() is called. */
  pause: () => void;
  /** Re-enables auto-start after pause(). */
  resume: () => void;
  /**
   * Reset rawState to 'idle' and clear transcript/error.
   * Call this after consuming a result so the auto-start cycle continues.
   */
  reset: () => void;
}

export function useAutoListenRecognition({
  enabled,
  blocked,
}: Options): UseAutoListenRecognitionResult {
  const {
    supported,
    state: rawState,
    transcript,
    error,
    start,
    stop,
    reset: rawReset,
  } = useSpeechRecognition();

  // User-controlled pause (independent of enabled/blocked)
  const [userPaused, setUserPaused] = useState(false);

  // Composite "we want to be listening" flag
  const shouldListen = enabled && supported && !blocked && !userPaused;

  // ── Core auto-start / auto-restart effect ─────────────────────────────────
  useEffect(() => {
    if (!shouldListen) {
      // Abort any in-progress recognition immediately
      if (rawState === 'listening') stop();
      return;
    }

    // Only start when idle (heard = waiting for caller to call reset())
    if (rawState !== 'idle') return;

    // Start immediately — no artificial delay
    start();
  }, [shouldListen, rawState, start, stop]);

  // ── Auto-reset error states so recognition can retry ──────────────────────
  useEffect(() => {
    if (rawState !== 'error' || !shouldListen) return;
    // Show the error in UI for a moment, then clear it to trigger auto-restart
    const t = setTimeout(() => rawReset(), 1800);
    return () => clearTimeout(t);
  }, [rawState, shouldListen, rawReset]);

  // ── Public pause / resume ─────────────────────────────────────────────────
  const pause = useCallback(() => {
    setUserPaused(true);
    stop();
  }, [stop]);

  const resume = useCallback(() => {
    setUserPaused(false);
    // rawReset puts rawState back to 'idle', triggering auto-start
    rawReset();
  }, [rawReset]);

  // ── Map internal rawState → public AutoListenState ────────────────────────
  const state: AutoListenState = (() => {
    if (userPaused) return 'paused';
    if (rawState === 'heard') return 'processing';
    if (rawState === 'listening') return 'listening';
    return 'idle';
  })();

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
    reset: rawReset,
  };
}
