'use client';
import { audioContext } from './sound';

// Single playback slot for the intro soundtrack: remounts and replays can never stack audio.
// The buffer is decoded with an OfflineAudioContext so preloading needs no user gesture;
// the live AudioContext is only created/resumed from the visitor's "Enter" click.
export const introAudioUrl = '/audio/aether-intro.mp3';
let decoded: Promise<AudioBuffer> | null = null;
let playing: {
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAt: number;
  offset: number;
} | null = null;

export function loadIntroAudio(onProgress: (fraction: number) => void) {
  decoded ??= (async () => {
    const response = await fetch(introAudioUrl);
    if (!response.ok || !response.body) throw new Error(`Intro audio ${response.status}`);
    const total = Number(response.headers.get('content-length')) || 0;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (total) onProgress(received / total);
    }
    const bytes = new Uint8Array(received);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.byteLength;
    }
    onProgress(1);
    return new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes.buffer);
  })();
  decoded.catch(() => (decoded = null));
  return decoded;
}

const ramp = (gain: GainNode, to: number, seconds: number) => {
  const now = gain.context.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(to, now + seconds);
};

/** Call from a user gesture. Starts (or restarts) the soundtrack at `offset` seconds. */
export async function startIntroAudio(buffer: AudioBuffer, offset: number, audible: boolean) {
  stopIntroAudio(0);
  const context = audioContext();
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  const entry = { source, gain, startedAt: context.currentTime, offset };
  playing = entry;
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
    if (playing === entry) playing = null;
  };
  source.start(0, offset);
  if (audible) ramp(gain, 1, 0.4);
  if (context.state === 'suspended') await context.resume();
}

export function setIntroAudioAudible(audible: boolean) {
  if (playing) ramp(playing.gain, audible ? 1 : 0, 0.35);
}

export function stopIntroAudio(fade = 0.6) {
  const current = playing;
  if (!current) return;
  playing = null;
  if (fade <= 0) {
    current.source.stop();
    return;
  }
  ramp(current.gain, 0, fade);
  current.source.stop(current.gain.context.currentTime + fade + 0.05);
}

/** Playback position heard by the visitor, or null when nothing is playing. */
export function introAudioTime() {
  if (!playing) return null;
  const context = playing.gain.context as AudioContext;
  return context.currentTime - playing.startedAt + playing.offset - (context.outputLatency || 0);
}

export function suspendIntroAudio(suspended: boolean) {
  if (!playing) return;
  const context = playing.gain.context as AudioContext;
  void (suspended ? context.suspend() : context.resume());
}
