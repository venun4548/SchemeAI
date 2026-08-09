import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { Chip, Empty, PageHead } from './ui'
import { useNavigate } from 'react-router-dom'

export default function AdminAgents() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()

  async function load() {
    try {
      setData(await api.get('/admin/ops/agents'))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  async function control(name, action) {
    const reason = action === 'pause' ? (prompt(`Reason for pausing ${name} (audited):`) || '') : 'Reviewed and resumed'
    setBusy(name)
    try {
      await api.post(`/admin/ops/agents/${name}/${action}`, { reason })
      toast.success(`${name} ${action === 'pause' ? 'paused' : 'resumed'}.`)
      await load()
    } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load agents">{error}</Alert></div>
  if (!data) return <Spinner label="Loading agent status…" />

  const paused = data.items.filter((a) => a.is_paused).length
  const failed = data.items.reduce((n, a) => n + (a.runs_24h?.failed || 0) + (a.last_status === 'failed' ? 1 : 0), 0)

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Agent Control Center" subtitle="Monitor, pause and resume the SchemeAI multi-agent pipeline. Pausing is fully audited.">
        <span className="chip">Paused: {paused}</span>
        <span className="chip">{data.items.length} agents</span>
      </PageHead>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase">Agents</div>
          <div className="mt-1 text-2xl font-bold text-ink">{data.items.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase">Paused</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{paused}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase">Failures (24h)</div>
          <div className="mt-1 text-2xl font-bold text-red-600">{failed}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase">Open incidents</div>
          <button className="mt-1 text-2xl font-bold text-blue-700 underline" onClick={() => navigate('/admin/incidents')}>View →</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Runs (24h)</th>
                <th className="px-4 py-3 font-semibold">Lifetime</th>
                <th className="px-4 py-3 font-semibold">Last run</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((a) => (
                <tr key={a.agent_name} className="hover:bg-cream">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{a.label}</p>
                    <p className="font-mono text-xs text-muted">{a.agent_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    {a.is_paused
                      ? <Chip tone="red">Paused</Chip>
                      : <Chip tone={a.last_status === 'failed' ? 'amber' : 'green'}>{a.last_status || 'idle'}</Chip>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-brand-700 font-semibold">{a.runs_24h?.success || 0}</span>
                    <span className="text-muted"> ok · </span>
                    <span className="text-red-600 font-semibold">{a.runs_24h?.failed || 0}</span>
                    <span className="text-muted"> fail</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{a.success_count} ok · {a.failure_count} fail</td>
                  <td className="px-4 py-3 text-muted">{a.last_run_at ? new Date(a.last_run_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="px-4 py-3">
                    {a.is_paused
                      ? <button className="btn-primary !py-1.5 !px-3 text-xs" disabled={busy === a.agent_name} onClick={() => control(a.agent_name, 'resume')}>Resume</button>
                      : <button className="btn-ghost !py-1.5 !px-3 text-xs text-amber-700 hover:bg-amber-50" disabled={busy === a.agent_name} onClick={() => control(a.agent_name, 'pause')}>Pause</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.items.length === 0 && <Empty message="No agents registered." />}
      </div>
    </div>
  )
}
