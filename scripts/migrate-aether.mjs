// One-time public-brand migration. Durable integration identifiers intentionally stay unchanged.
import fs from 'node:fs';
import path from 'node:path';
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (/\.(tsx?|mjs)$/.test(file)) files.push(file);
  }
}
walk('src/components');
walk('tests');
walk('scripts');
files.push(
  'src/app/layout.tsx',
  'src/app/loading.tsx',
  'src/app/not-found.tsx',
  'src/app/traffic/page.tsx',
  'src/lib/demo-conversation.ts',
  'src/lib/map.ts',
);
const changed = [];
for (const file of files) {
  if (file.endsWith('migrate-aether.mjs')) continue;
  const original = fs.readFileSync(file, 'utf8');
  const next = original
    .replace(/\bNEXUS\b/g, 'AETHER')
    .replace(/\bNXS\b/g, 'ATH')
    .replaceAll('nexus-records-', 'aether-records-');
  if (next !== original) {
    fs.writeFileSync(file, next);
    changed.push(file);
  }
}
fs.mkdirSync('docs/aether', { recursive: true });
fs.writeFileSync('docs/aether/changed-files.json', JSON.stringify(changed, null, 2));
console.log(
  `Updated public branding in ${changed.length} files; integration identifiers preserved.`,
);
