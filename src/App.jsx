import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import ProtectedRoute from './components/common/ProtectedRoute.jsx'
import PageLoader from './components/common/PageLoader.jsx'

// Route-level code splitting: the landing bundle only ships Layout + Home.
// Login/Contact/About/Portal/Profile/AdminDashboard load on demand, so the
// first JS download on mobile stays small. ProtectedRoute must stay eager —
// it gates every private route below.
const Home = lazy(() => import('./views/public/Home.jsx'))
const About = lazy(() => import('./views/public/About.jsx'))
const Login = lazy(() => import('./views/public/Login.jsx'))
const Contact = lazy(() => import('./views/public/Contact.jsx'))
const NotFound = lazy(() => import('./views/public/NotFound.jsx'))
const Portal = lazy(() => import('./views/private/Portal.jsx'))
const Profile = lazy(() => import('./views/private/Profile.jsx'))
const AdminDashboard = lazy(() => import('./views/private/AdminDashboard.jsx'))

/**
 * Single login surface + role-based private areas:
 *  "/"       → Home (public)
 *  "/about"  → About (public)
 *  "/login"  → ONE unified Login (public): admin vs disciple detector
 *  "/portal" → Disciple Portal (private, role=disciple)
 *  "/profile"→ Profile (private, any authenticated user)
 *  "/admin"  → Admin Dashboard with CSV tabs (private, role=admin)
 */
export default function App() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader label="Loading page…" />}>
        <Routes>
        {/* Required public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />

        {/* Single private member route — NO duplicate dashboards */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute role="disciple">
              <Portal />
            </ProtectedRoute>
          }
        />

        {/* Extra public routes */}
        <Route path="/contact" element={<Contact />} />

        {/* Common misspelling: keep old/shared links working. */}
        <Route path="/logi" element={<Navigate to="/login" replace />} />
        <Route path="/admin/data" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/data" element={<Navigate to="/admin" replace />} />
        {/* Giving / contribution has been removed site-wide. Old giving links
            (/give, /contribute, /donate, /offering, /dashboard/give) now land on
            Home instead of a dead page or a 404. */}
        <Route path="/give/*" element={<Navigate to="/" replace />} />
        <Route path="/contribute" element={<Navigate to="/" replace />} />
        <Route path="/donate" element={<Navigate to="/" replace />} />
        <Route path="/offering" element={<Navigate to="/" replace />} />
        {/* Campus events + the Ministries pages have been removed site-wide, so
            old links (/events, /ministries) land on Home instead of a 404. */}
        <Route path="/events/*" element={<Navigate to="/" replace />} />
        <Route path="/ministries/*" element={<Navigate to="/" replace />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </Layout>
  )
}


