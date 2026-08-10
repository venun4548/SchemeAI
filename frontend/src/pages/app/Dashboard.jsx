import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { ScoreRing, ScoreBar, statusBadge } from '../../components/Score'

const AGENT_META = {
  'Profiling Agent': { icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z', color: 'bg-blue-500' },
  'Eligibility Agent': { icon: 'M12 2 4 5v6c0 5.25 3.4 10.15 8 11 4.6-.85 8-5.75 8-11V5l-8-3z', color: 'bg-brand-500' },
  'Policy Agent': { icon: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', color: 'bg-violet-500' },
  'Recommender Agent': { icon: 'M12 21l-8-8a4 4 0 0 1 5.66-5.66L12 8l2.34-2.34A4 4 0 1 1 20 13l-8 8z', color: 'bg-brand-accent' },
  'Explainability Agent': { icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z', color: 'bg-teal-500' },
  'Guidance Agent': { icon: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z', color: 'bg-amber-500' },
  'Fraud Agent': { icon: 'M12 1l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V5l9-4z', color: 'bg-red-500' },
  'Documents Agent': { icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z', color: 'bg-slate-500' },
}

function AgentLog({ log }) {
  const meta = AGENT_META[log.agent] || { icon: '', color: 'bg-slate-400' }
  return (
    <div className="flex items-start gap-3">
      <span className={`h-7 w-7 rounded-lg ${meta.color} text-white flex items-center justify-center shrink-0 mt-0.5`}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d={meta.icon} /></svg>
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{log.agent}</div>
        <div className="text-xs text-muted">{log.task}</div>
        {log.detail && <div className="text-xs text-brand-700 mt-0.5 truncate">{log.detail}</div>}
      </div>
    </div>
  )
}

function PanelTitle({ title, sub }) {
  return (
    <div className="px-5 pt-5 pb-3 border-b border-line">
      <h3 className="font-bold text-ink">{title}</h3>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/dashboard/home')
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
  }, [])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load dashboard">{error}</Alert></div>
  if (!data) return <Spinner label="Running the AI pipeline…" />

  const { profile, best_match, second_best, explanation, guidance, document_status, agent_logs } = data

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">AI Dashboard</h1>
          <p className="text-sm text-muted">
            Welcome back, {user?.full_name || profile?.name || 'there'}. Here’s what the agents found.
          </p>
          {user?.citizen_id && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">SCHEMEAI CITIZEN ID</span>
              <span className="font-mono bg-white border border-line px-2 py-1 rounded text-ink font-bold text-sm tracking-widest">{user.citizen_id}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(user.citizen_id)
                  alert("Copied to clipboard!")
                }}
                className="btn-ghost !px-2 !py-1 text-xs"
              >
                Copy ID
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link to="/recommendations" className="btn-primary">Run full analysis</Link>
          <Link to="/questionnaire" className="btn-secondary">Update profile</Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Profile completeness', value: `${data.profile_completeness}%`, to: '/questionnaire' },
          { label: 'High-match schemes', value: data.counts?.high ?? 0, to: '/eligibility' },
          { label: 'Active applications', value: data.active_applications, to: '/applications' },
          { label: 'Saved schemes', value: data.saved_count, to: '/recommendations' },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="card p-4 hover:shadow-lift transition">
            <div className="text-xs font-medium text-muted uppercase tracking-wide">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-ink">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* Three-panel AI control */}
      <div className="grid gap-5 lg:grid-cols-[240px_1fr_300px]">
        {/* Left: agents */}
        <div className="card flex flex-col overflow-hidden">
          <PanelTitle title="AI Agents" sub={`${agent_logs?.length || 0} agents · ${data.runtime_ms}ms`} />
          <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-4">
            {agent_logs?.map((log, i) => <AgentLog key={i} log={log} />)}
          </div>
        </div>

        {/* Center: top match */}
        <div className="card flex flex-col overflow-hidden">
          <PanelTitle title="Top match" sub="Best fit for your current profile" />
          <div className="p-5 flex-1">
            {best_match ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-ink">{best_match.scheme.name}</h2>
                    <p className="text-sm text-muted mt-0.5">{best_match.scheme.ministry}</p>
                  </div>
                  <ScoreRing score={best_match.final_score ?? best_match.score?.score} size={92} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-cream border border-line p-3">
                    <div className="text-xs text-muted">Eligibility</div>
                    <div className="font-bold text-ink">{best_match.final_score ?? best_match.score?.score}%</div>
                  </div>
                  <div className="rounded-lg bg-cream border border-line p-3">
                    <div className="text-xs text-muted">Approval probability</div>
                    <div className="font-bold text-ink">{best_match.score?.approval_probability ?? 0}%</div>
                  </div>
                  <div className="rounded-lg bg-cream border border-line p-3">
                    <div className="text-xs text-muted">Benefit</div>
                    <div className="font-bold text-ink">{best_match.scheme.amount || '—'}</div>
                  </div>
                  <div className="rounded-lg bg-cream border border-line p-3">
                    <div className="text-xs text-muted">Category</div>
                    <div className="font-bold text-ink capitalize">{best_match.scheme.category}</div>
                  </div>
                </div>

                {explanation?.why_eligible?.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold text-ink mb-2">Why you qualify</h4>
                    <ul className="space-y-1.5">
                      {explanation.why_eligible.slice(0, 4).map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink">
                          <span className="text-brand-500 font-bold mt-0.5">✓</span>{w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <Link to={`/applications`} state={{ schemeId: best_match.scheme.id }} className="btn-primary flex-1">
                    Apply now
                  </Link>
                  <Link to="/recommendations" className="btn-secondary flex-1">View all</Link>
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <p className="text-muted mb-4">Complete your profile to unlock personalised matches.</p>
                <Link to="/questionnaire" className="btn-primary">Start the AI interview</Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: insights */}
        <div className="flex flex-col gap-5">
          <div className="card overflow-hidden">
            <PanelTitle title="Application plan" />
            <div className="p-4">
              {guidance?.steps?.length ? (
                <ol className="space-y-3">
                  {guidance.steps.slice(0, 4).map((s) => (
                    <li key={s.step} className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {s.step}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-ink">{s.title}</div>
                        <div className="text-xs text-muted">{s.detail}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">No plan yet — run the analysis.</p>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <PanelTitle title="Documents" />
            <div className="p-4">
              {document_status?.required?.length ? (
                <div className="space-y-2">
                  {document_status.required.map((d) => (
                    <div key={d} className="flex items-center justify-between text-sm">
                      <span className="text-ink capitalize">{d.replace(/_/g, ' ')}</span>
                      {document_status.uploaded.includes(d) ? (
                        <span className="badge-ok">Ready</span>
                      ) : (
                        <span className="badge-warn">Missing</span>
                      )}
                    </div>
                  ))}
                  <Link to="/documents" className="btn-secondary w-full mt-2 !py-2 text-xs">Manage documents</Link>
                </div>
              ) : (
                <p className="text-sm text-muted">Upload documents for readiness checks.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom strip: recent applications + notifications */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <PanelTitle title="Recent applications" />
          <div className="divide-y divide-line">
            {data.applications?.length ? (
              data.applications.map((a) => {
                const b = statusBadge(a.status)
                return (
                  <Link key={a.id} to={`/applications/${a.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-cream transition">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">{a.scheme_name}</div>
                      <div className="text-xs text-muted">{a.application_id} · step {a.current_step}/{a.total_steps}</div>
                    </div>
                    <span className={b.cls}>{b.label}</span>
                  </Link>
                )
              })
            ) : (
              <p className="px-5 py-6 text-sm text-muted text-center">No applications yet.</p>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <PanelTitle title="Recent notifications" sub={`${data.unread_count} unread`} />
          <div className="divide-y divide-line">
            {data.notifications?.length ? (
              data.notifications.slice(0, 4).map((n) => (
                <div key={n.id} className="px-5 py-3">
                  <div className="text-sm font-semibold text-ink">{n.title}</div>
                  <div className="text-xs text-muted">{n.body} · {fmtDate(n.created_at)}</div>
                </div>
              ))
            ) : (
              <p className="px-5 py-6 text-sm text-muted text-center">You’re all caught up.</p>
            )}
            <Link to="/notifications" className="block px-5 py-3 text-sm font-semibold text-brand-700 hover:bg-cream">
              View all notifications →
            </Link>
          </div>
        </div>
      </div>

      {/* Agent timeline bottom strip */}
      {data.trace?.length > 0 && (
        <div className="card overflow-hidden">
          <PanelTitle title="Agent execution trace" sub="The exact route the pipeline took" />
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-thin p-5">
            {data.trace.map((t, i) => (
              <div key={i} className="flex items-center shrink-0">
                <div className="flex flex-col items-center px-2">
                  <span className="h-7 w-7 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="mt-1.5 text-[11px] text-muted whitespace-nowrap">{t.agent}</span>
                </div>
                {i < data.trace.length - 1 && <span className="h-px w-10 bg-line" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
