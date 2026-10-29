import { writeFile } from 'node:fs/promises';
const urls = ['https://motion.dev/docs/ai-kit-install', 'https://transitions.dev/skill.html'];
const results = await Promise.all(
  urls.map(async (url) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const html = await response.text();
      const links = [...html.matchAll(/href="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((link) => /skill|mcp|agent|\/docs/.test(link));
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ');
      return {
        url,
        status: response.status,
        links: [...new Set(links)].slice(0, 35),
        installNotes: text.match(/.{0,150}(?:npx|skill|install).{0,250}/gi)?.slice(0, 12),
      };
    } catch (error) {
      return { url, error: error.message };
    }
  }),
);
await writeFile('docs/skill-research.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
