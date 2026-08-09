import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'

const empty = { name: '', relationship: '', age: '', gender: '', occupation: '', annual_income: '', education: '', disability: '', is_student: false }

const relationships = ['Self', 'Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Other']

export default function Family() {
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [recs, setRecs] = useState(null)
  const toast = useToast()

  async function load() {
    try {
      setMembers(await api.get('/profile/family'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  function openEdit(m) {
    setEditing(m?.id || null)
    setForm(m ? {
      name: m.name, relationship: m.relationship, age: m.age ?? '', gender: m.gender || '',
      occupation: m.occupation || '', annual_income: m.annual_income ?? '', education: m.education || '',
      disability: m.disability || '', is_student: m.is_student,
    } : empty)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name || !form.relationship) { toast.error('Name and relationship are required.'); return }
    setBusy(true)
    const payload = { ...form, age: form.age === '' ? null : Number(form.age), annual_income: form.annual_income === '' ? null : Number(form.annual_income) }
    try {
      if (editing) {
        await api.put(`/profile/family/${editing}`, payload)
        toast.success('Member updated.')
      } else {
        await api.post('/profile/family', payload)
        toast.success('Member added.')
      }
      setEditing(null)
      setForm(empty)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      await api.del(`/profile/family/${id}`)
      toast.info('Member removed.')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function recommend(m) {
    try {
      const res = await api.post(`/profile/family/${m.id}/recommend`)
      setRecs({ member: m, items: res.scores || [] })
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load family">{error}</Alert></div>
  if (!members) return <Spinner label="Loading family…" />

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Family</h1>
          <p className="text-sm text-muted">Add family members to get personalised scheme matches for each.</p>
        </div>
        <button className="btn-primary" onClick={() => openEdit(null)}>+ Add member</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(members.items || []).map((m) => (
          <div key={m.id} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-ink">{m.name}</h3>
                <p className="text-xs text-muted capitalize">{m.relationship}{m.age ? ` · ${m.age} yrs` : ''}</p>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(m)}>Edit</button>
                <button className="btn-ghost !px-2 !py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => remove(m.id)}>✕</button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted">Occupation</div><div className="text-ink capitalize">{m.occupation || '—'}</div>
              <div className="text-muted">Annual income</div><div className="text-ink">{m.annual_income != null ? `₹${Number(m.annual_income).toLocaleString('en-IN')}` : '—'}</div>
              <div className="text-muted">Education</div><div className="text-ink capitalize">{m.education || '—'}</div>
              <div className="text-muted">Student</div><div className="text-ink">{m.is_student ? 'Yes' : 'No'}</div>
            </div>
            <button className="btn-secondary w-full mt-4 !py-2 text-xs" onClick={() => recommend(m)}>
              Recommend schemes for {m.name.split(' ')[0]}
            </button>
          </div>
        ))}
      </div>

      {(members.items || []).length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-muted">No family members yet. Add one to unlock family-aware recommendations.</p>
        </div>
      )}

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <form onSubmit={save} className="relative card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <h2 className="text-xl font-bold text-ink mb-5">{editing ? 'Edit member' : 'Add family member'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <label className="label">Relationship *</label>
                <select className="input" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
                  <option value="">Select…</option>
                  {relationships.map((r) => <option key={r} value={r.toLowerCase()}>{r}</option>)}
                </select>
              </div>
              <div><label className="label">Age</label><input className="input" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              <div>
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </div>
              <div><label className="label">Occupation</label><input className="input" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></div>
              <div><label className="label">Annual income (₹)</label><input className="input" type="number" value={form.annual_income} onChange={(e) => setForm({ ...form, annual_income: e.target.value })} /></div>
              <div><label className="label">Education</label><input className="input" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} /></div>
              <div>
                <label className="label">Disability</label>
                <select className="input" value={form.disability} onChange={(e) => setForm({ ...form, disability: e.target.value })}>
                  <option value="">None</option><option value="physical">Physical</option><option value="visual">Visual</option>
                  <option value="hearing">Hearing</option><option value="intellectual">Intellectual</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 mt-4 text-sm text-ink">
              <input type="checkbox" checked={form.is_student} onChange={(e) => setForm({ ...form, is_student: e.target.checked })} className="h-4 w-4 rounded border-line" />
              Is a student
            </label>
            <div className="mt-6 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {recs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setRecs(null)} />
          <div className="relative card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-ink">Schemes for {recs.member.name}</h2>
              <button onClick={() => setRecs(null)} className="text-muted hover:text-ink">✕</button>
            </div>
            {recs.items.length === 0 ? (
              <p className="text-sm text-muted">Complete this member’s profile for better matches.</p>
            ) : (
              <div className="space-y-3">
                {recs.items.map((r, i) => (
                  <div key={i} className="rounded-lg border border-line p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{r.scheme_name || r.name}</span>
                      <span className={`chip ${r.score >= 75 ? 'badge-ok' : r.score >= 45 ? 'badge-warn' : 'badge-bad'}`}>{r.score}%</span>
                    </div>
                    <p className="text-xs text-muted mt-1">{r.reason || (r.matched_rules?.[0]?.label) || 'Personalised match for this family member.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
