/* eslint-disable @next/next/no-img-element -- Offline ImageResponse generation requires native image nodes, outside browser rendering. */
﻿import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ImageResponse } from 'next/og';
import { brand, brandArtwork } from '../src/lib/brand';

async function main() {
  const directory = 'public/brand';
  const source = await fs.readFile(directory + '/aether-original.jpeg');
  const data = `data:image/jpeg;base64,${source.toString('base64')}`;
  const image = `<image href="${data}" width="1600" height="714"/>`;
  const svg = (viewBox: string, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="AETHER CITY"><title>AETHER CITY</title>${body}</svg>`;
  const symbol = svg(brandArtwork.symbolViewBox, image);
  const wordmark = svg(brandArtwork.wordmarkViewBox, image);
  await fs.writeFile(directory + '/aether-symbol.svg', symbol);
  await fs.writeFile(directory + '/aether-wordmark.svg', wordmark);
  await fs.writeFile(
    directory + '/aether-city-wordmark.svg',
    svg(
      '0 0 1000 205',
      `<rect width="1000" height="205" fill="#000"/><svg width="1000" height="132" viewBox="${brandArtwork.wordmarkViewBox}">${image}</svg><text x="10" y="188" font-size="30" font-family="sans-serif" letter-spacing="15" fill="#F3F8FA">CITY</text>`,
    ),
  );
  await fs.writeFile(directory + '/aether-logo-dark.svg', svg('0 0 1600 714', image));
  await fs.writeFile(
    directory + '/aether-logo-light.svg',
    svg(
      '0 0 1640 754',
      `<rect width="1640" height="754" rx="24" fill="#F3F8FA"/><svg x="20" y="20" width="1600" height="714">${image}</svg>`,
    ),
  );
  await fs.writeFile(
    directory + '/aether-logo-mono.svg',
    svg(
      '0 0 1600 714',
      `<defs><filter id="mono"><feColorMatrix type="saturate" values="0"/></filter></defs><g filter="url(#mono)">${image}</g>`,
    ),
  );
  const icon = svg(
    '0 0 32 32',
    `<rect width="32" height="32" rx="6" fill="#000"/><svg y="4" width="32" height="24" viewBox="${brandArtwork.symbolViewBox}">${image}</svg>`,
  );
  await fs.writeFile(directory + '/aether-icon.svg', icon);
  await fs.writeFile('public/nexus.svg', icon);
  for (const size of [180, 192, 512]) {
    const scale = (size * 0.94) / 620;
    const response = new ImageResponse(
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: 620 * scale,
            height: 435 * scale,
            overflow: 'hidden',
          }}
        >
          <img
            alt=""
            src={data}
            width={1600 * scale}
            height={714 * scale}
            style={{ position: 'absolute', left: -490 * scale, top: -15 * scale }}
          />
        </div>
      </div>,
      { width: size, height: size },
    );
    await fs.writeFile(
      `${directory}/aether-icon-${size}.png`,
      Buffer.from(await response.arrayBuffer()),
    );
  }
  const response = new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        borderBottom: '6px solid #12B8A6',
      }}
    >
      <img alt="" src={data} width={1120} height={500} />
      <div
        style={{
          display: 'flex',
          width: 1080,
          justifyContent: 'space-between',
          fontSize: 18,
          color: '#A9BAC4',
        }}
      >
        <span>AETHER CITY</span>
        <span>CONCEPTUAL URBAN INTELLIGENCE / DEMO</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
  const social = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(directory + '/aether-social.png', social);
  for (const type of ['opengraph', 'twitter']) {
    await fs.writeFile(`src/app/${type}-image.png`, social);
    await fs.writeFile(
      `src/app/${type}-image.alt.txt`,
      `${brand.platform}. Official AETHER logo: ${brand.tagline} Conceptual platform demonstration.`,
    );
  }
  await fs.writeFile(
    'public/manifest.webmanifest',
    JSON.stringify(
      {
        name: brand.platform,
        short_name: brand.name,
        description: brand.description,
        start_url: '/',
        display: 'standalone',
        background_color: '#080D13',
        theme_color: '#081522',
        icons: [192, 512].map((size) => ({
          src: `/brand/aether-icon-${size}.png?v=2`,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: 'any',
        })),
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    `${directory}/PROVENANCE.md`,
    '# AETHER artwork\n\nOfficial JPEG supplied by the user on 21 October 2026. Original bytes are unchanged. SVG files embed and frame the same raster artwork; they are not vector tracings. The monochrome variant applies a display filter. Light-background variant retains the original black field inside a light frame.\n\nSHA-256: ' +
      createHash('sha256').update(source).digest('hex') +
      '\n',
  );
  console.log(
    'Official source artwork retained; logo views, browser icons and social images generated.',
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
