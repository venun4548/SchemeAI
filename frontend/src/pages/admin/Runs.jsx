import { useEffect, useState } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'

const AGENT_COLORS = {
  'Profiling Agent': 'bg-blue-500',
  'Eligibility Agent': 'bg-brand-500',
  'Policy Agent': 'bg-violet-500',
  'Recommender Agent': 'bg-brand-accent',
  'Explainability Agent': 'bg-teal-500',
  'Guidance Agent': 'bg-amber-500',
  'Fraud Agent': 'bg-red-500',
  'Documents Agent': 'bg-slate-500',
}

export default function AdminRuns() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/agent-runs').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load agent runs">{error}</Alert></div>
  if (!data) return <Spinner label="Loading agent runs…" />

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Agent Run Logs</h1>
        <p className="text-sm text-muted">The last {data.items.length} agent executions across all pipelines.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="divide-y divide-line">
          {data.items.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-4">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${AGENT_COLORS[r.agent] || 'bg-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{r.agent}</div>
                <div className="text-xs text-muted truncate">{r.task}</div>
              </div>
              <span className={`chip ${r.status === 'completed' ? 'badge-ok' : 'badge-warn'}`}>{r.status}</span>
              <span className="text-xs text-muted w-16 text-right">{r.duration_ms}ms</span>
              <span className="text-xs text-muted w-28 text-right">{fmtDate(r.created_at)}</span>
            </div>
          ))}
          {data.items.length === 0 && <p className="px-5 py-10 text-center text-muted">No runs recorded yet.</p>}
        </div>
      </div>
    </div>
  )
}
