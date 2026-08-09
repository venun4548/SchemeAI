import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useAuth } from '../../context/AuthContext'
import { Chip, CaseStatus, PageHead, StatCard, fmtDT, timeAgo } from './ui'
import { useNavigate } from 'react-router-dom'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/admin/ops/overview').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load command center">{error}</Alert></div>
  if (!data) return <Spinner label="Loading command center…" />

  const q = data.queues
  const queues = [
    { label: 'Pending review', value: q.pending_review + q.submitted, sub: `${q.submitted} newly submitted`, tone: 'violet', to: '/admin/applications?status=submitted' },
    { label: 'Assigned to me', value: q.assigned_to_me, sub: 'applications', tone: 'ink', to: '/admin/applications?assigned=me' },
    { label: 'Documents to review', value: q.documents_pending, sub: `${q.high_risk_documents} high risk`, tone: 'blue', to: '/admin/documents?review_status=unreviewed' },
    { label: 'Open cases', value: q.open_cases, sub: `${q.escalated_cases} escalated · ${q.overdue_sla} overdue`, tone: 'amber', to: '/admin/cases' },
    { label: 'Publications awaiting', value: q.pending_publications, sub: 'schemes in review', tone: 'green', to: '/admin/publications' },
    { label: 'AI incidents open', value: q.open_incidents, sub: 'agent failures', tone: 'red', to: '/admin/incidents?status=open' },
    { label: 'Open feedback', value: q.open_feedback, sub: 'citizen feedback', tone: 'gray', to: '/admin/analytics' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHead title="Command Center" subtitle={`Monitor → Review → Decide → Resolve → Publish → Analyze → Audit. Signed in as ${user?.full_name} (${user?.admin_role || 'admin'}).`}>
        <span className="text-xs text-muted">Last refresh {timeAgo(data.now)}</span>
      </PageHead>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {queues.map((c) => (
          <StatCard key={c.label} {...c} onClick={() => navigate(c.to)} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink">Recent audit activity</h2>
            <button className="btn-secondary !py-1.5 text-xs" onClick={() => navigate('/admin/audit')}>Open audit log</button>
          </div>
          <div className="space-y-3">
            {data.recent_audit.length === 0 && <p className="text-sm text-muted">No audit events recorded yet.</p>}
            {data.recent_audit.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${a.result === 'failure' ? 'bg-red-500' : 'bg-brand-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-medium">
                    {a.action.replace(/\./g, ' · ')} <span className="text-muted font-normal">on {a.entity}</span>
                  </p>
                  <p className="text-xs text-muted truncate">{a.entity_name || a.entity_id}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted">{a.actor_name}</p>
                  <p className="text-[11px] text-muted">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink">Recent support cases</h2>
            <button className="btn-secondary !py-1.5 text-xs" onClick={() => navigate('/admin/cases')}>Open cases</button>
          </div>
          <div className="space-y-3">
            {data.recent_cases.length === 0 && <p className="text-sm text-muted">No support cases yet.</p>}
            {data.recent_cases.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-ink font-medium truncate">{c.subject}</p>
                  <p className="text-xs text-muted">{c.case_ref} · {fmtDT(c.updated_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CaseStatus status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Alert kind="info">
        Every action you take here is recorded in the <button className="underline font-semibold" onClick={() => navigate('/admin/audit')}>audit trail</button> and
        enforced by role-based permissions. Some operations (e.g. scheme publication) require the appropriate role.
      </Alert>
    </div>
  )
}
