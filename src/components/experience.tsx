'use client';
import { useCallback, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowUpRight, Play } from 'lucide-react';
import { useNexus } from '@/lib/store';
import { visibleObservations, metricsAt, timeLabel } from '@/lib/data';
import { Logo, SectionLabel } from './ui';
import { MagneticLink, Reveal } from './motion-ui';
import {
  LivingCity,
  IntelligenceNetwork,
  ModuleExplorer,
  IntelligenceAction,
  SkyChapter,
} from './experience-sections';
import { CinematicHero, ExperienceNavigation } from './cinematic-hero';
import { ChapterBridge } from './chapter-bridge';
import { ObservationDetail } from './observation-detail';
import { Presentation } from './presentation';
import { TransitionLink } from './route-transition';
import { brand, brandArtwork } from '@/lib/brand';
import { GenesisOverlay, useGenesis } from './genesis';
import { MapHandoff } from './map-handoff';
import { FlightHero } from './flight-hero';
export function Experience() {
  const genesis = useGenesis();
  const [presentation, setPresentation] = useState(false);
  const [entrance, setEntrance] = useState<'static' | 'playing' | 'complete'>('static');
  const records = useNexus((s) => s.records);
  const step = useNexus((s) => s.timeStep);
  const selected = useNexus((s) => s.selectedId);
  const selectedRecord = visibleObservations(records, step).find((o) => o.id === selected);
  const metrics = metricsAt(step, records);
  const closePresentation = useCallback(() => setPresentation(false), []);
  return (
    <div
      className="experience rebirth cinematic awakening"
      data-entrance={entrance}
      data-genesis={genesis.mode}
    >
      <div className="experience-content" inert={genesis.active}>
        <ExperienceNavigation />
        <main id="main">
          <FlightHero paused={presentation || genesis.active} />
          <CinematicHero
            genesis={genesis}
            paused={presentation}
            onPresentation={() => setPresentation(true)}
            onEntrance={setEntrance}
          />
          <div className="rebirth-marque mono">
            <span>ONE CITY.</span>
            <span>TEN PERSPECTIVES.</span>
            <span>A SHARED CONTEXT.</span>
            <span className="amber">SOURCE-LABELED INTELLIGENCE ↗</span>
          </div>
          <LivingCity paused={presentation} />
          <ChapterBridge number="02" title="CHANGE YOUR PERSPECTIVE." />
          <SkyChapter />
          <MapHandoff />
          <ChapterBridge number="03" title="EVERY SIGNAL. A SHARED CONTEXT." />
          <IntelligenceNetwork />
          <ModuleExplorer />
          <IntelligenceAction />
          <section className="response-home-preview section-pad" id="response">
            <Reveal>
              <span className="eyebrow">NEW PERSPECTIVE / HUMAN-REVIEWED INTELLIGENCE</span>
              <h2>
                EVERY VOICE.
                <br />
                <span>A HUMAN RESPONSE.</span>
              </h2>
            </Reveal>
            <div>
              <p>
                Hindi, English, or both. Explore a responsible incident-intake demonstration with
                voluntary location sharing, a private review queue and simulated handoffs.
              </p>
              <TransitionLink href="/command/response" className="button primary">
                Explore AETHER RESPONSE <ArrowUpRight size={17} />
              </TransitionLink>
              <small>Non-operational demo. No emergency dispatch or live calling.</small>
            </div>
          </section>
          <section id="mission" className="rebirth-mission section-pad">
            <SectionLabel number="06">THE HUMAN POSSIBILITY</SectionLabel>
            <Reveal>
              <h2>
                BETTER AWARENESS.
                <br />
                <span>MORE RESILIENT CITIES.</span>
              </h2>
            </Reveal>
            <div>
              <p>
                Movement, temperature, water, infrastructure. AETHER connects the signals into a
                shared understanding of the places we call home.
              </p>
              <p>
                A conceptual exploration built across spatial design, software, and aerial
                engineering. Every finding can be traced to the simulated evidence that supports it.
              </p>
              <p className="aether-full-form">{brand.fullForm}</p>
              <div
                className="aether-official-artwork"
                role="img"
                aria-label="Official AETHER logo. Intelligence above. Safety below."
                style={{ backgroundImage: 'url(' + brandArtwork.source + ')' }}
              />
            </div>
          </section>
          <section className="command-closing section-pad">
            <SectionLabel number="07">THE NEXT PERSPECTIVE IS YOURS</SectionLabel>
            <Reveal>
              <h2>
                TAKE
                <br />
                <span>COMMAND.</span>
              </h2>
            </Reveal>
            <div className="closing-composition">
              <div
                className="closing-preview"
                aria-label="Command center preview using current demo snapshot"
              >
                <div className="mono">
                  <span className="tiny-status" />
                  AETHER COMMAND<span>{timeLabel(step)}</span>
                </div>
                <div className="preview-grid" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <span>12.9740° N / 77.5940° E</span>
                </div>
                <div className="preview-readings">
                  <div>
                    <strong>{metrics.active}</strong>
                    <span>ACTIVE / DEMO</span>
                  </div>
                  <div>
                    <strong>{metrics.temperature}°</strong>
                    <span>SURFACE / °C</span>
                  </div>
                  <div>
                    <strong>{metrics.speed}</strong>
                    <span>MOBILITY / KM/H</span>
                  </div>
                </div>
              </div>
              <div className="closing-cta">
                <p>
                  Every perspective.
                  <br />
                  One connected city.
                  <br />
                  <span>Your next move.</span>
                </p>
                <MagneticLink href="/command">Launch command center</MagneticLink>
                <button className="text-button" onClick={() => setPresentation(true)}>
                  <Play size={14} />
                  Start guided presentation
                </button>
                <span className="data-note">Conceptual city. Simulated intelligence.</span>
              </div>
            </div>
          </section>
        </main>
        <footer className="experience-footer">
          <Logo />
          <span className="mono">{brand.secondaryTagline}</span>
          <span>A conceptual perspective on urban resilience.</span>
          <a href="#main" className="text-button">
            Back to top <ArrowUpRight size={16} />
          </a>
        </footer>
        <AnimatePresence>
          {selectedRecord && (
            <ObservationDetail key={selectedRecord.id} observation={selectedRecord} />
          )}
        </AnimatePresence>
        {presentation && <Presentation onClose={closePresentation} />}
      </div>
      <GenesisOverlay controller={genesis} />
    </div>
  );
}
