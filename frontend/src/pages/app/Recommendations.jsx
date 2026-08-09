import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { ScoreRing, ScoreBar } from '../../components/Score'
import { useToast } from '../../context/ToastContext'

function RecCard({ m, rank }) {
  const toast = useToast()
  const s = m.scheme
  const score = m.final_score ?? m.score
  const [saving, setSaving] = useState(false)

  async function toggleSave(e) {
    e.preventDefault()
    e.stopPropagation()
    setSaving(true)
    try {
      if (m.is_saved) {
        await api.del(`/schemes/${s.id}/save`)
        toast.info('Removed from saved.')
      } else {
        await api.post(`/schemes/${s.id}/save`)
        toast.success('Saved to your list.')
      }
      // parent refreshes by re-mounting via key change; simplest: reload page state
      window.location.reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Link to={`/eligibility`} className="card p-5 block hover:shadow-lift transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-bold text-brand-accent uppercase">{rank}</span>
        <button
          onClick={toggleSave}
          disabled={saving}
          className="text-muted hover:text-brand-accent"
          aria-label="Save"
          title={m.is_saved ? 'Unsave' : 'Save'}
        >
          {m.is_saved ? '★' : '☆'}
        </button>
      </div>
      <h3 className="font-bold text-ink leading-snug">{s.name}</h3>
      <p className="text-xs text-brand-700 font-medium mt-0.5">{s.ministry}</p>
      <div className="mt-3 flex items-center gap-4">
        <ScoreBar score={score} className="flex-1" />
        <ScoreRing score={score} size={56} stroke={7} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="chip bg-brand-50 text-brand-700">{s.category}</span>
        <span className="chip bg-cream text-muted">{s.amount || '—'}</span>
        {m.has_applied && <span className="badge-info">Applied</span>}
      </div>
      {m.next_steps?.length > 0 && (
        <p className="mt-3 text-xs text-muted line-clamp-2">Next: {m.next_steps[0]}</p>
      )}
    </Link>
  )
}

function Snippet({ s }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="text-sm font-semibold text-ink">{s.title}</div>
      <p className="text-xs text-muted mt-1 line-clamp-3">{s.content || s.snippet}</p>
      {s.source && <div className="text-[11px] text-brand-700 mt-1">{s.source}</div>}
    </div>
  )
}

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

export default function Recommendations() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setData(null)
    api.get('/eligibility/recommendations')
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
  }, [])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load recommendations">{error}</Alert></div>
  if (!data) return <Spinner label="Running 8 agents — profiling, scoring, policy, recommending…" />

  const top = [data.best_match, data.second_best].filter(Boolean)
  const alternatives = data.alternatives || []

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Personalized Recommendations</h1>
          <p className="text-sm text-muted">
            Goal: {data.goal} · {data.total_matches} matches · {data.runtime_ms}ms
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/compare" className="btn-secondary">Compare</Link>
          <Link to="/questionnaire" className="btn-secondary">Refine profile</Link>
        </div>
      </div>

      {/* Top two matches */}
      <div className="grid gap-5 lg:grid-cols-2">
        {top.map((m, i) => (
          <div key={m.scheme.id} className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-brand-accent uppercase">{i === 0 ? 'Best match' : 'Runner up'}</span>
                <h2 className="text-xl font-bold text-ink mt-1">{m.scheme.name}</h2>
                <p className="text-sm text-muted">{m.scheme.ministry}</p>
              </div>
              <ScoreRing score={m.final_score ?? m.score} size={96} />
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-lg bg-cream border border-line p-2.5">
                <div className="text-lg font-bold text-ink">{m.score}%</div>
                <div className="text-[11px] text-muted">Eligibility</div>
              </div>
              <div className="rounded-lg bg-cream border border-line p-2.5">
                <div className="text-lg font-bold text-ink">{m.approval_probability}%</div>
                <div className="text-[11px] text-muted">Approval prob.</div>
              </div>
              <div className="rounded-lg bg-cream border border-line p-2.5">
                <div className="text-lg font-bold text-ink">{m.confidence}%</div>
                <div className="text-[11px] text-muted">Confidence</div>
              </div>
              <div className="rounded-lg bg-cream border border-line p-2.5">
                <div className="text-lg font-bold text-ink truncate">{m.scheme.amount || '—'}</div>
                <div className="text-[11px] text-muted">Benefit</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {m.scheme.tags?.map((t) => <span key={t} className="chip bg-brand-50 text-brand-700">{t}</span>)}
              {m.is_saved && <span className="badge-info">Saved</span>}
              {m.has_applied && <span className="badge-info">Applied</span>}
            </div>
            <div className="mt-5 flex gap-2">
              <Link to="/eligibility" className="btn-primary flex-1">See full explanation</Link>
              <Link to={`/applications`} state={{ schemeId: m.scheme.id }} className="btn-secondary flex-1">Apply</Link>
            </div>
          </div>
        ))}
      </div>

      {/* Explainer + guidance + fraud */}
      <div className="grid gap-5 lg:grid-cols-3">
        {data.explanation && (
          <div className="card p-5">
            <h3 className="font-bold text-ink mb-3">Why {data.explanation.scheme_name}</h3>
            {data.explanation.why_eligible?.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-brand-700 uppercase mb-1.5">You qualify because</div>
                <ul className="space-y-1.5">
                  {data.explanation.why_eligible.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink"><span className="text-brand-500 font-bold">✓</span>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.explanation.why_not_eligible?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-red-600 uppercase mb-1.5">Not yet eligible for</div>
                <ul className="space-y-1.5">
                  {data.explanation.why_not_eligible.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink"><span className="text-red-500 font-bold">✕</span>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {data.guidance && (
          <div className="card p-5">
            <h3 className="font-bold text-ink mb-1">Application roadmap</h3>
            <p className="text-xs text-muted mb-3">{data.guidance.scheme_name} · ~{data.guidance.estimated_time}</p>
            <ol className="space-y-3">
              {data.guidance.steps?.map((s) => (
                <li key={s.step} className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
                  <div>
                    <div className="text-sm font-medium text-ink">{s.title}</div>
                    <div className="text-xs text-muted">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="space-y-5">
          {data.document_status && (
            <div className="card p-5">
              <h3 className="font-bold text-ink mb-3">Document readiness</h3>
              <div className="space-y-2">
                {data.document_status.required?.map((d) => (
                  <div key={d} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-ink">{d.replace(/_/g, ' ')}</span>
                    {data.document_status.uploaded?.includes(d)
                      ? <span className="badge-ok">Ready</span>
                      : <span className="badge-warn">Missing</span>}
                  </div>
                ))}
                {!data.document_status.required?.length && <p className="text-sm text-muted">No documents required.</p>}
              </div>
              <Link to="/documents" className="btn-secondary w-full mt-3 !py-2 text-xs">Manage documents</Link>
            </div>
          )}
          {data.fraud_flags?.length > 0 && (
            <div className="card p-5 border-amber-200">
              <h3 className="font-bold text-ink mb-2">Safety check</h3>
              {data.fraud_flags.map((f, i) => (
                <div key={i} className={`flex items-start gap-2 text-sm ${f.level === 'high' ? 'text-red-600' : 'text-amber-700'}`}>
                  <span className="font-bold">⚠</span>{f.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <h3 className="font-bold text-ink mb-3">More good matches</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alternatives.map((m) => <RecCard key={m.scheme.id} m={m} rank="Also a match" />)}
          </div>
        </div>
      )}

      {/* Policy snippets */}
      {data.policy_snippets?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-ink mb-3">Policy context retrieved by RAG</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.policy_snippets.map((s, i) => <Snippet key={i} s={s} />)}
          </div>
        </div>
      )}

      {/* Agent logs */}
      {data.agent_logs?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-ink mb-3">Agent run log</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {data.agent_logs.map((log, i) => {
              const meta = AGENT_META[log.agent] || { icon: '', color: 'bg-slate-400' }
              return (
                <div key={i} className="rounded-lg border border-line p-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-6 w-6 rounded-md ${meta.color} text-white flex items-center justify-center`}>
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d={meta.icon} /></svg>
                    </span>
                    <span className="text-sm font-semibold text-ink">{log.agent}</span>
                  </div>
                  <p className="text-xs text-muted mt-1.5">{log.task}</p>
                  {log.detail && <p className="text-xs text-brand-700 mt-0.5 truncate">{log.detail}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted text-center">Run ID: {data.run_id} · generated {fmtDate(new Date().toISOString())}</p>
    </div>
  )
}
