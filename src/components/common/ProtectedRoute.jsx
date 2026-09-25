import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAdminToken } from '../../utils/adminApi.js'

// Single-gate route guard. Optional `role="admin"` locks CSV management
// panels to admins; disciples are bounced to /portal.
export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="container-shell py-24 text-center text-slate-500">
        Checking your session…
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" state={{ from: location.pathname }} replace />
    )
  }

  if (role === 'admin' && !(isAdmin && getAdminToken())) {
    return <Navigate to="/portal" replace />
  }

  if (role === 'disciple' && isAdmin) {
    return <Navigate to="/admin" replace />
  }

  return children
}

