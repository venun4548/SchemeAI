import { useEffect, useState } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { Chip } from './ui'

const adminRoleOptions = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'operations_admin', label: 'Operations Admin' },
  { value: 'scheme_admin', label: 'Scheme Admin' },
  { value: 'content_reviewer', label: 'Content Reviewer' },
  { value: 'support_agent', label: 'Support Agent' },
  { value: 'ai_operations', label: 'AI Operations' },
  { value: 'analyst', label: 'Analyst' },
]

const empty = { full_name: '', email: '', phone: '', password: '', role: 'citizen', admin_role: 'operations_admin' }

export default function AdminUsers() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)
  const toast = useToast()

  async function load() {
    try {
      setData(await api.get('/admin/users'))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [])

  async function verify(id) {
    try {
      await api.put(`/admin/users/${id}/verify`)
      toast.success('User verified.')
      setData((d) => ({ ...d, items: d.items.map((u) => (u.id === id ? { ...u, is_verified: true } : u)) }))
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function toggle(id) {
    try {
      const res = await api.put(`/admin/users/${id}/toggle`)
      toast.success(res.is_active ? 'Account enabled.' : 'Account disabled.')
      setData((d) => ({ ...d, items: d.items.map((u) => (u.id === id ? { ...u, is_active: res.is_active } : u)) }))
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function remove(id) {
    setRemoving(id)
    try {
      await api.del(`/admin/users/${id}`)
      toast.success('User removed.')
      setData((d) => ({ ...d, items: d.items.filter((u) => u.id !== id), total: d.total - 1 }))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setRemoving(null)
    }
  }

  async function createUser(e) {
    e.preventDefault()
    if (!form.full_name || !form.email || !form.password) {
      toast.error('Name, email and password are required.')
      return
    }
    setBusy(true)
    try {
      const payload = { ...form }
      if (payload.role !== 'citizen') {
        payload.admin_role = payload.role
        payload.role = 'admin'
      }
      await api.post('/admin/users', payload)
      toast.success(`User ${form.full_name.trim()} created.`)
      setCreating(false)
      setForm(empty)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load users">{error}</Alert></div>
  if (!data) return <Spinner label="Loading users…" />

  const citizens = data.items.filter((u) => u.role === 'citizen')
  const admins = data.items.filter((u) => u.role === 'admin')
  const verified = data.items.filter((u) => u.is_verified).length
  const active = data.items.filter((u) => u.is_active).length

  const stats = [
    { label: 'Total users', value: data.total },
    { label: 'Citizens', value: citizens.length },
    { label: 'Admins', value: admins.length },
    { label: 'Verified', value: verified },
    { label: 'Active accounts', value: active },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Users</h1>
          <p className="text-sm text-muted">Manage accounts, roles and access across the platform.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Create user</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs font-medium text-muted uppercase tracking-wide">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-ink">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Profile</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((u) => (
                <tr key={u.id} className="hover:bg-cream">
                  <td className="px-4 py-3 font-medium text-ink">{u.full_name}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role === 'admin'
                      ? <Chip tone="violet">{u.role_label || u.admin_role?.replace(/_/g, ' ') || 'Admin'}</Chip>
                      : <Chip tone="green">Citizen</Chip>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="chip bg-cream text-muted">{u.profile_completeness}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {u.is_verified ? <span className="badge-ok">Verified</span> : <span className="badge-warn">Pending</span>}
                      {!u.is_active && <span className="badge-bad">Disabled</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {!u.is_verified && (
                        <button className="btn-secondary !py-1 text-xs" onClick={() => verify(u.id)}>Verify</button>
                      )}
                      <button className="btn-secondary !py-1 text-xs" onClick={() => toggle(u.id)}>
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="btn-ghost !py-1 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => remove(u.id)}
                        disabled={removing === u.id}
                      >
                        {removing === u.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.items.length === 0 && (
          <p className="px-5 py-10 text-center text-muted">No users yet.</p>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCreating(false)} />
          <form onSubmit={createUser} className="relative card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <h2 className="text-xl font-bold text-ink mb-5">Create user</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Full name *</label>
                <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Password *</label>
                  <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 8 chars" />
                </div>
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, admin_role: e.target.value !== 'citizen' ? e.target.value : 'operations_admin' })}>
                  <option value="citizen">Citizen</option>
                  <optgroup label="Administrators">
                    {adminRoleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
