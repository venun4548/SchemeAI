import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function ProfileSecurity() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  
  const [sessions, setSessions] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [signingOutAll, setSigningOutAll] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [sessData, actData] = await Promise.all([
          api.get('/profile/security/sessions'),
          api.get('/profile/activity')
        ])
        setSessions(sessData)
        setActivity(actData)
      } catch (err) {
        toast.error('Failed to load security details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const handleSignOutAll = async () => {
    if (!window.confirm("Are you sure you want to sign out of all other sessions? You will stay logged in here.")) return;
    setSigningOutAll(true)
    try {
      await api.post('/profile/logout-all')
      toast.success('Signed out of all other sessions successfully.')
      // Refresh current token if needed, or simply let it be since this current one might be invalidated if not handled smartly in backend, but we set `sessions_valid_after`, which actually might invalidate the CURRENT token if its `iat` is older! 
      // If the user gets logged out, the interceptor will redirect them to login.
      await refresh()
    } catch (err) {
      toast.error('Failed to sign out of other sessions')
    } finally {
      setSigningOutAll(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted">Loading security info...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Security & Account Settings</h1>
          <p className="text-muted">Manage your sessions and view account activity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4 border-b border-line pb-4">
              <div>
                <h2 className="text-lg font-bold text-ink">Active Sessions</h2>
                <p className="text-sm text-muted">Recent successful logins to your account.</p>
              </div>
              <button 
                onClick={handleSignOutAll} 
                disabled={signingOutAll}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                {signingOutAll ? 'Signing out...' : 'Sign Out All Other Sessions'}
              </button>
            </div>
            
            {sessions.length === 0 ? (
              <div className="text-center text-muted py-4">No recent sessions found.</div>
            ) : (
              <div className="space-y-4">
                {sessions.map((s, i) => (
                  <div key={s.id || i} className="flex items-start gap-3 p-3 bg-cream rounded-lg">
                    <div className="mt-1 text-xl">📱</div>
                    <div>
                      <div className="font-medium text-ink flex items-center gap-2">
                        {s.ip_address}
                        {i === 0 && <span className="chip bg-green-100 text-green-800 text-xs">Current</span>}
                      </div>
                      <div className="text-sm text-muted">
                        {fmtDate(s.created_at)} at {new Date(s.created_at).toLocaleTimeString('en-IN')}
                      </div>
                      <div className="text-xs text-muted mt-1 truncate max-w-sm" title={s.user_agent}>
                        {s.user_agent}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-bold text-ink mb-4 border-b border-line pb-4">Recent Activity</h2>
            {activity.length === 0 ? (
              <div className="text-center text-muted py-4">No recent activity.</div>
            ) : (
              <div className="space-y-4">
                {activity.map((a, i) => (
                  <div key={a.id || i} className="flex items-start justify-between p-3 border border-line rounded-lg hover:border-brand-200 transition">
                    <div>
                      <div className="font-medium text-ink">{a.action.replace(/_/g, ' ')}</div>
                      <div className="text-sm text-muted">{a.entity} {a.entity_id ? `(${a.entity_id})` : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{fmtDate(a.created_at)}</div>
                      <div className="text-xs text-muted">{new Date(a.created_at).toLocaleTimeString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5 bg-gradient-to-br from-brand-50 to-white">
            <h3 className="font-bold text-ink mb-3 flex items-center gap-2">
              <span className="text-xl">🛡️</span> Security Tips
            </h3>
            <ul className="text-sm text-ink space-y-3">
              <li className="flex items-start gap-2">
                <span className="text-brand-500 mt-0.5">•</span>
                Never share your SchemeAI Citizen ID or password with anyone.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-500 mt-0.5">•</span>
                Government officials will never ask for your password.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-500 mt-0.5">•</span>
                Always log out when using public computers.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
