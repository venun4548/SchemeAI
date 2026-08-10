import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { Chip, Empty, PageHead, StatCard, fmtDT } from './ui'

const INTENT_LABELS = {
  SCHEME_SEARCH: 'Scheme search', ELIGIBILITY: 'Eligibility', WHY_NOT_ELIGIBLE: 'Why not eligible',
  DOCUMENTS: 'Documents', APPLICATION_HELP: 'Application help', APPLICATION_STATUS: 'App status',
  PROFILE: 'Profile', SUPPORT: 'Support', STATE_SCHEMES: 'State schemes', BENEFITS: 'Benefits',
  SCHEME_EXPLAIN: 'Scheme explain', ALTERNATIVES: 'Alternatives', GREETING: 'Greeting',
  GENERAL: 'General', UNKNOWN: 'Unknown', RATE_LIMITED: 'Rate limited',
}

export default function AdminChat() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      setData(await api.get('/admin/ops/chat'))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load chat monitoring">{error}</Alert></div>
  if (!data) return <Spinner label="Loading chatbot telemetry…" />

  const s = data.stats || {}
  const failures = data.recent_failures || []
  const agentUsage = data.agent_stats || []
  const intents = data.intent_distribution || []
  const maxIntent = Math.max(1, ...intents.map((i) => i.count))

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Citizen Assistant Monitoring" subtitle="Real-time telemetry for the SchemeAI chatbot. Refresh to update.">
        <span className="chip">Avg response: {s.avg_response_ms ?? 0}ms</span>
        <span className="chip">Success rate: {s.requests_today ? Math.round(((s.success_today || 0) / s.requests_today) * 100) : 100}%</span>
      </PageHead>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Requests (today)" value={s.requests_today ?? 0} sub={`${s.success_today ?? 0} ok · ${s.errors_today ?? 0} errors · ${s.rate_limited_today ?? 0} rate-limited`} tone="green" />
        <StatCard label="Conversations" value={s.total_conversations ?? 0} sub={`${s.conversations_today ?? 0} started today`} tone="violet" />
        <StatCard label="Messages (today)" value={s.messages_today ?? 0} sub="stored in conversation memory" tone="ink" />
        <StatCard label="Avg response" value={`${s.avg_response_ms ?? 0}ms`} sub="per request (rule engine)" tone="blue" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink mb-3">Agent usage (24h)</h2>
          {agentUsage.length === 0 ? <Empty message="No agent activity yet. Open the chatbot and ask a question." /> : (
            <div className="space-y-2.5">
              {agentUsage.map((a) => (
                <div key={a.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-ink">{a.name.replace(/_/g, ' ')}</span>
                    <span className="text-muted text-xs">{a.runs} runs · {a.avg_ms}ms avg</span>
                  </div>
                  <div className="h-2 rounded-full bg-cream overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, (a.runs / agentUsage[0].runs) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink mb-3">Intents (today)</h2>
          {intents.length === 0 ? <Empty message="No intents recorded today." /> : (
            <div className="space-y-2">
              {intents.map((i) => (
                <div key={i.intent} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 truncate text-ink">{INTENT_LABELS[i.intent] || i.intent}</span>
                  <div className="h-2 flex-1 rounded-full bg-cream overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(i.count / maxIntent) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-muted text-xs">{i.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {failures.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-bold text-red-600 mb-3">Recent errors (today)</h2>
          <div className="space-y-2">
            {failures.map((f) => (
              <div key={f.id} className="text-sm border border-red-100 bg-red-50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink truncate">{f.message}</span>
                  <span className="text-muted text-xs shrink-0">{fmtDT(f.created_at)}</span>
                </div>
                <div className="text-xs text-red-700 mt-0.5 font-mono break-words">{f.error}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Recent requests</h2>
          <span className="text-xs text-muted">Last {data.items?.length || 0} · raw messages are trimmed</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Message</th>
                <th className="px-4 py-3 font-semibold">Intent</th>
                <th className="px-4 py-3 font-semibold">Agents</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data.items || []).map((r) => (
                <tr key={r.id} className="hover:bg-cream">
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDT(r.created_at)}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{r.user?.name || 'Anonymous'}</td>
                  <td className="px-4 py-3 text-ink max-w-[260px] truncate">{r.message}</td>
                  <td className="px-4 py-3"><Chip tone={r.intent === 'UNKNOWN' ? 'gray' : 'green'}>{INTENT_LABELS[r.intent] || r.intent}</Chip></td>
                  <td className="px-4 py-3 text-muted">{(r.agents_used || []).map((a) => a.name).join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    {r.status === 'success' ? <Chip tone="green">OK</Chip>
                      : r.status === 'rate_limited' ? <Chip tone="amber">Limited</Chip>
                        : <Chip tone="red">Error</Chip>}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.duration_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data.items || []).length === 0 && <Empty message="No chat requests recorded yet." />}
      </div>
    </div>
  )
}
