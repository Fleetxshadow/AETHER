import { mkdir, writeFile } from 'node:fs/promises';
const urls = [
  'https://motion.dev/docs/react',
  'https://motion.dev/docs/react-use-reduced-motion',
  'https://transitions.dev/',
  'https://www.scrolltide.co/',
  'https://gsap.com/docs/v3/Plugins/ScrollTrigger/',
  'https://lenis.dev/',
  'https://reactbits.dev/',
  'https://kokonutui.com/',
  'https://beui.dev/',
  'https://bklit.com/',
  'https://ui.shadcn.com/',
  'https://godly.design/',
  'https://www.deck.gallery/',
  'https://www.backgrounds.supply/',
  'https://www.framer.com/',
  'https://www.motionsite.ai/',
  'https://threejs.org/docs/',
  'https://r3f.docs.pmnd.rs/advanced/scaling-performance',
  'https://drei.docs.pmnd.rs/',
  'https://spline.design/',
  'https://rive.app/',
  'https://maplibre.org/maplibre-gl-js/docs/examples/',
  'https://deck.gl/',
  'https://www.mapbox.com/',
  'https://howlerjs.com/',
  'https://n8n.io/',
];
const results = await Promise.all(
  urls.map(async (url) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const html = await r.text();
      const title =
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ') ||
        'No document title';
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 2400);
      return { url, status: r.status, title, excerpt: text };
    } catch (error) {
      return { url, status: 'unavailable', error: error.message };
    }
  }),
);
await mkdir('docs', { recursive: true });
await writeFile('docs/reference-research.json', JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.url} | ${r.status} | ${r.title || r.error}`);
