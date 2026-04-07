# Force Cheats – hosting

This repository serves a static website from `website/` and exposes API endpoints via `server.js` (MoneyMotion checkout + Supabase integration).

## Local run

1. Copy environment file:
   - Create `.env` next to `server.js` and fill values from `.env.example`.
2. Start server:
   - `npm run start`
3. Open:
   - `http://localhost:8000/`

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MONEY_MOTION_API_KEY`
- `ADMIN_EMAIL` (optional, defaults to `surgeworldorder@protonmail.com`)

Optional:
- `SUPABASE_ANON_KEY`
- `MONEY_MOTION_CREATE_CHECKOUT_URL`
- `MONEY_MOTION_CHECKOUT_BASE_URL`

## Deployment (recommended: run the Node server)

Deploy as a Node service (Render/Railway/Fly.io/VPS):

- Build command: none
- Start command: `npm run start` (or `node server.js`)
- Set environment variables in the hosting dashboard (never commit secrets to GitHub).
- Attach your domain and enable HTTPS.

MoneyMotion success/cancel URLs should point to your public domain:
- `https://YOUR_DOMAIN/success.html`
- `https://YOUR_DOMAIN/`

## Database

Supabase is the database. SQL helpers are in `website/supabase/`.
