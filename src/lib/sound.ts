'use client';
import { useNexus } from './store';
let context: AudioContext | null = null;
export async function playCue(
  kind: 'enter' | 'select' | 'scene' | 'signal' | 'anomaly' | 'reveal' = 'select',
) {
  const { sound, volume } = useNexus.getState();
  if (!sound || volume === 0) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    const now = context.currentTime;
    const tones =
      kind === 'reveal'
        ? [164.81, 246.94, 329.63]
        : kind === 'anomaly'
          ? [196, 207.65]
          : kind === 'signal'
            ? [523.25, 783.99]
            : kind === 'enter'
              ? [220, 330, 440]
              : kind === 'scene'
                ? [196, 294]
                : [440];
    tones.forEach((frequency, i) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(volume * 0.12, now + i * 0.08 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.45);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.start(now + i * 0.08);
      oscillator.stop(now + i * 0.08 + 0.5);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    /* Unsupported or denied audio does not affect navigation. */
  }
}
