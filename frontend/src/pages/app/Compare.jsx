import { useEffect, useState } from 'react'
import { api, fmtRupees } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { ScoreBar } from '../../components/Score'
import { useToast } from '../../context/ToastContext'

export default function Compare() {
  const [schemes, setSchemes] = useState([])
  const [selected, setSelected] = useState([])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.get('/schemes')
      .then((res) => setSchemes(res.items || []))
      .catch((e) => toast.error(e.message))
  }, [])

  function toggle(id) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s,
    )
    if (selected.length >= 5 && !selected.includes(id)) toast.error('Compare up to 5 schemes at once.')
  }

  async function run() {
    if (selected.length < 2) { toast.error('Select at least 2 schemes to compare.'); return }
    setBusy(true)
    try {
      const res = await api.post('/eligibility/compare', { scheme_ids: selected })
      setResult(res)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Compare schemes</h1>
        <p className="text-sm text-muted">Select 2–5 schemes to compare side by side with AI analysis.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {schemes.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={`chip border transition ${
              selected.includes(s.id) ? 'bg-brand text-white border-brand' : 'bg-white text-ink border-line hover:border-brand-300'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <button className="btn-primary" onClick={run} disabled={busy}>
        {busy ? 'Analysing…' : `Compare (${selected.length})`}
      </button>

      {result && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-bold text-ink mb-1">AI verdict</h2>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{result.analysis.verdict}</p>
            {result.analysis.pros?.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-brand-700 uppercase mb-1.5">Strengths</div>
                <ul className="space-y-1">
                  {result.analysis.pros.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink"><span className="text-brand-500 font-bold">✓</span>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.analysis.cons?.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-red-600 uppercase mb-1.5">Watch outs</div>
                <ul className="space-y-1">
                  {result.analysis.cons.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink"><span className="text-red-500 font-bold">✕</span>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand text-white text-left">
                    <th className="px-4 py-3 font-semibold">Attribute</th>
                    {result.schemes.map((s) => (
                      <th key={s.id} className="px-4 py-3 font-semibold min-w-[180px]">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[
                    ['Category', (s) => s.category],
                    ['Level', (s) => (s.level === 'central' ? 'Central' : s.state_specific)],
                    ['Ministry', (s) => s.ministry],
                    ['Benefit', (s) => s.amount || '—'],
                    ['Duration', (s) => s.duration || '—'],
                    ['Application time', (s) => s.application_time || '—'],
                    ['Renewal', (s) => s.renewal_policy || '—'],
                    ['Target audience', (s) => s.target_audience || '—'],
                  ].map(([label, fn]) => (
                    <tr key={label} className="hover:bg-cream">
                      <td className="px-4 py-3 font-medium text-muted">{label}</td>
                      {result.schemes.map((s) => (
                        <td key={s.id} className="px-4 py-3 text-ink">{fn(s)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="hover:bg-cream">
                    <td className="px-4 py-3 font-medium text-muted">Required documents</td>
                    {result.schemes.map((s) => (
                      <td key={s.id} className="px-4 py-3">
                        <div className="space-y-0.5">
                          {(s.required_documents || []).map((d) => (
                            <span key={d} className="chip bg-cream text-muted capitalize">{d.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-cream/60">
                    <td className="px-4 py-3 font-semibold text-ink">Eligibility score</td>
                    {result.schemes.map((s, i) => (
                      <td key={s.id} className="px-4 py-3">
                        <ScoreBar score={result.scores[i]?.score?.score ?? 0} className="max-w-[180px]" />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
