'use client';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export const googleMapsConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
export const mapsAuthEvent = 'aether:maps-authorization-failed';
declare global {
  interface Window {
    gm_authFailure?: () => void;
    aetherGoogleMaps?: { pending?: Promise<google.maps.MapsLibrary>; authorizationFailed: boolean };
  }
}

// One loader and one authentication hook for every route/map, including Strict Mode mounts.
export function loadGoogleMaps() {
  if (!googleMapsConfigured) return Promise.reject(new Error('Map not configured'));
  const shared = (window.aetherGoogleMaps ??= { authorizationFailed: false });
  if (shared.authorizationFailed) return Promise.reject(new Error('Map authorization failed'));
  if (!shared.pending) {
    window.gm_authFailure = () => {
      shared.authorizationFailed = true;
      window.dispatchEvent(new Event(mapsAuthEvent));
    };
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!.trim(),
      v: 'quarterly',
      language: 'en',
      region: 'IN',
    });
    shared.pending = importLibrary('maps').then((library) => {
      if (shared.authorizationFailed) throw new Error('Map authorization failed');
      return library;
    });
  }
  return shared.pending;
}
