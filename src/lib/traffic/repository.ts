import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, stat, unlink, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getNexusAdmin } from '../firebase/admin';
import {
  type TrafficState,
  commandSchema,
  type TrafficCommand,
  defaultSettings,
  settingsSchema,
} from './contract';
import { initialTraffic, demoObservations } from './demo';
import { applyCommand, refreshTraffic, TrafficError, type TrafficActor } from './engine';
import { toMobileIncident } from './mobile-contract';
import { validateTrafficState } from './validation';

const root = globalThis as typeof globalThis & { nexusTrafficQueue?: Promise<unknown> };
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const config = () =>
  process.env.NEXUS_TRAFFIC_SETTINGS
    ? settingsSchema.parse(JSON.parse(process.env.NEXUS_TRAFFIC_SETTINGS))
    : defaultSettings;
function checkState(value: unknown, siteId: string, source: 'DEMO' | 'LIVE'): TrafficState {
  try {
    return validateTrafficState(value, siteId, source);
  } catch {
    throw new TrafficError(
      'Unsupported or invalid persisted traffic contract. Administrative migration required.',
      503,
    );
  }
}
const groups = [
  'segments',
  'incidents',
  'investigations',
  'requests',
  'evidence',
  'hazards',
  'events',
  'windows',
] as const;
const collections = {
  segments: 'trafficRegistry',
  incidents: 'trafficCases',
  investigations: 'incidentInvestigations',
  requests: 'inspectionRequests',
  evidence: 'incidentEvidence',
  hazards: 'trafficPublications',
  events: 'trafficAudit',
  windows: 'trafficWindows',
};
async function transact(
  siteId: string,
  source: 'DEMO' | 'LIVE',
  owner: string,
  change: (s: TrafficState) => void,
) {
  const run = async () => {
    if (source === 'DEMO') {
      const dir = path.resolve(process.cwd(), '.nexus', 'traffic'),
        file = path.join(dir, `demo-${hash(siteId + ':' + owner)}.json`);
      await mkdir(dir, { recursive: true });
      const files = (await readdir(dir)).filter((n) =>
        /^demo-[a-f0-9]{64}\.json(?:\.[a-f0-9-]+\.tmp)?$/.test(n),
      );
      let retained = 0;
      for (const name of files) {
        const target = path.join(dir, name);
        if (Date.now() - (await stat(target)).mtimeMs > 86400000) await unlink(target);
        else retained++;
      }
      let s: TrafficState;
      try {
        const raw = await readFile(file, 'utf8');
        if (raw.length > 8000000) throw new TrafficError('Demo storage capacity exceeded.', 503);
        s = checkState(JSON.parse(raw), siteId, source);
        if (Date.parse(s.expiresAt) < Date.now()) s = initialTraffic(siteId, source);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        if (retained >= 500)
          throw new TrafficError('Demo workspace capacity reached. Try again later.', 503);
        s = initialTraffic(siteId, source);
      }
      const next = structuredClone(s);
      change(next);
      checkState(next, siteId, source);
      if (JSON.stringify(next) !== JSON.stringify(s)) {
        next.revision = s.revision + 1;
        await mkdir(dir, { recursive: true });
        const temp = file + '.' + randomUUID() + '.tmp';
        const serialized = JSON.stringify(next);
        if (Buffer.byteLength(serialized, 'utf8') > 8000000)
          throw new TrafficError('Demo storage capacity reached. No change committed.', 503);
        await writeFile(temp, serialized, { mode: 0o600 });
        await rename(temp, file);
      }
      return next;
    }
    if (process.env.NEXUS_TRAFFIC_LIVE_ENABLED !== 'true')
      throw new TrafficError(
        'LIVE traffic backend is not enabled. Start the isolated demonstration instead.',
        503,
      );
    const admin = getNexusAdmin();
    if (!admin)
      throw new TrafficError('Dedicated Firebase Admin access is required for LIVE traffic.', 503);
    return admin.firestore.runTransaction(async (tx) => {
      const meta = admin.firestore.collection('trafficWorkspaces').doc(siteId),
        doc = await tx.get(meta);
      const snapshots = await Promise.all(
        groups.map((g) =>
          tx.get(
            admin.firestore
              .collection(collections[g])
              .where('siteId', '==', siteId)
              .limit(
                {
                  segments: 200,
                  incidents: 300,
                  investigations: 300,
                  requests: 600,
                  evidence: 150,
                  hazards: 300,
                  events: 2000,
                  windows: 200,
                }[g] + 1,
              ),
          ),
        ),
      );
      const initial = initialTraffic(siteId, 'LIVE'),
        previous = { ...initial, ...(doc.exists ? doc.data() : {}), windows: {} } as TrafficState;
      groups.forEach((g, n) => {
        if (g === 'windows') {
          previous.windows = Object.fromEntries(
            snapshots[n].docs.map((d) => [d.data().segmentId, d.data().samples]),
          );
        } else Object.assign(previous, { [g]: snapshots[n].docs.map((d) => d.data()) });
      });
      const s = checkState(previous, siteId, 'LIVE'),
        next = structuredClone(s);
      next.clock = new Date().toISOString();
      change(next);
      checkState(next, siteId, 'LIVE');
      // Wall clock alone does not cause a write/revision; expiry or business changes do.
      const before = { ...s, clock: '' },
        after = { ...next, clock: '' };
      if (JSON.stringify(before) === JSON.stringify(after)) return next;
      next.revision = s.revision + 1;
      const pending: { ref: FirebaseFirestore.DocumentReference; value?: unknown }[] = [];
      groups.forEach((g, n) => {
        const rows =
          g === 'windows'
            ? Object.entries(next.windows).map(([id, samples]) => ({
                id,
                siteId,
                source: 'LIVE',
                schemaVersion: 1,
                segmentId: id,
                samples,
              }))
            : next[g];
        const old = new Map(snapshots[n].docs.map((d) => [d.id, { ref: d.ref, data: d.data() }]));
        for (const row of rows) {
          const key = `${siteId}__${row.id}`;
          const found = old.get(key);
          if (!found || JSON.stringify(found.data) !== JSON.stringify(row))
            pending.push({ ref: admin.firestore.collection(collections[g]).doc(key), value: row });
          old.delete(key);
        }
        for (const v of old.values()) pending.push({ ref: v.ref });
      });
      for (const h of [
        ...s.hazards.filter((h) => !next.hazards.some((n) => n.id === h.id)),
        ...next.hazards,
      ]) {
        const i = next.incidents.find((i) => i.id === h.incidentId);
        pending.push({
          ref: admin.firestore.collection('trafficIncidents').doc(`${siteId}__${h.id}`),
          value:
            i && Date.parse(h.expiresAt) > Date.parse(next.clock)
              ? toMobileIncident(h, i, next)
              : undefined,
        });
      }
      if (pending.length > 450)
        throw new TrafficError('Transaction capacity reached. Reduce the ingestion batch.', 503);
      for (const op of pending)
        if (op.value) {
          if (Buffer.byteLength(JSON.stringify(op.value), 'utf8') > 900000)
            throw new TrafficError('Traffic document capacity reached.', 503);
          tx.set(op.ref, op.value as FirebaseFirestore.DocumentData);
        } else tx.delete(op.ref);
      tx.set(meta, {
        schemaVersion: 1,
        siteId,
        source: 'LIVE',
        revision: next.revision,
        clock: next.clock,
        createdAt: next.createdAt,
        expiresAt: next.expiresAt,
        demoStep: 0,
        seenIds: next.seenIds,
      });
      return next;
    });
  };
  const task = (root.nexusTrafficQueue ?? Promise.resolve()).then(run);
  root.nexusTrafficQueue = task.catch(() => {});
  return task;
}
export async function readTraffic(siteId: string, source: 'DEMO' | 'LIVE', owner: string) {
  return transact(siteId, source, owner, (s) => {
    if (source === 'LIVE') refreshTraffic(s, config());
  });
}
export async function mutateTraffic(siteId: string, actor: TrafficActor, input: TrafficCommand) {
  const command = commandSchema.parse(input);
  return transact(siteId, actor.source, actor.id, (s) => {
    if (command.action === 'start-demo') {
      if (s.revision > 0 && command.expectedRevision !== s.revision)
        throw new TrafficError('Refresh before restarting an existing simulation.', 409);
      if (actor.source !== 'DEMO' || actor.role !== 'DEMO_OPERATOR')
        throw new TrafficError('Demo role required.', 403);
      const revision = s.revision;
      Object.assign(s, initialTraffic(siteId, 'DEMO'));
      s.revision = revision;
      for (const e of s.events) e.revision = revision + 1;
      return;
    }
    if (command.expectedRevision !== s.revision)
      throw new TrafficError('Workspace changed. Refresh before retrying.', 409);
    if (command.action === 'demo-observations') {
      if (actor.source !== 'DEMO' || actor.role !== 'DEMO_OPERATOR')
        throw new TrafficError('Simulation role required.', 403);
      demoObservations(s, command.phase, config());
    } else {
      // Only server-side hashes enter aggregation storage. No raw contributor IDs/positions are exposed.
      const safe =
        command.action === 'ingest'
          ? {
              ...command,
              observations: command.observations.map((o) => ({
                ...o,
                contributorId: hash(actor.id + ':' + o.contributorId),
                observationId: hash(actor.id + ':' + o.observationId),
              })),
            }
          : command;
      applyCommand(s, safe, actor, config());
    }
  });
}
export function adminTrafficView(s: TrafficState) {
  const { windows, seenIds, ...view } = s;
  void windows;
  void seenIds;
  return view;
}
