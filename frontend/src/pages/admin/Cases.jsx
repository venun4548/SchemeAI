import { useEffect, useState, useCallback } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { CaseStatus, Empty, PageHead, Pri, StatCard, fmtDT } from './ui'

const statusFlow = ['open', 'assigned', 'in_progress', 'waiting_for_user', 'escalated', 'resolved', 'closed']

export default function AdminCases() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ status: '', priority: '', assigned: '', q: '' })
  const [detail, setDetail] = useState(null)
  const [admins, setAdmins] = useState([])
  const [citizens, setCitizens] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ user_id: '', subject: '', description: '', issue_type: 'other', priority: 'medium' })
  const toast = useToast()

  const load = useCallback(async (f = filters) => {
    try {
      const params = new URLSearchParams()
      if (f.status) params.set('status', f.status)
      if (f.priority) params.set('priority', f.priority)
      if (f.assigned) params.set('assigned', f.assigned)
      if (f.q) params.set('q', f.q)
      setData(await api.get(`/admin/ops/cases?${params.toString()}`))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/admin/users').then((r) => {
      setAdmins(r.items.filter((u) => u.role === 'admin'))
      setCitizens(r.items.filter((u) => u.role === 'citizen'))
    }).catch(() => {})
  }, [])

  const open = useCallback(async (id) => {
    try {
      setDetail(await api.get(`/admin/ops/cases/${id}`))
      setNote('')
    } catch (e) { toast.error(e.message) }
  }, [toast])

  async function refresh() {
    if (detail) await open(detail.id)
    await load()
  }

  async function assign(adminId) {
    setBusy(true)
    try {
      await api.put(`/admin/ops/cases/${detail.id}/assign`, { assigned_to: adminId || null })
      toast.success('Case assigned.')
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function transition(status) {
    setBusy(true)
    try {
      const extraNote = status === 'resolved' || status === 'closed' ? (prompt('Resolution summary (recorded in audit):') || '') : note.trim()
      await api.put(`/admin/ops/cases/${detail.id}/status`, { status, note: extraNote || note.trim() })
      toast.success(`Case ${status.replace(/_/g, ' ')}.`)
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function reply(e) {
    e.preventDefault()
    if (!note.trim()) return
    setBusy(true)
    try {
      await api.post(`/admin/ops/cases/${detail.id}/reply`, { message: note.trim() })
      toast.success('Reply recorded.')
      setNote('')
      await refresh()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  async function createCase(e) {
    e.preventDefault()
    if (!form.user_id || !form.subject) {
      toast.error('Select a citizen and enter a subject.')
      return
    }
    setBusy(true)
    try {
      const c = await api.post('/admin/ops/cases', form)
      toast.success(`Case ${c.case_ref} created.`)
      setCreating(false)
      setForm({ user_id: '', subject: '', description: '', issue_type: 'other', priority: 'medium' })
      await load()
      open(c.id)
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load cases">{error}</Alert></div>
  if (!data) return <Spinner label="Loading cases…" />

  const openCount = data.items.filter((c) => ['open', 'assigned', 'in_progress', 'waiting_for_user'].includes(c.status)).length

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Support & Issues" subtitle="Triage citizen cases, track SLAs and escalate when needed.">
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Raise case</button>
      </PageHead>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open cases" value={openCount} tone="blue" />
        <StatCard label="Escalated" value={data.items.filter((c) => c.status === 'escalated').length} tone="amber" />
        <StatCard label="Resolved" value={data.items.filter((c) => c.status === 'resolved' || c.status === 'closed').length} tone="green" />
        <StatCard label="Critical priority" value={data.items.filter((c) => c.priority === 'critical').length} tone="red" />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <select className="input" value={filters.status} onChange={(e) => { const f = { ...filters, status: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All statuses</option>
            {statusFlow.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input" value={filters.priority} onChange={(e) => { const f = { ...filters, priority: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="input" value={filters.assigned} onChange={(e) => { const f = { ...filters, assigned: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All assignments</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <input className="input" placeholder="Search subject / case ref / name" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && load(filters)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Ref</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Citizen</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-cream">
                  <td className="px-4 py-3 font-mono text-xs text-muted">{c.case_ref}</td>
                  <td className="px-4 py-3 font-medium text-ink max-w-[240px] truncate">{c.subject}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{c.user}</p>
                    <p className="text-xs text-muted">{c.user_email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.issue_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><Pri priority={c.priority} /></td>
                  <td className="px-4 py-3"><CaseStatus status={c.status} /></td>
                  <td className="px-4 py-3 text-muted">{fmtDT(c.updated_at)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => open(c.id)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.items.length === 0 && <Empty message="No cases match the current filters." />}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <div className="relative card w-full max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-ink">{detail.subject}</h2>
                <p className="text-sm text-muted">{detail.case_ref} · {detail.user} · {detail.user_email} · {fmtDT(detail.created_at)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <CaseStatus status={detail.status} />
                <Pri priority={detail.priority} />
              </div>
            </div>

            {detail.sla_due_at && (
              <div className={`rounded-lg px-3 py-2 text-sm ${new Date(detail.sla_due_at) < new Date() ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'}`}>
                SLA due: {fmtDT(detail.sla_due_at)} {new Date(detail.sla_due_at) < new Date() && '— OVERDUE'}
              </div>
            )}

            {detail.description && <p className="text-sm text-muted bg-cream rounded-lg p-3">{detail.description}</p>}

            <div className="flex flex-wrap gap-2">
              <select className="input !py-1.5 text-xs" value={detail.assigned_to || ''} disabled={busy} onChange={(e) => assign(e.target.value)}>
                <option value="">Unassigned</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name} ({a.admin_role})</option>)}
              </select>
              {statusFlow.filter((s) => s !== detail.status).map((s) => (
                <button key={s} className={`btn text-xs !py-1.5 ${s === 'escalated' ? 'btn-ghost text-amber-700 hover:bg-amber-50' : s === 'resolved' || s === 'closed' ? 'btn-ghost text-brand-700 hover:bg-brand-50' : 'btn-secondary'}`}
                  onClick={() => transition(s)} disabled={busy}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Timeline</h3>
              <div className="space-y-2">
                {detail.timeline.length === 0 && <p className="text-sm text-muted">No activity.</p>}
                {detail.timeline.slice().reverse().map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink">{t.note || <span className="text-muted italic">No note</span>}</p>
                      <p className="text-xs text-muted">{t.by} · {t.status} · {fmtDT(t.ts)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={reply} className="flex gap-2">
              <input className="input text-sm" placeholder="Add note / reply to citizen…" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-secondary !py-1.5 text-xs" disabled={busy}>Add note</button>
            </form>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCreating(false)} />
          <form onSubmit={createCase} className="relative card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-ink">Raise support case</h2>
            <div>
              <label className="label">Citizen *</label>
              <select className="input" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                <option value="">Select citizen…</option>
                {citizens.map((c) => <option key={c.id} value={c.id}>{c.full_name} · {c.email}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Subject *</label>
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input w-full" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Issue type</label>
                <select className="input" value={form.issue_type} onChange={(e) => setForm({ ...form, issue_type: e.target.value })}>
                  {['login', 'otp', 'eligibility', 'application_stuck', 'document', 'scheme_info', 'ai_recommendation', 'technical', 'complaint', 'other'].map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create case'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
