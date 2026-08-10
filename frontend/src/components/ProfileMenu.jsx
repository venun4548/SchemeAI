import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function ProfileMenu({ admin = false }) {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  const handleLogout = async () => {
    const confirm = window.confirm("Are you sure you want to sign out?")
    if (confirm) {
      await logout()
      toast.info('You have been signed out.')
      navigate('/')
    }
    setOpen(false)
  }

  const roleLabel = admin 
    ? (user.role || 'USER').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : user.citizen_id

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 focus:outline-none rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5 transition"
      >
        <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold overflow-hidden">
          {user.full_name ? user.full_name.charAt(0).toUpperCase() : '👤'}
        </div>
        <div className="hidden sm:flex flex-col items-start mr-1">
          <span className={`text-sm font-bold ${admin ? 'text-brand-100' : 'text-ink'}`}>
            {user.full_name}
          </span>
          <span className={`text-xs font-mono ${admin ? 'text-brand-200 opacity-80' : 'text-muted'}`}>
            {roleLabel}
          </span>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-line rounded-lg shadow-lift z-50 py-2">
          <div className="px-4 py-2 border-b border-line mb-2 sm:hidden">
            <div className="font-bold text-ink">{user.full_name}</div>
            <div className="text-xs text-muted font-mono">{roleLabel}</div>
          </div>
          
          {admin ? (
            <>
              <Link to="/admin/profile" className="block px-4 py-2 text-sm text-ink hover:bg-cream" onClick={() => setOpen(false)}>My Profile</Link>
              <Link to="/admin/profile/activity" className="block px-4 py-2 text-sm text-ink hover:bg-cream" onClick={() => setOpen(false)}>Activity</Link>
              <Link to="/profile/security" className="block px-4 py-2 text-sm text-ink hover:bg-cream" onClick={() => setOpen(false)}>Security</Link>
            </>
          ) : (
            <>
              <Link to="/profile" className="block px-4 py-2 text-sm text-ink hover:bg-cream" onClick={() => setOpen(false)}>My Profile</Link>
              <Link to="/applications" className="block px-4 py-2 text-sm text-ink hover:bg-cream" onClick={() => setOpen(false)}>My Applications</Link>
              <Link to="/compare" className="block px-4 py-2 text-sm text-ink hover:bg-cream" onClick={() => setOpen(false)}>Saved Schemes</Link>
              <Link to="/notifications" className="block px-4 py-2 text-sm text-ink hover:bg-cream" onClick={() => setOpen(false)}>Notifications</Link>
              <Link to="/profile/security" className="block px-4 py-2 text-sm text-ink hover:bg-cream" onClick={() => setOpen(false)}>Account Settings</Link>
            </>
          )}
          
          <div className="border-t border-line mt-2 pt-2">
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
