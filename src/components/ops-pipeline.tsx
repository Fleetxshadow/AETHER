'use client';
import { motion } from 'motion/react';
import { ArrowUpRight, BrainCircuit, Eye, MapPin, ShieldCheck, Siren } from 'lucide-react';
import { TransitionLink as Link } from './route-transition';
import { observationStatus, type Observation } from '@/lib/data';
import { validCoordinate } from '@/lib/operational-map';
import { useNexus } from '@/lib/store';
import { useReducedMotion } from '@/lib/motion';

// Observe → Understand → Locate → Validate → Respond. Every count is derived from records
// already in the store; a stage without a connected source says so instead of showing a number.
export function OpsPipeline({ records, step }: { records: Observation[]; step: number }) {
  const integration = useNexus((s) => s.integration);
  const reduced = useReducedMotion();
  const live = records.filter((r) => r.dataSource === 'LIVE').length;
  const flagged = records.filter((r) => r.severity !== 'normal').length;
  // Approximate Gurugram operational extent. Bundled demo points use Bengaluru reference
  // coordinates and are deliberately never relocated, so they do not count as located here.
  const inGurugram = ([lng, lat]: readonly number[]) =>
    lng >= 76.85 && lng <= 77.25 && lat >= 28.35 && lat <= 28.6;
  const located = records.filter((r) => validCoordinate(r.location) && inGurugram(r.location));
  const elsewhere = records.length - located.length;
  const resolved = records.filter((r) => observationStatus(r, step) === 'resolved').length;
  const review = records.length - resolved;
  const responseFeed = integration.configured && integration.role === 'operator';
  const responses = integration.fresh.incidents.length + integration.fresh.responseReports.length;
  const aiFeed = integration.configured;
  const stages = [
    {
      key: 'observe',
      verb: 'Observe',
      Icon: Eye,
      value: String(records.length),
      unit: 'observations',
      note: live ? `${live} live · ${records.length - live} demo` : 'Recorded demo dataset',
      href: '/command/sky',
      cta: 'Review sensors in SKY',
    },
    {
      key: 'understand',
      verb: 'Understand',
      Icon: BrainCircuit,
      value: String(flagged),
      unit: 'flagged elevated+',
      note: aiFeed
        ? `${integration.fresh.aiDetections.length} AI detection results received`
        : 'Deterministic CORE summary · no AI feed',
      href: '/command/core',
      cta: 'Read the CORE analysis',
    },
    {
      key: 'locate',
      verb: 'Locate',
      Icon: MapPin,
      value: String(located.length),
      unit: 'on the Gurugram map',
      note: elsewhere
        ? `${elsewhere} demo point${elsewhere === 1 ? '' : 's'} use non-Gurugram reference coordinates`
        : 'Coordinates as reported by source',
      href: '/command/geo',
      cta: 'Locate in GEO',
    },
    {
      key: 'validate',
      verb: 'Validate',
      Icon: ShieldCheck,
      value: String(review),
      unit: 'awaiting review',
      note: `${resolved} resolved at this snapshot`,
      href: '#observations',
      cta: 'Open review queue',
    },
    {
      key: 'respond',
      verb: 'Respond',
      Icon: Siren,
      value: responseFeed ? String(responses) : '—',
      unit: responseFeed ? 'reported incidents' : 'feed not connected',
      note: responseFeed ? 'Operator incident projections' : 'Local demo intake available',
      href: '/command/response',
      cta: 'Open RESPONSE intake',
    },
  ];
  return (
    <section className="ops-pipeline" aria-labelledby="ops-pipeline-title">
      <h2 id="ops-pipeline-title" className="sr-only">
        Operational loop
      </h2>
      <ol>
        {stages.map(({ key, verb, Icon, value, unit, note, href, cta }, i) => (
          <motion.li
            key={key}
            data-stage={key}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : i * 0.06 }}
          >
            <span className="ops-stage-index mono" aria-hidden="true">
              0{i + 1}
            </span>
            <span className="ops-stage-verb">
              <Icon size={15} aria-hidden="true" />
              {verb}
            </span>
            <strong className="ops-stage-value">
              {value}
              <small>{unit}</small>
            </strong>
            <span className="ops-stage-note">{note}</span>
            {href.startsWith('#') ? (
              <a className="ops-stage-link" href={href}>
                {cta} <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            ) : (
              <Link className="ops-stage-link" href={href}>
                {cta} <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            )}
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
