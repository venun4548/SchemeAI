import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { Chip, Empty, PageHead, fmtDate } from './ui'
import { useAuth } from '../../context/AuthContext'

export default function AdminRoles() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const { user } = useAuth()

  async function load() {
    try {
      setData(await api.get('/admin/ops/roles'))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  async function changeRole(uid, role, adminRole) {
    setBusy(true)
    try {
      await api.put(`/admin/ops/users/${uid}/role`, { role, admin_role: adminRole })
      toast.success('Role updated (audited).')
      await load()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load roles">{error}</Alert></div>
  if (!data) return <Spinner label="Loading roles…" />

  const permissionsByRole = {
    super_admin: 'Full access across all modules',
    operations_admin: 'Applications, documents, cases, analytics, audit view',
    scheme_admin: 'Scheme editing, review & publish, knowledge',
    content_reviewer: 'Scheme & knowledge content editing and review',
    support_agent: 'Support cases and user lookup',
    ai_operations: 'Agent control, incidents, monitoring',
    analyst: 'Read-only analytics & report export',
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Admin Roles" subtitle="Assign enterprise permissions to admin accounts. Changes are recorded in the audit trail." />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {data.roles.map((r) => (
          <div key={r.value} className="card p-4">
            <div className="font-semibold text-ink">{r.label}</div>
            <p className="text-xs text-muted mt-1">{permissionsByRole[r.value] || 'Custom access'}</p>
            <div className="mt-2 text-xs text-muted">
              {data.admins.filter((a) => a.admin_role === r.value).length} admin(s)
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line font-bold text-ink">Admin accounts</div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Admin</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Change role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.admins.map((a) => (
                <tr key={a.id} className="hover:bg-cream">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{a.full_name}</p>
                    <p className="text-xs text-muted">{a.email}</p>
                  </td>
                  <td className="px-4 py-3"><Chip tone="violet">{a.role_label}</Chip></td>
                  <td className="px-4 py-3 text-muted">{a.last_login_at ? fmtDate(a.last_login_at) : 'Never'}</td>
                  <td className="px-4 py-3">
                    {a.is_active ? <Chip tone="green">Active</Chip> : <Chip tone="red">Disabled</Chip>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input !py-1.5 text-xs"
                      value={a.admin_role}
                      disabled={busy || a.id === user.id}
                      title={a.id === user.id ? 'You cannot change your own role' : ''}
                      onChange={(e) => changeRole(a.id, 'admin', e.target.value)}
                    >
                      {data.roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.admins.length === 0 && <Empty message="No admin accounts." />}
      </div>

      <Alert kind="info">
        Only the super admin role can assign roles. A role change takes effect on the next API call and is permanently recorded in the audit trail.
      </Alert>
    </div>
  )
}
