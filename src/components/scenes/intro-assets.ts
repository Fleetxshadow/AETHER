'use client';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Blender exports (scripts/blender/*.py). Draco decoder is copied to /draco at build.
export const introModelUrls = {
  city: '/models/intro/aether-city.glb',
  drone: '/models/intro/aether-drone.glb',
} as const;
export const heroModelUrls = {
  kit: '/models/hero/aether-hero-kit.glb',
  drone: '/models/intro/aether-drone.glb',
} as const;
export interface IntroModels {
  city: GLTF;
  drone: GLTF;
}
export interface HeroModels {
  kit: GLTF;
  drone: GLTF;
}

/** Loads a set of Draco-compressed GLBs, reporting combined byte progress. */
function loadSet<K extends string>(
  urls: Record<K, string>,
  onProgress?: (fraction: number) => void,
) {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const keys = Object.keys(urls) as K[];
  const bytes: Partial<Record<K, [number, number]>> = {};
  const report = () => {
    const values = Object.values(bytes) as [number, number][];
    const total = values.reduce((sum, [, t]) => sum + t, 0);
    if (values.length === keys.length && total)
      onProgress?.(values.reduce((s, [l]) => s + l, 0) / total);
  };
  return Promise.all(
    keys.map((key) =>
      loader.loadAsync(urls[key], (event) => {
        bytes[key] = [event.loaded, event.total || event.loaded];
        report();
      }),
    ),
  )
    .then((loaded) => Object.fromEntries(keys.map((k, i) => [k, loaded[i]])) as Record<K, GLTF>)
    .finally(() => draco.dispose());
}

let pending: Promise<IntroModels> | null = null;
export function loadIntroModels(onProgress: (fraction: number) => void) {
  pending ??= loadSet(introModelUrls, onProgress);
  pending.catch(() => (pending = null));
  return pending;
}

/** Drop the cached models after the intro so their memory can be reclaimed. */
export function releaseIntroModels() {
  pending = null;
}

// The hero keeps its own parsed copies: the intro rewires its models' materials and parents.
let hero: Promise<HeroModels> | null = null;
export function loadHeroModels() {
  hero ??= loadSet(heroModelUrls);
  hero.catch(() => (hero = null));
  return hero;
}
