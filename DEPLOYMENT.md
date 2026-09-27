# Deployment Guide — NICC Campus Ministry

## Architecture decision

| Piece | Host | Why |
|---|---|---|
| **Frontend** (React + Vite → `dist/`) | **Vercel** | Static build served from a global CDN. Matches `vercel.json`. |
| **Backend** (`backend/server.js`, Express) | **Render** (free tier) | The API is a *stateful long-running process*: 4 in-memory `Map` stores (`adminSessions`, `discipleSessions`, `otpStore`, `resetOtpStore`), **14** filesystem writes for the CSV mirror, background OTP/announcement emails (`void sendAnnouncementEmails`) and outbound SMTP. None of that survives Vercel's serverless model. On Render it runs **unchanged**. |

**Why not one platform?** Deploying the Express app to Vercel as `api/index.js` would need sessions converted to stateless tokens, OTP codes moved to Supabase, CSV writes redirected to `/tmp`, and announcement emails awaited inside the request — a rewrite of the exact code paths we just verified. Split hosting keeps zero regression risk.

> `server.js` also serves `dist/` itself, so the *whole app* also runs as a single service on Render if you ever prefer one URL — but then you give up Vercel's CDN.

---

## Part A — Vercel (frontend)

**Status: blocked on interactive login** (`vercel whoami` → `Logged out.`). The CLI needs your browser click; I cannot complete it.

```powershell
vercel login                      # opens browser → click "Confirm"
```

After login I will run (no action needed from you):

```powershell
vercel link                        # create the project
vercel env add VITE_API_URL production   # https://<your-api>.onrender.com
vercel --prod                      # build + deploy
```

`VITE_API_URL` is required: `src/utils/api.js` already reads it, and without it the
deployed site would call `/api/*` on the Vercel domain and 404. Verified inlining:
`vite build` bakes it into `dist/assets/index-*.js`.

---

## Part B — Render (backend)

**Status: ✅ DONE (2026-09-27).** Service `nicc-campus-api`
(`srv-daskpo3bc2fs73fn17ng`, Frankfurt, Node 22, free plan) was created via the
Render REST API with all 12 env vars set. First deploy went **live** on creation;
auto-deploy tracks `main`. **Live: `https://nicc-campus-api.onrender.com`.**

Manual equivalent (for reference):
### 1. Create the service
1. Sign in at [dashboard.render.com](https://dashboard.render.com) (GitHub sign-in is easiest).
2. **New → Blueprint →** connect `github.com/stephenojwang235-rgb/train-web`.
3. Render reads **`render.yaml`** at the repo root. Confirm it found:
   - `rootDir: backend` · `buildCommand: npm install` · `startCommand: npm start`
   - `healthCheckPath: /api/health` · `region: frankfurt` (closest to Nairobi)
4. Every variable marked `sync: false` prompts you for a value — paste them (below).
5. **Apply Blueprint.**

### 2. Environment variables (paste at the prompt)

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://csipxzqxatixziwxjjes.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *Supabase Dashboard → Project Settings → API Keys → **service_role** (secret). Server-side only; bypasses RLS. Never commit it.* |
| `SUPABASE_ANON_KEY` | *legacy local-dev fallback only — Render ignores it when the service_role key is set* |
| `EMAIL_API_KEY` | *⭐ REQUIRED for email. **resend.com → sign up → API Keys → Create API Key → copy the `re_...` value** and paste it here. Free tier = 3,000 emails/month. Without this, OTP/reset emails are never delivered from Render.* |
| `EMAIL_FROM` | *set by blueprint default: `NICC Campus Ministry <onboarding@resend.dev>`. Keep until you verify your own domain at resend.com/domains (test mode only delivers to the Resend account owner's inbox).* |
| `GMAIL_USER` | `stephenojwang235@gmail.com` *(local-dev SMTP fallback only — ignored on Render)* |
| `GMAIL_APP_PASSWORD` | *copy from local `.env` — never commit it* |
| `ADMIN_EMAIL` | `stephenojwang235@gmail.com` |
| `ADMIN_PASSWORD` | *copy from local `backend/.env`* |

`NODE_VERSION=22`, `NODE_ENV=production`, `DEMO_REVEAL_OTP=false` are set by the blueprint.
**Supabase credentials belong to the backend, not the frontend** — the browser never
talks to Supabase directly (see `backend/supabase/schema.sql`: the anon key is only
usable through the backend's RLS policies).

### 3. Your API URL
Render prints it on completion: **`https://nicc-campus-api.onrender.com`**.
Put that exact value into Vercel as `VITE_API_URL`.

---

## Part C — Post-deploy verification

**Verified live (2026-09-27):**

```
https://nicc-campus-api.onrender.com/api/health   → 200 {"ok":true,"service":"nicc-campus-backend"}
POST /api/visit-plan (public, test record)        → 201 {"ok":true,"id":"muk2pz7g39af3c","status":"Pending Follow-up"}
POST /api/admin/login (real admin creds)          → 200 {"ok":true,"token":"...","admin":{...}}
All 12 env vars confirmed set via Render API      → SUPABASE_*, GMAIL_*, EMAIL_HOST/PORT/SECURE, ADMIN_*, NODE_*, DEMO_REVEAL_OTP=false
```

Remaining manual checks on the site itself:
https://<api>.onrender.com/api/health   → {"ok":true,"service":"nicc-campus-backend"}
https://<site>.vercel.app/              → site loads
https://<site>.vercel.app/login         → admin login completes (Phase 1 + 2)
https://<site>.vercel.app/contact       → Plan a Visit form saves (check /api/admin/visitors)
```

Also confirm **no personal data** is served from the site: `.vercelignore` blocks
`backend/data/*.csv`, `.env*` and `local-only/`; `public/` was cleaned of CSV exports.

---

## Known caveats

- **Render free tier** sleeps after ~15 min idle → first request takes ~30–50 s
  (a login right after idle feels slow). Upgrade to **Starter ($7/mo)** for always-on.
- **Gmail OTP** is sent from Render, not your PC — same App Password works anywhere.
- **CSV mirror**: Render's disk is writable but resets on redeploy. Harmless —
  Supabase is the source of truth; the CSVs are only a local/offline fallback.
- **Local dev is unaffected**: `Start NICC.bat` / `npm run dev` behave exactly as before.

## Resetting local-only artifacts
Files moved out of `public/` to keep them off the live site live in `local-only/`
(`backend_data.csv`, `supabase_tables_csv.zip`, `schema.sql`). Keep them private.
