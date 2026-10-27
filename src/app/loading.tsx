import { BrandMark } from '@/components/brand-mark';
export default function Loading() {
  return (
    <main id="main" className="route-loading">
      <BrandMark className="aether-loading-mark" />
      <p className="mono">INITIALIZING AETHER</p>
      <div className="loading-line" />
    </main>
  );
}
