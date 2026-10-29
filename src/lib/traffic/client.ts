'use client';
import type { TrafficState } from './contract';
export type TrafficView = Omit<TrafficState, 'windows' | 'seenIds'>;
export async function requestTraffic(source: string, action?: unknown, signal?: AbortSignal) {
  const token =
    source === 'LIVE' ? await (await import('../firebase/client')).getFirebaseToken() : null;
  const response = await fetch(`/api/response/traffic?source=${source}`, {
    method: action ? 'POST' : 'GET',
    headers: {
      ...(action ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(action ? { body: JSON.stringify(action) } : {}),
    cache: 'no-store',
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Traffic request failed.');
  return data as { authorized: boolean; state: TrafficView | null; role?: string };
}
