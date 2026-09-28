// Shared helper: resolve backend base URL so /api/* calls never 404.
// Priority:
//  1. VITE_API_URL (Vercel production -> https://nicc-campus-api.onrender.com)
//  2. Dev (vite :5173 with proxy) or single-server mode (:5000) -> '' (same origin)
//  3. Unknown NON-localhost host (e.g. a deployed preview without the env var)
//     -> production Render API, so the live site keeps working
//  4. Localhost fallback -> local Express API on :5000
const PROD_API_URL = 'https://nicc-campus-api.onrender.com'

function resolveBase() {
  const envBase = (import.meta.env.VITE_API_URL || '').trim()
  if (envBase) return envBase.replace(/\/$/, '')
  try {
    const { protocol, hostname, port } = window.location
    // Same-origin works when backend serves frontend (port 5000) or vite proxy (5173)
    if (port === '5173' || port === '5000' || protocol === 'file:') {
      if (port === '5173' || port === '5000') return ''
    }
    // Local machine without a configured env var -> talk directly to local API
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
      return 'http://localhost:5000'
    }
    // Any other host (Vercel preview/prod without env var, static file) ->
    // target the cloud backend instead of erroring on :5000.
    return PROD_API_URL
  } catch {
    // SSR / non-browser: stay relative
  }
  return ''
}

export const API_BASE = resolveBase()

export function apiUrl(path) {
  return `${API_BASE}${path}`
}

export async function apiPost(path, body, options = {}) {
  let res
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the cloud server. Check your connection or try again shortly.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Prefer the server's own message: the API legitimately answers 404 with a
    // meaningful error (e.g. "No account found for you@example.com"), and a 400
    // with a validation message. Only fall back to the generic wording when the
    // response carried no usable message at all (i.e. a truly missing route).
    const serverMessage = typeof data?.error === 'string' ? data.error.trim() : ''
    if (serverMessage) throw new Error(serverMessage)
    if (res.status === 404) throw new Error(`Endpoint not found (404): ${path}.`)
    throw new Error(`Request failed (${res.status})`)
  }
  return data
}

export async function apiGet(path, options = {}) {
  let res
  try {
    res = await fetch(apiUrl(path), { headers: { ...(options.headers || {}) } })
  } catch {
    throw new Error('Could not reach the cloud server. Check your connection or try again shortly.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}
