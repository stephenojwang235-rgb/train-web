import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

// Clean primary nav: Home + About first, then the rest.
// Login stays as a clear standalone button on the right.
// NOTE: the giving/contribution surface has been removed site-wide, so there is
// no "Give" tab here — these links feed BOTH the desktop nav and the mobile drawer.
const primaryLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
    setOpen(false)
  }

  const goLogin = () => {
    navigate('/login')
    setOpen(false)
  }

  const authedLinks = isAdmin
    ? [...primaryLinks, { to: '/admin', label: 'Admin' }]
    : [...primaryLinks, { to: '/portal', label: 'Portal' }]
  const desktopLinks = isAuthenticated ? authedLinks : primaryLinks

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
      <nav className="container-shell flex items-center justify-between h-16 sm:h-20">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="NICC shield logo"
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover ring-1 ring-slate-200 bg-white"
          />
          <span className="leading-tight">
            <span className="block font-extrabold text-slate-900 text-sm sm:text-base">
              NICC Campus Ministry
            </span>
            <span className="block text-[11px] sm:text-xs text-slate-500 font-medium">
              Nairobi International Christian Church
            </span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {desktopLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link
                to={isAdmin ? '/admin' : '/portal'}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Hi, {user?.name?.split(' ')[0]}
              </Link>
              <button
                onClick={handleLogout}
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={goLogin}
              className="px-6 py-2.5 rounded-full bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 shadow-lg shadow-blue-700/20 transition"
            >
              Login
            </button>
          )}
        </div>

        <button
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span className="block w-6 h-0.5 bg-slate-900 mb-1.5" />
          <span className="block w-6 h-0.5 bg-slate-900 mb-1.5" />
          <span className="block w-6 h-0.5 bg-slate-900" />
        </button>
      </nav>

      {open && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-1">
          {authedLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-3 rounded-xl text-sm font-semibold ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="w-full mt-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={goLogin}
              className="w-full mt-2 px-4 py-3 rounded-xl bg-blue-700 text-white text-sm font-bold"
            >
              Login
            </button>
          )}
        </div>
      )}
    </header>
  )
}

