# ALIXO BPO · CRM

Call-center CRM: lead submission, dupe checker, active campaigns, callbacks, progress, tools,
agent sign-up with admin approval, and a hidden admin portal. Next.js 15 (React 19).

- **Database:** Upstash Redis (Vercel Storage → Upstash / KV) — the source of truth.
- **Google Sheet:** a copy of every lead and agent change (like the Elijah site). The CRM never reads it.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3020
```

Settings live in `.env.local` (see `.env.example`). Without `KV_REST_API_URL` / `KV_REST_API_TOKEN`
the CRM uses an in-memory demo store locally (lost on restart; disabled in production).

## Deploy on Vercel

1. **Database:** Project → Storage → Create → **Upstash (Redis / KV)** → connect it to this project.
   Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
2. **Environment variables** (Settings → Environment Variables), copied from `.env.local`:
   `SESSION_SECRET`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `SHEET_WEBHOOK_SECRET`, and `SHEET_WEBHOOK_URL` (step 3).
3. **Google Sheet copy:** new Google Sheet → Extensions → Apps Script → paste `apps-script/Code.gs`.
   Put `SHEET_WEBHOOK_SECRET` into `setSecret()`, Run it once, then Deploy → Web app
   (Execute as **Me**, access **Anyone**) and use the `/exec` URL as `SHEET_WEBHOOK_URL`.
4. Redeploy. In the admin portal click **Sync sheet now** once to copy existing data.

## Accounts

- **Admin:** open `/admin-alixo-bpo-2026` (not linked anywhere) and enter `ADMIN_PASSWORD`.
  To change the hidden path, edit `ADMIN_PATH` in `src/lib/config.ts` and rename the two
  `admin-alixo-bpo-2026` folders under `src/app/(auth)` and `src/app/(app)`.
- **Agents** sign up at `/signup` and log in at `/login` once the admin approves them.
  Passwords are bcrypt hashes in Redis and never sent to the sheet.
- **Callbacks:** Admin portal → an approved agent → *Callbacks* → paste a Google Sheet viewer link
  (shared as "Anyone with the link · Viewer"). Only agents with a link see the Callbacks page.
  Anyone who has that link can open the sheet — the CRM only controls who is shown it.

## Campaigns, tools, dialer

Edit `src/lib/config.ts`.
