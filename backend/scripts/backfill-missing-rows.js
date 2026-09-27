#!/usr/bin/env node
/**
 * NICC Campus Ministry — CSV → Supabase gap backfill
 *
 * Rows written while the backend was still in local-CSV mode (i.e. after the
 * one-off migration snapshot but before SUPABASE_URL was configured) exist in
 * backend/data/*.csv but never reached the cloud. This script finds exactly
 * those rows and inserts them, preserving their ORIGINAL timestamps.
 *
 * It is idempotent and safe to re-run:
 *   - sign_ins / feedback / messages / visitors match on email (+ message) with
 *     a ±10 min time window, to absorb the small clock skew between this machine
 *     and the database server.
 *   - verification_codes match on their primary-key uuid.
 * Nothing is ever deleted or updated, and CSV files are never modified (the
 * rows are already there).
 *
 * Usage:
 *   node backend/scripts/backfill-missing-rows.js --dry-run
 *   node backend/scripts/backfill-missing-rows.js
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  readCsvAsJson, SIGN_INS_CSV, FEEDBACK_CSV, MESSAGES_CSV, VISITORS_CSV,
  VERIFICATION_CODES_CSV,
} from '../csvStore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config()

const DRY_RUN = process.argv.includes('--dry-run')
const URL = (process.env.SUPABASE_URL || '').trim()
const KEY = (process.env.SUPABASE_ANON_KEY || '').trim()
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Add them to .env first.')
  process.exit(1)
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const WINDOW_MS = 10 * 60 * 1000
const email = (v) => String(v ?? '').trim().toLowerCase()
const ms = (t) => { const d = new Date(t); return Number.isNaN(d.getTime()) ? null : d.getTime() }
const near = (a, b) => a !== null && b !== null && Math.abs(a - b) <= WINDOW_MS
const iso = (t) => { const v = ms(t); return v === null ? null : new Date(v).toISOString() }
const text = (v) => (String(v ?? '').trim() ? String(v).trim() : null)

async function cloudRows(table) {
  const { data, error } = await supabase.from(table).select('*')
  if (error) throw new Error(`Supabase read ${table}: ${error.message}`)
  return data || []
}

async function insertRows(table, rows, label) {
  if (rows.length === 0) {
    console.log(`  ${label.padEnd(20)} 0 row(s) — already in sync`)
    return 0
  }
  if (DRY_RUN) {
    console.log(`  ${label.padEnd(20)} ${rows.length} row(s) would be inserted`)
    return 0
  }
  const { error } = await supabase.from(table).insert(rows)
  if (error) {
    console.error(`  ${label.padEnd(20)} FAILED: ${error.message}`)
    return 0
  }
  console.log(`  ${label.padEnd(20)} ${rows.length} row(s) inserted`)
  return rows.length
}

let total = 0

// --- sign_ins ---------------------------------------------------------------
{
  const csv = readCsvAsJson(SIGN_INS_CSV, ['timestamp', 'name', 'email'])
  const cloud = await cloudRows('sign_ins')
  const missing = csv.filter((r) => {
    const e = email(r.email)
    return e && !cloud.some((c) => email(c.email) === e && near(ms(r.timestamp), ms(c.created_at)))
  }).map((r) => ({
    name: String(r.name || '').trim() || email(r.email).split('@')[0],
    email: email(r.email),
    created_at: iso(r.timestamp) || new Date().toISOString(),
  }))
  total += await insertRows('sign_ins', missing, 'sign_ins')
}

// --- feedback --------------------------------------------------------------
// Match on email + timestamp (+ message). When the cloud copy is a strict
// PREFIX of the CSV message, the row was truncated by the previous line-based
// parser, so it is repaired in place instead of being inserted again.
{
  const csv = readCsvAsJson(FEEDBACK_CSV, ['timestamp', 'email', 'name', 'category', 'message'])
  const cloud = await cloudRows('feedback')
  const missing = []
  const repairs = []
  for (const r of csv) {
    const m = String(r.message || '').trim()
    if (!m) continue
    const e = email(r.email)
    const candidates = cloud.filter((c) => email(c.email) === e && near(ms(r.timestamp), ms(c.created_at)))
    if (candidates.some((c) => String(c.message || '').trim() === m)) continue // already identical
    const truncated = candidates.find((c) => m.startsWith(String(c.message || '').trim()))
    if (truncated) {
      repairs.push({ id: truncated.id, message: m })
      console.log(`  feedback             repairing truncated message (${String(truncated.message).length} → ${m.length} chars)`)
      continue
    }
    missing.push({
      email: e || null,
      name: text(r.name),
      category: text(r.category) || 'Message',
      message: m,
      created_at: iso(r.timestamp) || new Date().toISOString(),
    })
  }
  if (repairs.length && !DRY_RUN) {
    for (const fix of repairs) {
      const { error } = await supabase.from('feedback').update({ message: fix.message }).eq('id', fix.id)
      if (error) console.error(`  feedback             repair FAILED: ${error.message}`)
    }
    console.log(`  feedback             ${repairs.length} truncated message(s) repaired (updates, not new rows)`)
  }
  total += await insertRows('feedback', missing, 'feedback')
}

// --- messages --------------------------------------------------------------
{
  const csv = readCsvAsJson(MESSAGES_CSV, ['date', 'name', 'email', 'message'])
  const cloud = await cloudRows('messages')
  const missing = csv.filter((r) => {
    if (!String(r.message || '').trim()) return false
    const e = email(r.email)
    const m = String(r.message).trim()
    return !cloud.some((c) => email(c.email) === e && near(ms(r.date), ms(c.created_at)) && String(c.message || '').trim() === m)
  }).map((r) => ({
    name: String(r.name || '').trim() || 'Unknown',
    email: email(r.email),
    message: String(r.message).trim(),
    created_at: iso(r.date) || new Date().toISOString(),
  }))
  total += await insertRows('messages', missing, 'messages')
}

// --- visitors --------------------------------------------------------------
{
  const csv = readCsvAsJson(VISITORS_CSV, ['id', 'date', 'name', 'email', 'phone', 'campus', 'status'])
  const cloud = await cloudRows('visitors')
  const missing = csv.filter((r) => {
    const e = email(r.email)
    return e && !cloud.some((c) => email(c.email) === e && near(ms(r.date), ms(c.created_at)))
  }).map((r) => ({
    name: String(r.name || '').trim() || 'Unknown',
    email: email(r.email),
    phone: text(r.phone),
    campus: text(r.campus),
    status: text(r.status) || 'Pending Follow-up',
    created_at: iso(r.date) || new Date().toISOString(),
  }))
  total += await insertRows('visitors', missing, 'visitors')
}

// --- verification_codes ----------------------------------------------------
// Matched on (email, purpose, code_hash) rather than the uuid: the one-off
// migration let Postgres assign fresh uuids, so identical codes can exist under
// different ids. Matching on the hash keeps this duplicate-free.
{
  const csv = readCsvAsJson(VERIFICATION_CODES_CSV, ['id', 'email', 'purpose', 'code_hash', 'expires_at', 'consumed_at', 'created_at'])
  const cloud = await cloudRows('verification_codes')
  const missing = csv
    .filter((r) => {
      const e = email(r.email)
      const h = String(r.code_hash || '').trim()
      if (!r.id || !e || !h) return false
      return !cloud.some((c) => email(c.email) === e && String(c.code_hash || '').trim() === h)
    })
    .map((r) => ({
      id: r.id,
      email: email(r.email),
      purpose: ['signup', 'portal', 'reset'].includes(String(r.purpose || '').trim()) ? String(r.purpose).trim() : 'signup',
      code_hash: String(r.code_hash).trim(),
      expires_at: iso(r.expires_at) || new Date(Date.now() - 86_400_000).toISOString(),
      consumed_at: iso(r.consumed_at),
      created_at: iso(r.created_at) || new Date().toISOString(),
    }))
  total += await insertRows('verification_codes', missing, 'verification_codes')
}

console.log(`\nDone. ${total} row(s) ${DRY_RUN ? 'would be ' : ''}backfilled into Supabase.${DRY_RUN ? ' (dry run)' : ''}`)
