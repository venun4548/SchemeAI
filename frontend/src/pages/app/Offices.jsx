import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'

export default function Offices() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [types, setTypes] = useState([])
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    api.get('/offices/types')
      .then((res) => setTypes(res.types || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (filterType !== 'all') params.set('office_type', filterType)
    setData(null)
    api.get(`/offices${params.toString() ? `?${params}` : ''}`)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
  }, [q, filterType])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load offices">{error}</Alert></div>

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Government Offices</h1>
          <p className="text-sm text-muted">Find offices, working hours and services near you.</p>
        </div>
        <div className="flex gap-2">
          <input className="input sm:w-64" placeholder="Search office or address…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input sm:w-48" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {!data ? (
        <Spinner label="Loading offices…" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((o) => (
              <div key={o.id} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink leading-snug">{o.name}</h3>
                    <p className="text-xs text-muted mt-0.5 capitalize">{o.type}</p>
                  </div>
                  {o.is_open !== undefined && (
                    <span className={o.is_open ? 'badge-ok' : 'badge-bad'}>{o.is_open ? 'Open' : 'Closed'}</span>
                  )}
                </div>
                <p className="text-sm text-muted mt-2">{o.address}</p>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-ink">
                    <span className="text-muted w-16">Hours</span>
                    <span>{o.working_hours?.open && o.working_hours?.close ? `${o.working_hours.open} – ${o.working_hours.close}` : '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-ink">
                    <span className="text-muted w-16">Phone</span>
                    <span>{o.phone || '—'}</span>
                  </div>
                  {o.distance_km != null && (
                    <div className="flex items-center gap-2 text-ink">
                      <span className="text-muted w-16">Distance</span>
                      <span>{o.distance_km} km</span>
                    </div>
                  )}
                </div>
                {o.services?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {o.services.slice(0, 4).map((s) => (
                      <span key={s} className="chip bg-brand-50 text-brand-700">{s}</span>
                    ))}
                  </div>
                )}
                {o.rating != null && (
                  <div className="mt-3 text-sm text-amber-600">★ {o.rating}</div>
                )}
                {o.directions_url && (
                  <a href={o.directions_url} target="_blank" rel="noreferrer" className="btn-secondary w-full mt-4 !py-2 text-xs">
                    Get directions
                  </a>
                )}
              </div>
            ))}
          </div>
          {data.items.length === 0 && <p className="text-center text-muted py-10">No offices found.</p>}
        </>
      )}
    </div>
  )
}
