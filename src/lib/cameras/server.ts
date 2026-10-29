import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getNexusAdmin } from '../firebase/admin';
import { siteId } from '../firebase/config';
import { ResponseError, sessionFor } from '../response-server';
import { validateCameraInput, type CameraMetadata, type ViewerCamera } from './registry';
interface Access {
  principal: string;
  operator: boolean;
  expires: number;
}
interface PlaybackSession {
  cameraId: string;
  url: string;
  principal: string;
  expires: number;
}
const root = globalThis as typeof globalThis & {
  nexusCameraState?: {
    cameras: Map<string, CameraMetadata>;
    access: Map<string, Access>;
    playback: Map<string, PlaybackSession>;
  };
};
const state = (root.nexusCameraState ??= {
  cameras: new Map(),
  access: new Map(),
  playback: new Map(),
});
export function approvedCameraOrigins() {
  return (process.env.NEXUS_CAMERA_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new URL(s).origin);
}
function parseCamera(raw: unknown) {
  try {
    return validateCameraInput(
      raw,
      approvedCameraOrigins(),
      process.env.NODE_ENV === 'development' &&
        process.env.NEXUS_CAMERA_ALLOW_LOCAL_HTTP === 'true',
    );
  } catch {
    throw new ResponseError(
      'Invalid camera configuration. Use an approved, read-only stream URL without credentials.',
      400,
    );
  }
}
function prune() {
  const now = Date.now();
  for (const [id, v] of state.access) if (v.expires < now) state.access.delete(id);
}
export async function cameraAccess(request: NextRequest): Promise<Access | null> {
  prune();
  const local = sessionFor(request);
  if (local?.operator)
    return { principal: local.principal, operator: true, expires: local.expires };
  const bearer = request.headers.get('authorization');
  if (bearer) {
    const admin = getNexusAdmin();
    if (!admin) throw new ResponseError('Protected Firebase camera access is not configured.', 503);
    const token = await admin.auth
      .verifyIdToken(bearer.replace(/^Bearer /, ''), true)
      .catch(() => null);
    if (!token || token.nexusSite !== siteId || !['viewer', 'operator'].includes(token.nexusRole))
      throw new ResponseError('Camera authorization rejected.', 403);
    return {
      principal: token.uid,
      operator: token.nexusRole === 'operator',
      expires: Math.min(token.exp * 1000, Date.now() + 10 * 60000),
    };
  }
  const cookie = request.cookies.get('nexus-camera-session')?.value;
  return cookie ? state.access.get(cookie) || null : null;
}
export function setCameraCookie(response: NextResponse, access: Access, request: NextRequest) {
  if (state.access.size > 1000) throw new ResponseError('Camera session capacity reached.', 503);
  const token = randomBytes(32).toString('hex');
  state.access.set(token, access);
  response.cookies.set('nexus-camera-session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: request.nextUrl.protocol === 'https:',
    path: '/api/response/cameras',
    maxAge: Math.max(1, Math.floor((access.expires - Date.now()) / 1000)),
  });
}
export async function clearCameraCookie(response: NextResponse, request: NextRequest) {
  const token = request.cookies.get('nexus-camera-session')?.value;
  const principal =
    (token ? state.access.get(token)?.principal : undefined) || sessionFor(request)?.principal;
  if (token) state.access.delete(token);
  if (principal) {
    for (const [key, value] of state.access)
      if (value.principal === principal) state.access.delete(key);
    await Promise.all(
      [...state.playback]
        .filter(([, value]) => value.principal === principal)
        .map(async ([key, value]) => {
          state.playback.delete(key);
          await fetch(value.url, {
            method: 'DELETE',
            headers: providerHeaders(),
            redirect: 'error',
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
        }),
    );
  }
  response.cookies.set('nexus-camera-session', '', {
    path: '/api/response/cameras',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 0,
  });
}
export async function cameraList(): Promise<CameraMetadata[]> {
  const cameras = new Map(state.cameras);
  const admin = getNexusAdmin();
  if (admin) {
    const snapshot = await admin.firestore
      .collection('cameraMetadata')
      .where('siteId', '==', siteId)
      .limit(50)
      .get();
    for (const doc of snapshot.docs) {
      const raw = doc.data();
      try {
        const { siteId: site, updatedAt, source, ...input } = raw;
        if (
          site !== siteId ||
          source !== 'CONFIGURATION' ||
          raw.id !== doc.id ||
          typeof updatedAt !== 'string' ||
          !Number.isFinite(Date.parse(updatedAt))
        )
          continue;
        const valid = parseCamera(input);
        cameras.set(doc.id, { ...valid, siteId: site, updatedAt, source });
      } catch {
        /* Invalid cloud camera configuration is never embedded. */
      }
    }
  }
  return [...cameras.values()].slice(0, 50);
}
export async function saveCamera(raw: unknown) {
  const input = parseCamera(raw);
  if (state.cameras.size >= 50 && !state.cameras.has(input.id))
    throw new ResponseError('Camera registry capacity reached.', 409);
  const record: CameraMetadata = {
    ...input,
    siteId,
    source: 'CONFIGURATION',
    updatedAt: new Date().toISOString(),
  };
  const admin = getNexusAdmin();
  if (admin)
    await admin.firestore.runTransaction(async (transaction) => {
      const ref = admin.firestore.collection('cameraMetadata').doc(record.id);
      const existing = await transaction.get(ref);
      if (existing.exists && existing.data()?.siteId !== siteId)
        throw new ResponseError('Camera ID belongs to another site. Choose a unique ID.', 409);
      transaction.set(ref, record);
    });
  state.cameras.set(record.id, record);
  return { record, storage: admin ? 'firestore' : 'local-memory' };
}
export function viewerCamera(camera: CameraMetadata): ViewerCamera {
  const base = `/api/response/cameras/${camera.id}/stream`;
  return {
    id: camera.id,
    deviceId: camera.deviceId,
    name: camera.name,
    provider: camera.provider,
    development: camera.development,
    updatedAt: camera.updatedAt,
    viewerUrl:
      camera.provider === 'vdo-ninja'
        ? camera.url
        : `${base}?transport=${camera.url.endsWith('.m3u8') ? 'hls' : 'webrtc'}`,
    hlsViewerUrl: camera.hlsUrl ? `${base}?transport=hls` : undefined,
  };
}
export function providerHeaders(): Record<string, string> {
  const token = process.env.NEXUS_MEDIAMTX_BEARER_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export function rememberPlayback(cameraId: string, url: string, access: Access) {
  if (state.playback.size >= 200) throw new ResponseError('Playback capacity reached.', 503);
  const id = randomUUID();
  state.playback.set(id, {
    cameraId,
    url,
    principal: access.principal,
    expires: Math.min(access.expires, Date.now() + 120000),
  });
  const expire = () => {
    const entry = state.playback.get(id);
    if (!entry) return;
    if (entry.expires > Date.now()) {
      setTimeout(expire, entry.expires - Date.now() + 100).unref();
      return;
    }
    state.playback.delete(id);
    void fetch(entry.url, {
      method: 'DELETE',
      headers: providerHeaders(),
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  };
  setTimeout(expire, 120100).unref();
  return id;
}
export function takePlayback(id: string, cameraId: string, access: Access) {
  const value = state.playback.get(id);
  if (!value || value.cameraId !== cameraId || value.principal !== access.principal) return null;
  state.playback.delete(id);
  return value;
}
export function renewPlayback(id: string, cameraId: string, access: Access) {
  const value = state.playback.get(id);
  if (
    !value ||
    value.cameraId !== cameraId ||
    value.principal !== access.principal ||
    value.expires < Date.now()
  )
    return false;
  value.expires = Math.min(access.expires, Date.now() + 120000);
  return true;
}
