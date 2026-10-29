'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  Check,
  Headphones,
  LocateFixed,
  Mic,
  Phone,
  PhoneOff,
  Radio,
  ShieldCheck,
  Trash2,
  Volume2,
} from 'lucide-react';
import Link from 'next/link';
import {
  extractIncident,
  intakeSchema,
  type Incident,
  type IntakeLanguage,
  type Review,
  type CallState,
} from '@/lib/response';
import { useResponseVoice } from '@/lib/use-response-voice';
import { useReducedMotion, spring } from '@/lib/motion';
import { useDialogFocus } from '@/lib/hooks';
import { ResponseMap } from './response-map';
import { EvidenceFrame } from './replay';
import { observations } from '@/lib/data';
import { demoConversationIntake } from '@/lib/demo-conversation';
import { DemoConversation } from './demo-conversation';

const stamp = (value: string) =>
  new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export function ResponseWorkspace({ incidentId }: { incidentId?: string }) {
  const reduced = useReducedMotion();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [operator, setOperator] = useState(false);
  const [selected, setSelected] = useState<string | null>(incidentId || null);
  const [language, setLanguage] = useState<IntakeLanguage>('en-IN');
  const [text, setText] = useState('');
  const [location, setLocation] = useState('');
  const [landmark, setLandmark] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [callback, setCallback] = useState('');
  const [callbackConsent, setCallbackConsent] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const createdId = useRef<string | null>(null);
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [call, setCall] = useState<CallState>('idle');
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [sampleSaved, setSampleSaved] = useState(false);
  const [sampleFailed, setSampleFailed] = useState(false);
  const simulatedCallActive = ['incoming', 'connected', 'human-handoff'].includes(call);
  const [confirmation, setConfirmation] = useState<Review['action'] | 'delete' | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeConfirm = useCallback(() => setConfirmation(null), []);
  useDialogFocus(!!confirmation, dialog, closeConfirm);
  const voice = useResponseVoice(language, (value) => {
    setUsedVoice(true);
    setText((t) => `${t}${t ? ' ' : ''}${value}`.slice(0, 2000));
  });
  const input = {
    text,
    language,
    location,
    landmark,
    coordinates,
    callback,
    callbackConsent,
    channel:
      call === 'connected' || sampleLoaded
        ? ('simulated-call' as const)
        : usedVoice && voiceConsent
          ? ('browser-voice' as const)
          : ('text' as const),
  };
  const parsed = intakeSchema.safeParse(input);
  const extracted = text.trim().length >= 3 && parsed.success ? extractIncident(parsed.data) : null;
  const current = incidents.find((i) => i.id === selected);
  const greeting =
    language === 'en-IN'
      ? 'Welcome to AETHER RESPONSE. How can I help you?'
      : language === 'hi-IN'
        ? 'नमस्ते, AETHER RESPONSE में आपका स्वागत है। कृपया बताइए आपको किस प्रकार की सहायता चाहिए?'
        : 'Namaste, AETHER RESPONSE mein aapka swagat hai. How can I help you?';
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/response', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setIncidents(data.incidents);
      setOperator(data.operator);
      setSessionReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Demo service unavailable.');
    }
  }, []);
  useEffect(() => {
    // Network subscription resolves asynchronously; this stores no derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  const send = async (body: unknown) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setIncidents(data.incidents);
      setOperator(data.operator);
      createdId.current = data.createdId || null;
      return data.incidents as Incident[];
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Demo service unavailable.');
      return null;
    } finally {
      setBusy(false);
    }
  };
  const clearDraft = () => {
    setUsedVoice(false);
    setText('');
    setLocation('');
    setLandmark('');
    setCoordinates(null);
    setCallback('');
    setCallbackConsent(false);
  };
  const newBrowserReport = () => {
    voice.stop();
    clearDraft();
    setSampleLoaded(false);
    setSampleSaved(false);
    setSampleFailed(false);
    setCall('idle');
    setNotice('Fresh browser intake. Existing saved reports remain in your queue.');
  };
  const submit = async () => {
    if (!parsed.success) {
      setError('Add at least three characters; callback requires consent.');
      return;
    }
    voice.stop();
    const records = await send({ type: 'intake', input: parsed.data });
    if (records) {
      setSelected(createdId.current);
      clearDraft();
      setCall(call === 'connected' ? 'human-handoff' : 'idle');
      setNotice('Demo report saved for human review. No service has been contacted.');
    }
  };
  const acceptDemoCall = async () => {
    voice.stop();
    setUsedVoice(false);
    setCall('connected');
    setSampleLoaded(true);
    setSampleSaved(false);
    setSampleFailed(false);
    setText(demoConversationIntake.text);
    setLocation(demoConversationIntake.location);
    setLanguage('hinglish');
    setLandmark('');
    setCoordinates(null);
    setCallback('');
    setCallbackConsent(false);
    const records = await send({ type: 'intake', input: demoConversationIntake });
    if (records) {
      setSelected(createdId.current);
      setSampleSaved(true);
      setNotice(
        'Simulated waterlogging example saved for operator review. No phone/audio connection or external contact.',
      );
    } else setSampleFailed(true);
  };
  const review = async (action: Review['action']) => {
    if (!current) return;
    if (note.trim().length < 3) {
      setError('Add a review note (at least three characters).');
      return;
    }
    const records = await send({
      type: 'review',
      input: { id: current.id, version: current.version, action, note },
    });
    if (records) {
      setNote('');
      setNotice(`${action} saved to human audit history. No external contact.`);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setError('Location sharing unavailable. Enter location in text.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoordinates([p.coords.longitude, p.coords.latitude]);
        setNotice(
          'Coordinates shared voluntarily. Confirm the incident is at this location; device location may differ.',
        );
      },
      () => setError('Location permission unavailable. Type the incident location instead.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  };
  const changeLanguage = (value: IntakeLanguage) => {
    voice.stop();
    setLanguage(value);
  };
  const actions: Review['action'][] =
    current?.status === 'RECEIVED'
      ? ['triage', 'refer']
      : current?.status === 'TRIAGE'
        ? ['review', 'refer']
        : current?.status === 'OPERATOR REVIEW'
          ? ['verify', 'unconfirmed', 'refer']
          : current?.status === 'VERIFIED'
            ? ['refer', 'close']
            : current?.status === 'UNCONFIRMED'
              ? ['review', 'refer', 'close']
              : current?.status === 'REFERRED'
                ? ['close']
                : [];
  return (
    <div className="response-workspace">
      <div className="response-safety">
        <div>
          <ShieldCheck size={21} />
          <span>
            <strong>NON-OPERATIONAL DEMO</strong> Local extraction · simulated handoff · no
            emergency dispatch. For a real emergency in India, contact 112 directly.
          </span>
        </div>
        <a href="tel:112" className="response-emergency">
          <Phone size={17} />
          Call 112
        </a>
      </div>
      <div className="response-status-strip">
        {[
          ['QUEUE', String(incidents.length)],
          [
            'URGENT',
            String(incidents.filter((i) => i.urgency === 'urgent' && i.status !== 'CLOSED').length),
          ],
          [
            'HUMAN REVIEW',
            String(
              incidents.filter((i) => ['RECEIVED', 'TRIAGE', 'OPERATOR REVIEW'].includes(i.status))
                .length,
            ),
          ],
          ['RETENTION', '30 MIN'],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="mono">{label}</span>
            <motion.strong
              key={value}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {value}
            </motion.strong>
          </div>
        ))}
      </div>
      <div className="response-intake-grid">
        <section className="response-voice-panel">
          <header>
            <span className="eyebrow">
              <Radio size={14} />
              COMMUNICATIONS / LOCAL DEMO
            </span>
            <span className="response-state" role="status">
              {simulatedCallActive
                ? call === 'connected'
                  ? 'DEMO CONNECTED'
                  : `DEMO ${call.replaceAll('-', ' ').toUpperCase()}`
                : voice.state !== 'idle'
                  ? voice.state
                  : call.replaceAll('-', ' ')}
            </span>
          </header>
          {call !== 'idle' && (
            <p className="simulated-channel-disclosure">
              No phone/audio connection — simulated conversation
            </p>
          )}
          <div
            className={`voice-orbit ${voice.state}`}
            data-audio-active={voice.speechDetected || voice.state === 'speaking'}
            aria-hidden="true"
          >
            <div className="voice-ring" />
            <div className="voice-core">
              <Headphones size={34} strokeWidth={1} />
            </div>
            <div className="voice-wave">
              {Array.from({ length: 19 }, (_, i) => (
                <i
                  key={i}
                  style={{ animationDelay: `${i * 0.04}s`, height: `${10 + (i % 5) * 6}px` }}
                />
              ))}
            </div>
          </div>
          <h2>
            A voice. A location.
            <br />
            <span>A human decision.</span>
          </h2>
          <p className="voice-greeting" lang={language === 'hi-IN' ? 'hi' : 'en'}>
            {greeting}
          </p>
          <div className="response-language" aria-label="Intake language">
            {(
              [
                ['en-IN', 'English'],
                ['hi-IN', 'हिन्दी'],
                ['hinglish', 'Hinglish'],
              ] as const
            ).map(([id, name]) => (
              <button key={id} aria-pressed={language === id} onClick={() => changeLanguage(id)}>
                {language === id && (
                  <motion.i
                    layoutId="response-language"
                    transition={reduced ? { duration: 0 } : spring}
                  />
                )}
                <span>{name}</span>
              </button>
            ))}
          </div>
          <p className="eyebrow browser-voice-label">BROWSER VOICE / SEPARATE MICROPHONE DEMO</p>
          <label className="response-consent">
            <input
              type="checkbox"
              checked={voiceConsent}
              disabled={simulatedCallActive || sampleLoaded}
              onChange={(e) => {
                setVoiceConsent(e.target.checked);
                if (!e.target.checked) voice.stop();
              }}
            />
            <span>
              I consent to browser microphone transcription. Browser/vendor may process audio; AETHER
              stores no audio recording.
            </span>
          </label>
          <div className="voice-actions">
            <button
              className="button primary"
              disabled={
                simulatedCallActive || sampleLoaded || !voiceConsent || voice.state === 'listening'
              }
              onClick={voice.listen}
            >
              <Mic size={16} />
              Start microphone
            </button>
            <button
              className="icon-button"
              aria-label="Read welcome aloud"
              disabled={simulatedCallActive || sampleLoaded}
              onClick={() => voice.speak(greeting)}
            >
              <Volume2 size={18} />
            </button>
            <button className="icon-button" aria-label="Stop voice" onClick={voice.stop}>
              <PhoneOff size={18} />
            </button>
          </div>
          <p className="response-help">
            Hinglish uses the Hindi recognizer; mixed speech accuracy depends on your browser. Text
            always works.
          </p>
          {voice.interim && (
            <p className="voice-interim" aria-live="polite">
              {voice.interim}
            </p>
          )}
          {voice.error && (
            <p role="alert" className="response-error">
              {voice.error}
            </p>
          )}
          <div className="response-call-simulator">
            <span className="mono">PHONE CHANNEL / SIMULATED</span>
            <button
              className="text-button"
              disabled={busy || !sessionReady || !['idle', 'ended', 'error'].includes(call)}
              onClick={() => {
                voice.stop();
                setSampleLoaded(false);
                setCall('incoming');
              }}
            >
              Simulate incoming call <ArrowUpRight size={15} />
            </button>
            {call !== 'idle' && (
              <button
                className="text-button"
                onClick={() => {
                  voice.stop();
                  setCall('ended');
                }}
              >
                End demo call
              </button>
            )}
          </div>
          <AnimatePresence>
            {call === 'incoming' && (
              <motion.div
                className="incoming-call"
                initial={reduced ? false : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Phone size={21} />
                <div>
                  <strong>Incoming demo session</strong>
                  <small>No phone network or caller ID connected.</small>
                </div>
                <button
                  className="button primary"
                  disabled={busy || !sessionReady}
                  onClick={() => void acceptDemoCall()}
                >
                  Accept demo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {sampleLoaded && (
            <DemoConversation
              active={call === 'connected'}
              saved={sampleSaved}
              failed={sampleFailed}
            />
          )}
          {sampleLoaded && !simulatedCallActive && (
            <div className="response-call-simulator">
              <button className="button outline" disabled={busy} onClick={newBrowserReport}>
                Start separate browser report
              </button>
              <p className="response-help">
                Clears the example intake. Any saved sample stays in the queue.
              </p>
            </div>
          )}
        </section>
        <section className="response-transcript-panel">
          <header>
            <span className="eyebrow">01 / INCIDENT INTAKE</span>
            <span className="mono">EN / HI / MIXED</span>
          </header>
          <h3>Tell us what happened.</h3>
          <p>
            Use a natural sentence. Urgent reports can be submitted immediately; location and
            evidence are optional.
          </p>
          <label htmlFor="response-text">
            {simulatedCallActive || sampleLoaded
              ? 'Simulated caller statement (editable)'
              : 'Caller statement / live transcript'}
          </label>
          <textarea
            id="response-text"
            maxLength={2000}
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              language === 'hi-IN'
                ? 'क्या हुआ और कहाँ हुआ?'
                : 'Describe the incident, location and anything uncertain.'
            }
          />
          <div className="response-fields">
            <label>
              Incident location (optional)
              <input
                maxLength={160}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Caller-supplied place"
              />
            </label>
            <label>
              Nearby landmark (optional)
              <input
                maxLength={160}
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Known reference point"
              />
            </label>
          </div>
          <button className="text-button" onClick={locate}>
            <LocateFixed size={16} />
            Voluntarily share device location
          </button>
          {coordinates && (
            <p className="response-help">
              {coordinates[1].toFixed(5)} N, {coordinates[0].toFixed(5)} E · unverified{' '}
              <button className="text-button" onClick={() => setCoordinates(null)}>
                Remove
              </button>
            </p>
          )}
          <details className="response-callback">
            <summary>Optional callback, with consent</summary>
            <label className="response-consent">
              <input
                type="checkbox"
                checked={callbackConsent}
                onChange={(e) => {
                  setCallbackConsent(e.target.checked);
                  if (!e.target.checked) setCallback('');
                }}
              />
              <span>
                I consent to keeping my supplied callback with this demo report for 30 minutes.
              </span>
            </label>
            <label>
              Callback number
              <input
                type="tel"
                value={callback}
                disabled={!callbackConsent}
                maxLength={25}
                onChange={(e) => setCallback(e.target.value)}
              />
            </label>
          </details>
          <AnimatePresence>
            {extracted && (
              <motion.div
                className={`response-extraction ${extracted.urgency}`}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <header>
                  <strong>{extracted.category.toUpperCase()}</strong>
                  <span>{extracted.urgency === 'urgent' ? 'URGENT FLAG' : 'HUMAN REVIEW'}</span>
                </header>
                <p>
                  {extracted.location || 'Location unknown'} · {extracted.affected ?? 'Unknown'}{' '}
                  affected
                </p>
                <ul>
                  {extracted.uncertainties.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
                <small>
                  Keyword-based demo extraction. No confidence score or live AI inference.
                </small>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            className="button primary response-submit"
            disabled={busy || !sessionReady || text.trim().length < 3}
            onClick={() => void submit()}
          >
            Submit demo report <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
      {error && (
        <div className="response-error" role="alert">
          {error}
          <button className="text-button" onClick={() => void refresh()}>
            Refresh demo session
          </button>
        </div>
      )}
      {notice && (
        <p className="response-notice" role="status">
          <Check size={16} />
          {notice}
        </p>
      )}
      <section className="response-operator-access">
        <div>
          <ShieldCheck size={24} />
          <div>
            <h3>{operator ? 'Operator authenticated' : 'Human review requires operator access'}</h3>
            <p>
              Private server session. Reports expire after 30 minutes or server restart.{' '}
              {operator ? 'Review all local demo reports.' : 'Only your own reports are visible.'}
            </p>
          </div>
        </div>
        {operator ? (
          <div className="response-inline-actions">
            <button
              className="button outline"
              disabled={busy}
              onClick={() => void send({ type: 'seed' })}
            >
              Load simulated reports
            </button>
            <button
              className="button outline"
              disabled={busy}
              onClick={async () => {
                window.dispatchEvent(new Event('nexus:camera-signout'));
                await fetch('/api/response/cameras', { method: 'DELETE' }).catch(() => {});
                void send({ type: 'logout' });
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await send({ type: 'login', password });
              setPassword('');
            }}
          >
            <label className="sr-only" htmlFor="operator-password">
              Operator password
            </label>
            <input
              id="operator-password"
              type="password"
              autoComplete="current-password"
              placeholder="Local operator password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="button outline" disabled={busy || !sessionReady}>
              Sign in
            </button>
          </form>
        )}
      </section>
      <div className="response-review-grid">
        <section className="response-queue">
          <header>
            <span className="eyebrow">02 / HUMAN REVIEW QUEUE</span>
            <h3>Every report deserves context.</h3>
          </header>
          <p className="response-help">
            Urgent first. Incomplete evidence never means a report is discarded.
          </p>
          <div>
            {incidents.length ? (
              incidents.map((i) => (
                <motion.button
                  key={i.id}
                  className={`response-queue-item ${i.id === selected ? 'active' : ''}`}
                  aria-pressed={i.id === selected}
                  onClick={() => setSelected(i.id)}
                  initial={reduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className={`response-category ${i.urgency}`}>
                    <Radio size={17} />
                  </span>
                  <span>
                    <strong>
                      {i.category.toUpperCase()} / {i.id}
                    </strong>
                    <small>{i.location || 'Unknown location'}</small>
                    <small>
                      {stamp(i.reportedAt)} · {i.status}
                    </small>
                  </span>
                  <span className={i.urgency === 'urgent' ? 'response-urgent' : ''}>
                    {i.urgency === 'urgent' ? 'URGENT' : 'REVIEW'}
                  </span>
                </motion.button>
              ))
            ) : (
              <div className="response-empty">
                <Radio size={32} />
                <p>No reports in your session.</p>
                <span>Submit a statement or authenticate to load simulated incidents.</span>
              </div>
            )}
          </div>
        </section>
        <ResponseMap incidents={incidents} selected={selected} onSelect={setSelected} />
      </div>
      <AnimatePresence mode="wait">
        {current && (
          <motion.section
            key={current.id}
            className="response-detail"
            initial={reduced ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0 }}
            aria-label="Selected incident details"
          >
            <header>
              <div>
                <span className="eyebrow">
                  03 / {current.id} / VERSION {current.version}
                </span>
                <h2>
                  {current.category.toUpperCase()} <span>{current.status}</span>
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Delete selected demo report"
                disabled={busy}
                onClick={() => setConfirmation('delete')}
              >
                <Trash2 size={19} />
              </button>
            </header>
            <div className="response-detail-grid">
              <div>
                <h3>What was reported</h3>
                <p className="response-statement" lang={current.language === 'hi-IN' ? 'hi' : 'en'}>
                  {current.description}
                </p>
                <dl>
                  <dt>Where</dt>
                  <dd>
                    {current.location || 'Unknown'} {current.landmark && `/ ${current.landmark}`}
                  </dd>
                  <dt>Location verification</dt>
                  <dd>
                    {current.locationVerified
                      ? 'Human-confirmed coordinates'
                      : 'Unverified / caller-supplied'}
                  </dd>
                  <dt>Coordinates</dt>
                  <dd>{current.coordinates?.join(', ') || 'Not supplied'}</dd>
                  <dt>Affected people</dt>
                  <dd>{current.affected ?? 'Unknown'}</dd>
                  <dt>Reported at</dt>
                  <dd>{stamp(current.reportedAt)}</dd>
                  <dt>Occurred at</dt>
                  <dd>Caller statement only; exact time unconfirmed.</dd>
                  <dt>Callback</dt>
                  <dd>{current.callback || 'Not collected'}</dd>
                  <dt>Operator</dt>
                  <dd>{current.operator}</dd>
                  <dt>Assistance to consider</dt>
                  <dd>
                    {current.category === 'medical'
                      ? 'Qualified medical assistance'
                      : current.category === 'fire'
                        ? 'Qualified fire response'
                        : current.category === 'flood'
                          ? 'Qualified rescue / civic support'
                          : 'Qualified human assessment'}{' '}
                    / simulated
                  </dd>
                </dl>
                <h3>What remains uncertain</h3>
                <ul>
                  {current.uncertainties.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
              <div className="response-review-controls">
                <h3>Human decision, recorded.</h3>
                <p>
                  No external organization has been contacted. Referral events here are simulations.
                </p>
                <label>
                  Review / verification note
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={!operator || busy}
                  />
                </label>
                <div className="response-inline-actions">
                  {current.status !== 'CLOSED' && (
                    <button
                      className="button outline"
                      disabled={!operator || busy}
                      onClick={() => void review('assign')}
                    >
                      Assign to me
                    </button>
                  )}
                  {actions.map((action) => (
                    <button
                      key={action}
                      className={`button ${action === 'refer' ? 'primary' : 'outline'}`}
                      disabled={!operator || busy}
                      onClick={() =>
                        ['refer', 'verify', 'close'].includes(action)
                          ? setConfirmation(action)
                          : void review(action)
                      }
                    >
                      {action === 'refer'
                        ? 'Prepare simulated handoff'
                        : action === 'verify'
                          ? 'Verify report'
                          : action === 'unconfirmed'
                            ? 'Mark unconfirmed'
                            : action === 'close'
                              ? 'Close report'
                              : action === 'review'
                                ? 'Operator review'
                                : 'Start triage'}
                    </button>
                  ))}
                  {current.coordinates && current.status !== 'CLOSED' && (
                    <button
                      className="button outline"
                      disabled={!operator || busy}
                      onClick={() => void review('location-verify')}
                    >
                      Confirm supplied location
                    </button>
                  )}
                </div>
                <div className="response-evidence">
                  <span className="eyebrow">SUPPLEMENTARY / AETHER SKY</span>
                  <h3>Evidence: {current.evidence}</h3>
                  <p>
                    Evidence never gates an urgent handoff. No drone launch or flight control
                    connected.
                  </p>
                  <div className="response-inline-actions">
                    {(current.evidence === 'not requested'
                      ? ['evidence-request']
                      : current.evidence === 'requested'
                        ? ['evidence-pending', 'evidence-available', 'evidence-unavailable']
                        : current.evidence === 'pending'
                          ? ['evidence-available', 'evidence-unavailable']
                          : []
                    ).map((action) => (
                      <button
                        key={action}
                        className="button outline"
                        disabled={!operator || busy || current.status === 'CLOSED'}
                        onClick={() => void review(action as Review['action'])}
                      >
                        {action.replace('evidence-', '')} evidence
                      </button>
                    ))}
                  </div>
                  <Link
                    href={`/command/sky?incident=${encodeURIComponent(current.id)}`}
                    className="text-button"
                  >
                    Open linked SKY inspection <ArrowUpRight size={16} />
                  </Link>
                  {current.evidence === 'available' && (
                    <>
                      <EvidenceFrame
                        observation={
                          observations.find(
                            (o) =>
                              o.module ===
                              (current.category === 'fire'
                                ? 'fire'
                                : current.category === 'flood'
                                  ? 'aqua'
                                  : 'road'),
                          ) || observations[0]
                        }
                      />
                      <p>
                        Illustrative synthetic demo frame. Not captured at this caller’s location.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="response-audit">
              <h3>Human audit history</h3>
              <ol>
                {current.history.map((event, index) => (
                  <motion.li
                    key={`${event.at}-${index}`}
                    initial={reduced ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <i />
                    <time dateTime={event.at}>{stamp(event.at)}</time>
                    <span>
                      <strong>{event.actor}</strong>
                      {event.event}
                    </span>
                  </motion.li>
                ))}
              </ol>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <footer className="response-planned">
        <span className="mono">INBOUND TELEPHONY / NOT CONFIGURED</span>
        <p>
          Browser speech depends on your device. Phone events and outgoing handoffs are simulated.
          GEO routing, live traffic, hazard-aware navigation and organizational dispatch remain
          future milestones.
        </p>
      </footer>
      {confirmation && (
        <div className="dialog-backdrop">
          <div
            className="response-confirm"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="response-confirm-title"
          >
            <h2 id="response-confirm-title">
              {confirmation === 'delete'
                ? 'Delete this demo report?'
                : confirmation === 'refer'
                  ? 'Record simulated handoff?'
                  : `Confirm ${confirmation}?`}
            </h2>
            <p>
              {confirmation === 'delete'
                ? 'This removes the report, callback and history from demo memory.'
                : confirmation === 'refer'
                  ? 'No call or message will be sent. The record will show a simulated referral; external contact remains unconfirmed.'
                  : 'Your review note will be added to the human audit history.'}
            </p>
            <div className="response-inline-actions">
              <button className="button outline" onClick={closeConfirm}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  if (confirmation === 'delete' && current) {
                    const records = await send({
                      type: 'delete',
                      id: current.id,
                      version: current.version,
                    });
                    if (records) {
                      setSelected(null);
                      setNotice('Demo report deleted.');
                    }
                  } else if (confirmation !== 'delete') await review(confirmation);
                  closeConfirm();
                }}
              >
                Confirm {confirmation === 'refer' ? 'simulation' : confirmation}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export function LinkedResponseEvidence({ incidentId }: { incidentId?: string }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  useEffect(() => {
    if (!incidentId) return;
    const abort = new AbortController();
    fetch('/api/response', { cache: 'no-store', signal: abort.signal })
      .then((r) => r.json())
      .then((data) =>
        setIncident(data.incidents?.find((i: Incident) => i.id === incidentId) || null),
      )
      .catch(() => {});
    return () => abort.abort();
  }, [incidentId]);
  if (!incidentId) return null;
  return (
    <section className="response-sky-context">
      <span className="eyebrow">LINKED RESPONSE INCIDENT / DEMO</span>
      <h3>
        {incident
          ? `${incident.id} / ${incident.location || 'Unknown location'}`
          : 'Linked report unavailable or expired'}
      </h3>
      {incident && (
        <>
          <p>{incident.description}</p>
          <p>
            Evidence: {incident.evidence} · Coordinates:{' '}
            {incident.coordinates?.join(', ') || 'not supplied'}
          </p>
          {incident.evidence === 'available' && <EvidenceFrame observation={observations[0]} />}
        </>
      )}
      <p>
        Synthetic demonstration imagery only; not captured at caller location. No live drone launch.
        Evidence never delays escalation.
      </p>
      <Link
        href={
          incident
            ? `/command/response?incident=${encodeURIComponent(incident.id)}`
            : '/command/response'
        }
        className="text-button"
      >
        Return to source incident <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
