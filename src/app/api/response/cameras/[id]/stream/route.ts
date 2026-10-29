import { NextRequest, NextResponse } from 'next/server';
import {
  cameraAccess,
  cameraList,
  providerHeaders,
  rememberPlayback,
  takePlayback,
  renewPlayback,
} from '@/lib/cameras/server';
import { boundedBody, rateLimit, ResponseError, sameOrigin } from '@/lib/response-server';
type Context = { params: Promise<{ id: string }> };
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
async function boundedText(response: Response, maximum: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new ResponseError('Empty media response.', 502);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) {
      await reader.cancel();
      throw new ResponseError('Media response exceeds size limit.', 502);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function source(request: NextRequest, context: Context) {
  const access = await cameraAccess(request);
  if (!access) throw new ResponseError('Authorized camera access required.', 403);
  const { id } = await context.params;
  const camera = (await cameraList()).find((c) => c.id === id && c.provider === 'mediamtx');
  if (!camera) throw new ResponseError('Approved MediaMTX camera not found.', 404);
  return { access, camera };
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof ResponseError
          ? error.message
          : 'Camera stream unavailable. Demonstration remains available.',
    },
    { status: error instanceof ResponseError ? error.status : 502, headers: privateHeaders },
  );
}
export async function POST(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const { access, camera } = await source(request, context);
    rateLimit(`camera-signal:${access.principal}`, 40);
    if (!camera.url.endsWith('/whep'))
      throw new ResponseError('Camera is configured for HLS playback.', 400);
    const sdp = await boundedBody(request);
    if (!sdp.startsWith('v=0') || sdp.includes('\0'))
      throw new ResponseError('Valid SDP offer required.', 400);
    const upstream = await fetch(camera.url, {
      method: 'POST',
      headers: { ...providerHeaders(), 'Content-Type': 'application/sdp' },
      body: sdp,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (upstream.status !== 201)
      throw new ResponseError('Media server rejected playback or has no stream.', 502);
    const target = new URL(upstream.headers.get('location') || '', camera.url),
      base = new URL(camera.url);
    if (
      target.origin !== base.origin ||
      !target.pathname.startsWith(base.pathname + '/') ||
      target.username ||
      target.password ||
      target.search ||
      target.hash
    )
      throw new ResponseError('Unexpected media session location.', 502);
    try {
      const answer = await boundedText(upstream, 64000);
      if (!answer.startsWith('v=0')) throw new ResponseError('Invalid media answer.', 502);
      const session = rememberPlayback(camera.id, target.href, access);
      return new Response(answer, {
        status: 201,
        headers: {
          ...privateHeaders,
          'Content-Type': 'application/sdp',
          Location: `/api/response/cameras/${camera.id}/stream?session=${session}`,
        },
      });
    } catch (error) {
      await fetch(target, {
        method: 'DELETE',
        headers: providerHeaders(),
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
      throw error;
    }
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const { access, camera } = await source(request, context);
    rateLimit(`camera-lease:${access.principal}`, 120);
    if (!renewPlayback(request.nextUrl.searchParams.get('session') || '', camera.id, access))
      throw new ResponseError('Playback lease expired.', 410);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const { access, camera } = await source(request, context);
    const session = takePlayback(
      request.nextUrl.searchParams.get('session') || '',
      camera.id,
      access,
    );
    if (session)
      await fetch(session.url, {
        method: 'DELETE',
        headers: providerHeaders(),
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const { access, camera } = await source(request, context);
    rateLimit(`camera-hls:${access.principal}`, 1200);
    const main = camera.hlsUrl || (camera.url.endsWith('.m3u8') ? camera.url : null);
    if (!main) throw new ResponseError('No approved HLS fallback.', 404);
    const base = new URL(main),
      resource = request.nextUrl.searchParams.get('resource'),
      target = new URL(resource || main, base);
    const prefix = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
    if (
      target.origin !== base.origin ||
      !target.pathname.startsWith(prefix) ||
      target.search ||
      target.hash ||
      target.username ||
      target.password ||
      /%2f|%5c|%2e/i.test(target.pathname)
    )
      throw new ResponseError('HLS resource outside approved stream.', 403);
    const range = request.headers.get('range');
    if (range && !/^bytes=\d*-\d*$/.test(range))
      throw new ResponseError('Invalid byte range.', 400);
    const upstream = await fetch(target, {
      headers: { ...providerHeaders(), ...(range ? { Range: range } : {}) },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) throw new ResponseError('HLS stream unavailable.', 502);
    const type = upstream.headers.get('content-type') || 'application/octet-stream';
    if (target.pathname.endsWith('.m3u8')) {
      const text = await boundedText(upstream, 256000);
      if (text.length > 256000 || !text.startsWith('#EXTM3U'))
        throw new ResponseError('Invalid HLS playlist.', 502);
      const rewrite = (uri: string) => {
        const url = new URL(uri, target);
        if (
          url.origin !== base.origin ||
          !url.pathname.startsWith(prefix) ||
          url.search ||
          url.hash
        )
          throw new ResponseError('HLS playlist points outside approved stream.', 502);
        return `/api/response/cameras/${camera.id}/stream?transport=hls&resource=${encodeURIComponent(url.pathname)}`;
      };
      const playlist = text
        .split('\n')
        .map((line) =>
          line.startsWith('#')
            ? line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${rewrite(uri)}"`)
            : line.trim()
              ? rewrite(line.trim())
              : line,
        )
        .join('\n');
      return new Response(playlist, {
        headers: { ...privateHeaders, 'Content-Type': 'application/vnd.apple.mpegurl' },
      });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...privateHeaders,
        'Content-Type': type,
        ...(upstream.headers.get('content-range')
          ? { 'Content-Range': upstream.headers.get('content-range')! }
          : {}),
        ...(upstream.headers.get('accept-ranges')
          ? { 'Accept-Ranges': upstream.headers.get('accept-ranges')! }
          : {}),
      },
    });
  } catch (error) {
    return failure(error);
  }
}
