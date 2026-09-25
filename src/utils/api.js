// Shared helper: resolve backend base URL so POST /api/visit-plan never 404s.
// - Dev (vite :5173 with proxy)        -> '' (relative, proxied to :5000)
// - Single-server mode (:5000 + dist/) -> '' (relative, same origin)
// - Any other host/port (preview/file) -> 'http://localhost:5000' fallback
function resolveBase() {
  const envBase = (import.meta.env.VITE_API_URL || '').trim()
  if (envBase) return envBase.replace(/\/$/, '')
  try {
    const { protocol, hostname, port } = window.location
    // Same-origin works when backend serves frontend (port 5000) or vite proxy (5173)
    if (port === '5173' || port === '5000' || protocol === 'file:') {
      if (port === '5173' || port === '5000') return ''
    }
    // Unknown origin (e.g. vite preview :4173, static file) -> talk directly to local API
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
      return 'http://localhost:5000'
    }
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
    throw new Error('Could not reach the server. Start the backend: cd backend then node server.js (:5000).')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Endpoint not found (404): ${path}. Is the backend running on :5000?`)
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export async function apiGet(path, options = {}) {
  let res
  try {
    res = await fetch(apiUrl(path), { headers: { ...(options.headers || {}) } })
  } catch {
    throw new Error('Could not reach the server. Start the backend: cd backend then node server.js (:5000).')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}
