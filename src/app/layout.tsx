import type { Metadata } from 'next';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { cookies } from 'next/headers';
import { defaultTheme, isThemeId } from '@/lib/themes';
import { brand } from '@/lib/brand';
import { introPrepaintScript } from '@/lib/intro-gate';

export const metadata: Metadata = {
  applicationName: brand.platform,
  title: { default: brand.title, template: '%s | AETHER CITY' },
  description: brand.description,
  openGraph: {
    title: brand.title,
    description: brand.description,
    siteName: brand.platform,
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: brand.title, description: brand.description },
  icons: { icon: '/brand/aether-icon.svg?v=2', apple: '/brand/aether-icon-180.png?v=2' },
  manifest: '/manifest.webmanifest',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preference = (await cookies()).get('nexus-theme')?.value;
  const theme = isThemeId(preference) ? preference : defaultTheme;
  return (
    // data-intro is set before paint by the script below, so React must not flag it.
    <html lang="en" data-scroll-behavior="smooth" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introPrepaintScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers initialTheme={theme}>{children}</Providers>
      </body>
    </html>
  );
}
