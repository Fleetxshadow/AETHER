import { onValue, ref, query as realtimeQuery, limitToLast } from 'firebase/database';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { getFirebaseClient } from '../firebase/client';
import type { Connection, DataProvider, Feed } from './types';

export function createFirebaseProvider(siteId: string, operator: boolean): DataProvider {
  return {
    subscribe(listener) {
      const client = getFirebaseClient();
      if (!client) return () => {};
      let active = true,
        online = false;
      const cleanup: (() => void)[] = [];
      const ready = new Set<Feed>(),
        failed = new Set<Feed>();
      const cached = new Map<Feed, unknown[]>();
      const realtimeFeeds = ['devices', 'telemetry', 'cameraStatus'] as const;
      const documentFeeds: Feed[] = [
        'observations',
        'aiDetections',
        ...(operator ? (['incidents', 'responseReports'] as const) : []),
      ];
      const emit = (feed: Feed, connection: Connection, data?: unknown[]) => {
        if (active) listener({ feed, connection, data });
      };
      cleanup.push(
        onValue(ref(client.realtime, '.info/connected'), (snapshot) => {
          online = snapshot.val() === true;
          for (const feed of realtimeFeeds)
            emit(
              feed,
              failed.has(feed)
                ? 'error'
                : !online
                  ? 'offline'
                  : ready.has(feed)
                    ? 'connected'
                    : 'connecting',
              online ? cached.get(feed) : undefined,
            );
        }),
      );
      for (const feed of realtimeFeeds) {
        emit(feed, 'connecting');
        cleanup.push(
          onValue(
            realtimeQuery(ref(client.realtime, `nexus/${siteId}/${feed}`), limitToLast(200)),
            (snapshot) => {
              const raw: unknown = snapshot.val();
              const rows =
                raw && typeof raw === 'object'
                  ? Object.entries(raw).flatMap(([id, row]) => {
                      if (!row || typeof row !== 'object') return [null];
                      if (feed === 'telemetry') {
                        const latest = (row as { latest?: unknown }).latest;
                        return latest && typeof latest === 'object'
                          ? Object.entries(latest).map(([channel, value]) =>
                              value &&
                              typeof value === 'object' &&
                              value.deviceId === id &&
                              value.channel === channel
                                ? value
                                : null,
                            )
                          : [null];
                      }
                      return (row as Record<string, unknown>)[
                        feed === 'devices' ? 'id' : 'cameraId'
                      ] === id
                        ? [row]
                        : [null];
                    })
                  : [];
              ready.add(feed);
              cached.set(feed, rows);
              emit(feed, online ? 'connected' : 'offline', rows);
            },
            () => {
              failed.add(feed);
              emit(feed, 'error');
            },
          ),
        );
      }
      for (const feed of documentFeeds) {
        emit(feed, 'connecting');
        const timestamp =
          feed === 'incidents' || feed === 'responseReports' ? 'reportedAt' : 'observedAt';
        cleanup.push(
          onSnapshot(
            query(
              collection(client.firestore, feed),
              where('siteId', '==', siteId),
              orderBy(timestamp, 'desc'),
              limit(200),
            ),
            { includeMetadataChanges: true },
            (snapshot) => {
              if (!snapshot.metadata.fromCache) ready.add(feed);
              emit(
                feed,
                snapshot.metadata.fromCache ? 'offline' : 'connected',
                snapshot.docs.map((doc) => {
                  const row = doc.data();
                  return row.id === doc.id ? row : null;
                }),
              );
            },
            () => emit(feed, 'error'),
          ),
        );
      }
      const timeout = setTimeout(() => {
        for (const feed of [...realtimeFeeds, ...documentFeeds])
          if (!ready.has(feed)) emit(feed, 'offline');
      }, 12000);
      return () => {
        active = false;
        clearTimeout(timeout);
        cleanup.forEach((stop) => stop());
        cached.clear();
      };
    },
  };
}
