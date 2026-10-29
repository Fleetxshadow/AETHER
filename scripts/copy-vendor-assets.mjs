import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// Runtime files served from /public that ship inside npm packages (kept out of git).
const require = createRequire(import.meta.url);
// Package `exports` maps differ (some hide package.json or have no main), so search node_modules.
const packageRoot = (pkg) => {
  const dir = require.resolve
    .paths(pkg)
    .map((base) => path.join(base, pkg))
    .find((candidate) => existsSync(path.join(candidate, 'package.json')));
  if (!dir) throw new Error(`Cannot find package ${pkg}`);
  return dir;
};
const copy = (pkg, from, to, files) => {
  const source = path.join(packageRoot(pkg), from);
  const target = path.join(process.cwd(), 'public', to);
  mkdirSync(target, { recursive: true });
  for (const file of files) copyFileSync(path.join(source, file), path.join(target, file));
};
copy('maplibre-gl', 'dist', 'maplibre', ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']);
// Decoder for the Draco-compressed intro models (public/models/intro).
copy('three', 'examples/jsm/libs/draco/gltf', 'draco', [
  'draco_decoder.js',
  'draco_decoder.wasm',
  'draco_wasm_wrapper.js',
]);
