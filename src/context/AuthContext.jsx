import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getAdminToken, setAdminToken, adminLogout } from '../utils/adminApi.js'

/**
 * NICC Campus Ministry — Unified AuthContext (single login surface).
 * Roles: 'admin' (full CSV access, /admin) | 'disciple' (member resources, /portal).
 * No demo accounts, no bypass toggles.
 */

const AuthContext = createContext(null)
const USER_KEY = 'nicc-user'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children, initialUser = null }) {
  const [user, setUser] = useState(() => initialUser || readStoredUser())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
      else localStorage.removeItem(USER_KEY)
    } catch { /* private mode */ }
  }, [user])

  const isAuthenticated = Boolean(user)
  const isAdmin = Boolean(user && user.role === 'admin' && getAdminToken())
  const isDisciple = Boolean(user && user.role !== 'admin')
  const layoutMode = isAuthenticated ? 'private' : 'public'

  // Admin sign-in (after POST /api/admin/login verified against data/admins.csv)
  const loginAsAdmin = useCallback((admin, token) => {
    if (token) setAdminToken(token)
    const nextUser = {
      id: 'admin-' + String(admin?.email || 'admin').toLowerCase(),
      name: admin?.name || 'Admin',
      email: String(admin?.email || '').toLowerCase(),
      campus: 'NICC — All Campuses',
      role: 'admin',
      avatarInitials: String(admin?.name || 'A').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    }
    setUser(nextUser)
    return nextUser
  }, [])

  // Disciple sign-in (after OTP verify on backend, logged to sign_ins.csv)
  const loginWithUser = useCallback((verifiedUser) => {
    const name = verifiedUser?.name || 'Disciple'
    const nextUser = {
      id: verifiedUser?.id || 'otp-user',
      name,
      email: verifiedUser?.email || '',
      campus: verifiedUser?.campus || 'University of Nairobi — Chiromo Campus',
      role: 'disciple',
      avatarInitials: String(name).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    }
    setUser(nextUser)
    return nextUser
  }, [])

  const logout = useCallback(async () => {
    try { await adminLogout() } catch { /* still clear locally */ }
    setAdminToken('')
    setUser(null)
  }, [])

  const switchCampus = useCallback((campus) => {
    setUser((prev) => (prev ? { ...prev, campus } : prev))
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      setLoading,
      isAuthenticated,
      isAdmin,
      isDisciple,
      isDiscipleView: isDisciple,
      layoutMode,
      loginAsAdmin,
      loginWithUser,
      logout,
      switchCampus,
    }),
    [user, loading, isAuthenticated, isAdmin, isDisciple, layoutMode, loginAsAdmin, loginWithUser, logout, switchCampus],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export default AuthContext


