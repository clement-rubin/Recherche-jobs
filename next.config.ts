import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Netlify deployment with @netlify/plugin-nextjs
  output: undefined, // Let Netlify plugin handle output mode

  // Allow images from common job sites
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleapis.com' },
      { protocol: 'https', hostname: '*.microsoftonline.com' },
    ],
  },
}

export default nextConfig
