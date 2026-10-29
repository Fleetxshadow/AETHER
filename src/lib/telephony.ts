import { callEventSchema, type CallEvent, type CallState, type IntakeLanguage } from './response';
import { handleDemoCall, verifyDemoSignature } from './demo-calls';
import { ResponseError } from './response-server';

// Server integration boundary. Browser SpeechRecognition stays in use-response-voice.ts.
export interface TelephoneAudioChunk {
  encoding: 'pcm-s16le' | 'mulaw';
  sampleRate: 8000 | 16000;
  bytes: Uint8Array;
}
export interface TelephoneAudioAdapter {
  open(
    sessionId: string,
    signal: AbortSignal,
  ): Promise<{
    incoming: AsyncIterable<TelephoneAudioChunk>;
    send: (chunk: TelephoneAudioChunk) => Promise<void>;
    close: () => Promise<void>;
  }>;
}
export interface TelephoneRecognitionAdapter {
  recognize(
    audio: AsyncIterable<TelephoneAudioChunk>,
    language: IntakeLanguage,
    signal: AbortSignal,
  ): AsyncIterable<{ text: string; final: boolean }>;
}
export interface TelephoneSynthesisAdapter {
  synthesize(
    text: string,
    language: IntakeLanguage,
    signal: AbortSignal,
  ): AsyncIterable<TelephoneAudioChunk>;
}
export interface TelephoneSession {
  sessionId: string;
  state: CallState;
  language: IntakeLanguage;
  incidentId: string | null;
  source: 'DEMO' | 'AUTHORIZED_TEST';
  externalContactConfirmed: false;
}
export interface TelephonyAdapter {
  readonly mode: 'simulated' | 'authorized-test';
  readonly audio: TelephoneAudioAdapter | null;
  readonly recognition: TelephoneRecognitionAdapter | null;
  readonly synthesis: TelephoneSynthesisAdapter | null;
  verifyInbound(rawBody: string, headers: Headers): boolean;
  normalizeInbound(rawBody: string): CallEvent;
  handleInbound(event: CallEvent): TelephoneSession;
}
// Functional free local adapter: lifecycle, language, consented transcript->incident, handoff/error.
// Its signature is NEXUS-specific, not Exotel's. No stream, recognition service or TTS is claimed.
export function createDemoTelephonyAdapter(secret: string): TelephonyAdapter {
  return {
    mode: 'simulated',
    audio: null,
    recognition: null,
    synthesis: null,
    verifyInbound: (raw, headers) =>
      verifyDemoSignature(
        raw,
        headers.get('x-nexus-timestamp') || '',
        headers.get('x-nexus-signature') || '',
        secret,
      ),
    normalizeInbound: (raw) => callEventSchema.parse(JSON.parse(raw)),
    handleInbound: (event) => handleDemoCall(event),
  };
}
export function acceptTelephoneEvent(adapter: TelephonyAdapter, raw: string, headers: Headers) {
  if (adapter.mode !== 'simulated')
    throw new ResponseError('Live telephone integration is disabled in this local prototype.', 503);
  if (!adapter.verifyInbound(raw, headers))
    throw new ResponseError('Webhook signature rejected.', 401);
  return adapter.normalizeInbound(raw);
}
