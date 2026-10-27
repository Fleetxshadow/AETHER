// Migrate fixed interface colors once; retain exact original literals for comparison.
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
const directory = 'src/app';
const manifestPath = 'src/lib/theme-color-manifest.json';
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : {};
const palettes = JSON.parse(fs.readFileSync('src/lib/theme-palettes.json', 'utf8'));
function channels(raw) {
  if (raw.startsWith('#')) {
    let h = raw.slice(1);
    if (h.length < 5) h = [...h].map((c) => c + c).join('');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const values = raw.match(/[\d.]+/g).map(Number);
  return [values[0], values[1], values[2], values[3] ?? 1];
}
function role(raw, property, selector) {
  const [r, g, b] = channels(raw);
  const bright = (r + g + b) / 765;
  const saturated = Math.max(r, g, b) - Math.min(r, g, b) > 45;
  const text = property === 'color' || property === 'fill' || property === 'stroke';
  if (/shadow|filter/.test(property) && bright < 0.2) return 'shadow';
  if (/critical|severity.*critical/.test(selector) && r > g * 1.25)
    return text ? 'critical-ink' : 'critical-tint';
  if (/normal|resolved/.test(selector) && g > r) return text ? 'normal-ink' : 'normal-tint';
  if (/elevated/.test(selector)) return text ? 'elevated-ink' : 'elevated-tint';
  if (/border|outline/.test(property)) return 'border';
  if (text && bright < 0.22 && /primary|mission|closing|skip-link|::selection/.test(selector))
    return 'on-accent';
  if (saturated && r > b * 1.35 && r > g) return text ? 'accent-ink' : 'accent-fill';
  if (text) return bright > 0.68 ? 'ink' : 'muted-ink';
  return 'surface';
}
let changes = 0;
for (const file of fs
  .readdirSync(directory)
  .filter(
    (name) =>
      !process.argv.includes('--generate-only') &&
      name.endsWith('.css') &&
      !['theme-colors.css', 'themes.css'].includes(name),
  )) {
  const location = path.join(directory, file);
  const ast = postcss.parse(fs.readFileSync(location, 'utf8'));
  ast.walkDecls((declaration) => {
    if (declaration.value.includes('url(')) return;
    const selector = declaration.parent.selector || '';
    declaration.value = declaration.value.replace(
      /#[\da-f]{3,8}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/gi,
      (raw) => {
        const kind = role(raw, declaration.prop, selector);
        const key = `--nxs-${kind}-${raw.replace(/[^\da-z]/gi, '').toLowerCase()}`;
        manifest[key] = { raw, role: kind, channels: channels(raw) };
        changes++;
        return `var(${key})`;
      },
    );
    if (declaration.prop === 'color')
      declaration.value = declaration.value.replaceAll('var(--amber)', 'var(--accent-ink)');
  });
  fs.writeFileSync(location, ast.toString());
}
const entries = Object.entries(manifest);
let css =
  '/* Generated from exact original interface colors. See scripts/theme-tokens.mjs. */\n:root {\n';
for (const [key, { raw }] of entries) css += `  ${key}: ${raw};\n`;
css +=
  '  --accent-ink: #ffb347;\n  --primary-fill: #ffb347;\n  --secondary-fill: #d8ed86;\n  --on-accent: #171a13;\n}\n';
const immersive =
  '.city-portal,.city-scene,.drone-scene,.engineering-stage,.module-universe,.command-map-stage,.command-twin,.route-transition';
for (const [id, palette] of Object.entries(palettes)) {
  if (id === 'original') continue;
  css += `html[data-theme="${id}"] { color-scheme: ${palette.mode}; --theme-bg:${palette.background}; --theme-surface:${palette.surface}; --theme-ink:${palette.text}; --theme-muted:${palette.muted}; --theme-border:${palette.border}; --primary-fill:${palette.primary}; --accent-ink:${palette.accentInk}; --secondary-fill:${palette.secondary}; --on-accent:${palette.onAccent}; --bg:var(--theme-bg); --surface:var(--theme-surface); --line:var(--theme-border); --text:var(--theme-ink); --muted:var(--theme-muted); --amber:var(--primary-fill); --lime:var(--secondary-fill); --critical-ink:${palette.mode === 'light' ? '#A93225' : '#FF9D87'}; --normal-ink:${palette.mode === 'light' ? '#276C43' : '#BCE4A1'}; --elevated-ink:${palette.mode === 'light' ? '#825109' : '#FFE066'}; }\n`;
  css += `html[data-theme="${id}"] :is(${immersive}) {color-scheme:dark;--theme-bg:${palette.scene.background};--theme-surface:${palette.scene.surface};--theme-ink:${palette.scene.text};--theme-muted:${palette.scene.muted};--theme-border:${palette.border};--accent-ink:var(--primary-fill);--text:var(--theme-ink);--muted:var(--theme-muted);--surface:var(--theme-surface);--critical-ink:#FF9D87;--normal-ink:#BCE4A1;--elevated-ink:#FFE066;}\n`;
}
css += `html[data-theme]:not([data-theme="original"]),html[data-theme]:not([data-theme="original"]) :is(${immersive}) {\n`;
for (const [key, entry] of entries) {
  const [r, g, b, alpha] = entry.channels;
  const luminance = (r + g + b) / 765;
  const map = {
    ink: 'var(--theme-ink)',
    'muted-ink': 'var(--theme-muted)',
    'accent-ink': 'var(--accent-ink)',
    'accent-fill': 'var(--primary-fill)',
    'on-accent': 'var(--on-accent)',
    border: 'var(--theme-border)',
    shadow: '#000000',
    'critical-ink': 'var(--critical-ink)',
    'critical-tint': '#D95645',
    'normal-ink': 'var(--normal-ink)',
    'normal-tint': '#419761',
    'elevated-ink': 'var(--elevated-ink)',
    'elevated-tint': '#C5912C',
  };
  let value =
    map[entry.role] ||
    `color-mix(in srgb,var(--theme-surface) ${Math.round(99 - Math.min(0.4, luminance) * 25)}%,var(--primary-fill))`;
  if (alpha < 1) value = `color-mix(in srgb,${value} ${(alpha * 100).toFixed(3)}%,transparent)`;
  css += `  ${key}:${value};\n`;
}
css += '}\n';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(directory, 'theme-colors.css'), css);
console.log(
  `Tokenized ${changes} color occurrences; ${entries.length} exact original tokens preserved.`,
);
