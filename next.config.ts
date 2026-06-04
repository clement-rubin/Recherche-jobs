import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: undefined,

  images: {
    remotePatterns: [
      // Employer logos from JSearch (Google User Content)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Generic CDN logos returned by JSearch
      { protocol: 'https', hostname: '*.logo.dev' },
      { protocol: 'https', hostname: 'logo.clearbit.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(self), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control',     value: 'on' },
        ],
      },
    ]
  },
}

export default nextConfig
