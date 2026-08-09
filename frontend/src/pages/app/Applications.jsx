import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { statusBadge } from '../../components/Score'
import { useToast } from '../../context/ToastContext'

export default function Applications() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [schemeId, setSchemeId] = useState(null)
  const [applying, setApplying] = useState(false)
  const location = useLocation()
  const toast = useToast()

  useEffect(() => {
    if (location.state?.schemeId) setSchemeId(location.state.schemeId)
    api.get('/applications')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [location.state])

  async function apply() {
    if (!schemeId) return
    setApplying(true)
    try {
      const app = await api.post('/applications', { scheme_id: schemeId })
      toast.success(`Application ${app.application_id} started.`)
      window.location.href = `/applications/${app.id}`
    } catch (e) {
      toast.error(e.message)
    } finally {
      setApplying(false)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load applications">{error}</Alert></div>
  if (!data) return <Spinner label="Loading applications…" />

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Applications</h1>
          <p className="text-sm text-muted">{data.total} applications in the registry.</p>
        </div>
        <div className="flex gap-2">
          {schemeId ? (
            <button className="btn-primary" onClick={apply} disabled={applying}>
              {applying ? 'Creating…' : 'Start draft application'}
            </button>
          ) : (
            <Link to="/recommendations" className="btn-primary">Find schemes to apply for</Link>
          )}
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted mb-2">No applications yet.</p>
          <p className="text-sm text-muted">Pick a scheme and start your guided application.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((a) => {
            const b = statusBadge(a.status)
            return (
              <Link key={a.id} to={`/applications/${a.id}`} className="card p-5 hover:shadow-lift transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink truncate">{a.scheme_name}</h3>
                    <p className="text-xs text-muted">{a.application_id}</p>
                  </div>
                  <span className={b.cls}>{b.label}</span>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>Progress</span>
                    <span>{a.current_step}/{a.steps?.length ?? 0} steps</span>
                  </div>
                  <div className="h-2 rounded-full bg-line overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${((a.current_step / (a.steps?.length || 1)) * 100).toFixed(0)}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-semibold text-brand-700">Eligibility {a.eligibility_score}%</span>
                  <span className="text-xs text-muted">View →</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
