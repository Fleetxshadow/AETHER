import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="route-loading">
      <p className="eyebrow">404 / OUTSIDE THE GRID</p>
      <h1>Uncharted territory.</h1>
      <Link className="button primary" href="/">
        Return to AETHER
      </Link>
    </main>
  );
}
