'use client';
import { useMemo, useRef, type RefObject } from 'react';
/* eslint-disable react-hooks/immutability -- R3F frame loop owns imperative DOM label coordinates; no React props or state are mutated. */
import { useFrame } from '@react-three/fiber';
import { Vector3, type Object3D } from 'three';
import { placeSpatialLabels } from '@/lib/spatial-labels';
export interface ProjectedPoint {
  id: string;
  position: [number, number, number];
  object?: RefObject<Object3D | null>;
}
// HTML stays in the application's DOM root. The renderer only updates coordinates.
export function LabelProjector({
  container,
  points,
}: {
  container: RefObject<HTMLDivElement | null>;
  points: ProjectedPoint[];
}) {
  const vector = useRef(new Vector3());
  const pointMap = useMemo(() => new Map(points.map((point) => [point.id, point])), [points]);
  useFrame(({ camera, size }) => {
    const root = container.current;
    if (!root) return;
    const projected = [];
    for (const element of root.children) {
      const label = element as HTMLElement;
      const point = pointMap.get(label.dataset.point || '');
      if (!point) continue;
      vector.current.set(...point.position);
      if (point.object?.current) vector.current.applyMatrix4(point.object.current.matrixWorld);
      vector.current.project(camera);
      const { x, y, z } = vector.current;
      if (!(z < 1 && z > -1 && Math.abs(x) < 1.15 && Math.abs(y) < 1.15)) {
        label.style.visibility = 'hidden';
        continue;
      }
      projected.push({
        id: point.id,
        x: (x * 0.5 + 0.5) * size.width,
        y: (-y * 0.5 + 0.5) * size.height,
        width: label.offsetWidth,
        height: label.offsetHeight,
        priority: label.querySelector('[aria-pressed="true"]')
          ? 0
          : label.querySelector('button')
            ? 1
            : 2,
        label,
      });
    }
    for (const item of placeSpatialLabels(projected, size.width, size.height)) {
      const original = projected.find((point) => point.id === item.id)!;
      const label = original.label;
      label.style.visibility = item.visible ? 'visible' : 'hidden';
      label.style.transform = `translate(${item.x}px,${item.y}px) translate(-50%,-50%)`;
      const dx = original.x - item.x,
        dy = original.y - item.y;
      const length = Math.hypot(dx, dy);
      label.dataset.displaced = String(length > 12);
      label.style.setProperty('--leader-length', `${length}px`);
      label.style.setProperty('--leader-angle', `${Math.atan2(dy, dx)}rad`);
    }
  });
  return null;
}
