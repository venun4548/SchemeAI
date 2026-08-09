import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'

const priorityStyles = {
  high: 'bg-red-50 text-red-700',
  normal: 'bg-brand-50 text-brand-700',
}

export default function Notifications() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const toast = useToast()

  async function load() {
    try {
      setData(await api.get('/notifications'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  async function markRead(id) {
    try {
      await api.post(`/notifications/${id}/read`)
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function markAll() {
    try {
      await api.post('/notifications/read-all')
      toast.success('All notifications marked as read.')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load notifications">{error}</Alert></div>
  if (!data) return <Spinner label="Loading notifications…" />

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Notifications</h1>
          <p className="text-sm text-muted">{data.unread_count ?? 0} unread</p>
        </div>
        <button className="btn-secondary" onClick={markAll}>Mark all read</button>
      </div>

      <div className="space-y-3">
        {data.items?.map((n) => (
          <div key={n.id} className={`card p-4 ${n.is_read ? 'opacity-70' : 'border-brand-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${n.is_read ? 'bg-line' : 'bg-brand-500'}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink">{n.title}</span>
                    <span className={`chip ${priorityStyles[n.priority] || priorityStyles.normal}`}>{n.type}</span>
                  </div>
                  <p className="text-sm text-muted mt-0.5">{n.body}</p>
                  <div className="text-xs text-muted/80 mt-1">{fmtDate(n.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!n.is_read && (
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => markRead(n.id)}>Mark read</button>
                )}
                {n.link && (
                  <Link to={n.link} className="btn-secondary !px-2 !py-1 text-xs">Open</Link>
                )}
              </div>
            </div>
          </div>
        ))}
        {(!data.items || data.items.length === 0) && (
          <div className="card p-12 text-center text-muted">No notifications yet.</div>
        )}
      </div>
    </div>
  )
}
