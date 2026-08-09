import { useEffect, useState, useCallback } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { Chip, Empty, Lifecycle, PageHead, fmtDT } from './ui'

export default function AdminSchemes() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ lifecycle_status: '', q: '' })
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = useCallback(async (f = filters) => {
    try {
      const params = new URLSearchParams()
      if (f.lifecycle_status) params.set('lifecycle_status', f.lifecycle_status)
      if (f.q) params.set('q', f.q)
      setData(await api.get(`/admin/ops/schemes?${params.toString()}`))
    } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  const open = useCallback(async (id) => {
    try {
      const s = await api.get(`/admin/ops/schemes/${id}`)
      setSelected(s)
    } catch (e) { toast.error(e.message) }
  }, [toast])

  async function refresh() {
    if (selected) await open(selected.id)
    await load()
  }

  function startEdit() {
    const f = {}
    ;['name', 'short_name', 'ministry', 'department', 'level', 'category', 'description', 'amount',
      'duration', 'application_time', 'renewal_policy', 'official_link', 'application_portal',
      'target_audience', 'state_specific', 'is_active'].forEach((k) => { f[k] = selected[k] })
    f.benefits = (selected.benefits || []).join('\n')
    f.tags = (selected.tags || []).join(', ')
    f.reason = ''
    setEditForm(f)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { ...editForm }
      payload.benefits = editForm.benefits.split('\n').map((s) => s.trim()).filter(Boolean)
      payload.tags = editForm.tags.split(',').map((s) => s.trim()).filter(Boolean)
      delete payload.reason_fields
      const res = await api.put(`/admin/ops/schemes/${selected.id}/edit`, payload)
      toast.success('Scheme saved. Moved to approval queue.')
      setEditForm(null)
      setSelected(res)
      await load()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  async function publish() {
    if (!window.confirm(`Publish ${selected.name}? This records the approval in the audit trail.`)) return
    setBusy(true)
    try {
      const res = await api.post(`/admin/ops/schemes/${selected.id}/publish`)
      toast.success('Scheme published.')
      setSelected(res)
      await load()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function archive() {
    const reason = prompt('Reason for archiving (recorded in audit):')
    if (!reason) return
    setBusy(true)
    try {
      const res = await api.post(`/admin/ops/schemes/${selected.id}/archive`, { reason })
      toast.success('Scheme archived.')
      setSelected(res)
      await load()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load schemes">{error}</Alert></div>
  if (!data) return <Spinner label="Loading schemes…" />

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Scheme Operations" subtitle="Edit scheme details, manage eligibility and benefits, and track versioned approval." />

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <select className="input" value={filters.lifecycle_status} onChange={(e) => { const f = { ...filters, lifecycle_status: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All lifecycle states</option>
            <option value="draft">Draft</option>
            <option value="review">Awaiting approval</option>
            <option value="verified">Verified</option>
            <option value="published">Published</option>
            <option value="update_required">Update required</option>
            <option value="archived">Archived</option>
          </select>
          <input className="input md:col-span-2" placeholder="Search name / code / ministry" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && load(filters)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Scheme</th>
                <th className="px-4 py-3 font-semibold">Ministry</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Lifecycle</th>
                <th className="px-4 py-3 font-semibold">Version</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-cream">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-muted">{s.code}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{s.ministry}</td>
                  <td className="px-4 py-3 text-muted">{s.category}</td>
                  <td className="px-4 py-3"><Lifecycle status={s.lifecycle_status} /></td>
                  <td className="px-4 py-3">
                    <Chip tone="slate">v{s.version}</Chip>
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDT(s.updated_at)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => open(s.id)}>Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.items.length === 0 && <Empty message="No schemes match the current filters." />}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative card w-full max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-ink">{selected.name}</h2>
                <p className="text-sm text-muted">{selected.code} · {selected.ministry} · {selected.category}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Lifecycle status={selected.lifecycle_status} />
                <Chip tone="slate">v{selected.version}</Chip>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary text-xs !py-1.5" onClick={startEdit} disabled={busy}>Edit scheme</button>
              {selected.lifecycle_status !== 'published' && selected.lifecycle_status !== 'archived' && (
                <button className="btn-primary text-xs !py-1.5" onClick={publish} disabled={busy}>Publish</button>
              )}
              {selected.lifecycle_status !== 'archived' && (
                <button className="btn-ghost text-xs !py-1.5 text-red-600 hover:bg-red-50" onClick={archive} disabled={busy}>Archive</button>
              )}
            </div>

            {selected.description && <p className="text-sm text-muted bg-cream rounded-lg p-3">{selected.description}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-cream rounded-lg p-3">
                <div className="text-xs text-muted uppercase">Amount</div>
                <div className="font-semibold text-ink">{selected.amount || '—'}</div>
              </div>
              <div className="bg-cream rounded-lg p-3">
                <div className="text-xs text-muted uppercase">Level</div>
                <div className="font-semibold text-ink capitalize">{selected.level}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Benefits</h3>
              <ul className="text-sm text-muted list-disc pl-5 space-y-1">
                {(selected.benefits || []).map((b, i) => <li key={i}>{b}</li>)}
                {selected.benefits?.length === 0 && <li>None listed.</li>}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Eligibility rules</h3>
              <div className="text-sm text-muted space-y-1">
                {(selected.eligibility_rules || []).length === 0 && <p>No structured rules.</p>}
                {(selected.eligibility_rules || []).map((r, i) => <p key={i}>• {JSON.stringify(r)}</p>)}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Version history</h3>
              <div className="space-y-2">
                {selected.versions.length === 0 && <p className="text-sm text-muted">No revision history.</p>}
                {selected.versions.map((v) => (
                  <div key={v.id} className="bg-cream rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">v{v.version} · {v.status}</span>
                      <span className="text-xs text-muted">{fmtDT(v.created_at)}</span>
                    </div>
                    {v.reason && <p className="text-xs text-muted mt-1">“{v.reason}”</p>}
                    {Object.keys(v.changed_fields || {}).length > 0 && (
                      <div className="mt-1 text-xs text-muted">
                        Changed: {Object.keys(v.changed_fields).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditForm(null)} />
          <form onSubmit={saveEdit} className="relative card w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin p-6 space-y-4">
            <h2 className="text-xl font-bold text-ink">Edit scheme</h2>
            <p className="text-sm text-muted">Saving creates a new version and sends the scheme to the approval queue.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Name</label>
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Short name</label>
                <input className="input" value={editForm.short_name} onChange={(e) => setEditForm({ ...editForm, short_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Ministry</label>
                <input className="input" value={editForm.ministry} onChange={(e) => setEditForm({ ...editForm, ministry: e.target.value })} />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
              </div>
              <div>
                <label className="label">Amount</label>
                <input className="input" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="label">Duration</label>
                <input className="input" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} />
              </div>
              <div>
                <label className="label">Official link</label>
                <input className="input" value={editForm.official_link} onChange={(e) => setEditForm({ ...editForm, official_link: e.target.value })} />
              </div>
              <div>
                <label className="label">Application portal</label>
                <input className="input" value={editForm.application_portal} onChange={(e) => setEditForm({ ...editForm, application_portal: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input w-full" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Benefits (one per line)</label>
              <textarea className="input w-full" rows={3} value={editForm.benefits} onChange={(e) => setEditForm({ ...editForm, benefits: e.target.value })} />
            </div>
            <div>
              <label className="label">Tags (comma separated)</label>
              <input className="input" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} />
            </div>
            <div>
              <label className="label">Change reason *</label>
              <input className="input" required value={editForm.reason} placeholder="Why is this change needed?" onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setEditForm(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save & submit for approval'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
