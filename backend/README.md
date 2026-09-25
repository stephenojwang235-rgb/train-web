# NICC Campus Backend (local, CSV database)

Local Express server storing website submissions in CSV files. No cloud DB needed.

## Run both servers

Terminal 1 — backend (port 5000):
```bash
cd backend
npm install
npm run dev          # node --watch server.js
```

Terminal 2 — frontend (port 5173, proxies `/api` → `http://localhost:5000`):
```bash
npm install
npm run dev
```

The backend also serves the built frontend (`../dist`) with an SPA fallback, so `node server.js` alone can host the whole site on `:5000`.

## Configuration (`backend/.env`)

Copy `.env.example` and fill it in:

| Key | Purpose |
|---|---|
| `PORT` | Server port (default 5000) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeds the first `admins.csv` row (bcrypt-hashed) |
| `EMAIL_USER` | Gmail address that sends OTP mail |
| `EMAIL_PASS` | 16-character Google **App Password** (not the account password) |
| `DEMO_REVEAL_OTP` | `true` returns OTP codes in API responses when email fails (dev only) |

`EMAIL_PASS` is validated at startup: if it is not exactly 16 characters the mailer is not started.

## Files

- `server.js` — all routes (visit plans, admin reads, feedback, 2-step OTP auth, password reset)
- `csvStore.js` — `fs`-based CSV helpers (auto-create files, RFC-4180 escaping, quoted-field parser, password-column updates)
- `data/admins.csv` — header `username,email,name,password` (bcrypt)
- `data/users.csv` — header `name,email,password,campus` (bcrypt)
- `data/visitors.csv` — header `id,date,name,email,phone,campus,status`
- `data/sign_ins.csv` — header `timestamp,name,email`
- `data/messages.csv` — header `date,name,email,message`
- `data/feedback.csv` — header `timestamp,email,name,category,message`

## Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | health check |
| POST | `/api/visit-plan` | `{name,email,phone?,campus?,message?}` → appends a `Pending Follow-up` row to visitors.csv (and messages.csv when a message is included) |
| POST | `/api/feedback` | `{email?,name?,category?,message}` → appends to feedback.csv |
| POST | `/api/auth/verify-credentials` | **Phase 1**: `{email,password}` → detects admin (admins.csv) vs disciple (users.csv), emails a 6-digit code (5-min TTL). Returns `requiresOtp:true` |
| POST | `/api/auth/verify-otp` | **Phase 2**: `{email,code}` → creates the session; disciples are logged to sign_ins.csv |
| POST | `/api/auth/register` | `{name,email,password,campus?}` → bcrypt-hashes and appends to users.csv |
| POST | `/api/auth/forgot-password` | `{email}` → emails a 6-digit reset code (10-min TTL) |
| POST | `/api/auth/reset-password` | `{email,code,newPassword}` → verifies the code and rewrites the bcrypt password in admins.csv / users.csv |
| POST | `/api/admin/login` | Legacy admin-only login → admin token |
| POST | `/api/admin/logout` | Invalidates the admin token |
| GET | `/api/admin/visitors` | visitors.csv as JSON array (admin) |
| GET | `/api/admin/signins` | sign_ins.csv as JSON array (admin) |
| GET | `/api/admin/messages` | messages.csv as JSON array (admin) |
| GET | `/api/admin/feedback` | feedback.csv as JSON array (admin) |
| GET | `/api/admin/announcements` | All announcements and per-user read IDs (admin) |
| POST | `/api/admin/announcements` | `{message_text}` → publishes a global announcement (admin) |
| GET | `/api/announcements` | Current disciple's unread announcements (requires `x-user-token`) |
| POST | `/api/announcements/:id/read` | Adds only the current disciple to the announcement's `user_ids` read array |
| POST | `/api/otp/request` | Legacy code-only OTP request (superseded by `/api/auth/verify-credentials`) |
| POST | `/api/otp/verify` | Legacy code-only OTP verify (superseded by `/api/auth/verify-otp`) |

Admin routes require the `x-admin-token` header.

## Email delivery behaviour

All OTP mail goes through one helper (`sendOtpEmail`) that:
1. sends over **port 465 (SSL/TLS)** with `family: 4` to force IPv4 — this removes the `connect ENETUNREACH <ipv6>:465` errors seen on IPv4-only networks;
2. retries automatically over **port 587 (STARTTLS)** if 465 fails.

If both fail, the response is still `ok: true` with `emailSent: false`, a `deliveryWarning` and (when `DEMO_REVEAL_OTP` is on) a `demoCode`, so the user is never stranded at the OTP step. The frontend renders this as an amber warning rather than an error.

## Data notes

- OTP codes live in memory only and are cleared on restart; a used code is deleted so it cannot be replayed.
- Passwords are bcrypt hashes (`$2b$`). `passwordMatches()` still accepts legacy plaintext or SHA-256 rows so older CSV data keeps working — but new writes are always hashed.
- The CSV files are the only datastore. Back them up; never commit `backend/.env`.

## Frontend wiring

- Plan a Visit form (`/contact`) POSTs to `/api/visit-plan`
- Login (`/login`) uses the `/api/auth/*` pair for login, sign-up and password reset
- Admin dashboard (`/admin`) reads all four `/api/admin/*` tables, including disciple feedback
