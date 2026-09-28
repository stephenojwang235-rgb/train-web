import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// ---- Load .env files regardless of cwd ---------------------------------
// Order matters: the ROOT .env is loaded first so its GMAIL_APP_PASSWORD takes
// priority, then backend/.env, then a plain cwd .env as a final fallback.
// dotenv never overwrites variables that are already set, so the first
// definition of a key wins.
try {
  const __fn = fileURLToPath(import.meta.url)
  const __backendDir = path.dirname(__fn)
  const __rootDir = path.join(__backendDir, '..')
  dotenv.config({ path: path.join(__rootDir, '.env') })
  dotenv.config({ path: path.join(__backendDir, '.env') })
} catch { /* fallback to cwd .env */ }
dotenv.config()
import express from 'express'
import cors from 'cors'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { Resend } from 'resend'
import bcrypt from 'bcrypt'
import {
  isSupabaseConfigured, listUsers, findUserByEmail, insertUser,
  emailExists, markUserVerified, updateUserPassword, updateAdminPassword,
  listAdmins, insertVisitor, listVisitors, insertSignIn, listSignIns,
  insertMessage, listMessages, insertFeedback, listFeedback,
  insertAnnouncement, listAnnouncements, listAnnouncementReads,
  listAnnouncementReadIdsForUser, markAnnouncementReadRow,
  insertVerificationCode, findVerificationCodeRow, consumeVerificationCodeRow,
} from './supabaseClient.js'
import {
  DATA_DIR, VISITORS_CSV, SIGN_INS_CSV, MESSAGES_CSV, ADMINS_CSV, USERS_CSV, FEEDBACK_CSV, ANNOUNCEMENTS_CSV, VERIFICATION_CODES_CSV, ensureDataFiles,
  appendRow, readCsvAsJson, updatePasswordCsv, updateUserVerified, updateVerificationCode, markAnnouncementRead, escapeCsv,
} from './csvStore.js'

ensureDataFiles()
const app = express()
const PORT = process.env.PORT || 5000
app.use(cors())
app.use(express.json())

// ---- NICC email delivery via Resend HTTP API (env-based, no raw secrets) ----
// Render's free tier blocks outbound SMTP ports (25/465/587), so nodemailer
// can never connect from the cloud server. Resend sends over HTTPS (port 443),
// which is always open. See https://resend.com - free tier = 3,000 emails/mo.
//   EMAIL_API_KEY  = Resend API key (starts with "re_"; Dashboard > API Keys)
//   EMAIL_FROM     = verified sender, e.g. "NICC Campus Ministry <noreply@yourdomain.com>"
//                    Until a domain is verified, Resend only delivers to the
//                    account owner's email - perfect for testing.
const EMAIL_API_KEY = (process.env.EMAIL_API_KEY || '').trim()
const EMAIL_FROM = (process.env.EMAIL_FROM || 'NICC Campus Ministry <onboarding@resend.dev>').trim()

let resend = null
if (EMAIL_API_KEY) {
  if (!EMAIL_API_KEY.startsWith('re_')) {
    console.error('NICC email configuration error: EMAIL_API_KEY should be a Resend key starting with "re_".')
    console.error('   -> Resend Dashboard -> API Keys -> Create API Key -> copy the re_... value.')
    process.env.EMAIL_API_VALIDATED = 'false'
  } else {
    try {
      resend = new Resend(EMAIL_API_KEY)
      console.log(`NICC email: Resend HTTP API client ready (sender: ${EMAIL_FROM}).`)
      process.env.EMAIL_API_VALIDATED = 'true'
    } catch (mailErr) {
      console.error('Resend client setup failed:', mailErr)
      resend = null
      process.env.EMAIL_API_VALIDATED = 'false'
    }
  }
} else {
  console.log('NICC email NOT configured (missing EMAIL_API_KEY in env). Set a Resend key to enable OTP emails.')
  process.env.EMAIL_API_VALIDATED = 'false'
}

// ---- Legacy Gmail SMTP settings (kept for local dev only) -----------------
// Local `node server.js` can still reach smtp.gmail.com:465 from your own
// network, so the old variables are honoured as a fallback when no Resend key
// is configured. On Render (SMTP ports blocked) they are ignored entirely.
const SMTP_USER = (process.env.GMAIL_USER || process.env.EMAIL_USER || '').trim()
const SMTP_PASS = String(process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || '').replace(/\s+/g, '')
const SMTP_AVAILABLE = Boolean(SMTP_USER && SMTP_PASS && SMTP_PASS.length === 16)
if (SMTP_USER && SMTP_PASS && SMTP_PASS.length !== 16) {
  console.error(
    `NICC SMTP note: EMAIL_PASS is not a 16-char Google App Password (${SMTP_PASS.length} chars) - local SMTP fallback disabled; Resend will be used.`
  )
}
// ---- One send path for every OTP / notification email ---------------------
// Central helper so delivery behaviour, logging and the result are
// identical on all routes. Returns { ok: true } or { ok: false, error } - never throws.
//
// Delivery order:
//   1. Resend HTTP API (EMAIL_API_KEY) - works everywhere incl. Render free
//      tier, because it is plain HTTPS on port 443.
//   2. Legacy Gmail SMTP (local dev only) - dynamic import of nodemailer so the
//      package is not even loaded on Render. Skipped automatically when the
//      server runs in production (NODE_ENV=production) since those ports are
//      blocked there.
async function sendOtpEmail({ to, subject, text, html, tag = 'otp' }) {
  const cleanTo = String(to || '').trim()
  if (!cleanTo) return { ok: false, error: new Error('No recipient address') }

  // --- Path 1: Resend HTTP API (primary, cloud-safe) ---
  if (resend) {
    try {
      console.log(`[${tag}] BEFORE send: emailing ${cleanTo} via Resend API`)
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: [cleanTo],
        subject,
        text,
        html,
      })
      if (error) throw new Error(error.message || 'Resend API error')
      console.log(`[${tag}] AFTER send SUCCESS: emailed ${cleanTo} via Resend (id: ${data?.id || 'n/a'})`)
      return { ok: true }
    } catch (mailErr) {
      console.error(`[${tag}] Resend send FAILED:`)
      console.error(`[${tag}]   error name   :`, mailErr?.name)
      console.error(`[${tag}]   error code   :`, mailErr?.code || mailErr?.statusCode)
      console.error(`[${tag}]   error message:`, mailErr?.message)
      // Common Resend errors:
      //   "The from address ... must be a verified domain" -> verify a domain
      //   at resend.com/domains, or keep EMAIL_FROM as onboarding@resend.dev
      //   "You can only send to ..." -> unverified account: recipients limited
      //   to the account owner until a domain is verified.
      return { ok: false, error: mailErr }
    }
  }

  // --- Path 2: legacy Gmail SMTP (local dev only) ---
  // Production (Render) blocks SMTP ports, so don't even try there.
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.log(`[${tag}] email NOT sent: EMAIL_API_KEY missing and SMTP is blocked on Render - verification code remains server-side.`)
    return { ok: false, error: null }
  }
  if (!SMTP_AVAILABLE) {
    console.log(`[${tag}] email NOT available (no EMAIL_API_KEY and no valid Gmail App Password) - verification code remains server-side; delivery must be retried.`)
    return { ok: false, error: null }
  }
  try {
    const { default: nodemailer } = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4, // force IPv4 (Node prefers IPv6; many networks lack IPv6 routes)
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    })
    console.log(`[${tag}] BEFORE sendMail: emailing ${cleanTo} via Gmail SMTP (local fallback)`)
    await transport.sendMail({
      from: `"NICC Campus Ministry" <${SMTP_USER}>`,
      to: cleanTo, subject, text, html,
    })
    console.log(`[${tag}] AFTER sendMail SUCCESS: emailed ${cleanTo} via Gmail SMTP`)
    return { ok: true }
  } catch (mailErr) {
    console.error(`[${tag}] Gmail SMTP fallback FAILED:`)
    console.error(`[${tag}]   error name   :`, mailErr?.name)
    console.error(`[${tag}]   error code   :`, mailErr?.code)
    console.error(`[${tag}]   error message:`, mailErr?.message)
    return { ok: false, error: mailErr }
  }
}

// Never return authentication codes in HTTP responses. This is intentionally
// fixed off for all environments; delivery failure returns a generic error only.
const REVEAL_OTP_IN_RESPONSE = false

function smtpFailureMessage(lastSmtpError) {
  return lastSmtpError
    ? `Email delivery failed: ${lastSmtpError?.message || lastSmtpError}`
    : 'Email not configured — set EMAIL_API_KEY (Resend) in the environment and restart the backend.'
}

// Single source of truth for "we verified you, but could not email the code".
// The flow still advances to Phase 2 (ok: true) instead of dead-ending on a 500,
// and the message tells the user exactly how to obtain the code.
function otpDeliveryFailure(code, errorMessage, tag = 'otp') {
  console.error(`[${tag}] delivered OTP locally only: ${errorMessage}`)
  return {
    ok: true,
    requiresOtp: true,
    emailSent: false,
    deliveryError: errorMessage,
    deliveryWarning: 'Email delivery failed. Please request a new code or contact a campus leader if the email does not arrive.',
  }
}

// ---- Password matching: supports plaintext (legacy CSV value) OR SHA-256 hash ----
// `hashPassword` produces a 64-char hex string; passwordMatches accepts either
// storage format so existing plaintext CSV rows keep working and hashed rows verify.
function hashPassword(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}
function passwordMatches(stored, input) {
  const plain = String(stored == null ? '' : stored)
  const typed = String(input)
  if (!plain || !typed) return false
  if (plain === typed) return true
  if (/^[a-f0-9]{64}$/.test(plain)) return plain === hashPassword(typed)
  // bcrypt hashes start with $2a$ / $2b$ / $2x$ / $2y$
  if (/^\$2[abxy]\$/.test(plain)) {
    try { return bcrypt.compareSync(typed, plain) } catch { return false }
  }
  return false
}

// Registered disciple accounts. Backed by the Supabase `users` table when
// SUPABASE_URL + SUPABASE_ANON_KEY are configured, otherwise the legacy
// users.csv. Both paths return the same shape, so callers are unaware of the
// difference. See backend/supabaseClient.js.
function loadDisciplesFromCsv() {
  try {
    return readCsvAsJson(USERS_CSV, ['name', 'email', 'password', 'campus', 'is_verified'])
  } catch {
    return []
  }
}

/** Synchronous read. Only the CSV store can answer synchronously, so in Supabase
 *  mode this returns the legacy file (or [] if it doesn't exist). New and
 *  updated code should `await listDisciples()`, which always returns fresh data. */
function loadDisciples() {
  return loadDisciplesFromCsv()
}

/** Preferred accessor: always returns current data, from Supabase when available. */
async function listDisciples() {
  if (isSupabaseConfigured) {
    try {
      return await listUsers()
    } catch (err) {
      console.error('[supabase] listUsers failed, falling back to CSV:', err.message)
      return loadDisciplesFromCsv()
    }
  }
  return loadDisciplesFromCsv()
}

async function findDisciple({ email = '', password = '' }) {
  const cleanEmail = String(email).toLowerCase().trim()
  const pass = String(password)
  if (!cleanEmail || pass === '') return null
  const candidates = await listDisciples()
  return candidates.find((r) => {
    const rowEmail = String(r.email || '').toLowerCase().trim()
    return rowEmail === cleanEmail && passwordMatches(String(r.password || ''), pass)
  }) || null
}

/** Look up by email only (no password) — used by the OTP verification routes. */
async function findDiscipleByEmail(email) {
  const cleanEmail = String(email).toLowerCase().trim()
  if (!cleanEmail) return null
  if (isSupabaseConfigured) {
    try {
      return await findUserByEmail(cleanEmail)
    } catch (err) {
      console.error('[supabase] findUserByEmail failed:', err.message)
    }
  }
  const rows = await listDisciples()
  return rows.find((r) => String(r.email || '').toLowerCase().trim() === cleanEmail) || null
}

// ---- Dual-write: local CSV mirror + cloud --------------------------------
// Every write below goes to the local CSV first (always available, never
// lost) and then to Supabase when configured. A cloud failure is logged but
// never fails the request — the CSV copy keeps the data safe — so no record
// can be missed on either side.
async function writeBoth(label, csvWrite, cloudWrite) {
  try {
    csvWrite()
  } catch (err) {
    console.error(`[csv] ${label} write failed:`, err.message)
    throw err // preserve the old behaviour: a failed CSV write is a 500
  }
  if (isSupabaseConfigured && cloudWrite) {
    try {
      await cloudWrite()
    } catch (err) {
      console.error(`[supabase] ${label} insert FAILED — row kept in CSV only:`, err.message)
    }
  }
}

// Sign-in audit log: CSV mirror + cloud, always both.
async function logSignIn(name, email) {
  await writeBoth('sign_ins',
    () => appendRow(SIGN_INS_CSV, [new Date().toISOString(), name, email]),
    () => insertSignIn({ name, email }))
}

// Keep users.csv as a live mirror of the cloud users table (idempotent —
// never appends a duplicate email), so a later cloud outage still has every
// account, verified flag and password reset.
function mirrorUserToCsv({ name, email, passwordHash, campus, isVerified }) {
  try {
    const rows = readCsvAsJson(USERS_CSV, ['name', 'email', 'password', 'campus', 'is_verified'])
    if (rows.some((r) => String(r.email || '').toLowerCase().trim() === String(email).toLowerCase().trim())) return
    appendRow(USERS_CSV, [name, email, passwordHash, campus, isVerified ? 'true' : 'false'])
  } catch (err) {
    console.error('[csv] user mirror failed:', err.message)
  }
}

const VERIFICATION_TTL_MS = 15 * 60 * 1000
function verificationHash(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex')
}
function loadVerificationRecords() {
  try { return readCsvAsJson(VERIFICATION_CODES_CSV, ['id', 'email', 'purpose', 'code_hash', 'expires_at', 'consumed_at', 'created_at']) } catch { return [] }
}
async function createVerificationCode({ email, purpose }) {
  const cleanEmail = String(email).toLowerCase().trim()
  const code = String(crypto.randomInt(100000, 1000000))
  const now = new Date()
  const record = { id: crypto.randomUUID(), email: cleanEmail, purpose, code_hash: verificationHash(code), expires_at: new Date(now.getTime() + VERIFICATION_TTL_MS).toISOString(), consumed_at: '', created_at: now.toISOString() }
  // CSV keeps a local copy for offline recovery; cloud is the primary store.
  await writeBoth('verification_codes',
    () => appendRow(VERIFICATION_CODES_CSV, [record.id, record.email, record.purpose, record.code_hash, record.expires_at, '', record.created_at]),
    () => insertVerificationCode({ id: record.id, email: record.email, purpose: record.purpose, code_hash: record.code_hash, expires_at: record.expires_at, created_at: record.created_at }))
  return { code, record }
}
async function findVerificationCode({ email, purpose, code }) {
  const cleanEmail = String(email).toLowerCase().trim()
  const cleanCode = String(code).trim()
  const codeHash = verificationHash(cleanCode)
  // Cloud primary: latest unconsumed, unexpired row matching the hash.
  if (isSupabaseConfigured) {
    try {
      const row = await findVerificationCodeRow({ email: cleanEmail, purpose, code_hash: codeHash })
      if (row) {
        await consumeVerificationCodeRow(row.id)
        // Consume the local mirror too when it carries the same id.
        try { if (loadVerificationRecords().some((r) => r.id === row.id)) updateVerificationCode(VERIFICATION_CODES_CSV, row.id) } catch { /* mirror is best-effort */ }
        return row
      }
      // No cloud match — also check the CSV so a code issued during a cloud
      // outage still verifies (then consume it in both stores below).
    } catch (err) {
      console.error('[supabase] findVerificationCodeRow failed, falling back to CSV:', err.message)
    }
  }
  const record = loadVerificationRecords().find((r) => r.email === cleanEmail && r.purpose === purpose && !r.consumed_at && new Date(r.expires_at).getTime() > Date.now() && timingSafeEqual(Buffer.from(r.code_hash), Buffer.from(codeHash)))
  if (!record) return null
  const rows = loadVerificationRecords()
  const index = rows.findIndex((r) => r.id === record.id)
  if (index >= 0) updateVerificationCode(VERIFICATION_CODES_CSV, record.id)
  if (isSupabaseConfigured) {
    try { await consumeVerificationCodeRow(record.id) } catch { /* already consumed in cloud or row missing */ }
  }
  return record
}
function timingSafeEqual(a, b) {
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// admins.csv / admins table: username,email,name,password
// Reads the cloud admins table when configured, else the CSV — both return the
// same { username, email, name, password } shape (password = bcrypt hash).
async function loadAdminRows() {
  if (isSupabaseConfigured) {
    try {
      const rows = await listAdmins()
      if (rows.length) return rows
    } catch (err) {
      console.error('[supabase] listAdmins failed, falling back to admins.csv:', err.message)
    }
  }
  try {
    const rows = readCsvAsJson(ADMINS_CSV, ['username', 'email', 'name', 'password'])
    if (rows.length) return rows
  } catch { /* fall through to env seed */ }
  // Fallback to env on first run if CSV is still empty/untouched.
  const envEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim()
  const envPass = process.env.ADMIN_PASSWORD || ''
  if (envEmail && envPass) {
    return [{ username: 'admin', email: envEmail, name: 'Admin', password: envPass }]
  }
  return []
}

// Typing exactly "admin" on the login screen routes here.
async function findAdmin({ username = '', email = '', password = '' }) {
  const cleanUser = String(username).toLowerCase().trim()
  const cleanEmail = String(email).toLowerCase().trim()
  const pass = String(password)
  const rows = await loadAdminRows()
  return rows.find((r) => {
    const rowUser = String(r.username || '').toLowerCase().trim()
    const rowEmail = String(r.email || '').toLowerCase().trim()
    const identityMatch =
      (cleanUser && (cleanUser === rowUser || cleanUser === rowEmail)) ||
      (cleanEmail && (cleanEmail === rowEmail || cleanEmail === rowUser))
    return identityMatch && passwordMatches(String(r.password || ''), pass)
  }) || null
}
const adminSessions = new Map() // token -> { email, name, createdAt }
const discipleSessions = new Map() // token -> { email, name, campus, createdAt }

// Check whether an email/username belongs to an Admin (data/admins.csv), regardless
// of password â€” used at Phase 2 (OTP verify) to grant admin token/route privileges.
// Check whether an email/username belongs to an Admin (admins table or
// admins.csv), regardless of password — used at Phase 2 (OTP verify) to grant
// admin token/route privileges.
async function isAdminEmail(identity) {
  const clean = String(identity || '').toLowerCase().trim()
  if (!clean) return false
  const rows = await loadAdminRows()
  return rows.some((r) => {
    const rowUser = String(r.username || '').toLowerCase().trim()
    const rowEmail = String(r.email || '').toLowerCase().trim()
    return clean === rowUser || clean === rowEmail
  })
}

function requireAdmin(req, res, next) {
  try {
    const token = req.headers['x-admin-token'] || req.query.adminToken || ''
    if (!token || !adminSessions.has(String(token))) {
      return res.status(401).json({ ok: false, error: 'Admin login required.' })
    }
    req.admin = adminSessions.get(String(token))
    next()
  } catch {
    return res.status(401).json({ ok: false, error: 'Admin login required.' })
  }
}

function discipleUserId(email) {
  return 'disciple-' + Buffer.from(String(email).toLowerCase().trim()).toString('hex')
}

function requireDisciple(req, res, next) {
  try {
    const token = req.headers['x-user-token'] || ''
    if (!token || !discipleSessions.has(String(token))) {
      return res.status(401).json({ ok: false, error: 'Disciple login required.' })
    }
    req.disciple = discipleSessions.get(String(token))
    next()
  } catch {
    return res.status(401).json({ ok: false, error: 'Disciple login required.' })
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'nicc-campus-backend', time: new Date().toISOString() })
})

// POST /api/visit-plan -> visitors.csv + cloud visitors row (status = Pending Follow-up)
app.post('/api/visit-plan', async (req, res) => {
  try {
    const { name = '', email = '', phone = '', campus = '', message = '' } = req.body || {}
    if (!String(name).trim() || !String(email).trim()) {
      return res.status(400).json({ ok: false, error: 'name and email are required' })
    }
    const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex')
    const nowIso = new Date().toISOString()
    const cleanMessage = String(message).trim()
    await writeBoth('visitors',
      () => appendRow(VISITORS_CSV, [id, nowIso, name, email, phone, campus, 'Pending Follow-up']),
      () => insertVisitor({ name, email, phone, campus, message: cleanMessage || null, status: 'Pending Follow-up' }))
    // Also log the visitor message so admins can read it later
    if (cleanMessage) {
      try {
        await writeBoth('messages',
          () => appendRow(MESSAGES_CSV, [nowIso, name, email, cleanMessage]),
          () => insertMessage({ name, email, message: cleanMessage }))
      } catch (msgErr) {
        console.error('messages write failed:', msgErr)
      }
    }
    if (cleanMessage) console.log(`[visit-plan] ${name} <${email}>: ${cleanMessage}`)
    res.status(201).json({ ok: true, id, status: 'Pending Follow-up' })
  } catch (err) {
    console.error('POST /api/visit-plan failed:', err)
    res.status(500).json({ ok: false, error: 'Could not save visit plan.' })
  }
})

app.get('/api/admin/visitors', requireAdmin, async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try { return res.json(await listVisitors()) } catch (err) { console.error('[supabase] listVisitors failed, falling back to CSV:', err.message) }
    }
    res.json(readCsvAsJson(VISITORS_CSV, ['id', 'date', 'name', 'email', 'phone', 'campus', 'status']))
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Could not read visitors data' })
  }
})

app.get('/api/admin/signins', requireAdmin, async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try { return res.json(await listSignIns()) } catch (err) { console.error('[supabase] listSignIns failed, falling back to CSV:', err.message) }
    }
    res.json(readCsvAsJson(SIGN_INS_CSV, ['timestamp', 'name', 'email']))
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Could not read sign-ins data' })
  }
})

app.get('/api/admin/messages', requireAdmin, async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try { return res.json(await listMessages()) } catch (err) { console.error('[supabase] listMessages failed, falling back to CSV:', err.message) }
    }
    res.json(readCsvAsJson(MESSAGES_CSV, ['date', 'name', 'email', 'message']))
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Could not read messages data' })
  }
})

// ---- Announcements: persistent global notices with per-disciple read receipts ----
function readAnnouncementsFromCsv() {
  return readCsvAsJson(ANNOUNCEMENTS_CSV, ['id', 'message_text', 'created_at', 'user_ids'])
    .map((row) => {
      let userIds = []
      try {
        const parsed = JSON.parse(row.user_ids || '[]')
        if (Array.isArray(parsed)) userIds = parsed.map(String)
      } catch { /* preserve malformed receipt as empty */ }
      return { id: row.id, message_text: row.message_text, created_at: row.created_at, user_ids: userIds }
    })
    .reverse()
}

// Cloud or CSV, newest first, always in the API shape {id, message_text,
// created_at, user_ids[]}. user_ids keeps the legacy 'disciple-<hex>' ids for
// the admin dashboard count; the cloud keeps the same ids via email mapping.
async function readAnnouncements() {
  if (isSupabaseConfigured) {
    try {
      const [anns, reads] = await Promise.all([listAnnouncements(), listAnnouncementReads()])
      const legacyIdsByEmail = new Map()
      for (const read of reads) {
        if (!read.email) continue
        if (!legacyIdsByEmail.has(read.announcement_id)) legacyIdsByEmail.set(read.announcement_id, [])
        legacyIdsByEmail.get(read.announcement_id).push(discipleUserId(read.email))
      }
      return anns
        .map((a) => ({
          id: a.id,
          message_text: a.message,
          created_at: a.created_at,
          user_ids: legacyIdsByEmail.get(a.id) || [],
        }))
        .reverse()
    } catch (err) {
      console.error('[supabase] listAnnouncements failed, falling back to CSV:', err.message)
    }
  }
  return readAnnouncementsFromCsv()
}

app.get('/api/admin/announcements', requireAdmin, async (req, res) => {
  try {
    res.json(await readAnnouncements())
  } catch (err) {
    console.error('GET /api/admin/announcements failed:', err)
    res.status(500).json({ ok: false, error: 'Could not read announcements data' })
  }
})

async function sendAnnouncementEmails(announcement) {
  const recipients = [...new Set((await listDisciples())
    .map((row) => String(row.email || '').trim().toLowerCase())
    .filter((email) => EMAIL_REGEX.test(email)))]
  let sent = 0
  let failed = 0
  let next = 0
  const worker = async () => {
    while (next < recipients.length) {
      const index = next++
      const delivery = await sendOtpEmail({
        to: recipients[index],
        tag: 'announcement',
        subject: 'New announcement from NICC Campus Ministry',
        text: announcement.message_text,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>NICC Campus Ministry</h2><p>${String(announcement.message_text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}</p></div>`,
      })
      if (delivery.ok) sent += 1
      else failed += 1
    }
  }
  // Keep Gmail and the admin request responsive while limiting simultaneous sends.
  await Promise.all(Array.from({ length: Math.min(5, recipients.length) }, worker))
  console.log(`[announcement] ${announcement.id} email fan-out complete: ${sent} sent, ${failed} failed, ${recipients.length} recipients`)
  return { sent, failed, recipients: recipients.length }
}

app.post('/api/admin/announcements', requireAdmin, async (req, res) => {
  try {
    const messageText = String(req.body?.message_text || '').trim()
    if (!messageText) return res.status(400).json({ ok: false, error: 'Announcement text is required.' })
    if (messageText.length > 1000) return res.status(400).json({ ok: false, error: 'Announcement must be 1,000 characters or fewer.' })
    const announcement = {
      id: crypto.randomUUID(), // uuid shared by CSV row + cloud row
      message_text: messageText,
      created_at: new Date().toISOString(),
      user_ids: [],
    }
    await writeBoth('announcements',
      () => appendRow(ANNOUNCEMENTS_CSV, [announcement.id, announcement.message_text, announcement.created_at, '[]']),
      () => insertAnnouncement({ id: announcement.id, message: announcement.message_text, created_at: announcement.created_at }))
    // Persist first, then email in the background so publishing is not blocked by bulk delivery.
    void sendAnnouncementEmails(announcement).catch((err) => {
      console.error(`[announcement] ${announcement.id} email fan-out failed:`, err)
    })
    res.status(201).json({ ...announcement, email_delivery: 'queued' })
  } catch (err) {
    console.error('POST /api/admin/announcements failed:', err)
    res.status(500).json({ ok: false, error: 'Could not publish announcement.' })
  }
})

app.get('/api/announcements', requireDisciple, async (req, res) => {
  try {
    const userId = discipleUserId(req.disciple.email)
    const announcements = (await readAnnouncements())
      .map(({ user_ids, ...announcement }) => ({
        ...announcement,
        unread: !user_ids.includes(userId),
      }))
      .filter((item) => item.unread)
    res.json({ ok: true, announcements, unread_count: announcements.length })
  } catch (err) {
    console.error('GET /api/announcements failed:', err)
    res.status(500).json({ ok: false, error: 'Could not load announcements.' })
  }
})

app.post('/api/announcements/:id/read', requireDisciple, async (req, res) => {
  try {
    // Cloud path: receipt row in announcement_reads (uuid ids). The CSV copy is
    // updated too when the id also exists there, so neither store is left behind.
    if (isSupabaseConfigured) {
      try {
        const user = await findDiscipleByEmail(req.disciple.email)
        if (user?.id) {
          await markAnnouncementReadRow({ announcementId: req.params.id, userId: user.id })
          try { markAnnouncementRead(ANNOUNCEMENTS_CSV, req.params.id, discipleUserId(req.disciple.email)) } catch { /* CSV mirror best-effort */ }
          return res.json({ ok: true })
        }
      } catch (err) {
        console.error('[supabase] markAnnouncementReadRow failed, falling back to CSV:', err.message)
      }
    }
    if (!markAnnouncementRead(ANNOUNCEMENTS_CSV, req.params.id, discipleUserId(req.disciple.email))) {
      return res.status(404).json({ ok: false, error: 'Announcement not found.' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /api/announcements/:id/read failed:', err)
    res.status(500).json({ ok: false, error: 'Could not mark announcement as read.' })
  }
})

// ---- Reset-password OTP store (10-minute TTL, separate from login OTP) ----
const resetOtpStore = new Map() // email -> { code, name, role, expiresAt }
const RESET_OTP_TTL_MS = 10 * 60 * 1000

// ---- 2-Step OTP: request + verify (verify appends to sign_ins.csv) ----
const otpStore = new Map() // email -> { code, name, expiresAt }
const OTP_TTL_MS = 5 * 60 * 1000
// Broad, provider-agnostic email format (accepts school .ac.ke/.edu, corporate,
// Outlook/Hotmail/Yahoo/Gmail, custom â€” anything local@domain.tld). No domain lock-in.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

app.post('/api/otp/request', async (req, res) => {
  try {
    const { name = '', email = '' } = req.body || {}
    const cleanEmail = String(email).toLowerCase().trim()
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: 'A valid email is required' })
    }
    const code = String(crypto.randomInt(100000, 999999))
    otpStore.set(cleanEmail, { code, name: String(name).trim(), expiresAt: Date.now() + OTP_TTL_MS })
    console.log(`[otp] code for ${cleanEmail}: ${code} (expires in 5 min)`)
    // Send the code via Gmail SMTP (with IPv4 pinning + 587 fallback). If it truly
    // fails, we still issue the OTP and tell the client plainly â€” plus a recovery
    // path â€” instead of dead-ending on a 500 the way the old code did.
    const otpMail = {
      subject: 'Your NICC Campus Ministry login code',
      text: `Your NICC Campus Ministry login code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:sans-serif"><h2>NICC Campus Ministry Portal</h2><p>Your login code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 5 minutes.</p></div>`,
    }
    const delivery = await sendOtpEmail({ to: cleanEmail, tag: 'otp', ...otpMail })
    if (delivery.ok) {
      res.json({ ok: true, requiresOtp: true, emailSent: true, message: 'OTP sent to your email.' })
    } else {
      res.json(otpDeliveryFailure(code, smtpFailureMessage(delivery.error), 'otp'))
    }
  } catch (err) {
    console.error('POST /api/otp/request failed:', err)
    res.status(500).json({ ok: false, error: 'Could not generate OTP.' })
  }
})

app.post('/api/otp/verify', async (req, res) => {
  try {
    const { name = '', email = '', code = '' } = req.body || {}
    const cleanEmail = String(email).toLowerCase().trim()
    if (!cleanEmail || !String(code).trim()) {
      return res.status(400).json({ ok: false, error: 'email and code are required' })
    }
    const record = otpStore.get(cleanEmail)
    if (!record) return res.status(400).json({ ok: false, error: 'No OTP requested. Request a code first.' })
    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail)
      return res.status(400).json({ ok: false, error: 'OTP expired. Request a new code.' })
    }
    if (record.code !== String(code).trim()) {
      return res.status(400).json({ ok: false, error: 'Invalid code. Try again.' })
    }
    otpStore.delete(cleanEmail)
    const displayName = String(name).trim() || record.name || cleanEmail.split('@')[0]
    try {
      await logSignIn(displayName, cleanEmail)
    } catch (fileErr) {
      console.error('sign-in log write failed:', fileErr)
      return res.status(500).json({ ok: false, error: 'Verified, but could not log sign-in.' })
    }
    res.json({
      ok: true,
      user: {
        id: 'otp-' + Buffer.from(cleanEmail).toString('hex').slice(0, 8),
        name: displayName, email: cleanEmail,
        campus: 'University of Nairobi - Chiromo Campus', role: 'disciple',
      },
    })
  } catch (err) {
    console.error('POST /api/otp/verify failed:', err)
    res.status(500).json({ ok: false, error: 'Could not verify OTP.' })
  }
})

// ---- UNIFIED PHASE 1: Email + Password credential & role routing ----
// Single entry point behind ONE login surface. Routes to Admin or Disciple:
//  â€¢ Admin   â€” matches data/admins.csv (username "admin" / admin@nicc.com / admin email).
//               Email + Password verified, then a 6-digit OTP is emailed. The code is
//               REQUIRED for BOTH roles before any token/dashboard access is granted.
//  â€¢ Disciple â€” Email+Password verified against data/users.csv (the designated DB array).
//               On success a 6-digit OTP is generated + emailed via Gmail SMTP.
// Both return requiresOtp:true â†’ frontend always moves to Phase 2 (OTP wall).
// NOTE: passwords are NEVER returned to the client.
app.post('/api/auth/verify-credentials', async (req, res) => {
  try {
    const { email = '', password = '', username = '' } = req.body || {}
    const identity = String(username || email || '').trim()
        const pass = String(password)
    if (!identity || !pass) {
      return res.status(400).json({ ok: false, error: 'Email and password are required.' })
    }
    // Accept ANY valid email provider domain; reject only structurally-invalid input.
    if (!EMAIL_REGEX.test(identity)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' })
    }

    // ---- DEBUG: log the search attempt ----
    const lowerIdentity = identity.toLowerCase()
    console.log(`[auth] ===== LOGIN ATTEMPT =====`)
    console.log(`[auth] Searching for identity: "${lowerIdentity}"`)

    // ---- Admin path: match by "admin", admin@nicc.com, or the admin row's email ----
    const adminIdentity =
      lowerIdentity === 'admin' ||
      lowerIdentity === 'admin@nicc.com' ||
      Boolean(await findAdmin({ email: identity, username: identity, password: pass }))
    if (adminIdentity) {
      const admin = await findAdmin({ username: 'admin', email: identity, password: pass })
      if (!admin) {
        console.log(`[auth] Admin identity matched but password verification FAILED for: ${lowerIdentity}`)
        return res.status(401).json({ ok: false, error: 'Invalid admin credentials.' })
      }
      const adminName = String(admin.name || admin.username || 'Admin').trim() || 'Admin'
      const adminEmail = String(admin.email || identity).toLowerCase().trim()
      console.log(`[auth] âœ… Admin FOUND: ${adminEmail} (name: ${adminName})`)

      // Admins face the SAME OTP wall: generate + dispatch a 6-digit code via Gmail SMTP.
      const code = String(crypto.randomInt(100000, 999999))
      otpStore.set(adminEmail, {
        code,
        name: adminName,
        expiresAt: Date.now() + OTP_TTL_MS,
      })
      console.log(`[auth] OTP for ${adminEmail}: ${code} (expires in 5 min)`)
      const delivery = await sendOtpEmail({
        to: adminEmail,
        tag: 'auth-admin',
        subject: 'Your NICC Campus Ministry verification code',
        text: `Your NICC Campus Ministry login code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`,
        html: `<div style="font-family:sans-serif"><h2>NICC Campus Ministry Portal</h2><p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 5 minutes.</p></div>`,
      })
      console.log(`[auth] admin credentials verified OK (awaiting OTP): ${adminEmail}`)
      if (delivery.ok) {
        return res.json({
          ok: true,
          role: 'admin',
          requiresOtp: true,
          email: adminEmail,
          name: adminName,
          emailSent: true,
          message: 'Admin code sent to your email. Check inbox + spam.',
        })
      }
      return res.json({
        ...otpDeliveryFailure(code, smtpFailureMessage(delivery.error), 'auth-admin'),
        role: 'admin',
        email: adminEmail,
        name: adminName,
      })
    }

    // ---- Disciple path: verify Email + Password against the users table ----
    console.log(`[auth] Not an admin. Searching disciples database for: ${lowerIdentity}`)
    const allDisciples = await listDisciples()
    console.log(`[auth] Total disciples loaded from ${isSupabaseConfigured ? 'Supabase users table' : 'users.csv'}: ${allDisciples.length}`)
    const discipleMatch = allDisciples.find((r) => String(r.email || '').toLowerCase().trim() === lowerIdentity)
    if (discipleMatch) {
      console.log(`[auth] âœ… Disciple email FOUND: ${discipleMatch.email} (name: ${discipleMatch.name})`)
      console.log(`[auth]    Stored password hash: ${String(discipleMatch.password).substring(0, 20)}...`)
    } else {
      console.log(`[auth] âŒ No disciple found with email: ${lowerIdentity}`)
    }
    const user = await findDisciple({ email: identity, password: pass })
    if (!user) {
      // Check if email exists at all (without password match) for better debugging
      const emailAlreadyOnFile = allDisciples.some((r) => String(r.email || '').toLowerCase().trim() === lowerIdentity)
      if (emailAlreadyOnFile) {
        console.log(`[auth] âš ï¸  Email exists but PASSWORD MISMATCH for: ${lowerIdentity}`)
        return res.status(401).json({ ok: false, error: 'Invalid email or password.' })
      }
      // Completely new email â€” log clearly
      console.log(`[auth] âŒ UNKNOWN EMAIL: "${lowerIdentity}" not found in admins.csv or users.csv`)
      console.log(`[auth]    Available admin emails: ${readCsvAsJson(ADMINS_CSV, ['username','email','name','password']).map(r => r.email).join(', ') || '(none)'}`)
      console.log(`[auth]    Available disciple emails: ${allDisciples.map(r => r.email).join(', ') || '(none)'}`)
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' })
    }
    const cleanEmail = String(user.email || identity).toLowerCase().trim()
    console.log(`[auth] âœ… Disciple credentials verified OK: ${cleanEmail}`)

    // Generate + dispatch the 6-digit OTP via the active Gmail SMTP transport.
    const code = String(crypto.randomInt(100000, 999999))
    otpStore.set(cleanEmail, {
      code,
      name: String(user.name || '').trim(),
      expiresAt: Date.now() + OTP_TTL_MS,
    })
    console.log(`[auth] OTP for ${cleanEmail}: ${code} (expires in 5 min)`)
    const delivery = await sendOtpEmail({
      to: cleanEmail,
      tag: 'auth-disciple',
      subject: 'Your NICC Campus Ministry verification code',
      text: `Your NICC Campus Ministry login code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:sans-serif"><h2>NICC Campus Ministry Portal</h2><p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 5 minutes.</p></div>`,
    })
    console.log(`[auth] disciple credentials verified OK: ${cleanEmail}`)
    if (delivery.ok) {
      res.json({
        ok: true,
        role: 'disciple',
        requiresOtp: true,
        email: cleanEmail,
        name: String(user.name || '').trim(),
        emailSent: true,
        message: 'Code sent to your email. Check inbox + spam.',
      })
    } else {
      res.json({
        ...otpDeliveryFailure(code, smtpFailureMessage(delivery.error), 'auth-disciple'),
        role: 'disciple',
        email: cleanEmail,
        name: String(user.name || '').trim(),
      })
    }
  } catch (err) {
    console.error('POST /api/auth/verify-credentials failed:', err)
    res.status(500).json({ ok: false, error: 'Could not verify credentials.' })
  }
})

// ---- UNIFIED PHASE 2: OTP verification for disciples ----
// Cross-references the 6-digit code, writes the login log to data/sign_ins.csv,
// issues an active-session profile token, and returns the disciple profile.
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email = '', code = '' } = req.body || {}
    const cleanEmail = String(email).toLowerCase().trim()
    if (!cleanEmail || !String(code).trim()) {
      return res.status(400).json({ ok: false, error: 'email and code are required' })
    }
    const record = otpStore.get(cleanEmail)
    if (!record) return res.status(400).json({ ok: false, error: 'No OTP requested. Sign in again.' })
    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail)
      return res.status(400).json({ ok: false, error: 'OTP expired. Sign in again to request a new code.' })
    }
    if (record.code !== String(code).trim()) {
      return res.status(400).json({ ok: false, error: 'Invalid code. Try again.' })
    }
    otpStore.delete(cleanEmail)

    // ---- ADMIN OTP verified -> grant full administrative privileges + route to /admin ----
    if (await isAdminEmail(cleanEmail)) {
      let admin = null
      try {
        admin = (await loadAdminRows())
          .find((r) => String(r.email || '').toLowerCase().trim() === cleanEmail) || null
      } catch { admin = null }
      const adminName = String(admin?.name || record.name || 'Admin').trim() || 'Admin'
      const token = crypto.randomBytes(24).toString('hex')
      adminSessions.set(token, { email: cleanEmail, name: adminName, createdAt: new Date().toISOString() })
      console.log(`[auth] ADMIN OTP verified â€” granting admin token: ${cleanEmail}`)
      return res.json({
        ok: true,
        role: 'admin',
        requiresOtp: false,
        token,
        admin: { email: cleanEmail, name: adminName, role: 'admin' },
        user: {
          id: 'admin-' + Buffer.from(cleanEmail).toString('hex').slice(0, 8),
          name: adminName,
          email: cleanEmail,
          role: 'admin',
        },
      })
    }

    const user = await findDiscipleByEmail(cleanEmail) || {}
    const displayName = String(user.name || record.name || '').trim() || cleanEmail.split('@')[0]
    const campus = String(user.campus || 'University of Nairobi - Chiromo Campus').trim()

    // Write the sign-in log to both the local CSV and the cloud sign_ins table.
    try {
      await logSignIn(displayName, cleanEmail)
    } catch (fileErr) {
      console.error('sign-in log write failed:', fileErr)
      return res.status(500).json({ ok: false, error: 'Verified, but could not log sign-in.' })
    }

    // Issue an active-session profile token for this disciple.
    const token = crypto.randomBytes(24).toString('hex')
    discipleSessions.set(token, {
      email: cleanEmail,
      name: displayName,
      campus,
      createdAt: new Date().toISOString(),
    })
    res.json({
      ok: true,
      token,
      user: {
        id: 'otp-' + Buffer.from(cleanEmail).toString('hex').slice(0, 8),
        name: displayName,
        email: cleanEmail,
        campus,
        role: 'disciple',
      },
    })
  } catch (err) {
    console.error('POST /api/auth/verify-otp failed:', err)
    res.status(500).json({ ok: false, error: 'Could not verify OTP.' })
  }
})

// ---- Admin login: verifies username/email + password against data/admins.csv ----
// Unified login sends { username: 'admin', password } for the admin path.
// NOTE: passwords are NEVER stored in, or returned from, any CSV/log.
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username = '', email = '', password = '' } = req.body || {}
    const identity = String(username || email || '').trim()
    if (!identity || !String(password)) {
      return res.status(400).json({ ok: false, error: 'Username and password are required.' })
    }
    const admin = await findAdmin({ username: identity, email: identity, password })
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Invalid admin credentials.' })
    }
    const token = crypto.randomBytes(24).toString('hex')
    const adminName = String(admin.name || admin.username || 'Admin').trim() || 'Admin'
    const adminEmail = String(admin.email || '').toLowerCase().trim()
    adminSessions.set(token, { email: adminEmail, name: adminName, createdAt: new Date().toISOString() })
    res.json({ ok: true, token, admin: { email: adminEmail, name: adminName, role: 'admin' } })
  } catch (err) {
    console.error('POST /api/admin/login failed:', err)
    res.status(500).json({ ok: false, error: 'Could not process admin login.' })
  }
})

app.post('/api/admin/logout', (req, res) => {
  try {
    const token = req.headers['x-admin-token'] || ''
    if (token) adminSessions.delete(String(token))
    res.json({ ok: true })
  } catch {
    res.json({ ok: true })
  }
})

// ---- Forgot Password: request a 6-digit reset OTP via email ----
// Looks up the submitted email in both admins.csv and users.csv.
// If found, generates a 6-digit code (10-min TTL in server memory) and
// emails it via the existing Gmail SMTP transporter.
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email = '' } = req.body || {}
    const cleanEmail = String(email).toLowerCase().trim()
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: 'A valid email address is required.' })
    }

    // Search the admins table (cloud or CSV) and the users table for the email.
    let user = null
    let source = null
    const adminRows = await loadAdminRows()
    const adminRow = adminRows.find((r) => String(r.email || '').toLowerCase().trim() === cleanEmail)
    if (adminRow) { user = adminRow; source = 'admin' }
    if (!user) {
      const discipleRow = await findDiscipleByEmail(cleanEmail)
      if (discipleRow) { user = discipleRow; source = 'disciple' }
    }
    if (!user) {
      // 400 (not 404): the route exists, so a 404 here would be indistinguishable
      // from a genuinely missing endpoint and would surface as
      // "Endpoint not found (404)" in the client. 400 matches the other
      // validation errors below and lets the real message reach the user.
      return res.status(400).json({ ok: false, error: `No account found for ${cleanEmail}. Please check your email or contact a campus leader.` })
    }

    const displayName = String(user.name || user.username || 'User').trim() || 'User'
    const code = String(crypto.randomInt(100000, 999999))
    resetOtpStore.set(cleanEmail, { code, name: displayName, role: source, expiresAt: Date.now() + RESET_OTP_TTL_MS })

    const delivery = await sendOtpEmail({
      to: cleanEmail,
      tag: 'forgot',
      subject: 'ðŸ”’ Reset Your NICC Campus Portal Password',
      html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px;border:1px solid #e2e8f0;border-radius:16px;"><h2 style="color:#1e3a8a;margin-top:0;">Password Reset Request</h2><p style="font-size:16px;line-height:1.6;color:#334159;">Hello ${displayName || 'there'},</p><p style="font-size:16px;line-height:1.6;color:#334159;">You requested a password reset for the <strong>NICC Campus Ministry Portal</strong>. Your 6-digit security code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#f59e0b;text-align:center;margin:24px 0;padding:12px;background:#fffbeb;border-radius:12px;">${code}</p><p style="font-size:15px;line-height:1.5;color:#64748b;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p><p style="font-size:13px;color:#94a3b8;margin-top:28px;"> â€” The NICC Campus Ministry Team</p></div>`,
      text: `Reset Your NICC Campus Portal Password\n\nHello ${displayName || 'there'},\n\nYour 6-digit password reset code is: ${code}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.\n\n â€” The NICC Campus Ministry Team`,
    })

    if (delivery.ok) {
      res.json({
        ok: true,
        email: cleanEmail,
        role: source,
        emailSent: true,
        message: 'A 6-digit reset code has been sent to your email. Check your inbox (and spam).',
      })
    } else {
      // A reset code is strictly secret. If email delivery fails, invalidate the
      // in-memory code and require the user to request a new one; never return it.
      resetOtpStore.delete(cleanEmail)
      console.error(`[forgot] reset email delivery failed for ${cleanEmail}`)
      res.status(503).json({
        ok: false,
        emailSent: false,
        error: 'We could not send the reset code. Please try again shortly.',
      })
    }
  } catch (err) {
    console.error('POST /api/auth/forgot-password failed:', err)
    res.status(500).json({ ok: false, error: 'Could not process your request.' })
  }
})

// ---- Reset Password: verify OTP + update the CSV data file ----
// Checks the 6-digit code against resetOtpStore, hashes the new password with
// bcrypt, and rewrites admins.csv or users.csv in place.
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email = '', code = '', newPassword = '' } = req.body || {}
    const cleanEmail = String(email).toLowerCase().trim()
    if (!cleanEmail || !String(code).trim() || !String(newPassword)) {
      return res.status(400).json({ ok: false, error: 'Email, reset code, and new password are all required.' })
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' })
    }

    const record = resetOtpStore.get(cleanEmail)
    if (!record) {
      return res.status(400).json({ ok: false, error: 'No reset code requested. Please request a reset code first.' })
    }
    if (Date.now() > record.expiresAt) {
      resetOtpStore.delete(cleanEmail)
      return res.status(400).json({ ok: false, error: 'Reset code has expired. Please request a new one.' })
    }
    if (record.code !== String(code).trim()) {
      return res.status(400).json({ ok: false, error: 'Invalid reset code. Please check and try again.' })
    }

    // Code is valid â€” hash the new password with bcrypt (salt rounds = 12).
    const hashedPassword = await bcrypt.hash(String(newPassword), 12)

    // Code is valid — write the new bcrypt hash back to the admins/users table
    // (cloud primary) and mirror it into the CSV so both stores stay in sync.
    let success = false
    if (record.role === 'admin') {
      success = updatePasswordCsv(ADMINS_CSV, cleanEmail, hashedPassword, 3)
      if (isSupabaseConfigured) {
        try {
          const cloudOk = await updateAdminPassword(cleanEmail, hashedPassword)
          if (!cloudOk) console.error('[reset-password] admin row not found in cloud admins table')
        } catch (updErr) {
          console.error('[reset-password] updateAdminPassword failed:', updErr.message)
        }
      }
    } else if (isSupabaseConfigured) {
      try {
        success = await updateUserPassword(cleanEmail, hashedPassword)
      } catch (updErr) {
        console.error('[reset-password] updateUserPassword failed:', updErr.message)
        success = false
      }
      // Mirror the new hash into users.csv (update in place, or append the row).
      try {
        if (!updatePasswordCsv(USERS_CSV, cleanEmail, hashedPassword, 2)) {
          const csvUser = loadDisciplesFromCsv().find((r) => String(r.email || '').toLowerCase().trim() === cleanEmail)
          mirrorUserToCsv({
            name: csvUser?.name || 'Disciple',
            email: cleanEmail,
            passwordHash: hashedPassword,
            campus: csvUser?.campus || 'University of Nairobi — Chiromo Campus',
            isVerified: String(csvUser?.is_verified ?? 'true').toLowerCase() === 'true',
          })
        }
      } catch (mirrorErr) {
        console.error('[reset-password] users.csv mirror failed:', mirrorErr.message)
      }
    } else {
      success = updatePasswordCsv(USERS_CSV, cleanEmail, hashedPassword, 2)
    }

    if (!success) {
      return res.status(500).json({ ok: false, error: 'Could not update password in the data file.' })
    }

    // Clean up the used OTP so it can't be replayed.
    resetOtpStore.delete(cleanEmail)
    console.log(`[forgot] password updated for ${cleanEmail} (${record.role}) via reset flow`)

    res.json({ ok: true, message: 'Password updated successfully! Please log in with your new password.' })
  } catch (err) {
    console.error('POST /api/auth/reset-password failed:', err)
    res.status(500).json({ ok: false, error: 'Could not reset password.' })
  }
})

// ---- Strict email-verified disciple authentication -------------------------
async function deliverAuthCode({ email, purpose, name, resend = false }) {
  const subject = purpose === 'signup' ? 'Verify your NICC account' : 'Your NICC Portal Unlock Code'
  const action = purpose === 'signup' ? 'Email verification' : 'Portal unlock'
  const { code, record } = await createVerificationCode({ email, purpose })
  const delivery = await sendOtpEmail({ to: email, tag: purpose, subject, text: `Your NICC Campus Ministry ${action.toLowerCase()} code is ${code}. It expires in 15 minutes.`, html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>NICC Campus Ministry</h2><p>Your ${action.toLowerCase()} code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 15 minutes and can only be used once.</p></div>` })
  if (!delivery.ok) return { ok: false, error: 'We could not send the verification email. Please try again shortly.' }
  return { ok: true, message: `${resend ? 'A new code has been sent' : 'Verification code sent'} to your email. It expires in 15 minutes.`, expiresAt: record.expires_at }
}

app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim()
  const password = String(req.body?.password || '')
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ ok: false, error: 'A valid email address is required.' })
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' })
  const existing = await findDiscipleByEmail(email)
  if (existing) return res.status(409).json({ ok: false, error: 'An account with this email already exists. Please use Login instead.' })
  if ((await loadAdminRows()).some((row) => String(row.email || '').toLowerCase().trim() === email)) return res.status(409).json({ ok: false, error: 'This email is reserved. Please use Login instead.' })
  const signupHash = await bcrypt.hash(password, 12)
  if (isSupabaseConfigured) {
    try {
      await insertUser({ name: 'Disciple', email, passwordHash: signupHash, campus: 'University of Nairobi — Chiromo Campus', isVerified: false })
    } catch (insErr) {
      const msg = String(insErr?.message || '').toLowerCase()
      if (msg.includes('23505') || msg.includes('duplicate')) return res.status(409).json({ ok: false, error: 'An account with this email already exists. Please use Login instead.' })
      console.error('[signup] insertUser failed:', insErr.message)
      return res.status(500).json({ ok: false, error: 'Could not create the account. Try again.' })
    }
    mirrorUserToCsv({ name: 'Disciple', email, passwordHash: signupHash, campus: 'University of Nairobi — Chiromo Campus', isVerified: false })
  } else {
    appendRow(USERS_CSV, ['Disciple', email, signupHash, 'University of Nairobi — Chiromo Campus', 'false'])
  }
  const result = await deliverAuthCode({ email, purpose: 'signup', name: 'Disciple' })
  if (!result.ok) return res.status(503).json({ ok: false, error: result.error })
  res.status(201).json(result)
})

app.post('/api/auth/resend-code', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim(); const purpose = String(req.body?.purpose || '')
  const user = await findDiscipleByEmail(email)
  if (!user || !['signup', 'portal'].includes(purpose)) return res.status(404).json({ ok: false, error: 'Account not found.' })
  if (purpose === 'signup' && String(user.is_verified).toLowerCase() === 'true') return res.status(400).json({ ok: false, error: 'This account is already verified. Please use Login.' })
  if (purpose === 'portal' && String(user.is_verified).toLowerCase() !== 'true') return res.status(403).json({ ok: false, error: 'Verify your email address first.' })
  const result = await deliverAuthCode({ email, purpose, name: user.name, resend: true })
  if (!result.ok) return res.status(503).json({ ok: false, error: result.error })
  res.json(result)
})


// ---- Registration: create a new disciple account in data/users.csv ----
app.post('/api/auth/portal-unlock', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim(); const password = String(req.body?.password || '')
  const user = await findDiscipleByEmail(email)
  if (!user || !passwordMatches(user.password, password)) return res.status(401).json({ ok: false, error: 'Invalid email or password.' })
  // Valid credentials always advance to the code screen. An unverified legacy or
  // newly-created account uses the signup purpose so verification also upgrades
  // users.csv before a session is issued.
  const purpose = String(user.is_verified).toLowerCase() === 'true' ? 'portal' : 'signup'
  const result = await deliverAuthCode({ email, purpose, name: user.name })
  // The code is persisted even when SMTP is temporarily unavailable. Keep the
  // request successful so the frontend can always render the verification screen;
  // the code is never included in this response.
  if (!result.ok) {
    console.error(`[portal-unlock] verification email delivery failed for ${email}:`, result.error)
    return res.json({
      ok: true,
      status: 'OTP_SENT',
      redirectTo: '/verify-otp',
      purpose,
      requiresVerification: true,
      emailSent: false,
      message: 'Your verification screen is ready. Email delivery is temporarily unavailable; please resend the code in a moment.',
    })
  }
  res.json({ ...result, status: 'OTP_SENT', redirectTo: '/verify-otp', purpose, requiresVerification: true })
})

app.post('/api/auth/verify-signup', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim(); const code = String(req.body?.code || '').trim()
  const user = await findDiscipleByEmail(email)
  if (!user || !/^\d{6}$/.test(code) || !(await findVerificationCode({ email, purpose: 'signup', code }))) return res.status(400).json({ ok: false, error: 'That code is invalid or expired. Request a new code.' })
  if (isSupabaseConfigured) {
    try { await markUserVerified(email) } catch (e) { console.error('[verify-signup] markUserVerified failed:', e.message) }
    try { updateUserVerified(USERS_CSV, email, true) } catch { /* CSV mirror best-effort */ }
  } else {
    updateUserVerified(USERS_CSV, email, true)
  }
  const name = String(user.name || 'Disciple'); const token = crypto.randomBytes(24).toString('hex')
  discipleSessions.set(token, { email, name, campus: user.campus, createdAt: new Date().toISOString() }); await logSignIn(name, email)
  res.json({ ok: true, message: 'Account created successfully!', token, user: { id: discipleUserId(email), name, email, campus: user.campus, role: 'disciple' } })
})

app.post('/api/auth/verify-portal', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim(); const code = String(req.body?.code || '').trim()
  const user = await findDiscipleByEmail(email)
  if (!user || !/^\d{6}$/.test(code) || !(await findVerificationCode({ email, purpose: 'portal', code }))) return res.status(400).json({ ok: false, error: 'That unlock code is invalid or expired. Request a new code.' })
  const name = String(user.name || 'Disciple'); const token = crypto.randomBytes(24).toString('hex')
  discipleSessions.set(token, { email, name, campus: user.campus, createdAt: new Date().toISOString() }); await logSignIn(name, email)
  res.json({ ok: true, token, user: { id: discipleUserId(email), name, email, campus: user.campus, role: 'disciple' } })
})


// Validates input, checks for duplicate email (across users.csv AND admins.csv),
// hashes the password with bcrypt, and appends the new row to users.csv.
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name = '', email = '', password = '', campus = '' } = req.body || {}
    const cleanName = String(name).trim()
    const cleanEmail = String(email).toLowerCase().trim()
    const cleanCampus = String(campus).trim()

    // --- Validation ---
    if (!cleanName) {
      return res.status(400).json({ ok: false, error: 'Name is required.' })
    }
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ ok: false, error: 'Name must be at least 2 characters.' })
    }
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: 'A valid email address is required.' })
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' })
    }

    // --- Check for duplicate email in the users table ---
    let duplicateInUsers = false
    if (isSupabaseConfigured) {
      try {
        duplicateInUsers = await emailExists(cleanEmail)
      } catch (err) {
        console.error('[register] emailExists failed:', err.message)
        return res.status(500).json({ ok: false, error: 'Could not verify the email address. Try again.' })
      }
    } else {
      const existingDisciples = await listDisciples()
      duplicateInUsers = existingDisciples.some(
        (r) => String(r.email || '').toLowerCase().trim() === cleanEmail
      )
    }
    if (duplicateInUsers) {
      return res.status(409).json({
        ok: false,
        error: 'An account with this email already exists. Please log in instead.',
      })
    }

    // --- Check the admins table for reserved emails (cloud or CSV) ---
    {
      const adminRows = await loadAdminRows()
      const duplicateInAdmins = adminRows.some(
        (r) => String(r.email || '').toLowerCase().trim() === cleanEmail
      )
      if (duplicateInAdmins) {
        return res.status(409).json({ ok: false, error: 'This email is reserved. Please log in instead.' })
      }
    }

    // --- Hash password with bcrypt (salt rounds = 12) ---
    const hashedPassword = await bcrypt.hash(String(password), 12)

    // --- Persist the new user (Supabase `users` table, or users.csv fallback) ---
    const defaultCampus = cleanCampus || 'University of Nairobi â€” Chiromo Campus'
    if (isSupabaseConfigured) {
      try {
        await insertUser({
          name: cleanName,
          email: cleanEmail,
          passwordHash: hashedPassword,
          campus: defaultCampus,
          isVerified: false,
        })
      } catch (insErr) {
        // 23505 = unique_violation: someone registered the same email in the
        // gap between the duplicate check and this insert.
        const msg = String(insErr?.message || '').toLowerCase()
        if (msg.includes('23505') || msg.includes('duplicate')) {
          return res.status(409).json({ ok: false, error: 'An account with this email already exists. Please log in instead.' })
        }
        console.error('[register] insertUser failed:', insErr.message)
        return res.status(500).json({ ok: false, error: 'Could not create the account. Try again.' })
      }
      mirrorUserToCsv({ name: cleanName, email: cleanEmail, passwordHash: hashedPassword, campus: defaultCampus, isVerified: false })
    } else {
      appendRow(USERS_CSV, [cleanName, cleanEmail, hashedPassword, defaultCampus])
    }

    console.log(`[register] new disciple account created: ${cleanEmail} (${cleanName})`)

    res.status(201).json({
      ok: true,
      message: 'Account created successfully! You can now log in with your email and password.',
      user: {
        name: cleanName,
        email: cleanEmail,
        campus: cleanCampus || 'University of Nairobi â€” Chiromo Campus',
        role: 'disciple',
      },
    })
  } catch (err) {
    console.error('POST /api/auth/register failed:', err)
    res.status(500).json({ ok: false, error: 'Could not create account. Please try again.' })
  }
})

// ---- Feedback: disciple submits feedback from the portal dashboard ----
// Saves to feedback.csv AND the cloud feedback table (timestamp, email, name, category, message).
app.post('/api/feedback', async (req, res) => {
  try {
    const { email = '', name = '', category = '', message = '' } = req.body || {}
    const cleanEmail = String(email).trim().toLowerCase()
    const cleanName = String(name).trim()
    const cleanCategory = String(category).trim()
    const cleanMessage = String(message).trim()

    if (!cleanEmail && !cleanName) {
      return res.status(400).json({ ok: false, error: 'Email or name is required.' })
    }
    if (!cleanCategory) {
      return res.status(400).json({ ok: false, error: 'Please select a category.' })
    }
    if (!cleanMessage) {
      return res.status(400).json({ ok: false, error: 'Please write a message.' })
    }

    await writeBoth('feedback',
      () => appendRow(FEEDBACK_CSV, [new Date().toISOString(), cleanEmail, cleanName, cleanCategory, cleanMessage]),
      () => insertFeedback({ email: cleanEmail, name: cleanName, category: cleanCategory, message: cleanMessage }))
    console.log(`[feedback] ${cleanCategory} from ${cleanName || cleanEmail}: ${cleanMessage.substring(0, 60)}...`)
    res.status(201).json({ ok: true, message: 'Feedback submitted successfully!' })
  } catch (err) {
    console.error('POST /api/feedback failed:', err)
    res.status(500).json({ ok: false, error: 'Could not submit feedback.' })
  }
})

app.get('/api/admin/feedback', requireAdmin, async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try { return res.json(await listFeedback()) } catch (err) { console.error('[supabase] listFeedback failed, falling back to CSV:', err.message) }
    }
    res.json(readCsvAsJson(FEEDBACK_CSV, ['timestamp', 'email', 'name', 'category', 'message']))
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Could not read feedback data' })
  }
})

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Unknown API route' }))

// ---- Serve the built frontend (dist/) so ONE server hosts site + API ----
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DIST_DIR = path.join(__dirname, '..', 'dist')
if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR))
  // SPA fallback: React Router handles /about, /portal, /admin, etc.
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NICC backend on http://localhost:${PORT}`)
  console.log(`NICC on your network: http://192.168.100.5:${PORT} (use your current Wi-Fi IPv4 if different)`)
  console.log(`CSV store: ${DATA_DIR}`)
  if (resend) {
    console.log(`NICC email ready via Resend API (sender: ${EMAIL_FROM})`)
  } else if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.log('NICC email NOT configured: set EMAIL_API_KEY (Resend) - SMTP ports are blocked on Render.')
  } else if (SMTP_AVAILABLE) {
    console.log(`NICC email ready via Gmail SMTP fallback (local dev, ${SMTP_USER})`)
  } else {
    console.log('NICC email NOT configured (missing EMAIL_API_KEY; no valid Gmail App Password for local fallback).')
  }
})
