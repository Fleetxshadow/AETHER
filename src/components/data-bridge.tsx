'use client';
import { useEffect, useRef } from 'react';
import { demoAdapter } from '@/lib/data';
import { useNexus } from '@/lib/store';
import { NexusDataController } from '@/lib/data/data-provider';
import { firebaseConfigured, freshnessMs, siteId } from '@/lib/firebase/config';
import type { Feed, Connection } from '@/lib/data/types';
export function DataBridge() {
  const engine = useRef<NexusDataController>(null);
  const retry = useNexus((s) => s.dataRetry);
  useEffect(() => {
    const controller = new NexusDataController(
      (records, state, history) => useNexus.getState().applyData(records, state, history),
      siteId,
      freshnessMs,
    );
    engine.current = controller;
    controller.configure(firebaseConfigured);
    let stop = () => {};
    let stopAuth = () => {};
    let disposed = false,
      generation = 0;
    if (firebaseConfigured)
      void Promise.all([
        import('@/lib/firebase/client'),
        import('firebase/auth'),
        import('@/lib/data/firebase-provider'),
      ])
        .then(([client, auth, provider]) => {
          if (disposed) return;
          const c = client.getFirebaseClient();
          if (!c) return;
          stopAuth = auth.onIdTokenChanged(c.auth, async (user) => {
            const current = ++generation;
            stop();
            stop = () => {};
            controller.configure(true);
            if (!user) return;
            try {
              const token = await user.getIdTokenResult();
              if (disposed || current !== generation) return;
              const role = token.claims.nexusRole;
              if ((role !== 'viewer' && role !== 'operator') || token.claims.nexusSite !== siteId)
                return;
              controller.configure(true, role);
              stop = controller.attach(
                provider.createFirebaseProvider(siteId, role === 'operator'),
              );
            } catch {
              if (!disposed && current === generation) controller.receive('observations', 'error');
            }
          });
        })
        .catch(() => {
          if (!disposed) controller.receive('observations', 'error');
        });
    else
      void import('@/lib/data/nexus-provider')
        .then((provider) => {
          if (disposed) return;
          controller.configure(true, 'operator');
          stop = controller.attach(provider.createNexusProvider());
        })
        .catch(() => {
          if (!disposed) controller.receive('observations', 'error');
        });
    // Controlled, explicitly labeled fixtures only in a localhost development build.
    const fixture = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (data?.reset) controller.configure(false);
      else if (
        [
          'observations',
          'telemetry',
          'devices',
          'cameraStatus',
          'aiDetections',
          'incidents',
          'responseReports',
        ].includes(data?.feed) &&
        ['connecting', 'connected', 'offline', 'error'].includes(data?.connection) &&
        (data.rows === undefined || Array.isArray(data.rows))
      ) {
        if (!controller.state.test) controller.configure(true, 'operator', true);
        controller.receive(data.feed as Feed, data.connection as Connection, data.rows);
      }
    };
    const localTest =
      process.env.NODE_ENV === 'development' &&
      ['localhost', '127.0.0.1'].includes(location.hostname);
    if (localTest) window.addEventListener('nexus:fixture', fixture);
    const timer = setInterval(() => controller.refresh(), 1000);
    return () => {
      disposed = true;
      generation++;
      stopAuth();
      stop();
      clearInterval(timer);
      if (localTest) window.removeEventListener('nexus:fixture', fixture);
      engine.current = null;
      controller.configure(false);
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    useNexus.setState({ demoStatus: 'loading' });
    void demoAdapter
      .load(abort.signal)
      .then((snapshot) => {
        engine.current?.setDemo(snapshot.observations);
        useNexus.setState({ demoStatus: 'ready' });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') useNexus.setState({ demoStatus: 'error' });
      });
    return () => abort.abort();
  }, [retry]);
  return null;
}
