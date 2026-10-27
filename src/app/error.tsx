'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="route-loading">
      <p className="eyebrow">SYSTEM INTERRUPTED</p>
      <h1>Let’s reconnect.</h1>
      <p>This workspace couldn’t load. Your local preferences are preserved.</p>
      <button className="button primary" onClick={reset}>
        Retry workspace
      </button>
    </main>
  );
}
