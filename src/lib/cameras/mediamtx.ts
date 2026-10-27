import type { ViewerCamera } from './registry';
export type StreamState = 'DEMO' | 'CONNECTING' | 'LIVE' | 'OFFLINE' | 'ERROR';
export interface PlaybackReport {
  needsPlay?: boolean;
  state: StreamState;
  message: string;
  resolution?: string;
  transport?: string;
}

// LIVE means decoded video frames, never merely a successful signaling response.
export async function playMediaMTX(
  video: HTMLVideoElement,
  camera: ViewerCamera,
  report: (value: PlaybackReport) => void,
  signal: AbortSignal,
) {
  let stopped = false,
    terminal = false,
    fallback = false,
    hasFrames = false,
    waitingPlay = false;
  let lastFrame = Date.now(),
    frameCallback: number | undefined,
    lastReport = '';
  let cleanupTransport = () => {};
  const notify = (value: PlaybackReport) => {
    const key = JSON.stringify(value);
    if (!stopped && !signal.aborted && key !== lastReport) {
      lastReport = key;
      report(value);
    }
  };
  const play = () => {
    void video.play().catch(() => {
      if (stopped || terminal || signal.aborted) return;
      waitingPlay = true;
      notify({
        state: 'CONNECTING',
        needsPlay: true,
        message: 'Use the video play control to start playback.',
      });
    });
  };
  const fail = () => {
    if (stopped || terminal || signal.aborted) return;
    cleanupTransport();
    video.srcObject = null;
    if (camera.hlsViewerUrl && !fallback) {
      fallback = true;
      void startHls(camera.hlsViewerUrl).catch(fail);
    } else {
      terminal = true;
      notify({
        state: 'OFFLINE',
        message: 'Stream interrupted or unavailable. Demonstration view retained.',
      });
    }
  };
  const frameReceived = () => {
    if (stopped || terminal || signal.aborted || !video.videoWidth || !video.videoHeight) return;
    lastFrame = Date.now();
    hasFrames = true;
    waitingPlay = false;
    notify({
      state: 'LIVE',
      message: 'Decoded video frames received.',
      resolution: `${video.videoWidth}x${video.videoHeight}`,
      transport: fallback ? 'HLS' : 'WebRTC',
    });
  };
  const frameLoop = () => {
    frameReceived();
    if (!stopped && !terminal) frameCallback = video.requestVideoFrameCallback(frameLoop);
  };
  const resumed = () => {
    lastFrame = Date.now();
    waitingPlay = false;
  };
  const watchdog = setInterval(() => {
    if (!waitingPlay && !(hasFrames && video.paused) && Date.now() - lastFrame > 12000) fail();
  }, 2000);
  const startHls = async (url: string) => {
    if (stopped || signal.aborted) return;
    lastFrame = Date.now();
    hasFrames = false;
    notify({
      state: 'CONNECTING',
      message: 'Connecting to approved HLS playback.',
      transport: 'HLS',
    });
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      cleanupTransport = () => {
        video.removeAttribute('src');
        video.load();
      };
    } else {
      const { default: Hls } = await import('hls.js');
      if (stopped || signal.aborted) return;
      if (!Hls.isSupported()) {
        terminal = true;
        notify({ state: 'ERROR', message: 'HLS unsupported in this browser.' });
        return;
      }
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      cleanupTransport = () => hls.destroy();
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) fail();
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    }
    play();
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(watchdog);
    if (frameCallback !== undefined) video.cancelVideoFrameCallback?.(frameCallback);
    signal.removeEventListener('abort', stop);
    video.removeEventListener('timeupdate', frameReceived);
    video.removeEventListener('error', fail);
    video.removeEventListener('play', resumed);
    cleanupTransport();
    video.pause();
    video.srcObject = null;
    video.removeAttribute('src');
    video.load();
  };
  signal.addEventListener('abort', stop, { once: true });
  video.addEventListener('error', fail);
  video.addEventListener('play', resumed);
  if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(frameLoop);
  else video.addEventListener('timeupdate', frameReceived);
  if (signal.aborted) {
    stop();
    return stop;
  }
  if (camera.viewerUrl.includes('transport=hls')) {
    fallback = true;
    try {
      await startHls(camera.viewerUrl);
    } catch {
      fail();
    }
    return stop;
  }
  let session: string | null = null,
    lease: ReturnType<typeof setInterval> | undefined;
  let peer: RTCPeerConnection | undefined,
    closed = false;
  const deleteSession = () => {
    if (session) {
      const url = session;
      session = null;
      void fetch(url, { method: 'DELETE', keepalive: true }).catch(() => {});
    }
  };
  cleanupTransport = () => {
    closed = true;
    clearInterval(lease);
    peer?.close();
    deleteSession();
  };
  try {
    notify({
      state: 'CONNECTING',
      message: 'Negotiating authorized WebRTC playback.',
      transport: 'WebRTC',
    });
    const p = (peer = new RTCPeerConnection());
    p.addTransceiver('video', { direction: 'recvonly' });
    p.addTransceiver('audio', { direction: 'recvonly' });
    p.ontrack = (event) => {
      if (!closed && !signal.aborted) {
        video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        play();
      }
    };
    p.onconnectionstatechange = () => {
      if (!closed && ['failed', 'disconnected'].includes(p.connectionState)) fail();
    };
    await p.setLocalDescription(await p.createOffer());
    await new Promise<void>((resolve) => {
      if (p.iceGatheringState === 'complete') return resolve();
      const timer = setTimeout(resolve, 3000);
      p.onicegatheringstatechange = () => {
        if (p.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      };
    });
    if (closed || signal.aborted) {
      stop();
      return stop;
    }
    const response = await fetch(camera.viewerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: p.localDescription!.sdp,
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    if (response.status !== 201) throw new Error('Playback unavailable');
    const location = response.headers.get('location');
    if (
      !location ||
      !/^\/api\/response\/cameras\/[A-Za-z0-9_-]+\/stream\?session=[a-f0-9-]+$/.test(location)
    )
      throw new Error('Invalid playback session');
    session = location;
    if (closed || signal.aborted) {
      deleteSession();
      stop();
      return stop;
    }
    await p.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    if (closed || signal.aborted) {
      deleteSession();
      return stop;
    }
    lease = setInterval(() => {
      if (session)
        void fetch(session, { method: 'PATCH' })
          .then((r) => {
            if (!r.ok) fail();
          })
          .catch(fail);
    }, 30000);
  } catch {
    if (signal.aborted) stop();
    else fail();
  }
  return stop;
}
