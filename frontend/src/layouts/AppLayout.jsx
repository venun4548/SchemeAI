import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import ProfileMenu from '../components/ProfileMenu'

const userNav = [
  { to: '/dashboard', label: 'AI Dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { to: '/questionnaire', label: 'AI Interview', icon: 'M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z' },
  { to: '/eligibility', label: 'Eligibility', icon: 'M12 2 4 5v6c0 5.25 3.4 10.15 8 11 4.6-.85 8-5.75 8-11V5l-8-3zm-1.2 14.8-3.6-3.6 1.4-1.4 2.2 2.2 4.6-4.6 1.4 1.4-6 6z' },
  { to: '/recommendations', label: 'Recommendations', icon: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22' },
  { to: '/compare', label: 'Compare', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
  { to: '/documents', label: 'Documents', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z' },
  { to: '/applications', label: 'Applications', icon: 'M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z' },
  { to: '/offices', label: 'Offices', icon: 'M12 2C8.13 2 5 5.13 5 8c0 5.25 7 13 7 13s7-7.75 7-13c0-2.87-3.13-5-7-5zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z' },
  { to: '/family', label: 'Family', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
  { to: '/news', label: "What's New", icon: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm4 6h8M8 12h8M8 8h5' },
  { to: '/notifications', label: 'Notifications', icon: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.83V4.5a1.5 1.5 0 0 0-3 0v.67A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z' },
  { to: '/reports', label: 'Reports', icon: 'M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2 2H5V5h11l5 5v9a2 2 0 0 1-2 2z' },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { toggle, dark } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-brand-700 text-white' : 'text-muted hover:bg-brand-50 hover:text-brand-700'
    }`

  const sidebar = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {userNav.map((n) => (
        <NavLink key={n.to} to={n.to} className={linkCls} onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor">
            <path d={n.icon} />
          </svg>
          {n.label}
        </NavLink>
      ))}
      {user?.role === 'admin' && (
        <NavLink to="/admin" className={linkCls} onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 10h2v7H7v-7zm4-3h2v10h-2V7zm4 5h2v5h-2v-5z" />
          </svg>
          Admin
        </NavLink>
      )}
      <a href="https://scheme-ai-nine.vercel.app/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition text-muted hover:bg-brand-50 hover:text-brand-700 mt-auto">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to website
      </a>
    </nav>
  )

  return (
    <div className="h-screen flex flex-col bg-cream overflow-hidden">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-line">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden btn-ghost !px-2.5" onClick={() => setOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
            </button>
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 17V11a8 8 0 0 1 16 0v6" />
                  <circle cx="8" cy="15" r="1.8" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="17" r="1.8" fill="currentColor" stroke="none" />
                  <circle cx="16" cy="15" r="1.8" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="hidden sm:inline text-lg font-bold text-ink">
                Scheme<span className="text-brand-accent">AI</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ProfileMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-60 h-full flex-col border-r border-line bg-white shrink-0 overflow-y-auto scrollbar-thin">{sidebar}</aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-lift">
              <div className="flex items-center justify-between px-4 h-16 border-b border-line">
                <span className="font-bold text-ink">Menu</span>
                <button onClick={() => setOpen(false)} className="text-muted hover:text-ink">✕</button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0 h-full overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
