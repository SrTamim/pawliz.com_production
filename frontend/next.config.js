// Derive the backend HTTP + WS origin from NEXT_PUBLIC_API_URL for CSP connect-src.
// Guarded so a missing/invalid env never breaks `next build`.
function backendOrigins() {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const { origin, host, protocol } = new URL(raw);
    const wsScheme = protocol === "https:" ? "wss:" : "ws:";
    return { http: origin, ws: `${wsScheme}//${host}` };
  } catch {
    return { http: "http://localhost:5000", ws: "ws://localhost:5000" };
  }
}

// Content-Security-Policy (enforced, see headers() below).
// Rationale for each relaxed directive is documented in the implementation plan.
function buildCsp() {
  const { http, ws } = backendOrigins();
  return [
    "default-src 'self'",
    // 'unsafe-inline': _document injects a FOUC theme script via dangerouslySetInnerHTML (no nonce in pages-router)
    // Tawk.to live chat injects its widget from embed.tawk.to + *.tawk.to
    // cdn.jsdelivr.net: Tawk.to emoji picker (emojione) loads from jsDelivr
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://embed.tawk.to https://*.tawk.to https://static.cloudflareinsights.com https://cdn.jsdelivr.net",
    // 'unsafe-inline': app uses inline style={{}} objects + inline <style> + onLoad font swap
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to",
    "font-src 'self' https://fonts.gstatic.com https://*.tawk.to",
    // https: — uploaded images load via a backend->R2 302 redirect (pub-*.r2.dev, no FE env to pin); also covers OSM tiles + Unsplash
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${http} ${ws} https://va.vercel-scripts.com https://*.tawk.to wss://*.tawk.to https://cloudflareinsights.com https://static.cloudflareinsights.com`,
    // Tawk.to renders its chat UI in an iframe from tawk.to
    "frame-src 'self' https://*.tawk.to https://tawk.to",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  // Enforced — preview deploy showed zero violations across all flows.
  { key: "Content-Security-Policy", value: buildCsp() },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: process.env.NEXT_PUBLIC_BACKEND_DOMAIN || "localhost" },
      { protocol: "http", hostname: "localhost" },
      // Cloudflare R2 public bucket — public uploads served direct (see lib/api getImageUrl).
      // Guarded so a missing/invalid env never breaks `next build`.
      ...(() => {
        try {
          if (!process.env.NEXT_PUBLIC_R2_PUBLIC_URL) return [];
          const { hostname } = new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
          return [{ protocol: "https", hostname }];
        } catch {
          return [];
        }
      })(),
    ],
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBase}/v1/:path*`,
      },
      {
        source: "/api/health",
        destination: `${apiBase}/health`,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    return config;
  },
};
module.exports = nextConfig;
