import { useRef } from 'react';

export function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  function getCtx(): AudioContext | null {
    if (!enabled) return null;
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }

  function tone(
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType = 'sine',
    vol = 0.25,
  ) {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
    osc.start(ctx.currentTime + startOffset);
    osc.stop(ctx.currentTime + startOffset + duration);
  }

  function playCorrect() {
    tone(523.25, 0, 0.12);      // C5
    tone(783.99, 0.12, 0.2);    // G5
  }

  function playWrong() {
    tone(220, 0, 0.15, 'sawtooth', 0.2);
    tone(180, 0.15, 0.2, 'sawtooth', 0.15);
  }

  function playTick() {
    tone(880, 0, 0.05, 'sine', 0.15);
  }

  function playSticker() {
    tone(523.25, 0,    0.1);   // C5
    tone(659.25, 0.1,  0.1);   // E5
    tone(783.99, 0.2,  0.1);   // G5
    tone(1046.5, 0.3,  0.25);  // C6
  }

  return { playCorrect, playWrong, playTick, playSticker };
}
