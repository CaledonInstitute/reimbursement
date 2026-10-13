import withPWA from '@ducanh2912/next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/auth/google/:path*',
        destination: (process.env.BACKEND_URL || 'http://localhost:3001') + '/auth/google/:path*',
      },
      {
        source: '/api/auth/google/:path*',
        destination: (process.env.BACKEND_URL || 'http://localhost:3001') + '/auth/google/:path*',
      },
      {
        source: '/api/auth/google',
        destination: (process.env.BACKEND_URL || 'http://localhost:3001') + '/auth/google',
      },
      {
        source: '/api/:path*',
        destination: (process.env.BACKEND_URL || 'http://localhost:3001') + '/api/:path*',
      },
    ];
  },
  allowedDevOrigins: ['feels-significant-replaced-forecast.trycloudflare.com'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheStartUrl: false,
  dynamicStartUrl: false,
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'navigation-pages',
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
    ],
  },
})({
  ...nextConfig,
  turbopack: {},
})
