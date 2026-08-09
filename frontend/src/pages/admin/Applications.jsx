import { useEffect, useState, useCallback } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { AppStatus, Chip, Empty, PageHead, Pri, ReviewStatus, fmtDT } from './ui'

const statusOpts = [
  ['', 'All statuses'], ['submitted', 'Submitted'], ['under_review', 'Under review'],
  ['approved', 'Approved'], ['rejected', 'Rejected'], ['disbursed', 'Disbursed'],
  ['draft', 'Draft'], ['in_progress', 'In progress'],
]

export default function AdminApplications() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ status: '', review_status: '', priority: '', assigned: '', q: '' })
  const [detail, setDetail] = useState(null)
  const [admins, setAdmins] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const toast = useToast()

  const load = useCallback(async (f = filters) => {
    try {
      const params = new URLSearchParams()
      if (f.status) params.set('status', f.status)
      if (f.review_status) params.set('review_status', f.review_status)
      if (f.priority) params.set('priority', f.priority)
      if (f.assigned) params.set('assigned', f.assigned)
      if (f.q) params.set('q', f.q)
      setData(await api.get(`/admin/ops/applications?${params.toString()}`))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadDetail = useCallback(async (id) => {
    try {
      setDetail(await api.get(`/admin/ops/applications/${id}`))
    } catch (e) {
      toast.error(e.message)
    }
  }, [toast])

  async function refreshDetail() {
    if (detail) await loadDetail(detail.id)
    await load()
  }

  async function assign(adminId) {
    setBusy(true)
    try {
      await api.put(`/admin/ops/applications/${detail.id}/assign`, { assigned_admin_id: adminId })
      toast.success('Application assigned.')
      await refreshDetail()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function setPriority(p) {
    setBusy(true)
    try {
      await api.put(`/admin/ops/applications/${detail.id}/priority`, { priority: p })
      toast.success('Priority updated.')
      await refreshDetail()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    setBusy(true)
    try {
      await api.post(`/admin/ops/applications/${detail.id}/notes`, { note: note.trim() })
      toast.success('Note added.')
      setNote('')
      await refreshDetail()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  async function decide(decision) {
    if (!window.confirm(`Approve application ${detail.application_id}? This decision is recorded in the audit trail.`)) return
    setBusy(true)
    try {
      const reason = decision === 'approve'
        ? 'Verified during document & eligibility review'
        : (prompt('Reason for rejection (recorded in audit):') || 'Rejected after review')
      await api.put(`/admin/ops/applications/${detail.id}/decision`, { decision, reason })
      toast.success(`Application ${decision}d.`)
      await refreshDetail()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function requestDocs() {
    const docs = prompt('Document types to request (comma separated, e.g. Aadhaar, Income certificate):')
    if (!docs) return
    setBusy(true)
    try {
      await api.post(`/admin/ops/applications/${detail.id}/request-documents`, { documents: docs.split(',').map((s) => s.trim()).filter(Boolean) })
      toast.success('Document request sent.')
      await refreshDetail()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  useEffect(() => {
    if (admins.length === 0) {
      api.get('/admin/users').then((r) => setAdmins(r.items.filter((u) => u.role === 'admin'))).catch(() => {})
    }
  }, [admins.length])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load applications">{error}</Alert></div>
  if (!data) return <Spinner label="Loading applications…" />

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Application Review" subtitle="Assign, triage and decide citizen applications. All actions are audited." />

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <select className="input" value={filters.status} onChange={(e) => { const f = { ...filters, status: e.target.value }; setFilters(f); load(f) }}>
            {statusOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input" value={filters.review_status} onChange={(e) => { const f = { ...filters, review_status: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All review states</option>
            <option value="new">New</option>
            <option value="needs_review">Needs review</option>
            <option value="documents_required">Docs required</option>
            <option value="under_review">Under review</option>
            <option value="decision">Decision made</option>
          </select>
          <select className="input" value={filters.priority} onChange={(e) => { const f = { ...filters, priority: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <select className="input" value={filters.assigned} onChange={(e) => { const f = { ...filters, assigned: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All assignments</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <input className="input" placeholder="Search name / app id / email" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && load(filters)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Application</th>
                <th className="px-4 py-3 font-semibold">Applicant</th>
                <th className="px-4 py-3 font-semibold">Scheme</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Review</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((a) => (
                <tr key={a.id} className="hover:bg-cream">
                  <td className="px-4 py-3 font-mono text-xs text-muted">{a.application_id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{a.applicant_name || a.user}</p>
                    <p className="text-xs text-muted">{a.user_email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{a.scheme}</td>
                  <td className="px-4 py-3"><Pri priority={a.priority} /></td>
                  <td className="px-4 py-3"><AppStatus status={a.status} /></td>
                  <td className="px-4 py-3"><ReviewStatus status={a.review_status} /></td>
                  <td className="px-4 py-3 text-muted">{fmtDate(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => loadDetail(a.id)}>Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.items.length === 0 && <Empty message="No applications match the current filters." />}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <div className="relative card w-full max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-ink">{detail.application_id}</h2>
                <p className="text-sm text-muted">{detail.scheme} · {detail.applicant_name} · {detail.user_email}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <AppStatus status={detail.status} />
                <Pri priority={detail.priority} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select className="input !py-1.5 text-xs" value={detail.assigned_admin_id || ''} disabled={busy}
                onChange={(e) => assign(e.target.value)}>
                <option value="">Unassigned</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name} ({a.admin_role})</option>)}
              </select>
              <select className="input !py-1.5 text-xs" value={detail.priority} disabled={busy} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Priority: Low</option>
                <option value="normal">Priority: Normal</option>
                <option value="high">Priority: High</option>
                <option value="critical">Priority: Critical</option>
              </select>
              <button className="btn-secondary !py-1.5 text-xs" onClick={requestDocs} disabled={busy}>Request documents</button>
              {detail.status !== 'approved' && detail.status !== 'rejected' && detail.status !== 'disbursed' && (
                <>
                  <button className="btn-primary !py-1.5 text-xs" onClick={() => decide('approve')} disabled={busy}>Approve</button>
                  <button className="btn-ghost !py-1.5 text-xs text-red-600 hover:bg-red-50" onClick={() => decide('reject')} disabled={busy}>Reject</button>
                </>
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-2">Eligibility</h3>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold text-brand-700">{Math.round(detail.eligibility_score || 0)}%</div>
                    <div className="flex-1 h-2 bg-cream rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(detail.eligibility_score || 0, 100)}%` }} />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-2">Requested documents</h3>
                  {detail.requested_documents.length === 0 ? (
                    <p className="text-sm text-muted">None requested.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.requested_documents.map((r, i) => (
                        <p key={i} className="text-sm text-muted">• {r.doc} <span className="text-xs">(requested {fmtDT(r.requested_at)} by {r.by})</span></p>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-2">Submitted documents</h3>
                  {detail.documents.length === 0 ? (
                    <p className="text-sm text-muted">No documents uploaded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.documents.map((d) => (
                        <p key={d.id} className="text-sm flex items-center justify-between gap-2">
                          <span className="text-muted">{d.doc_type} · {d.file_name}</span>
                          <ReviewStatus status={d.review_status} />
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink mb-2">Internal notes</h3>
                <div className="space-y-2 mb-3">
                  {detail.internal_notes.length === 0 && <p className="text-sm text-muted">No internal notes.</p>}
                  {detail.internal_notes.map((n, i) => (
                    <div key={i} className="bg-cream rounded-lg p-2.5 text-sm">
                      <p className="text-muted">{n.note}</p>
                      <p className="text-xs text-muted mt-1">{n.admin} · {fmtDT(n.ts)}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={addNote} className="flex gap-2">
                  <input className="input text-sm" placeholder="Add internal note…" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className="btn-secondary !py-1.5 text-xs" disabled={busy}>Add</button>
                </form>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Audit trail</h3>
              <div className="space-y-2">
                {detail.audit_trail.length === 0 && <p className="text-sm text-muted">No actions recorded.</p>}
                {detail.audit_trail.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-xs text-muted">
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${a.result === 'failure' ? 'bg-red-500' : 'bg-brand-500'}`} />
                    <span className="font-medium text-ink">{a.action.replace(/\./g, ' ')}</span>
                    <span>— {a.actor_name} · {fmtDT(a.created_at)}</span>
                    {a.reason && <span className="italic">“{a.reason}”</span>}
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
