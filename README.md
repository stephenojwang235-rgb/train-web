# NICC Campus Ministry

Website for the **Nairobi International Christian Church Campus Ministry** — Faith, Fellowship & Purpose for university students in Nairobi.

The site is primarily a UoN Chiromo campus ministry: Sunday service (Sarit Expo), Wednesday Bible Talk (Chiromo) and Wednesday fellowship (Ufungamano House).

## Stack

**Frontend**
- React 19 + Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- React Router v7

**Backend** (`backend/`) — Express 4 + nodemailer + bcrypt, storing everything in CSV files (`backend/data/`). No cloud database required.

## Getting started

Two servers. Backend first:

```bash
cd backend
npm install
node server.js          # http://localhost:5000
```

Then the frontend, from the project root:

```bash
npm install
npm run dev             # http://localhost:5173 (proxies /api -> :5000)
```

On Windows you can instead double-click **`Start NICC.bat`** or **`start-local.bat`** — they start whichever port is not already in use and open `/login`.

`backend/.env` must exist (copy `backend/.env.example`). It needs `EMAIL_USER` + a 16-character Google **App Password** in `EMAIL_PASS`, otherwise OTP emails cannot be sent.

## Routes

| Path | Access | Purpose |
|---|---|---|
| `/` | public | Home — hero, service times, directions |
| `/about` | public | About the ministry |
| `/contact` | public | Plan a Visit form + leader contacts |

## Live Deployment

- **Production Frontend (Vercel):** [https://ignited-campus-ministry-nairobi.vercel.app](https://ignited-campus-ministry-nairobi.vercel.app) (also aliased: `https://train-web-one.vercel.app`)
- **Production Backend (Render):** `https://nicc-campus-api.onrender.com`
- **Deployment & Architecture Documentation:** [`DEPLOYMENT.md`](./DEPLOYMENT.md)

| `/login` | public | ONE unified login / sign-up / forgot-password surface |
| `/portal` | private (disciple) | Disciple portal |
| `/profile` | private (any user) | Profile |
| `/admin` | private (admin) | Admin dashboard: visitors, sign-ins, messages, feedback |

Legacy URLs redirect rather than 404: `/dashboard/*` → `/portal`, `/admin/data` → `/admin`, and the removed `/give`, `/contribute`, `/donate`, `/offering`, `/events/*`, `/ministries/*` → `/`.

## Authentication

Phase 1 verifies Email + Password against `backend/data/admins.csv` (admin) or `backend/data/users.csv` (disciple). Phase 2 emails a 6-digit code and verifies it before a session is created.

If Gmail is unreachable the login **still advances to Phase 2** with an amber warning; in local dev the recovery code is shown in the UI (`DEMO_REVEAL_OTP`, see `backend/README.md`). Set `DEMO_REVEAL_OTP=false` or `NODE_ENV=production` to keep codes off the wire.

Demo disciple accounts (bcrypt hashed in `users.csv`): `grace@campus.nicc.ke`, `david@campus.nicc.ke`, `faith@campus.nicc.ke` — password `disciple123`.

## Project structure

```
src/
  App.jsx                 # Routes (public + private + legacy redirects)
  main.jsx                # Entry: Router + AuthProvider + CSS
  index.css               # Tailwind + theme + helpers
  components/
    common/               # Button, Card, SectionHeading, ProtectedRoute
    layout/               # Navbar, Footer, Layout
    features/             # Hero, MainServices, BibleTalkCard, DirectionsHub,
                          # PlanAVisitForm, LeaderContact
  views/
    public/               # Home, About, Contact, Login, NotFound
    private/              # Portal, Profile, AdminDashboard (behind ProtectedRoute)
  context/                # AuthContext (+ barrel export index.js)
  data/                   # site.js — service times, contacts, campus list
  utils/                  # api.js, adminApi.js, helpers.js
backend/
  server.js               # All Express routes (see backend/README.md)
  csvStore.js             # fs-based CSV helpers (auto-create, RFC-4180 escaping)
  data/                   # admins.csv, users.csv, visitors.csv, sign_ins.csv,
                          # messages.csv, feedback.csv
```

## Scripts

- `npm run dev` — start dev server (frontend)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build

`backend/` has its own scripts: `npm start` and `npm run dev` (node --watch).

## Notes

- Passwords are stored as bcrypt hashes; `passwordMatches()` also accepts legacy plaintext or SHA-256 rows so old data keeps working.
- CSV files in `backend/data/` are the source of truth — back them up; nothing is in a remote database.
- `backend/.env` holds a real Gmail App Password. It is gitignored — never commit or share it, and rotate it if it leaks.
