import { brandArtwork } from '@/lib/brand';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#000" />
      <svg x="0" y="4" width="32" height="24" viewBox={brandArtwork.symbolViewBox}>
        <image href={brandArtwork.source} width={brandArtwork.width} height={brandArtwork.height} />
      </svg>
    </svg>
  );
}

export function BrandWordmark() {
  return (
    <svg className="brand-wordmark" viewBox={brandArtwork.wordmarkViewBox} aria-hidden="true">
      <image href={brandArtwork.source} width={brandArtwork.width} height={brandArtwork.height} />
    </svg>
  );
}
