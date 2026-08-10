import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useToast } from '../../context/ToastContext'

export default function AdminProfileActivity() {
  const toast = useToast()
  
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const actData = await api.get('/admin/profile/activity')
        setActivity(actData)
      } catch (err) {
        toast.error('Failed to load activity details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  if (loading) return <div className="p-8 text-center text-muted">Loading activity...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">My Activity</h1>
      </div>

      <div className="card p-6">
        <p className="text-sm text-muted mb-6">A chronological record of actions you have performed in the system.</p>
        
        {activity.length === 0 ? (
          <div className="text-center text-muted py-8 border border-dashed border-line rounded-lg bg-cream/50">
            No recent activity found.
          </div>
        ) : (
          <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-line before:to-transparent">
            {activity.map((a, i) => (
              <div key={a.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-4">
                {/* Timeline Icon */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-brand-100 text-brand-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 font-bold text-xs">
                  {a.action === 'ADMIN_SIGNOUT' ? '🚪' : a.action === 'ADMIN_LOGIN' ? '🔑' : '📝'}
                </div>
                
                {/* Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-line bg-white shadow-sm group-hover:border-brand-300 group-hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-ink text-sm uppercase tracking-wide">{a.action.replace(/_/g, ' ')}</div>
                    <div className="text-xs font-mono text-muted">{new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="text-sm text-muted mb-2">
                    <span className="font-medium text-ink/80">{a.entity}</span>
                    {a.entity_id && <span className="ml-1 text-xs opacity-75">#{a.entity_id}</span>}
                  </div>
                  
                  {/* Details / IP */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-line/50">
                    <div className="text-xs text-muted font-medium">{fmtDate(a.created_at)}</div>
                    {a.ip_address && (
                      <div className="text-[10px] bg-cream px-2 py-1 rounded font-mono text-muted/80" title="IP Address">
                        {a.ip_address}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
