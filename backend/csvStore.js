import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
dotenv.config()
try {
  const __fn2 = fileURLToPath(import.meta.url)
  dotenv.config({ path: path.join(path.dirname(__fn2), '.env') })
} catch { /* cwd .env already loaded */ }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const DATA_DIR = path.join(__dirname, 'data')
export const VISITORS_CSV = path.join(DATA_DIR, 'visitors.csv')
export const SIGN_INS_CSV = path.join(DATA_DIR, 'sign_ins.csv')

export const MESSAGES_CSV = path.join(DATA_DIR, 'messages.csv')

export const ADMINS_CSV = path.join(DATA_DIR, 'admins.csv')

// Registered disciple accounts — the "designated database array" used by the
// unified login to verify Email + Password in Phase 1 before issuing an OTP.
export const USERS_CSV = path.join(DATA_DIR, 'users.csv')
export const FEEDBACK_CSV = path.join(DATA_DIR, 'feedback.csv')
export const ANNOUNCEMENTS_CSV = path.join(DATA_DIR, 'announcements.csv')
export const VERIFICATION_CODES_CSV = path.join(DATA_DIR, 'verification_codes.csv')

export const VISITORS_HEADER = 'id,date,name,email,phone,campus,status'
export const SIGN_INS_HEADER = 'timestamp,name,email'
export const MESSAGES_HEADER = 'date,name,email,message'
export const ADMINS_HEADER = 'username,email,name,password'
// users.csv header: a disciple must be registered here to log in (email + password).
export const USERS_HEADER = 'name,email,password,campus,is_verified'
// feedback.csv header: user-submitted feedback from the disciple portal
export const FEEDBACK_HEADER = 'timestamp,email,name,category,message'
// announcement read receipts are stored as a JSON array in the final CSV cell
export const ANNOUNCEMENTS_HEADER = 'id,message_text,created_at,user_ids'
export const VERIFICATION_CODES_HEADER = 'id,email,purpose,code_hash,expires_at,consumed_at,created_at'

export function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(VISITORS_CSV)) {
    fs.writeFileSync(VISITORS_CSV, VISITORS_HEADER + '\n', 'utf8')
    console.log('Created data/visitors.csv')
  }
  if (!fs.existsSync(SIGN_INS_CSV)) {
    fs.writeFileSync(SIGN_INS_CSV, SIGN_INS_HEADER + '\n', 'utf8')
    console.log('Created data/sign_ins.csv')
  }
  if (!fs.existsSync(MESSAGES_CSV)) {
    fs.writeFileSync(MESSAGES_CSV, MESSAGES_HEADER + '\n', 'utf8')
    console.log('Created data/messages.csv')
  }
  if (!fs.existsSync(ADMINS_CSV)) {
    fs.writeFileSync(ADMINS_CSV, ADMINS_HEADER + '\n', 'utf8')
    console.log('Created data/admins.csv')
  }
  if (!fs.existsSync(USERS_CSV)) {
    fs.writeFileSync(USERS_CSV, USERS_HEADER + '\n', 'utf8')
    console.log('Created data/users.csv')
  }
  if (!fs.existsSync(FEEDBACK_CSV)) {
    fs.writeFileSync(FEEDBACK_CSV, FEEDBACK_HEADER + '\n', 'utf8')
    console.log('Created data/feedback.csv')
  }
  if (!fs.existsSync(VERIFICATION_CODES_CSV)) {
    fs.writeFileSync(VERIFICATION_CODES_CSV, VERIFICATION_CODES_HEADER + '\n', 'utf8')
    console.log('Created data/verification_codes.csv')
  }
  if (!fs.existsSync(ANNOUNCEMENTS_CSV)) {
    fs.writeFileSync(ANNOUNCEMENTS_CSV, ANNOUNCEMENTS_HEADER + '\n', 'utf8')
    console.log('Created data/announcements.csv')
  }
  // Seed a default `admin` row from env so `data/admins.csv` is the source of truth.
  // backend/.env provides ADMIN_EMAIL + ADMIN_PASSWORD on first run.
  // Password is hashed with bcrypt before being written to the CSV file.
  try {
    const raw = fs.readFileSync(ADMINS_CSV, 'utf8')
    const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '')
    const seedEmail = (process.env.ADMIN_EMAIL || '').trim()
    const seedPass = process.env.ADMIN_PASSWORD || ''
    if (lines.length <= 1 && seedEmail && seedPass) {
      const hashedPass = bcrypt.hashSync(seedPass, 12)
      appendRow(ADMINS_CSV, ['admin', seedEmail.toLowerCase(), 'Admin', hashedPass])
      console.log('Seeded data/admins.csv with default admin user (bcrypt-hashed password from .env)')
    } else if (seedEmail && seedPass) {
      // File already has rows — ensure the admin email exists with a bcrypt-hashed password.
      const hasAdminEmail = lines.some((l) => {
        const cols = parseCsvLine(l)
        return cols[1] && String(cols[1]).toLowerCase().trim() === seedEmail.toLowerCase()
      })
      if (!hasAdminEmail) {
        const hashedPass = bcrypt.hashSync(seedPass, 12)
        appendRow(ADMINS_CSV, ['admin', seedEmail.toLowerCase(), 'Admin', hashedPass])
        console.log('Appended missing admin row to data/admins.csv (bcrypt-hashed password)')
      }
    }
  } catch (seedErr) {
    console.error('admins.csv seed failed:', seedErr)
  }
  // Intentionally no demo disciple seeding. An empty users.csv is a valid,
  // persistent state: only newly registered, email-verified disciples belong here.
}

// Quote fields containing comma/quote/newline (RFC 4180) so columns don't break
export function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\r\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
  return str
}

export function appendRow(filePath, fields) {
  const line = fields.map(escapeCsv).join(',') + '\n'
  fs.appendFileSync(filePath, line, 'utf8')
}

// Persist one disciple's read receipt without changing the announcement body.
export function markAnnouncementRead(filePath, announcementId, userId) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/)
  let updated = false
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cols = parseCsvLine(lines[i])
    if (cols[0] !== String(announcementId)) continue
    let readers = []
    try {
      const parsed = JSON.parse(cols[3] || '[]')
      if (Array.isArray(parsed)) readers = parsed.map(String)
    } catch { /* tolerate a legacy/corrupt cell */ }
    if (!readers.includes(String(userId))) readers.push(String(userId))
    cols[3] = JSON.stringify(readers)
    lines[i] = cols.map(escapeCsv).join(',')
    updated = true
    break
  }
  if (!updated) return false
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
  return true
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

export function readCsvAsJson(filePath, headers) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length <= 1) return []
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const obj = {}
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? '' })
    rows.push(obj)
  }
  return rows
}

// Update a single CSV row's password column. Email is assumed to be at col index 1
// for both admins.csv (username,email,name,password → pwd at index 3)
// and users.csv (name,email,password,campus → pwd at index 2).
// Strips a leading BOM if present on the first data line.
export function updateVerificationCode(filePath, id) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cols = parseCsvLine(lines[i])
    if (cols[0] !== String(id)) continue
    cols[5] = new Date().toISOString()
    lines[i] = cols.map(escapeCsv).join(',')
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
    return true
  }
  return false
}

export function updateUserVerified(filePath, email, verified = true) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/)
  const cleanEmail = String(email).toLowerCase().trim()
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cols = parseCsvLine(lines[i])
    if (String(cols[1] || '').toLowerCase().trim() === cleanEmail) {
      if (cols.length < 5) cols.push('false')
      cols[4] = verified ? 'true' : 'false'
      lines[i] = cols.map(escapeCsv).join(',')
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
      return true
    }
  }
  return false
}

export function updatePasswordCsv(filePath, email, newPassword, passwordColIndex) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const clean = raw.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/)
  const cleanEmail = String(email).toLowerCase().trim()
  let updated = false
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cols = parseCsvLine(lines[i])
    if (cols[1] && String(cols[1]).toLowerCase().trim() === cleanEmail) {
      cols[passwordColIndex] = newPassword
      lines[i] = cols.map(escapeCsv).join(',')
      updated = true
      break
    }
  }
  if (!updated) return false
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
  return true
}
