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

export default function AIOperations() {
  const [runs, setRuns] = useState(null)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/admin/agent-runs'),
      api.get('/admin/agents/health')
    ]).then(([runsRes, healthRes]) => {
      setRuns(runsRes)
      setHealth(healthRes)
    }).catch(e => setError(e.message))
  }, [])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load AI Operations">{error}</Alert></div>
  if (!runs || !health) return <Spinner label="Loading AI Operations dashboard…" />

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-ink">AI Operations Dashboard</h1>
        <p className="text-sm text-muted">Monitor health, latency, and executions of all AI Agents.</p>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">System Health</div>
          <div className={`text-2xl font-bold ${
            health.overall_health === 'Healthy' ? 'text-emerald-600' :
            health.overall_health === 'Degraded' ? 'text-amber-500' : 'text-red-600'
          }`}>
            {health.overall_health}
          </div>
        </div>
        
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">24h Executions</div>
          <div className="text-2xl font-bold text-ink">{health.total_runs_24h.toLocaleString()}</div>
        </div>
        
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Success Rate</div>
          <div className="text-2xl font-bold text-ink">{health.success_rate}%</div>
        </div>
        
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Avg Latency</div>
          <div className="text-2xl font-bold text-ink">{health.average_latency_ms} ms</div>
        </div>
      </div>

      {/* Agent Breakdown */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-line bg-cream font-bold text-ink">
          Agent Performance (24h)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-brand-50/50 text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Agent</th>
                <th className="px-5 py-3 font-semibold text-right">Executions</th>
                <th className="px-5 py-3 font-semibold text-right">Success Rate</th>
                <th className="px-5 py-3 font-semibold text-right">Avg Latency (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {Object.entries(health.agents).map(([name, stats]) => (
                <tr key={name} className="hover:bg-cream/50">
                  <td className="px-5 py-3 flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${AGENT_COLORS[name] || 'bg-slate-400'}`} />
                    <span className="font-medium text-ink">{name}</span>
                  </td>
                  <td className="px-5 py-3 text-right">{stats.total.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={stats.error_rate > 5 ? 'text-red-500 font-bold' : 'text-emerald-600'}>
                      {100 - stats.error_rate}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono">{stats.avg_duration}</td>
                </tr>
              ))}
              {Object.keys(health.agents).length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-8 text-center text-muted">No agents have run in the past 24 hours.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Logs */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-line bg-cream font-bold text-ink flex justify-between items-center">
          <span>Recent Execution Logs</span>
          <span className="badge-info">Latest {runs.items.length}</span>
        </div>
        <div className="divide-y divide-line max-h-[600px] overflow-y-auto">
          {runs.items.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-4 hover:bg-cream/30">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${AGENT_COLORS[r.agent] || 'bg-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{r.agent}</div>
                <div className="text-xs text-muted truncate">{r.task}</div>
              </div>
              <span className={`chip ${r.status === 'completed' || r.status === 'success' ? 'badge-ok' : 'badge-warn'}`}>{r.status}</span>
              <span className="text-xs text-muted w-16 text-right">{r.duration_ms}ms</span>
              <span className="text-xs text-muted w-28 text-right">{fmtDate(r.created_at)}</span>
            </div>
          ))}
          {runs.items.length === 0 && <p className="px-5 py-10 text-center text-muted">No runs recorded yet.</p>}
        </div>
      </div>
    </div>
  )
}
