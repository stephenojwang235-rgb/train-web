import { useState } from 'react'
import { apiPost } from './api.js'
import { API_BASE } from './api.js'

const TOKEN_KEY = 'nicc-admin-token'

export function getAdminToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* private mode */ }
}

export function authHeaders() {
  const token = getAdminToken()
  return token ? { 'x-admin-token': token } : {}
}

export async function apiGetAdmin(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Admin login required. Sign in at /login as admin.')
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// Unified login posts { username: 'admin', password } for the admin path.
// Backend verifies against data/admins.csv (source of truth).
export async function adminLogin(usernameOrEmail, password) {
  const data = await apiPost('/api/admin/login', { username: usernameOrEmail, email: usernameOrEmail, password })
  if (data?.token) setAdminToken(data.token)
  return data
}

export async function adminLogout() {
  try {
    await apiPost('/api/admin/logout', {}, { headers: { ...authHeaders() } })
  } catch { /* still clear locally */ }
  setAdminToken('')
}

export default function useAdminSession() {
  const [token, setToken] = useState(() => getAdminToken())
  const login = async (usernameOrEmail, password) => {
    const data = await adminLogin(usernameOrEmail, password)
    setToken(data?.token || '')
    return data
  }
  const logout = async () => {
    await adminLogout()
    setToken('')
  }
  return { token, isAdmin: Boolean(token), login, logout }
}
