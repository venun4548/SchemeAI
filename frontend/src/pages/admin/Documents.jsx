import { useEffect, useState, useCallback } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { Chip, Empty, PageHead, ReviewStatus, StatCard, fmtDT } from './ui'

export default function AdminDocuments() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ review_status: '', min_risk: '', q: '' })
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = useCallback(async (f = filters) => {
    try {
      const params = new URLSearchParams()
      if (f.review_status) params.set('review_status', f.review_status)
      if (f.min_risk) params.set('min_risk', f.min_risk)
      if (f.q) params.set('q', f.q)
      setData(await api.get(`/admin/ops/documents?${params.toString()}`))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const open = useCallback(async (id) => {
    try {
      setSelected(await api.get(`/admin/ops/documents/${id}`))
      setNote('')
    } catch (e) {
      toast.error(e.message)
    }
  }, [toast])

  async function decide(decision) {
    setBusy(true)
    try {
      await api.put(`/admin/ops/documents/${selected.id}/review`, { decision, note: note.trim() })
      toast.success(`Document marked ${decision}.`)
      setSelected(null)
      await load()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load documents">{error}</Alert></div>
  if (!data) return <Spinner label="Loading documents…" />

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Document Review" subtitle="Verify uploaded KYC documents. Fake-risk flags and blur/duplicate detection help prioritise review." />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Unreviewed', value: data.stats.unreviewed, tone: 'gray' },
          { label: 'Verified', value: data.stats.verified, tone: 'green' },
          { label: 'Rejected', value: data.stats.rejected, tone: 'red' },
          { label: 'Re-upload requested', value: data.stats.reupload_requested, tone: 'amber' },
          { label: 'Escalated', value: data.stats.escalated, tone: 'violet' },
          { label: 'High fake-risk', value: data.stats.high_risk, tone: 'red' },
        ].map((s) => <StatCard key={s.label} {...s} onClick={() => {
          const f = { ...filters, review_status: s.label === 'High fake-risk' ? '' : s.label === 'Unreviewed' ? 'unreviewed' : s.label.toLowerCase().replace(' ', '_') }
          if (s.label === 'High fake-risk') { f.min_risk = '60'; f.review_status = '' }
          setFilters(f); load(f)
        }} />)}
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <select className="input" value={filters.review_status} onChange={(e) => { const f = { ...filters, review_status: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All review states</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="reupload_requested">Re-upload requested</option>
            <option value="escalated">Escalated</option>
          </select>
          <select className="input" value={filters.min_risk} onChange={(e) => { const f = { ...filters, min_risk: e.target.value }; setFilters(f); load(f) }}>
            <option value="">Any fake-risk</option>
            <option value="40">Risk ≥ 40%</option>
            <option value="60">Risk ≥ 60%</option>
            <option value="80">Risk ≥ 80%</option>
          </select>
          <input className="input md:col-span-2" placeholder="Search name / doc type / file" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && load(filters)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Citizen</th>
                <th className="px-4 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Fake-risk</th>
                <th className="px-4 py-3 font-semibold">Flags</th>
                <th className="px-4 py-3 font-semibold">Review state</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((d) => (
                <tr key={d.id} className="hover:bg-cream">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{d.user}</p>
                    <p className="text-xs text-muted">{d.user_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{d.doc_type}</p>
                    <p className="text-xs text-muted truncate max-w-[200px]">{d.file_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${d.fake_risk >= 60 ? 'text-red-600' : d.fake_risk >= 30 ? 'text-amber-600' : 'text-brand-700'}`}>
                      {Math.round(d.fake_risk)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.is_blurry && <Chip tone="amber">Blurry</Chip>}
                      {d.is_duplicate && <Chip tone="red">Duplicate</Chip>}
                      {d.expiry_date && <Chip tone="gray">Exp {d.expiry_date}</Chip>}
                      {!d.is_blurry && !d.is_duplicate && !d.expiry_date && <span className="text-xs text-muted">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><ReviewStatus status={d.review_status} /></td>
                  <td className="px-4 py-3 text-muted">{fmtDate(d.uploaded_at)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => open(d.id)}>Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.items.length === 0 && <Empty message="No documents match the current filters." />}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative card w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">{selected.doc_type}</h2>
                <p className="text-sm text-muted">{selected.user} · {selected.user_email}</p>
              </div>
              <ReviewStatus status={selected.review_status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-cream rounded-lg p-3">
                <div className="text-xs text-muted uppercase">Fake-risk score</div>
                <div className={`text-2xl font-bold ${selected.fake_risk >= 60 ? 'text-red-600' : selected.fake_risk >= 30 ? 'text-amber-600' : 'text-brand-700'}`}>
                  {Math.round(selected.fake_risk)}%
                </div>
              </div>
              <div className="bg-cream rounded-lg p-3">
                <div className="text-xs text-muted uppercase">Expiry date</div>
                <div className="text-2xl font-bold text-ink">{selected.expiry_date || '—'}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Analyzer report</h3>
              {selected.analyzer_report && Object.keys(selected.analyzer_report).length ? (
                <pre className="bg-cream rounded-lg p-3 text-xs text-muted overflow-x-auto scrollbar-thin">
                  {JSON.stringify(selected.analyzer_report, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted">No analyzer report available.</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Review note</h3>
              <textarea className="input w-full" rows={3} placeholder="Notes recorded in the audit trail…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button className="btn-secondary text-sm" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn-ghost !text-sm text-amber-700 hover:bg-amber-50" onClick={() => decide('reupload_requested')} disabled={busy}>Request re-upload</button>
              <button className="btn-ghost !text-sm text-red-600 hover:bg-red-50" onClick={() => decide('rejected')} disabled={busy}>Reject</button>
              <button className="btn-primary text-sm" onClick={() => decide('verified')} disabled={busy}>Verify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
