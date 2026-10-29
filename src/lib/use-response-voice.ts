'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IntakeLanguage } from './response';
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: {
          length: number;
          [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
        };
      }) => void)
    | null;
  start: () => void;
  abort: () => void;
}
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useResponseVoice(language: IntakeLanguage, onTranscript: (value: string) => void) {
  const recognition = useRef<Recognition | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [state, setState] = useState<'idle' | 'listening' | 'speaking' | 'error'>('idle');
  const [speechDetected, setSpeechDetected] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const callback = useRef(onTranscript);
  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);
  const stop = useCallback(() => {
    generation.current++;
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onend = null;
      current.onresult = null;
      current.onerror = null;
      current.onstart = null;
      current.onspeechstart = null;
      current.onspeechend = null;
      current.abort();
    }
    if (utterance.current) {
      utterance.current.onstart = null;
      utterance.current.onend = null;
      utterance.current.onerror = null;
      utterance.current = null;
    }
    window.speechSynthesis?.cancel();
    setState('idle');
    setSpeechDetected(false);
    setInterim('');
  }, []);
  useEffect(() => {
    return stop;
  }, [language, stop]);
  const listen = () => {
    stop();
    setError('');
    const api = window as VoiceWindow;
    const Constructor = api.SpeechRecognition || api.webkitSpeechRecognition;
    if (!Constructor) {
      setError('Browser transcription unavailable. Use the text field.');
      setState('error');
      return;
    }
    const current = new Constructor();
    recognition.current = current;
    const ticket = generation.current;
    const active = () => generation.current === ticket;
    current.lang = language === 'en-IN' ? 'en-IN' : 'hi-IN';
    current.continuous = false;
    current.interimResults = true;
    current.onstart = () => {
      if (active()) setState('listening');
    };
    current.onspeechstart = () => {
      if (active()) setSpeechDetected(true);
    };
    current.onspeechend = () => {
      if (active()) setSpeechDetected(false);
    };
    current.onend = () => {
      if (active()) {
        setState((s) => (s === 'error' ? 'error' : 'idle'));
        setSpeechDetected(false);
        setInterim('');
        recognition.current = null;
      }
    };
    current.onerror = (e) => {
      if (active()) {
        setError(`Transcription ${e.error}. Text intake remains available.`);
        setState('error');
        setSpeechDetected(false);
      }
    };
    current.onresult = (e) => {
      if (!active()) return;
      let pending = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += text + ' ';
        else pending += text;
      }
      if (final) callback.current(final.trim());
      setInterim(pending);
    };
    try {
      current.start();
    } catch {
      setState('error');
      setError('Microphone could not start. Use text intake.');
    }
  };
  const speak = (text: string) => {
    stop();
    setError('');
    if (!window.speechSynthesis) {
      setError('Speech playback unavailable. Read the transcript.');
      return;
    }
    const current = new SpeechSynthesisUtterance(text);
    utterance.current = current;
    const ticket = generation.current;
    current.lang = language === 'en-IN' ? 'en-IN' : 'hi-IN';
    current.rate = 0.95;
    current.onstart = () => {
      if (generation.current === ticket) setState('speaking');
    };
    current.onend = () => {
      if (generation.current === ticket) {
        setState('idle');
        utterance.current = null;
      }
    };
    current.onerror = () => {
      if (generation.current === ticket) {
        setState('error');
        setError('Speech playback unavailable. Read the transcript.');
      }
    };
    window.speechSynthesis.speak(current);
  };
  return { state, speechDetected, interim, error, listen, speak, stop };
}
