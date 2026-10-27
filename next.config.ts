import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';

const config: NextConfig = {
  // Permit dev assets through this computer's private LAN addresses, without a wildcard origin.
  allowedDevOrigins: [
    '127.0.0.1',
    ...Object.values(networkInterfaces()).flatMap((addresses) =>
      (addresses || [])
        .filter(
          (address) =>
            address.family === 'IPv4' &&
            !address.internal &&
            /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address),
        )
        .map((address) => address.address),
    ),
  ],
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  async rewrites() {
    const nexusUrl = process.env.NEXUS_BACKEND_URL || 'http://127.0.0.1:8000';
    return [
      {
        source: '/api/camera/:path*',
        destination: `${nexusUrl}/api/camera/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
