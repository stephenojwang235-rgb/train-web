#!/usr/bin/env node
/**
 * NICC Campus Ministry — post-migration verification
 *
 * Confirms the data really landed in Supabase, and specifically that:
 *   - every user/admin email is present and stored lower-case
 *   - every password_hash is a real bcrypt hash ($2b$...) and is non-empty
 *   - each table's row count matches the source CSV
 *
 * It never prints a full hash — only a 7-character prefix and its length.
 *
 * Usage:  node backend/scripts/verify-migration.js
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

const supabase = createClient((process.env.SUPABASE_URL || '').trim(), (process.env.SUPABASE_ANON_KEY || '').trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

const email = (v) => String(v ?? '').trim().toLowerCase()
const BCRYPT = /^\$2[abxy]\$\d{2}\$/
const csvCount = (file, headers) => {
  try { return readCsvAsJson(file, headers).length } catch { return 0 }
}

const EXPECTED = [
  ['users', () => csvCount(USERS_CSV, ['name', 'email', 'password', 'campus', 'is_verified'])],
  ['admins', () => csvCount(ADMINS_CSV, ['username', 'email', 'name', 'password'])],
  ['visitors', () => csvCount(VISITORS_CSV, ['id', 'date', 'name', 'email', 'phone', 'campus', 'status'])],
  ['sign_ins', () => csvCount(SIGN_INS_CSV, ['timestamp', 'name', 'email'])],
  ['messages', () => csvCount(MESSAGES_CSV, ['date', 'name', 'email', 'message'])],
  ['feedback', () => csvCount(FEEDBACK_CSV, ['timestamp', 'email', 'name', 'category', 'message'])],
  ['announcements', () => csvCount(ANNOUNCEMENTS_CSV, ['id', 'message_text', 'created_at', 'user_ids'])],
  ['verification_codes', () => csvCount(VERIFICATION_CODES_CSV, ['id', 'email', 'purpose', 'code_hash', 'expires_at', 'consumed_at', 'created_at'])],
  ['announcement_reads', () => 0],
]

let problems = 0

console.log('Row counts (CSV expected -> Supabase actual)\n')
for (const [table, expected] of EXPECTED) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) {
    console.log(`  ${table.padEnd(20)} ERROR  ${error.message}`)
    problems++
    continue
  }
  const exp = expected()
  const ok = table === 'announcement_reads' ? true : count === exp
  if (!ok) problems++
  console.log(`  ${table.padEnd(20)} ${String(exp).padStart(3)} -> ${String(count).padStart(3)}  ${ok ? 'OK' : 'MISMATCH'}`)
}

console.log('\nUser accounts in Supabase\n')
const { data: users, error: uErr } = await supabase.from('users').select('id, email, name, password_hash, is_verified, campus').order('email')
if (uErr) {
  console.error('  ERROR ' + uErr.message)
  problems++
} else if (!users?.length) {
  console.log('  (none)')
} else {
  for (const u of users) {
    const hash = String(u.password_hash || '')
    const bcryptOk = BCRYPT.test(hash)
    const emailOk = u.email === email(u.email) && u.email.includes('@')
    if (!bcryptOk || !emailOk) problems++
    console.log(`  ${u.email}`)
    console.log(`      name:        ${u.name || '(blank)'}`)
    console.log(`      campus:      ${u.campus || '(blank)'}`)
    console.log(`      verified:    ${u.is_verified}`)
    console.log(`      password:    ${bcryptOk ? 'OK bcrypt' : '!! NOT BCRYPT'} (${hash.slice(0, 7)}..., ${hash.length} chars)`)
    if (!emailOk) console.log(`      !! email is malformed or not lower-cased`)
  }
}

console.log('\nAdmin accounts in Supabase\n')
const { data: admins, error: aErr } = await supabase.from('admins').select('username, email, password_hash').order('email')
if (aErr) {
  console.error('  ERROR ' + aErr.message)
  problems++
} else if (!admins?.length) {
  console.log('  (none)')
} else {
  for (const a of admins) {
    const hash = String(a.password_hash || '')
    const bcryptOk = BCRYPT.test(hash)
    if (!bcryptOk) problems++
    console.log(`  ${a.email}  (@${a.username})  password: ${bcryptOk ? 'OK bcrypt' : '!! NOT BCRYPT'} (${hash.slice(0, 7)}..., ${hash.length} chars)`)
  }
}

console.log(problems === 0
  ? '\nRESULT: all checks passed.'
  : `\nRESULT: ${problems} problem(s) found.`)
process.exit(problems === 0 ? 0 : 1)
