import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { Chip, Empty, Lifecycle, PageHead, fmtDT } from './ui'
import { useNavigate } from 'react-router-dom'

export default function AdminPublications() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()

  async function load() {
    try {
      setData(await api.get('/admin/ops/publication-queue'))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  async function publish(id, name) {
    if (!window.confirm(`Publish "${name}"? This is recorded in the audit trail.`)) return
    setBusy(id)
    try {
      await api.post(`/admin/ops/schemes/${id}/publish`)
      toast.success('Scheme published.')
      await load()
    } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load publication queue">{error}</Alert></div>
  if (!data) return <Spinner label="Loading publication queue…" />

  const count = data.total

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Publication Queue" subtitle={`${count} scheme(s) awaiting approval before going live on the citizen portal.`}>
        <button className="btn-secondary" onClick={() => navigate('/admin/schemes')}>All schemes</button>
      </PageHead>

      {count === 0 && (
        <Alert kind="success">The publication queue is empty. All schemes are live.</Alert>
      )}

      <div className="space-y-4">
        {data.items.map((s) => {
          const pendingVersion = s.versions.find((v) => v.status === 'review')
          return (
            <div key={s.id} className="card p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-ink">{s.name}</h2>
                  <p className="text-sm text-muted">{s.code} · {s.ministry} · {s.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Lifecycle status={s.lifecycle_status} />
                  <Chip tone="slate">v{s.version}</Chip>
                </div>
              </div>

              {pendingVersion && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-800">Pending changes (v{pendingVersion.version})</span>
                    <span className="text-xs text-amber-700">{fmtDT(pendingVersion.created_at)}</span>
                  </div>
                  {pendingVersion.reason && <p className="text-xs text-amber-800 mt-1">“{pendingVersion.reason}”</p>}
                  {Object.keys(pendingVersion.changed_fields || {}).length > 0 && (
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {Object.entries(pendingVersion.changed_fields).map(([field, cv]) => (
                        <div key={field} className="text-xs">
                          <span className="font-semibold text-amber-800">{field}</span>
                          <div className="text-muted">
                            <span className="line-through opacity-70">{String(cv.old)}</span> → <span>{String(cv.new)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-end">
                <button className="btn-secondary text-xs !py-1.5" onClick={() => navigate(`/admin/schemes`)}>Open scheme</button>
                <button className="btn-primary text-xs !py-1.5" disabled={busy === s.id} onClick={() => publish(s.id, s.name)}>
                  {busy === s.id ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          )
        })}
        {data.items.length === 0 && <Empty message="Nothing waiting for publication." />}
      </div>
    </div>
  )
}
