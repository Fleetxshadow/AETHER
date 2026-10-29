'use client';
import { useState } from 'react';
import { useNexus } from '@/lib/store';
import { readingTime } from '@/lib/data/hooks';
import { eventTime } from '@/lib/data/validators';
import { firebaseConfigured } from '@/lib/firebase/config';
import type { Workspace } from '@/lib/modules';
import type { Feed, LiveFeeds } from '@/lib/data/types';
export function DataSourcePanel({ module }: { module?: Workspace }) {
  const state = useNexus((s) => s.integration);
  const demoStatus = useNexus((s) => s.demoStatus);
  const rows = (Object.keys(state.lastKnown) as Feed[]).flatMap((feed) =>
    state.lastKnown[feed].map((row: LiveFeeds[Feed][number]) => ({ feed, row })),
  );
  const freshRows = new Set<LiveFeeds[Feed][number]>(Object.values(state.fresh).flat());
  return (
    <details className="data-source-panel" data-demo-status={demoStatus}>
      <summary>
        <span className="data-source-state" data-mode={state.mode}>
          {state.test ? 'CONTROLLED TEST · ' : ''}
          {state.message}
        </span>
        <span>Inspect sources</span>
      </summary>
      <div>
        <p>
          Unconnected panels retain labeled demo data. Recorded replay uses the bundled
          demonstration; live observations stay current.
        </p>
        {state.invalid > 0 && <p>{state.invalid} invalid records ignored.</p>}
        <p>
          {Object.entries(state.connections)
            .map(([feed, connection]) => `${feed}: ${connection}`)
            .join(' · ') || 'No protected subscriptions active.'}
        </p>
        {rows.length ? (
          <ul>
            {rows
              .filter(
                ({ row: r }) =>
                  !module ||
                  ['command', 'twin', 'settings', 'core', 'response'].includes(module) ||
                  !('module' in r) ||
                  r.module === module,
              )
              .slice(0, 50)
              .map(({ feed, row: r }, i) => (
                <li key={i}>
                  <strong>{'cameraId' in r ? r.cameraId : 'id' in r ? r.id : r.deviceId}</strong>
                  <span>
                    {'value' in r
                      ? `${r.value} ${r.unit}`
                      : 'title' in r
                        ? r.title
                        : 'description' in r
                          ? r.description
                          : 'status' in r
                            ? `Device report: ${r.status}`
                            : `Device camera report: ${r.online ? 'online' : 'offline'}`}
                  </span>
                  <time>{readingTime(new Date(eventTime(r)).toISOString())}</time>
                  <span>
                    {freshRows.has(r)
                      ? 'CURRENT REPORT'
                      : 'UNAVAILABLE / STALE · last known report'}{' '}
                    · {feed}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p>No operational readings received. No sensor or camera is claimed online.</p>
        )}
      </div>
    </details>
  );
}
export function LiveModuleData({ module }: { module: Workspace }) {
  const state = useNexus((s) => s.integration);
  const readings = state.fresh.telemetry.filter(
    (r) => ['command', 'twin', 'core'].includes(module) || r.module === module,
  );
  const ai = module === 'core' ? state.fresh.aiDetections : [];
  const incidents =
    ['response', 'rescue', 'command'].includes(module) && state.role === 'operator'
      ? [
          ...state.fresh.incidents.map((row) => ({ feed: 'incidents', row })),
          ...(module === 'rescue'
            ? []
            : state.fresh.responseReports.map((row) => ({ feed: 'responseReports', row }))),
        ]
      : [];
  if (!readings.length && !ai.length && !incidents.length) return null;
  return (
    <section className="live-module-data" aria-label="Verified operational feed">
      <p className="eyebrow">
        {state.test ? 'CONTROLLED TEST FEED' : 'LIVE DATA'} · REPORTED VALUES
      </p>
      <div className="sensor-strip">
        {readings.map((r) => (
          <div key={`${r.deviceId}:${r.channel}`}>
            <span>{r.channel}</span>
            <strong>
              {r.value} <small>{r.unit}</small>
            </strong>
            <small>
              {r.deviceId} · {readingTime(r.observedAt)}
            </small>
          </div>
        ))}
      </div>
      {ai.map((r) => (
        <article key={r.id}>
          <strong>
            {r.category} · {r.confidence}% reported confidence
          </strong>
          <p>{r.description}</p>
          <small>
            {r.deviceId} · {readingTime(r.observedAt)} · sources{' '}
            {r.observationIds.join(', ') || 'none supplied'}
          </small>
        </article>
      ))}
      {incidents.map(({ feed, row: r }) => (
        <article key={`${feed}:${r.id}`}>
          <strong>
            {r.category} · {r.status}
          </strong>
          <p>{r.description}</p>
          <small>
            {r.location} · {readingTime(r.reportedAt)} ·{' '}
            {r.externalContactConfirmed
              ? 'External contact recorded by source'
              : 'No external contact confirmed'}
          </small>
        </article>
      ))}
    </section>
  );
}
export function FirebaseAccess() {
  const state = useNexus((s) => s.integration);
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="firebase-access">
      <h2>Protected device access</h2>
      <p>
        {firebaseConfigured
          ? 'Sign in with your provisioned AETHER account. Site permissions are checked before subscribing.'
          : 'No device backend configured. Demonstration remains available.'}
      </p>
      {firebaseConfigured && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await (await import('@/lib/firebase/client')).signIn(email, password);
              setPassword('');
              setMessage('Sign-in completed. Access depends on assigned site permissions.');
            } catch {
              setMessage(
                'Sign-in unavailable. Check account access or connection; demo remains available.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="button outline" disabled={busy}>
            Sign in to device feeds
          </button>
          <button
            type="button"
            className="button outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await (await import('@/lib/firebase/client')).signOut();
                setMessage('Device feeds signed out.');
              } catch {
                setMessage('Sign-out could not complete. Retry to revoke device access.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out device feeds
          </button>
        </form>
      )}
      <p role="status">{message || `Device access: ${state.role || 'not authorized'}`}</p>
    </section>
  );
}
