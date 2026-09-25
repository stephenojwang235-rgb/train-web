# CSV data store

This folder is the application's database. There is **no** cloud database — the
Express server reads and writes plain CSV files here at runtime.

## What is and isn't in Git

The real `*.csv` files in this folder contain personal data (visitor names,
phone numbers, emails, messages) and bcrypt password hashes, so they are
**git-ignored and never committed**:

```gitignore
backend/data/*.csv
```

The header-only copies in `templates/` are committed instead, so the schema is
visible without leaking any data.

## Files the server expects

| File | Columns |
|---|---|
| `admins.csv` | `username,email,name,password` |
| `users.csv` | `name,email,password,campus,is_verified` |
| `visitors.csv` | `id,date,name,email,phone,campus,status` |
| `sign_ins.csv` | `timestamp,name,email` |
| `messages.csv` | `date,name,email,message` |
| `feedback.csv` | `timestamp,email,name,category,message` |
| `announcements.csv` | `id,message_text,created_at,user_ids` |
| `verification_codes.csv` | `id,email,purpose,code_hash,expires_at,consumed_at,created_at` |

## Nothing to do on a fresh clone

On first start, `ensureDataFiles()` in `backend/csvStore.js` creates every one
of these files with the correct header row if it is missing. To seed an admin
account, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your `.env` before starting
the server.

## Back up your data

Because the CSVs *are* the database, they are not recoverable from Git. Copy
this folder somewhere safe before any destructive change.
