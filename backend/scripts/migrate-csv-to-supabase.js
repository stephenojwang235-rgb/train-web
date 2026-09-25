#!/usr/bin/env node
/**
 * NICC Campus Ministry — CSV -> Supabase migration
 *
 * Imports every row from backend/data/*.csv into the matching Supabase table.
 *
 * Prerequisites
 *   1. You have run backend/supabase/schema.sql in the Supabase SQL Editor.
 *   2. .env contains SUPABASE_URL and SUPABASE_ANON_KEY.
 *
 * Passwords are NOT re-hashed. The bcrypt hashes already in users.csv /
 * admins.csv are copied verbatim, so existing logins keep working — which is
 * why this script never prints or logs a hash.
 *
 * Usage:
 *   node backend/scripts/migrate-csv-to-supabase.js --dry-run
 *   node backend/scripts/migrate-csv-to-supabase.js
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  readCsvAsJson, ADMINS_CSV, USERS_CSV, VISITORS_CSV, SIGN_INS_CSV,
  MESSAGES_CSV, FEEDBACK_CSV, ANNOUNCEMENTS_CSV, VERIFICATION_CODES_CSV,
} from '../csvStore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
try {
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })
  dotenv.config({ path: path.join(__dirname, '..', '.env') })
} catch { /* cwd .env */ }
dotenv.config()

const DRY_RUN = process.argv.includes('--dry-run')
const URL = (process.env.SUPABASE_URL || '').trim()
const KEY = (process.env.SUPABASE_ANON_KEY || '').trim()

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Add them to .env first.')
  process.exit(1)
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/** Parse a timestamp to ISO, or null when blank/unparseable. */
function toIso(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const email = (v) => String(v ?? '').trim().toLowerCase()
const text = (v) => (String(v ?? '').trim() ? String(v).trim() : null)
const bool = (v) => /^(true|1|yes)$/i.test(String(v ?? '').trim())

/** Insert rows and report counts. Never throws. */
async function insert(table, rows, label) {
  if (rows.length === 0) {
    console.log(`  ${label.padEnd(22)} 0 rows — skipped`)
    return { table, inserted: 0, failed: 0 }
  }
  if (DRY_RUN) {
    console.log(`  ${label.padEnd(22)} ${rows.length} row(s) would be inserted`)
    return { table, inserted: rows.length, failed: 0 }
  }
  const { error } = await supabase.from(table).insert(rows)
  if (error) {
    console.error(`  ${label.padEnd(22)} FAILED: ${error.message}`)
    return { table, inserted: 0, failed: rows.length }
  }
  console.log(`  ${label.padEnd(22)} ${rows.length} row(s) inserted`)
  return { table, inserted: rows.length, failed: 0 }
}

/** Read a CSV into objects, tolerating a missing/empty file. */
function read(file, headers) {
  try { return readCsvAsJson(file, headers) } catch { return [] }
}


// --- users -----------------------------------------------------------------
// email is the natural key, so the unique index keeps this idempotent.
const userRows = read(USERS_CSV, ['name', 'email', 'password', 'campus', 'is_verified'])
  .filter((r) => email(r.email) && String(r.password || '').trim())
  .map((r) => ({
    email: email(r.email),
    name: String(r.name || 'Disciple').trim() || 'Disciple',
    password_hash: String(r.password).trim(),
    campus: text(r.campus),
    is_verified: bool(r.is_verified),
    role: 'disciple',
  }))

// --- admins ----------------------------------------------------------------
const adminRows = read(ADMINS_CSV, ['username', 'email', 'name', 'password'])
  .filter((r) => email(r.email) && String(r.password || '').trim())
  .map((r) => ({
    username: String(r.username || 'admin').trim() || 'admin',
    email: email(r.email),
    name: String(r.name || 'Admin').trim() || 'Admin',
    password_hash: String(r.password).trim(),
  }))

// --- visitors --------------------------------------------------------------
const visitorRows = read(VISITORS_CSV, ['id', 'date', 'name', 'email', 'phone', 'campus', 'status', 'message'])
  .map((r) => ({
    name: String(r.name || '').trim() || 'Unknown',
    email: String(r.email || '').trim(),
    phone: text(r.phone),
    campus: text(r.campus),
    message: text(r.message),
    status: text(r.status) || 'Pending Follow-up',
    created_at: toIso(r.date) || new Date().toISOString(),
  }))

// --- messages --------------------------------------------------------------
const messageRows = read(MESSAGES_CSV, ['date', 'name', 'email', 'message'])
  .filter((r) => String(r.message || '').trim())
  .map((r) => ({
    name: String(r.name || '').trim() || 'Unknown',
    email: String(r.email || '').trim(),
    message: String(r.message).trim(),
    created_at: toIso(r.date) || new Date().toISOString(),
  }))

// --- sign_ins --------------------------------------------------------------
const signInRows = read(SIGN_INS_CSV, ['timestamp', 'name', 'email'])
  .map((r) => ({
    name: String(r.name || '').trim() || String(r.email || 'Disciple').split('@')[0],
    email: email(r.email),
    created_at: toIso(r.timestamp) || new Date().toISOString(),
  }))
  .filter((r) => r.email)

// --- feedback --------------------------------------------------------------
const feedbackRows = read(FEEDBACK_CSV, ['timestamp', 'email', 'name', 'category', 'message'])
  .filter((r) => String(r.message || '').trim())
  .map((r) => ({
    email: text(email(r.email)),
    name: text(r.name),
    category: text(r.category) || 'Message',
    message: String(r.message).trim(),
    created_at: toIso(r.timestamp) || new Date().toISOString(),
  }))

// --- announcements ---------------------------------------------------------
// The CSV id is a base36 string; Supabase uses uuid, so Postgres generates
// ids and read receipts are re-keyed by email in a second pass below.
const announcementRows = read(ANNOUNCEMENTS_CSV, ['id', 'message_text', 'created_at', 'user_ids'])
  .filter((r) => String(r.message_text || '').trim())
  .map((r) => ({
    message: String(r.message_text).trim().slice(0, 1000),
    created_at: toIso(r.created_at) || new Date().toISOString(),
  }))

// --- verification_codes ----------------------------------------------------
const codeRows = read(VERIFICATION_CODES_CSV, ['id', 'email', 'purpose', 'code_hash', 'expires_at', 'consumed_at', 'created_at'])
  .filter((r) => email(r.email) && String(r.code_hash || '').trim())
  .map((r) => ({
    email: email(r.email),
    purpose: ['signup', 'portal', 'reset'].includes(String(r.purpose || '').trim()) ? String(r.purpose).trim() : 'signup',
    code_hash: String(r.code_hash).trim(),
    // Anything unparseable is forced to be already expired rather than valid.
    expires_at: toIso(r.expires_at) || new Date(Date.now() - 86_400_000).toISOString(),
    consumed_at: toIso(r.consumed_at),
  }))

const results = []
results.push(await insert('users', userRows, 'users (accounts)'))
results.push(await insert('admins', adminRows, 'admins (staff)'))
results.push(await insert('visitors', visitorRows, 'visitors'))
results.push(await insert('messages', messageRows, 'messages'))
results.push(await insert('sign_ins', signInRows, 'sign_ins'))
results.push(await insert('feedback', feedbackRows, 'feedback'))
results.push(await insert('announcements', announcementRows, 'announcements'))
results.push(await insert('verification_codes', codeRows, 'verification_codes'))

// --- announcement_reads (second pass) -------------------------------------
// Legacy receipts were keyed by 'disciple-'+hex(email). Decode to an email and
// resolve it to a real users.id, now that users exist.
if (!DRY_RUN && announcementRows.length) {
  const { data: anns } = await supabase.from('announcements').select('id, message').order('created_at', { ascending: true })
  const { data: usrs } = await supabase.from('users').select('id, email')
  const byEmail = new Map((usrs || []).map((u) => [email(u.email), u.id]))
  const source = read(ANNOUNCEMENTS_CSV, ['id', 'message_text', 'created_at', 'user_ids'])
  const readRows = []
  for (const a of anns || []) {
    const src = source.find((r) => String(r.message_text || '').trim() === a.message)
    if (!src) continue
    let legacyIds = []
    try { legacyIds = JSON.parse(src.user_ids || '[]') } catch { legacyIds = [] }
    for (const legacy of legacyIds) {
      const hex = String(legacy).replace(/^disciple-/, '')
      let decoded = ''
      try { decoded = Buffer.from(hex, 'hex').toString('utf8') } catch { continue }
      const uid = byEmail.get(email(decoded))
      if (uid) readRows.push({ announcement_id: a.id, user_id: uid })
    }
  }
  results.push(await insert('announcement_reads', readRows, 'announcement_reads'))
}

const inserted = results.reduce((n, r) => n + r.inserted, 0)
const failed = results.reduce((n, r) => n + r.failed, 0)

console.log(`\nDone. inserted=${inserted} failed=${failed}${DRY_RUN ? ' (dry run)' : ''}`)
if (failed) {
  console.error('Some tables failed — see the messages above.')
  process.exit(1)
}
if (!DRY_RUN) {
  console.log('Bcrypt password hashes were copied verbatim, so existing logins still work.')
  console.log('Verify with:  node backend/scripts/verify-migration.js')
}


console.log(DRY_RUN ? 'DRY RUN — nothing will be written\n' : 'Migrating CSV -> Supabase\n')
