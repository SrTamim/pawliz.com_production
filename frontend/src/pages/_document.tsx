import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Blocking theme script — runs before any paint to prevent light-mode FOUC */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('pawliz_theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();` }} />
        <meta charSet="UTF-8" />
        <meta
          name="keywords"
          content="vet Bangladesh, veterinary Dhaka, pet care Bangladesh, animal hospital"
        />
        {/* Static, page-invariant Open Graph / Twitter defaults.
            Per-page og:title / og:description / description live in each page's
            next/head <Head> (keyed) so they override these without duplicating. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Pawliz" />
        <meta property="og:url" content="https://pawliz.com" />
        <meta property="og:image" content="https://pawliz.com/og-default.svg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://pawliz.com/og-default.svg" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00e5a0" />
        {/* Fonts are self-hosted via @fontsource (imported in _app.jsx), so no
            fonts.googleapis.com / fonts.gstatic.com connection is needed. */}
        {/* OSM tiles load from a/b/c subdomains (shared infra). Keep one preconnect
            + dns-prefetch the rest to stay under the 4-preconnect guidance. */}
        <link rel="preconnect" href="https://a.tile.openstreetmap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://b.tile.openstreetmap.org" />
        <link rel="dns-prefetch" href="https://c.tile.openstreetmap.org" />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
        {/* Cloudflare Web Analytics — beacon token from env, not hardcoded.
            Unset → analytics script is skipped. */}
        {process.env.NEXT_PUBLIC_CF_BEACON_TOKEN && (
          <Script
            id="cloudflare-analytics"
            strategy="afterInteractive"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_BEACON_TOKEN}"}`}
          />
        )}
      </body>
    </Html>
  );
}
