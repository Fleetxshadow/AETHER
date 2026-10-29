import { z } from 'zod';
import { safeId } from '../data/validators';
export const cameraInputSchema = z
  .object({
    id: safeId,
    deviceId: safeId,
    name: z.string().min(1).max(100),
    provider: z.enum(['vdo-ninja', 'mediamtx']),
    url: z.string().max(500),
    hlsUrl: z.string().max(500).optional(),
    development: z.boolean().default(false),
  })
  .strict();
export type CameraInput = z.infer<typeof cameraInputSchema>;
export type CameraMetadata = CameraInput & {
  siteId: string;
  updatedAt: string;
  source: 'CONFIGURATION';
};
export interface ViewerCamera {
  id: string;
  deviceId: string;
  name: string;
  provider: CameraInput['provider'];
  development: boolean;
  updatedAt: string;
  viewerUrl: string;
  hlsViewerUrl?: string;
}
export function localAddress(host: string) {
  return (
    ['localhost', '127.0.0.1', '[::1]'].includes(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)
  );
}
export function validateCameraInput(
  raw: unknown,
  approvedOrigins: readonly string[],
  allowLocalHttp = false,
): CameraInput {
  const camera = cameraInputSchema.parse(raw);
  const validate = (value: string, hls = false) => {
    const url = new URL(value);
    if (url.username || url.password || url.hash || /%2f|%5c|%2e/i.test(url.pathname))
      throw new Error('Credentials, fragments and encoded paths are not allowed.');
    if (
      url.protocol !== 'https:' &&
      !(allowLocalHttp && url.protocol === 'http:' && localAddress(url.hostname))
    )
      throw new Error('HTTPS required except explicitly approved local development streams.');
    if (camera.provider === 'vdo-ninja') {
      if (
        url.origin !== 'https://vdo.ninja' ||
        url.pathname !== '/' ||
        !url.searchParams.has('view')
      )
        throw new Error('A VDO.Ninja VIEW URL is required.');
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(url.searchParams.get('view') || ''))
        throw new Error('Invalid view identifier.');
      for (const key of url.searchParams.keys())
        if (!['view', 'cleanoutput', 'autoplay', 'mute', 'noaudio', 'codec'].includes(key))
          throw new Error('Publishing keys and unsupported viewer parameters are forbidden.');
      for (const key of url.searchParams.keys())
        if (url.searchParams.getAll(key).length !== 1)
          throw new Error('Duplicate viewer parameters are forbidden.');
      url.searchParams.set('cleanoutput', '');
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('mute', '1');
    } else {
      if (!approvedOrigins.includes(url.origin) || url.search)
        throw new Error(
          'Media server origin must be approved; URL credentials/query tokens are forbidden.',
        );
      if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/(whep|index\.m3u8)$/.test(url.pathname))
        throw new Error('Expected a read-only WHEP or HLS endpoint.');
      if (hls && !url.pathname.endsWith('/index.m3u8'))
        throw new Error('HLS fallback must use index.m3u8.');
    }
    return url.href;
  };
  camera.url = validate(camera.url);
  if (camera.hlsUrl) {
    if (camera.provider !== 'mediamtx')
      throw new Error('HLS fallback is only supported for MediaMTX.');
    camera.hlsUrl = validate(camera.hlsUrl, true);
  }
  return camera;
}
export function vdoConnectionEvent(
  data: unknown,
  streamId: string,
): 'connected' | 'disconnected' | null {
  if (!data || typeof data !== 'object') return null;
  const event = data as Record<string, unknown>;
  if (event.streamID !== streamId) return null;
  return event.action === 'view-connection' && event.value === true
    ? 'connected'
    : (event.action === 'view-connection' || event.action === 'push-connection') &&
        event.value === false
      ? 'disconnected'
      : null;
}
