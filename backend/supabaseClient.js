// ---- Supabase data layer ----------------------------------------------------
// Credentials come from the environment only; nothing is hard-coded here.
//   SUPABASE_URL       -> Project Settings > Data API
//   SUPABASE_ANON_KEY  -> Project Settings > Data API > anon public key
//
// The backend is the ONLY thing that talks to the database. The browser never
// receives these keys, and Row Level Security (see supabase/schema.sql) keeps
// the anon key from being useful to anyone who finds it.
import { createClient } from '@supabase/supabase-js'

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
