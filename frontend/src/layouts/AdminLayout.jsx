import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const allNavGroups = [
  {
    label: 'Operations',
    roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'],
    links: [
      { to: '/admin', label: 'Command Center', end: true, icon: '◉', roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'] },
      { to: '/admin/applications', label: 'Applications', icon: '▤', roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'] },
      { to: '/admin/documents', label: 'Document Review', icon: '🗎', roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'] },
      { to: '/admin/cases', label: 'Issues & Escalations', icon: '☰', roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'] },
    ],
  },
  {
    label: 'Scheme & Content',
    roles: ['SUPER_ADMIN', 'SCHEME_ADMIN', 'CONTENT_REVIEWER'],
    links: [
      { to: '/admin/schemes', label: 'Schemes', icon: '◎', roles: ['SUPER_ADMIN', 'SCHEME_ADMIN', 'CONTENT_REVIEWER'] },
      { to: '/admin/publications', label: 'Publication Queue', icon: '⇪', roles: ['SUPER_ADMIN', 'SCHEME_ADMIN'] },
      { to: '/admin/knowledge', label: 'Knowledge Base', icon: '⛁', roles: ['SUPER_ADMIN', 'SCHEME_ADMIN', 'CONTENT_REVIEWER'] },
    ],
  },
  {
    label: 'Support',
    roles: ['SUPER_ADMIN', 'SUPPORT_AGENT'],
    links: [
      { to: '/admin/users', label: 'Users', icon: '☷', roles: ['SUPER_ADMIN', 'SUPPORT_AGENT', 'OPERATIONS_ADMIN'] },
      { to: '/admin/cases', label: 'Support Cases', icon: '☰', roles: ['SUPER_ADMIN', 'SUPPORT_AGENT'] },
    ],
  },
  {
    label: 'AI Operations',
    roles: ['SUPER_ADMIN', 'AI_OPERATIONS'],
    links: [
      { to: '/admin/agents', label: 'Agent Control Center', icon: '⚙', roles: ['SUPER_ADMIN', 'AI_OPERATIONS'] },
      { to: '/admin/incidents', label: 'AI Incidents', icon: '⚠', roles: ['SUPER_ADMIN', 'AI_OPERATIONS'] },
      { to: '/admin/runs', label: 'Agent Logs', icon: '≡', roles: ['SUPER_ADMIN', 'AI_OPERATIONS'] },
    ],
  },
  {
    label: 'Governance & Analytics',
    roles: ['SUPER_ADMIN', 'ANALYST'],
    links: [
      { to: '/admin/analytics', label: 'Analytics', icon: '≣', roles: ['SUPER_ADMIN', 'ANALYST', 'OPERATIONS_ADMIN', 'SCHEME_ADMIN'] },
      { to: '/admin/reports', label: 'Reports', icon: '∑', roles: ['SUPER_ADMIN', 'ANALYST'] },
      { to: '/admin/roles', label: 'Admin Roles', icon: '⌑', roles: ['SUPER_ADMIN'] },
      { to: '/admin/audit', label: 'Audit Trail', icon: '↻', roles: ['SUPER_ADMIN', 'OPERATIONS_ADMIN'] },
      { to: '/admin/security', label: 'Security Center', icon: '✧', roles: ['SUPER_ADMIN'] },
    ],
  },
]

const ROLE_BADGES = {
  SUPER_ADMIN: 'bg-amber-50 text-amber-800',
  OPERATIONS_ADMIN: 'bg-brand-50 text-brand-700',
  SCHEME_ADMIN: 'bg-violet-50 text-violet-700',
  CONTENT_REVIEWER: 'bg-blue-50 text-blue-700',
  SUPPORT_AGENT: 'bg-sky-50 text-sky-700',
  AI_OPERATIONS: 'bg-fuchsia-50 text-fuchsia-700',
  ANALYST: 'bg-slate-50 text-slate-700',
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const linkCls = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-brand-700 text-white' : 'text-muted hover:bg-brand-50 hover:text-brand-700'
    }`

  const currentRole = user?.role || 'USER'
  const roleLabel = currentRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  // Filter navigation by role
  const allowedGroups = allNavGroups.map(g => {
    return {
      ...g,
      links: g.links.filter(l => l.roles.includes(currentRole) || l.roles.includes('SUPER_ADMIN') && currentRole === 'SUPER_ADMIN')
    }
  }).filter(g => g.links.length > 0)

  const Sidebar = (
    <aside className="w-64 flex-shrink-0 border-r border-line bg-white overflow-y-auto scrollbar-thin p-3 space-y-5">
      <div className="px-3 pt-1">
        <div className="text-lg font-bold text-ink">SchemeAI Ops</div>
        <div className={`chip mt-2 capitalize ${ROLE_BADGES[currentRole] || 'bg-cream text-muted'}`}>{roleLabel}</div>
      </div>
      {allowedGroups.map((g) => (
        <div key={g.label}>
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-muted uppercase tracking-wider">{g.label}</div>
          <div className="space-y-0.5">
            {g.links.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkCls} onClick={() => setOpen(false)}>
                <span className="text-sm opacity-70 w-4 text-center">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </aside>
  )

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <header className="sticky top-0 z-40 bg-brand text-white shadow-sm">
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden text-xl leading-none" onClick={() => setOpen((o) => !o)} aria-label="Menu">☰</button>
            <span className="text-lg font-bold whitespace-nowrap">Admin Operations</span>
            <span className="chip bg-white/15 text-white hidden sm:inline-flex">Enterprise Portal</span>
          </div>
          <div className="flex items-center gap-2 text-sm shrink-0">
            <span className="text-brand-100 hidden sm:inline truncate max-w-[180px]">{user?.full_name}</span>
            <button
              onClick={() => {
                logout()
                toast.info('Signed out.')
                navigate('/login')
              }}
              className="btn !py-1.5 !px-3 bg-white/10 text-white hover:bg-white/20 border border-white/20"
            >
              Sign out
            </button>
          </div>
        </div>
        {open && (
          <nav className="md:hidden border-t border-white/15 bg-brand max-h-[70vh] overflow-y-auto">
            <div className="p-3 space-y-4">{Sidebar}</div>
          </nav>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="hidden md:block">{Sidebar}</div>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
