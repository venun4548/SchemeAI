import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { Chip, PageHead, fmtDT } from './ui'

export default function AdminSecurity() {
  const [overview, setOverview] = useState(null)
  const [attempts, setAttempts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/admin/ops/security/overview'),
      api.get('/admin/ops/security/login-attempts?limit=50'),
    ]).then(([o, a]) => { setOverview(o); setAttempts(a) })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load security center">{error}</Alert></div>
  if (!overview || !attempts) return <Spinner label="Loading security center…" />

  const failed = attempts.items.filter((a) => !a.success)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHead title="Security Center" subtitle="Login activity, account health and admin role distribution. Passwords and tokens are never displayed." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase">Failed logins (24h)</div>
          <div className="mt-1 text-3xl font-bold text-red-600">{overview.failed_24h}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase">Success rate (24h)</div>
          <div className="mt-1 text-3xl font-bold text-brand-700">{overview.success_rate_24h}%</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase">Unique IPs (24h)</div>
          <div className="mt-1 text-3xl font-bold text-ink">{overview.unique_ips_24h}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase">Disabled accounts</div>
          <div className="mt-1 text-3xl font-bold text-amber-600">{overview.disabled_accounts}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-bold text-ink mb-3">Top failed login emails (24h)</h2>
          {overview.top_failed_emails.length === 0 ? (
            <p className="text-sm text-muted">No failed logins in the last 24 hours.</p>
          ) : (
            <div className="space-y-2">
              {overview.top_failed_emails.map((e) => (
                <div key={e.email} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-muted truncate">{e.email}</span>
                  <span className="font-semibold text-red-600">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-bold text-ink mb-3">Admin role distribution</h2>
          <div className="space-y-2">
            {Object.entries(overview.role_distribution).length === 0 && <p className="text-sm text-muted">No admin roles assigned.</p>}
            {Object.entries(overview.role_distribution).map(([role, count]) => (
              <div key={role} className="flex items-center gap-3 text-sm">
                <span className="w-36 truncate text-muted">{role.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-2 bg-cream rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(count / overview.admin_count) * 100}%` }} />
                </div>
                <span className="font-semibold text-ink">{count}</span>
              </div>
            ))}
            <p className="text-xs text-muted pt-1">{overview.admin_count} admin account(s)</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="font-bold text-ink">Recent login attempts</h2>
          <span className="text-xs text-muted">{attempts.total} recorded</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {attempts.items.map((a) => (
                <tr key={a.id} className="hover:bg-cream">
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDT(a.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-muted">{a.email}</td>
                  <td className="px-4 py-3"><Chip tone={a.success ? 'green' : 'red'}>{a.success ? 'Success' : 'Failed'}</Chip></td>
                  <td className="px-4 py-3 text-muted">{a.reason || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{a.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {attempts.items.length === 0 && <p className="px-5 py-10 text-center text-muted">No login attempts recorded.</p>}
      </div>
    </div>
  )
}
