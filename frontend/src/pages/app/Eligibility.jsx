import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtRupees } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { ScoreRing, ScoreBar } from '../../components/Score'

function RuleRow({ rule, ok }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-0.5 font-bold ${ok ? 'text-brand-500' : 'text-red-500'}`}>{ok ? '✓' : '✕'}</span>
      <div className="min-w-0">
        <div className="text-sm text-ink">{rule.label || rule.reason || rule.field}</div>
        {rule.reason && rule.label && <div className="text-xs text-muted">{rule.reason}</div>}
      </div>
    </div>
  )
}

export default function Eligibility() {
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/eligibility/score')
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    api.get(`/eligibility/score/${selected}`)
      .then(setDetail)
      .catch((e) => setError(e.message))
  }, [selected])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load scores">{error}</Alert></div>
  if (!data) return <Spinner label="Scoring schemes…" />

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Eligibility Scores</h1>
          <p className="text-sm text-muted">
            All {data.total_schemes} schemes scored against your profile · average {data.average_score}%
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/recommendations" className="btn-primary">Get recommendations</Link>
          <Link to="/questionnaire" className="btn-secondary">Update profile</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="card p-4 flex items-center gap-4">
          <ScoreRing score={data.top_score?.score ?? 0} size={70} stroke={8} />
          <div>
            <div className="text-xs text-muted uppercase">Top scheme</div>
            <div className="font-semibold text-ink text-sm mt-0.5">{data.top_score?.scheme_name}</div>
            <div className="text-xs text-muted">confidence {data.top_score?.confidence}%</div>
          </div>
        </div>
        {[
          ['High match', data.counts.high, 'text-brand-700 bg-brand-50'],
          ['Partial', data.counts.partial, 'text-amber-700 bg-amber-50'],
          ['Low / none', data.counts.low, 'text-red-700 bg-red-50'],
        ].map(([label, val, cls]) => (
          <div key={label} className="card p-4">
            <div className="text-xs text-muted uppercase">{label}</div>
            <div className={`mt-1 inline-block rounded-lg px-3 py-1 font-bold ${cls}`}>{val} schemes</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-line font-bold text-ink">All schemes by score</div>
          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin divide-y divide-line">
            {data.top_score && (
              <button
                onClick={() => setSelected(data.top_score.scheme_id)}
                className={`w-full text-left px-5 py-4 hover:bg-cream transition ${selected === data.top_score.scheme_id ? 'bg-brand-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-ink">{data.top_score.scheme_name}</span>
                  <span className="text-sm font-bold text-brand-700">{data.top_score.score}%</span>
                </div>
                <ScoreBar score={data.top_score.score} />
              </button>
            )}
            <div className="px-5 py-2 text-xs text-muted">Full ranked list available in Recommendations.</div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-line font-bold text-ink">
            {detail ? detail.scheme_name : 'Scheme detail'}
          </div>
          {detail ? (
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center gap-5">
                <ScoreRing score={detail.score} size={88} />
                <div className="space-y-1">
                  <div className="text-sm"><span className="text-muted">Confidence:</span> <b>{detail.confidence}%</b></div>
                  <div className="text-sm"><span className="text-muted">Approval probability:</span> <b>{detail.approval_probability}%</b></div>
                  <div className="text-sm"><span className="text-muted">Benefit:</span> <b>{detail.amount || fmtRupees(detail.amount_max)}</b></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink mb-2">Matched criteria ({detail.matched_rules?.length ?? 0})</h3>
                <div className="space-y-1.5">
                  {detail.matched_rules?.length
                    ? detail.matched_rules.map((r, i) => <RuleRow key={i} rule={r} ok />)
                    : <p className="text-sm text-muted">None.</p>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink mb-2">Missing criteria ({detail.missing_rules?.length ?? 0})</h3>
                <div className="space-y-1.5">
                  {detail.missing_rules?.length
                    ? detail.missing_rules.map((r, i) => <RuleRow key={i} rule={r} ok={false} />)
                    : <p className="text-sm text-muted">Nothing missing — fully eligible!</p>}
                </div>
              </div>

              {detail.next_steps?.length > 0 && (
                <div className="rounded-lg bg-brand-50 border border-brand-100 p-4">
                  <h3 className="text-sm font-semibold text-brand-800 mb-2">How to improve your score</h3>
                  <ul className="space-y-1.5 text-sm text-brand-900">
                    {detail.next_steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2"><span className="text-brand-accent font-bold">→</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Link to="/compare" className="btn-secondary flex-1">Compare with others</Link>
                <Link to={`/applications`} state={{ schemeId: detail.scheme_id }} className="btn-primary flex-1">Apply</Link>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-muted text-sm">
              Select a scheme on the left to see its explainable score.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
