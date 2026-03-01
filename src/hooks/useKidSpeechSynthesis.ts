/**
 * useKidSpeechSynthesis
 *
 * zh-CN TTS hook with:
 *  - Chinese voice selection (warm, clear voices preferred)
 *  - Prosody tuning (rate / pitch) controlled by kidFriendlyVoice flag
 *  - `isSpeaking` boolean so callers can block recognition while speaking
 *  - Guaranteed no overlap: speechSynthesis.cancel() before every utterance
 */

import { useState, useCallback, useEffect, useRef } from 'react';

const synthSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Preferred Chinese voice names, checked in order.
 * Covers macOS, Chrome, Windows common zh-CN installs.
 */
const PREFERRED_ZH_VOICE_NAMES = [
  'Ting-Ting',                      // macOS — zh-TW Mandarin, but often clearest
  'Google 普通话（中国大陆）',         // Chrome zh-CN
  'Google 中文（中国大陆）',           // alternative Chrome name
  'Microsoft Xiaoxiao',              // Windows 11 zh-CN (natural female)
  'Microsoft Huihui',                // Windows zh-CN (older female)
  'Microsoft Kangkang',              // Windows zh-CN (male)
  'Yu-shu',                         // macOS zh-TW Mandarin
  'Sin-ji',                         // macOS zh-HK (Cantonese — fallback)
];

function pickBestZhVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  // Try preferred voice names first
  for (const name of PREFERRED_ZH_VOICE_NAMES) {
    const v = voices.find((v) => v.name.includes(name));
    if (v) return v;
  }
  // Fall back to any zh-CN / zh voice
  return (
    voices.find((v) => v.lang === 'zh-CN') ??
    voices.find((v) => v.lang === 'zh_CN') ??
    voices.find((v) => v.lang.startsWith('zh'))
  );
}

export interface UseKidSpeechSynthesisResult {
  speak: (text: string) => void;
  cancel: () => void;
  isSpeaking: boolean;
  supported: boolean;
}

export function useKidSpeechSynthesis(
  kidFriendlyVoice: boolean,
): UseKidSpeechSynthesisResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const isSpeakingRef = useRef(false);

  // Voices load asynchronously on Chrome — listen for the event
  useEffect(() => {
    if (!synthSupported) return;

    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () =>
      window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!synthSupported) return;

      // Cancel any in-flight speech to avoid overlap
      window.speechSynthesis.cancel();

      const utt = new SpeechSynthesisUtterance(text);
      utt.lang   = 'zh-CN';
      utt.volume = 1.0;

      if (kidFriendlyVoice) {
        // Slightly slower and warmer for young listeners
        utt.rate  = 0.92;
        utt.pitch = 1.10;
      } else {
        utt.rate  = 1.0;
        utt.pitch = 1.0;
      }

      const bestVoice = pickBestZhVoice(voices);
      if (bestVoice) utt.voice = bestVoice;

      // Mark as speaking eagerly (batched with caller's state updates in React 18)
      isSpeakingRef.current = true;
      setIsSpeaking(true);

      utt.onend   = () => { isSpeakingRef.current = false; setIsSpeaking(false); };
      utt.onerror = () => { isSpeakingRef.current = false; setIsSpeaking(false); };

      window.speechSynthesis.speak(utt);
    },
    [voices, kidFriendlyVoice],
  );

  const cancel = useCallback(() => {
    if (!synthSupported) return;
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (synthSupported) window.speechSynthesis.cancel();
    };
  }, []);

  return { speak, cancel, isSpeaking, supported: synthSupported };
}
