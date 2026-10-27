'use client';
import dynamic from 'next/dynamic';
import { useMemo, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { ArrowUpRight, Globe2 } from 'lucide-react';
import { useNexus } from '@/lib/store';
import { observationSpatialFeatures, spatialMapPoints } from '@/lib/geo-review';
import { canViewSpatial } from '@/lib/geo-contracts';
import { transition, useReducedMotion } from '@/lib/motion';
import { MagneticLink } from './motion-ui';
import { TransitionLink } from './route-transition';
const OperationalMap = dynamic(() => import('./google-operational-map'), {
  ssr: false,
  loading: () => (
    <div className="handoff-map-placeholder" role="status">
      <Globe2 size={28} />
      <span>Preparing geographic workspace</span>
    </div>
  ),
});
export function MapHandoff() {
  const root = useRef<HTMLElement>(null);
  const visible = useInView(root, { once: true, amount: 0.25 });
  const reduced = useReducedMotion();
  const records = useNexus((s) => s.records),
    integration = useNexus((s) => s.integration);
  const selected = useNexus((s) => s.selectedId),
    select = useNexus((s) => s.select);
  const points = useMemo(
    () =>
      spatialMapPoints(
        observationSpatialFeatures(
          records,
          integration.fresh.aiDetections,
          integration.test,
        ).filter(
          (f) => f.properties.source === 'AUTHORIZED' && canViewSpatial(f, integration.role),
        ),
      ),
    [records, integration],
  );
  return (
    <section className="map-handoff section-pad" id="geography" ref={root}>
      <div className="handoff-heading">
        <span className="eyebrow">THE ILLUSTRATION ENDS. THE GEOGRAPHY BEGINS.</span>
        <h2>
          A REAL CITY.
          <br />
          <span>A SHARED UNDERSTANDING.</span>
        </h2>
        <p>
          The cinematic city is illustrative. Here, Google Maps shows actual Gurugram streets.
          Authorized AETHER observations appear only when supplied by a connected source.
        </p>
      </div>
      <motion.div
        className="handoff-map-frame"
        initial={false}
        animate={{ y: visible || reduced ? 0 : 36 }}
        transition={reduced ? { duration: 0 } : { ...transition, duration: 0.9 }}
      >
        <div className="handoff-coordinate">
          <Globe2 size={17} />
          <span>GURUGRAM / HARYANA, INDIA</span>
          <span>28.4595° N / 77.0266° E</span>
        </div>
        {visible ? (
          <OperationalMap
            points={points}
            selected={selected}
            onSelect={select}
            note={
              <p>
                Real geography. {points.length} authorized AETHER observations supplied. Google
                traffic is a visual layer, not AETHER incident detection.
              </p>
            }
          />
        ) : (
          <div className="handoff-map-placeholder">
            <Globe2 size={28} />
            <span>Real geographic workspace</span>
          </div>
        )}
      </motion.div>
      <div className="handoff-footer">
        <div>
          <span className="mono">OBSERVATION → EVIDENCE → HUMAN REVIEW</span>
          <p>
            Paths, affected areas and verification states belong to their original records. No
            cinematic geometry is transferred to this map.
          </p>
        </div>
        <div>
          <MagneticLink href="/command">Enter AETHER command</MagneticLink>
          <TransitionLink href="/command/geo" className="text-button">
            Review paths & affected areas <ArrowUpRight size={16} />
          </TransitionLink>
        </div>
      </div>
    </section>
  );
}
