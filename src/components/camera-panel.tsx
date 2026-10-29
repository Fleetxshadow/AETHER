'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Maximize2, Radio, RefreshCw } from 'lucide-react';
import { useNexus } from '@/lib/store';
import { observations } from '@/lib/data';
import { readingTime } from '@/lib/data/hooks';
import { vdoConnectionEvent, type ViewerCamera } from '@/lib/cameras/registry';
import { playMediaMTX, type PlaybackReport } from '@/lib/cameras/mediamtx';
import { EvidenceFrame } from './replay';

const demo: PlaybackReport = {
  state: 'DEMO',
  message: 'No live camera connected — demonstration view',
};
export function CameraPanel() {
  const role = useNexus((s) => s.integration.role);
  const health = useNexus((s) => s.integration.fresh.cameraStatus);
  const [cameras, setCameras] = useState<ViewerCamera[]>([]);
  const [authorized, setAuthorized] = useState(false),
    [canManage, setCanManage] = useState(false);
  const [selected, setSelected] = useState(''),
    [open, setOpen] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [report, setReport] = useState<PlaybackReport>(demo),
    [lastConnection, setLastConnection] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null),
    video = useRef<HTMLVideoElement>(null),
    viewer = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const camera = cameras.find((c) => c.id === selected);
  const deviceReport = health.find((c) => c.cameraId === selected);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    try {
      const token = await (await import('@/lib/firebase/client')).getFirebaseToken();
      const response = await fetch('/api/response/cameras', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (current !== generation.current) return;
      if (!response.ok) throw new Error('Registry unavailable');
      setAuthorized(data.authorized === true);
      setCanManage(data.canManage === true);
      setCameras(data.cameras || []);
      setSelected((previous) =>
        data.cameras?.some((c: ViewerCamera) => c.id === previous)
          ? previous
          : data.cameras?.[0]?.id || '',
      );
      setMessage(
        data.authorized
          ? 'Approved camera registry loaded.'
          : 'Protected registry: sign in with device access or the local RESPONSE operator account, then refresh.',
      );
    } catch {
      if (current === generation.current) {
        setCameras([]);
        setAuthorized(false);
        setCanManage(false);
        setOpen(false);
        setMessage('Camera registry unavailable. Demonstration remains available.');
      }
    }
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return reload();
    });
    const invalidate = () => {
      generation.current++;
    };
    const signout = () => {
      generation.current++;
      setOpen(false);
      setCameras([]);
      setAuthorized(false);
      setCanManage(false);
      setReport(demo);
      setLastConnection({});
    };
    window.addEventListener('nexus:camera-signout', signout);
    return () => {
      active = false;
      invalidate();
      window.removeEventListener('nexus:camera-signout', signout);
    };
  }, [role, reload]);
  useEffect(() => {
    if (!open || !camera) return;
    const abort = new AbortController();
    let lastState = '';
    const notify = (value: PlaybackReport) => {
      if (abort.signal.aborted) return;
      if (value.state === 'LIVE' && lastState !== 'LIVE')
        setLastConnection((previous) => ({ ...previous, [camera.id]: new Date().toISOString() }));
      lastState = value.state;
      setReport(value);
    };
    queueMicrotask(() =>
      notify({
        state: 'CONNECTING',
        message: 'Opening authorized viewer. A configured URL is not evidence of a live stream.',
      }),
    );
    if (camera.provider === 'mediamtx' && video.current) {
      void playMediaMTX(video.current, camera, notify, abort.signal).catch(() =>
        notify({
          state: 'ERROR',
          message: 'Playback could not start. Demonstration remains available.',
        }),
      );
      return () => abort.abort();
    }
    const url = new URL(camera.viewerUrl);
    if (url.origin !== 'https://vdo.ninja' || !url.searchParams.get('view')) {
      notify({ state: 'ERROR', message: 'Approved VDO.Ninja VIEW URL required.' });
      return () => abort.abort();
    }
    const listener = (event: MessageEvent) => {
      if (event.origin !== url.origin || event.source !== frame.current?.contentWindow) return;
      const connection = vdoConnectionEvent(event.data, url.searchParams.get('view')!);
      if (!connection) return;
      clearTimeout(timeout);
      notify(
        connection === 'connected'
          ? {
              state: 'LIVE',
              message:
                'VDO.Ninja reports a connected viewer peer. Frame delivery is not independently measured.',
              transport: 'VDO.Ninja',
            }
          : {
              state: 'OFFLINE',
              message: 'VDO.Ninja reports a disconnected stream. Demonstration view retained.',
            },
      );
    };
    window.addEventListener('message', listener);
    const timeout = setTimeout(
      () =>
        notify({
          state: 'OFFLINE',
          message: 'No provider connection received. Check the publisher and retry.',
        }),
      20000,
    );
    return () => {
      abort.abort();
      clearTimeout(timeout);
      window.removeEventListener('message', listener);
    };
  }, [open, camera, attempt]);
  const close = () => {
    setOpen(false);
    setReport(demo);
  };
  return (
    <section className="camera-panel" aria-labelledby="camera-title">
      <div className="panel-heading">
        <h2 id="camera-title">
          <Radio size={18} /> SKY camera viewer
        </h2>
        <span className="tag">{report.state}</span>
      </div>
      <div className="camera-toolbar">
        <label>
          Camera selector
          <select
            value={selected}
            disabled={!cameras.length}
            onChange={(e) => {
              close();
              setSelected(e.target.value);
            }}
          >
            <option value="" disabled>
              No approved camera selected
            </option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} / {c.id}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button outline"
          disabled={!camera || !authorized}
          onClick={() => {
            setOpen(true);
            setAttempt((n) => n + 1);
          }}
        >
          {open ? 'Retry camera' : 'Open camera'}
        </button>
        <button className="button outline" disabled={!open} onClick={close}>
          Close camera
        </button>
        <button
          className="icon-button"
          aria-label="Fullscreen camera viewer"
          onClick={() => {
            void viewer.current
              ?.requestFullscreen?.()
              .catch(() => setMessage('Fullscreen unavailable in this browser.'));
          }}
        >
          <Maximize2 size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Refresh camera registry"
          onClick={() => void reload()}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <p className="camera-status" role="status">
        {camera?.development && open ? 'DEVELOPMENT STREAM · ' : ''}
        {report.state} · {report.message}
      </p>
      {report.needsPlay && (
        <button
          className="button outline"
          onClick={() => {
            if (video.current) {
              video.current.muted = true;
              void video.current
                .play()
                .catch(() =>
                  setMessage('Playback could not start. Check the publisher and retry.'),
                );
            }
          }}
        >
          Play camera video
        </button>
      )}
      <div className="camera-viewer" ref={viewer}>
        {open && camera?.provider === 'vdo-ninja' && (
          <iframe
            ref={frame}
            src={camera.viewerUrl}
            title={`Authorized camera ${camera.name}`}
            allow="autoplay; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        )}
        {open && camera?.provider === 'mediamtx' && (
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            controls
            aria-label={`Authorized camera ${camera.name}`}
          />
        )}
        {(!open || report.state === 'OFFLINE' || report.state === 'ERROR') && (
          <div className="camera-fallback">
            <EvidenceFrame observation={observations[0]} />
            <strong>No live camera connected — demonstration view</strong>
            <p>Synthetic context illustration. No camera footage received in this view.</p>
          </div>
        )}
      </div>
      <dl className="camera-info">
        <div>
          <dt>Camera / device</dt>
          <dd>{camera ? `${camera.id} / ${camera.deviceId}` : 'Not configured'}</dd>
        </div>
        <div>
          <dt>Source / transport</dt>
          <dd>
            {camera ? `${camera.provider}${camera.development ? ' / DEVELOPMENT' : ''}` : 'DEMO'}
            {report.transport ? ` / ${report.transport}` : ''}
          </dd>
        </div>
        <div>
          <dt>Last viewer connection</dt>
          <dd>
            {lastConnection[selected]
              ? readingTime(lastConnection[selected])
              : 'Not established in this session'}
          </dd>
        </div>
        <div>
          <dt>Device health report</dt>
          <dd>
            {deviceReport
              ? `${deviceReport.online ? 'Reported online' : 'Reported offline'} · ${readingTime(deviceReport.lastSeen)}`
              : 'No fresh device health report'}
          </dd>
        </div>
        <div>
          <dt>Resolution</dt>
          <dd>
            {report.state === 'LIVE' && report.resolution
              ? `${report.resolution} / decoded video`
              : 'Not independently measured'}
          </dd>
        </div>
        <div>
          <dt>Reported device format</dt>
          <dd>
            {deviceReport?.resolution
              ? `${deviceReport.resolution}${deviceReport.fps ? ` / ${deviceReport.fps} fps` : ''} · device metadata only`
              : 'Not reported'}
          </dd>
        </div>
      </dl>
      <p className="data-note">
        Firebase stores metadata; the video provider carries media. VDO.Ninja connection status is
        provider-reported. Device health alone never marks this viewer LIVE.
      </p>
      <p role="status">{message}</p>
      {!authorized && (
        <p>
          <Link className="text-button" href="/command/settings">
            Device access settings
          </Link>{' '}
          ·{' '}
          <Link className="text-button" href="/command/response">
            RESPONSE operator sign-in
          </Link>
        </p>
      )}
      {canManage && (
        <details className="camera-admin">
          <summary>Register an approved camera</summary>
          <p>
            Local registry is in memory unless server-side Firebase administration is explicitly
            configured. Enter a read-only viewer URL; never paste a publishing key.
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              const form = event.currentTarget,
                data = new FormData(form);
              const input = {
                id: String(data.get('id')),
                deviceId: String(data.get('deviceId')),
                name: String(data.get('name')),
                provider: String(data.get('provider')),
                url: String(data.get('url')),
                development: data.get('development') === 'on',
                ...(data.get('hlsUrl') ? { hlsUrl: String(data.get('hlsUrl')) } : {}),
              };
              try {
                const token = await (await import('@/lib/firebase/client')).getFirebaseToken();
                const response = await fetch('/api/response/cameras', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify(input),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Registration rejected');
                form.reset();
                await reload();
                setMessage(
                  `Camera registered. Storage: ${result.storage}. Open viewer to check actual connectivity.`,
                );
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : 'Camera registration unavailable.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Camera ID
              <input name="id" pattern="[A-Za-z0-9_-]{1,80}" maxLength={80} required />
            </label>
            <label>
              Device ID
              <input name="deviceId" pattern="[A-Za-z0-9_-]{1,80}" maxLength={80} required />
            </label>
            <label>
              Camera name
              <input name="name" maxLength={100} required />
            </label>
            <label>
              Provider
              <select name="provider">
                <option value="vdo-ninja">VDO.Ninja VIEW</option>
                <option value="mediamtx">MediaMTX</option>
              </select>
            </label>
            <label>
              Read-only stream URL
              <input name="url" type="url" maxLength={500} required />
            </label>
            <label>
              Optional HLS fallback
              <input name="hlsUrl" type="url" maxLength={500} />
            </label>
            <label className="camera-checkbox">
              <input name="development" type="checkbox" defaultChecked /> Development/test footage
            </label>
            <button className="button outline" disabled={busy}>
              {busy ? 'Registering…' : 'Register camera'}
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
