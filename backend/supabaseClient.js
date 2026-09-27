// ---- Supabase data layer ----------------------------------------------------
// Credentials come from the environment only; nothing is hard-coded here.
//   SUPABASE_URL       -> Project Settings > Data API
//   SUPABASE_ANON_KEY  -> Project Settings > Data API > anon public key
//
// The backend is the ONLY thing that talks to the database. The browser never
// receives these keys, and Row Level Security (see supabase/schema.sql) keeps
// the anon key from being useful to anyone who finds it.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// ESM hoists all imports, so this module's body runs BEFORE server.js's
// dotenv.config() call. Without loading .env here, process.env would still be
// empty at this point and the client would always be "not configured".
// (csvStore.js does the same thing for the same reason.)
try {
  const __dir = path.dirname(fileURLToPath(import.meta.url))
  dotenv.config({ path: path.join(__dir, '..', '.env') }) // root .env first
  dotenv.config({ path: path.join(__dir, '.env') })       // backend/.env second
} catch { /* dotenv.config() without args will pick up a cwd .env */ }
dotenv.config()

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim()
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim()

/**
 * True when both Supabase variables are present. The server uses this to decide
 * between the cloud store and the legacy CSV store, so an unconfigured
 * deployment keeps working exactly as it did before.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

if (isSupabaseConfigured) {
  console.log('✓ NICC Supabase: cloud database connected')
} else {
  console.log(
    'NICC Supabase NOT configured (missing SUPABASE_URL or SUPABASE_ANON_KEY in .env) — falling back to local CSV storage.'
  )
}

// Supabase returns `{ data, error }`; translate a PostgREST error into a thrown
// Error so the route handlers can keep their existing try/catch shape.
function unwrap({ data, error }) {
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

const DEFAULT_COLUMNS = 'id,email,name,password_hash,campus,is_verified,created_at'

/** Map a `users` row onto the snake_case shape the rest of the server expects. */
function toUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    // `password` is the column name the auth code checks; it holds a bcrypt hash.
    password: row.password_hash,
    campus: row.campus,
    is_verified: row.is_verified,
  }
}

/** List every disciple (used for duplicate checks and admin lookups). */
export async function listUsers(columns = DEFAULT_COLUMNS) {
  return unwrap(await supabase.from('users').select(columns).order('created_at', { ascending: true })).map(toUser)
}

/** Find one disciple by email (case-insensitive; the column is stored lowercased). */
export async function findUserByEmail(email, columns = DEFAULT_COLUMNS) {
  const clean = String(email || '').toLowerCase().trim()
  if (!clean) return null
  const rows = unwrap(
    await supabase.from('users').select(columns).eq('email', clean).limit(1)
  )
  return toUser(rows[0])
}

/**
 * Insert a new disciple. `passwordHash` is a bcrypt hash — the plaintext
 * password must never leave the request handler.
 */
export async function insertUser({ name, email, passwordHash, campus, isVerified = false }) {
  const row = unwrap(
    await supabase
      .from('users')
      .insert({
        name: String(name || '').trim(),
        email: String(email || '').toLowerCase().trim(),
        password_hash: passwordHash,
        campus: campus || null,
        is_verified: Boolean(isVerified),
      })
      .select()
      .single()
  )
  return toUser(row)
}

/** True when the email is already taken (used to return a 409 before hashing). */
export async function emailExists(email) {
  const clean = String(email || '').toLowerCase().trim()
  if (!clean) return false
  const rows = unwrap(await supabase.from('users').select('id').eq('email', clean).limit(1))
  return rows.length > 0
}

/** Flip is_verified to true once a disciple completes email verification. */
export async function markUserVerified(email) {
  const clean = String(email || '').toLowerCase().trim()
  return unwrap(
    await supabase.from('users').update({ is_verified: true }).eq('email', clean).select()
  )
}

/** Replace a disciple's password hash (used by the reset-password flow). */
export async function updateUserPassword(email, passwordHash) {
  const clean = String(email || '').toLowerCase().trim()
  const rows = unwrap(
    await supabase.from('users').update({ password_hash: passwordHash }).eq('email', clean).select()
  )
  return rows.length > 0
}

// ============================================================================
// Admins (staff logins) — same shape the CSV store returns:
// { username, email, name, password } where password is the bcrypt hash.
// ============================================================================
export async function listAdmins(columns = 'id,username,email,name,password_hash,created_at') {
  return unwrap(
    await supabase.from('admins').select(columns).order('created_at', { ascending: true })
  ).map((row) => ({
    username: row.username,
    email: row.email,
    name: row.name,
    password: row.password_hash,
  }))
}

/** Replace an admin's password hash (used by the admin reset-password flow). */
export async function updateAdminPassword(email, passwordHash) {
  const clean = String(email || '').toLowerCase().trim()
  const rows = unwrap(
    await supabase.from('admins').update({ password_hash: passwordHash }).eq('email', clean).select()
  )
  return rows.length > 0
}

// ============================================================================
// Visitors ("Plan a Visit" leads) — maps created_at back to the CSV `date`
// column so the admin dashboard keeps working unchanged.
// ============================================================================
export async function insertVisitor({ name, email, phone, campus, message, status }) {
  return unwrap(
    await supabase.from('visitors').insert({
      name: String(name || '').trim() || 'Unknown',
      email: String(email || '').trim(),
      phone: phone || null,
      campus: campus || null,
      message: message || null,
      status: status || 'Pending Follow-up',
    })
  )
}

export async function listVisitors() {
  return unwrap(
    await supabase.from('visitors').select('id,created_at,name,email,phone,campus,message,status')
      .order('created_at', { ascending: true })
  ).map((row) => ({
    id: row.id,
    date: row.created_at,
    name: row.name,
    email: row.email,
    phone: row.phone,
    campus: row.campus,
    status: row.status,
    message: row.message,
  }))
}

// ============================================================================
// Sign-ins (login audit trail) — CSV `timestamp` <- created_at.
// ============================================================================
export async function insertSignIn({ name, email }) {
  return unwrap(
    await supabase.from('sign_ins').insert({
      name: String(name || '').trim(),
      email: String(email || '').trim(),
    })
  )
}

export async function listSignIns() {
  return unwrap(
    await supabase.from('sign_ins').select('id,created_at,name,email')
      .order('created_at', { ascending: true })
  ).map((row) => ({ timestamp: row.created_at, name: row.name, email: row.email }))
}

// ============================================================================
// Messages (contact-form / visit-plan messages) — CSV `date` <- created_at.
// ============================================================================
export async function insertMessage({ name, email, message }) {
  return unwrap(
    await supabase.from('messages').insert({
      name: String(name || '').trim() || 'Unknown',
      email: String(email || '').trim(),
      message: String(message || '').trim(),
    })
  )
}

export async function listMessages() {
  return unwrap(
    await supabase.from('messages').select('id,created_at,name,email,message')
      .order('created_at', { ascending: true })
  ).map((row) => ({ date: row.created_at, name: row.name, email: row.email, message: row.message }))
}

// ============================================================================
// Feedback — CSV `timestamp` <- created_at.
// ============================================================================
export async function insertFeedback({ email, name, category, message }) {
  return unwrap(
    await supabase.from('feedback').insert({
      email: String(email || '').trim() || null,
      name: String(name || '').trim() || null,
      category: category || 'Message',
      message: String(message || '').trim(),
    })
  )
}

export async function listFeedback() {
  return unwrap(
    await supabase.from('feedback').select('id,created_at,email,name,category,message')
      .order('created_at', { ascending: true })
  ).map((row) => ({
    timestamp: row.created_at,
    email: row.email,
    name: row.name,
    category: row.category,
    message: row.message,
  }))
}

// ============================================================================
// Announcements + per-disciple read receipts.
// Supabase stores the body in `message`; the API/CSV shape is `message_text`.
// ============================================================================
export async function insertAnnouncement({ id, message, created_at }) {
  return unwrap(
    await supabase.from('announcements').insert({
      id, // uuid shared with the CSV row so both stores stay in sync
      message: String(message || '').trim(),
      created_at: created_at || new Date().toISOString(),
    })
  )
}

export async function listAnnouncements() {
  return unwrap(
    await supabase.from('announcements').select('id,message,created_at')
      .order('created_at', { ascending: true })
  )
}

/** All read receipts joined with the reader's email (for the admin dashboard). */
export async function listAnnouncementReads() {
  return unwrap(
    await supabase.from('announcement_reads')
      .select('announcement_id,user_id,users(email)')
  ).map((row) => ({
    announcement_id: row.announcement_id,
    user_id: row.user_id,
    email: row.users?.email || null,
  }))
}

/** Announcement ids already read by one user (Set for O(1) lookups). */
export async function listAnnouncementReadIdsForUser(userId) {
  if (!userId) return new Set()
  const rows = unwrap(
    await supabase.from('announcement_reads').select('announcement_id').eq('user_id', userId)
  )
  return new Set(rows.map((r) => r.announcement_id))
}

/** Record a read receipt; onConflict makes double-clicks idempotent. */
export async function markAnnouncementReadRow({ announcementId, userId }) {
  return unwrap(
    await supabase
      .from('announcement_reads')
      .upsert(
        { announcement_id: announcementId, user_id: userId },
        { onConflict: 'announcement_id,user_id' }
      )
  )
}

// ============================================================================
// Verification codes (signup / portal OTP) — SHA-256 hash only, never the code.
// ============================================================================
export async function insertVerificationCode({ id, email, purpose, code_hash, expires_at, created_at }) {
  return unwrap(
    await supabase.from('verification_codes').insert({
      id, // uuid shared with the CSV row
      email: String(email || '').toLowerCase().trim(),
      purpose,
      code_hash,
      expires_at,
      created_at: created_at || new Date().toISOString(),
    })
  )
}

/** Latest unconsumed, unexpired row matching this exact code hash. */
export async function findVerificationCodeRow({ email, purpose, code_hash }) {
  const rows = unwrap(
    await supabase
      .from('verification_codes')
      .select('id,email,purpose,code_hash,expires_at,consumed_at,created_at')
      .eq('email', String(email || '').toLowerCase().trim())
      .eq('purpose', purpose)
      .eq('code_hash', code_hash)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
  )
  return rows[0] || null
}

/** Mark a code consumed so it can never be replayed. */
export async function consumeVerificationCodeRow(id) {
  return unwrap(
    await supabase
      .from('verification_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
  )
}
