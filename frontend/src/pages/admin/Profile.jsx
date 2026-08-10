import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function AdminProfile() {
  const { user } = useAuth()
  const toast = useToast()
  
  const [adminData, setAdminData] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get('/admin/profile')
        setAdminData(data.admin)
        setPermissions(data.permissions || [])
      } catch (err) {
        toast.error('Failed to load admin profile details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  if (loading) return <div className="p-8 text-center text-muted">Loading profile...</div>

  const roleLabel = (user.role || 'ADMIN').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Admin Profile</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="card text-center p-6 bg-gradient-to-br from-brand-900 to-brand-800 border-none shadow-lg text-white">
            <div className="h-24 w-24 mx-auto rounded-full bg-white/20 flex items-center justify-center text-white text-4xl font-bold mb-4 shadow-inner border-2 border-white/30 backdrop-blur-sm">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : '🛡️'}
            </div>
            <h2 className="text-2xl font-bold mb-1">{user.full_name}</h2>
            <div className="text-brand-100 text-sm mb-4 opacity-90">{user.email}</div>
            
            <div className="inline-block px-4 py-1.5 rounded-full bg-brand-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm mb-4 border border-brand-400">
              {roleLabel}
            </div>

            <div className="bg-black/20 p-3 rounded-lg border border-white/10 text-left backdrop-blur-sm">
              <div className="text-[10px] font-bold text-brand-200 mb-1 uppercase tracking-wider opacity-80">Admin ID</div>
              <code className="text-white font-mono text-sm block">{user.citizen_id}</code>
            </div>
          </div>
          
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-ink text-sm">ACCOUNT STATUS</h3>
            <div>
              <div className="text-xs text-muted">Created On</div>
              <div className="text-sm font-medium">{fmtDate(user.created_at)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Status</div>
              <div className="text-sm font-medium flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                {user.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-ink mb-2">Role Permissions</h2>
            <p className="text-sm text-muted mb-6">Capabilities authorized for the <strong>{roleLabel}</strong> role.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {permissions.map((perm, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-line bg-cream">
                  <div className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-ink break-all">{perm}</span>
                </div>
              ))}
              
              {permissions.length === 0 && (
                <div className="col-span-2 text-center py-6 text-muted border border-dashed border-line rounded-lg bg-cream/50">
                  No explicit permissions listed.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
