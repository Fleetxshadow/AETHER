import type { Connection, DataProvider, Feed } from './types';

export function createNexusProvider(): DataProvider {
  return {
    subscribe(listener) {
      let active = true;
      const feeds: Feed[] = [
        'devices',
        'telemetry',
        'cameraStatus',
        'aiDetections',
        'observations',
      ];

      const emit = (feed: Feed, connection: Connection, data?: unknown[]) => {
        if (active) listener({ feed, connection, data });
      };

      // Initial connecting announcement
      for (const f of feeds) {
        emit(f, 'connecting');
      }

      const poll = async () => {
        if (!active) return;
        try {
          const res = await fetch('/api/nexus/feeds', {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(3000),
          });

          if (!res.ok) {
            for (const f of feeds) emit(f, 'offline');
            return;
          }

          const data = await res.json();
          if (data && data.source === 'LIVE') {
            emit('devices', 'connected', Array.isArray(data.devices) ? data.devices : []);
            emit('telemetry', 'connected', Array.isArray(data.telemetry) ? data.telemetry : []);
            emit(
              'cameraStatus',
              'connected',
              Array.isArray(data.cameraStatus) ? data.cameraStatus : [],
            );
            emit(
              'aiDetections',
              'connected',
              Array.isArray(data.aiDetections) ? data.aiDetections : [],
            );
            emit(
              'observations',
              'connected',
              Array.isArray(data.observations) ? data.observations : [],
            );
          } else {
            for (const f of feeds) emit(f, 'offline');
          }
        } catch {
          if (active) {
            for (const f of feeds) emit(f, 'offline');
          }
        }
      };

      void poll();
      const timer = setInterval(() => {
        void poll();
      }, 3000);

      return () => {
        active = false;
        clearInterval(timer);
      };
    },
  };
}
