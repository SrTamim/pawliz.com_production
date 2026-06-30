# Pawliz — Veterinary Platform Bangladesh

Pawliz is a full-stack veterinary platform for Bangladesh. It connects pet owners with vets through an interactive map and directory, and supports pet profiles with QR codes, a lost & found feed, a rescue & adoption board, real-time notifications, and an admin dashboard — with bilingual (English / বাংলা) support.

## Deployment

- **Backend** → **Railway** (canonical): config in `railway.toml`. Build `npm install && npm run build`; start `npm run migrate:prod && node dist/server.js`. The backend assumes a **single instance** (in-memory OTP/auth caches + nightly cron jobs); keep it at one replica unless those are externalized.
- **Frontend** → Vercel (`NEXT_PUBLIC_API_URL` must be set; the build fails without it).
- **DB** → Supabase (set `DB_CA_CERT` to enable verified TLS). **Files** → Cloudflare R2.

playwright test
npm run test:e2e	headless, all tests
npm run test:e2e:headed	----- watch browser run
npm run test:e2e:ui	interactive UI mode (pick/debug tests)
npm run test:e2e:report	open last HTML report