import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'

const nav = [
  { to: '/', label: 'Home', exact: true },
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/schemes', label: 'Schemes' },
  { to: '/about', label: 'About' },
  { to: '/help', label: 'Help' },
  { to: '/contact', label: 'Contact' },
]

export default function Header() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()

  const linkCls = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'text-brand-700 bg-brand-50' : 'text-muted hover:text-brand-700'
    }`

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-lg bg-brand flex items-center justify-center text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 17V11a8 8 0 0 1 16 0v6" />
              <circle cx="8" cy="15" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="12" cy="17" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="16" cy="15" r="1.8" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">
            Scheme<span className="text-brand-accent">AI</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) =>
            n.exact ? (
              <NavLink key={n.to} to={n.to} end className={linkCls}>
                {n.label}
              </NavLink>
            ) : (
              <NavLink key={n.to} to={n.to} className={linkCls}>
                {n.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="btn-ghost !px-2.5 !py-2"
            aria-label="Toggle dark mode"
            title="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          {user ? (
            <>
              <Link to="/dashboard" className="btn-primary hidden sm:inline-flex">
                Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="btn-secondary hidden sm:inline-flex">
                  Admin
                </Link>
              )}
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-sm font-bold text-ink">{user?.full_name}</span>
                <span className="text-xs font-mono text-muted" title="Citizen ID">{user?.citizen_id}</span>
              </div>
              <button
                onClick={() => {
                  logout()
                  toast.info('You have been signed out.')
                  navigate('/')
                }}
                className="btn-ghost !px-2"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
