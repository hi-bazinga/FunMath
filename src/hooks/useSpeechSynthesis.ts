import { useCallback } from 'react';

const synthSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export function useSpeechSynthesis() {
  /**
   * Speak text aloud.  Cancels any ongoing speech first so phrases
   * never overlap.
   */
  const speak = useCallback((text: string) => {
    if (!synthSupported) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = 0.9;   // slightly slower — easier for kids
    utt.pitch = 1.1;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
  }, []);

  const cancel = useCallback(() => {
    if (!synthSupported) return;
    window.speechSynthesis.cancel();
  }, []);

  return { supported: synthSupported, speak, cancel };
}
