import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: undefined,
  outputFileTracingRoot: __dirname,

  // Hide X-Powered-By: Next.js (info disclosure)
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.logo.dev' },
      { protocol: 'https', hostname: 'logo.clearbit.com' },
    ],
  },

  async headers() {
    return [
      // ── All routes ──────────────────────────────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security',   value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options',            value: 'DENY' },
          { key: 'X-Content-Type-Options',      value: 'nosniff' },
          { key: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',          value: 'camera=(), microphone=(self), geolocation=(), payment=()' },
          { key: 'X-DNS-Prefetch-Control',      value: 'on' },
          { key: 'Cross-Origin-Opener-Policy',  value: 'unsafe-none' },
          // CSP — Next.js needs unsafe-inline for hydration scripts
          // Connect-src covers Supabase WS, JSearch, France Travail, Groq
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              // connect-src: Supabase realtime/REST/auth, job APIs, Groq, Google OAuth token endpoint
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://jsearch.p.rapidapi.com https://api.emploi-store.fr https://entreprise.francetravail.fr https://api.groq.com https://oauth2.googleapis.com https://accounts.google.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              // form-action must include Google OAuth — supabase signInWithOAuth can use a form redirect
              "form-action 'self' https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
      // ── Next.js static assets (JS, CSS, fonts, images) ──────────────────────
      // Netlify CDN serves these — we need explicit CORP header here
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',       value: 'nosniff' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      // ── HTML pages only ──────────────────────────────────────────────────────
      {
        source: '/((?!_next/static|_next/image|favicon).*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy',  value: 'unsafe-none' },
          { key: 'Cross-Origin-Resource-Policy',  value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
