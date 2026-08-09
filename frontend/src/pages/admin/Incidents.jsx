import { useEffect, useState, useCallback } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { Chip, Empty, PageHead, Severity, StatCard, fmtDT } from './ui'

export default function AdminIncidents() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ status: '', severity: '' })
  const [detail, setDetail] = useState(null)
  const [admins, setAdmins] = useState([])
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = useCallback(async (f = filters) => {
    try {
      const params = new URLSearchParams()
      if (f.status) params.set('status', f.status)
      if (f.severity) params.set('severity', f.severity)
      setData(await api.get(`/admin/ops/incidents?${params.toString()}`))
    } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/admin/users').then((r) => setAdmins(r.items.filter((u) => u.role === 'admin'))).catch(() => {})
  }, [])

  const open = useCallback((inc) => setDetail(inc), [])

  async function refresh() {
    if (detail) {
      const fresh = await api.get('/admin/ops/incidents').then((r) => r.items.find((i) => i.id === detail.id))
      if (fresh) setDetail(fresh)
    }
    await load()
  }

  async function assign(adminId) {
    setBusy(true)
    try {
      await api.post(`/admin/ops/incidents/${detail.id}/assign`, { assigned_to: adminId || null })
      toast.success('Incident assigned.')
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function resolve() {
    setBusy(true)
    try {
      await api.post(`/admin/ops/incidents/${detail.id}/resolve`)
      toast.success('Incident resolved.')
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function pauseAgent() {
    setBusy(true)
    try {
      await api.post(`/admin/ops/incidents/${detail.id}/pause-agent`, { reason: 'Paused from incident review' })
      toast.success('Agent paused.')
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load incidents">{error}</Alert></div>
  if (!data) return <Spinner label="Loading incidents…" />

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="AI Incidents" subtitle="Agent failures surfaced for triage. Pause the affected agent or assign an owner." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open" value={data.items.filter((i) => i.status === 'open').length} tone="red" />
        <StatCard label="Paused agents" value={data.items.filter((i) => i.status === 'paused').length} tone="amber" />
        <StatCard label="Resolved" value={data.items.filter((i) => i.status === 'resolved').length} tone="green" />
        <StatCard label="Critical" value={data.items.filter((i) => i.severity === 'critical').length} tone="red" />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <select className="input" value={filters.status} onChange={(e) => { const f = { ...filters, status: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="paused">Paused</option>
            <option value="resolved">Resolved</option>
          </select>
          <select className="input" value={filters.severity} onChange={(e) => { const f = { ...filters, severity: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Failures</th>
                <th className="px-4 py-3 font-semibold">Last error</th>
                <th className="px-4 py-3 font-semibold">Started</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((i) => (
                <tr key={i.id} className="hover:bg-cream">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink capitalize">{i.agent_name.replace(/_/g, ' ')}</p>
                    {i.assigned_to_name && <p className="text-xs text-muted">{i.assigned_to_name}</p>}
                  </td>
                  <td className="px-4 py-3"><Severity severity={i.severity} /></td>
                  <td className="px-4 py-3">
                    <Chip tone={i.status === 'open' ? 'red' : i.status === 'paused' ? 'amber' : 'green'}>{i.status}</Chip>
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{i.failure_count}</td>
                  <td className="px-4 py-3 text-muted max-w-[220px] truncate">{i.last_error || '—'}</td>
                  <td className="px-4 py-3 text-muted">{fmtDT(i.started_at)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => open(i)}>Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.items.length === 0 && <Empty message="No incidents recorded." />}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <div className="relative card w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink capitalize">{detail.agent_name.replace(/_/g, ' ')} incident</h2>
                <p className="text-sm text-muted">{detail.id}</p>
              </div>
              <div className="flex gap-2">
                <Severity severity={detail.severity} />
                <Chip tone={detail.status === 'open' ? 'red' : detail.status === 'paused' ? 'amber' : 'green'}>{detail.status}</Chip>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
              <span className="font-semibold">Last error:</span> {detail.last_error || 'No error captured'}
            </div>

            <div className="flex flex-wrap gap-2">
              <select className="input !py-1.5 text-xs" value={detail.assigned_to || ''} disabled={busy} onChange={(e) => assign(e.target.value)}>
                <option value="">Unassigned</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
              {detail.status !== 'paused' && detail.status !== 'resolved' && (
                <button className="btn-ghost text-xs !py-1.5 text-amber-700 hover:bg-amber-50" onClick={pauseAgent} disabled={busy}>Pause agent</button>
              )}
              {detail.status !== 'resolved' && (
                <button className="btn-primary text-xs !py-1.5" onClick={resolve} disabled={busy}>Resolve</button>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Timeline</h3>
              <div className="space-y-2">
                {detail.timeline.length === 0 && <p className="text-sm text-muted">No activity.</p>}
                {detail.timeline.slice().reverse().map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                    <p className="text-muted">{t.note} <span className="text-xs">· {t.by} · {fmtDT(t.ts)}</span></p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
