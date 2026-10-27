export interface SpatialLabel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
}
export interface PlacedLabel extends SpatialLabel {
  visible: boolean;
}
// Screen-space placement shared by model callouts and geographic marker buttons.
export function placeSpatialLabels(
  labels: SpatialLabel[],
  width: number,
  height: number,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const padding = 7;
  const gap = 6;
  const fits = (candidate: SpatialLabel) =>
    placed.every(
      (other) =>
        !other.visible ||
        Math.abs(candidate.x - other.x) >= (candidate.width + other.width) / 2 + gap ||
        Math.abs(candidate.y - other.y) >= (candidate.height + other.height) / 2 + gap,
    );
  for (const label of [...labels].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  )) {
    const candidates: SpatialLabel[] = [];
    for (let ring = 0; ring <= 6; ring++) {
      const radius = ring * 50;
      const offsets =
        ring === 0
          ? [[0, 0]]
          : [
              [0, -radius],
              [0, radius],
              [-radius, 0],
              [radius, 0],
              [-radius, -radius],
              [radius, -radius],
              [-radius, radius],
              [radius, radius],
            ];
      for (const [dx, dy] of offsets) {
        candidates.push({
          ...label,
          x: Math.max(
            label.width / 2 + padding,
            Math.min(width - label.width / 2 - padding, label.x + dx),
          ),
          y: Math.max(
            label.height / 2 + padding,
            Math.min(height - label.height / 2 - padding, label.y + dy),
          ),
        });
      }
    }
    candidates.sort(
      (a, b) =>
        (a.x - label.x) ** 2 + (a.y - label.y) ** 2 - ((b.x - label.x) ** 2 + (b.y - label.y) ** 2),
    );
    const candidate = candidates.find(
      (item) =>
        item.width + padding * 2 <= width && item.height + padding * 2 <= height && fits(item),
    );
    placed.push(candidate ? { ...candidate, visible: true } : { ...label, visible: false });
  }
  return placed;
}
