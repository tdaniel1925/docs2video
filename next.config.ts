import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingExcludes: {
    '*': ['node_modules/ffmpeg-static/**'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // `microphone=()` means NOBODY may use the microphone here — our own
          // pages included — and no amount of clicking Allow in the browser can
          // override it. It silently killed dictation site-wide, while the same
          // feature worked in Jordyn purely because Jordyn sends no such header.
          //
          // `(self)` allows OUR pages and still refuses every embedded frame,
          // which is the actual thing worth defending against. Camera and
          // location stay shut because nothing here uses them; if something ever
          // does, it will need the same treatment rather than a debugging session.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
