import { useEffect, useState } from 'react'
import { api, downloadBlob, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { PageHead } from './ui'

export default function AdminReports() {
  const [groupBy, setGroupBy] = useState('status')
  const [appRep, setAppRep] = useState(null)
  const [caseRep, setCaseRep] = useState(null)
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    api.get('/admin/ops/reports/cases').then(setCaseRep).catch(() => {})
  }, [])

  useEffect(() => {
    api.get(`/admin/ops/reports/applications?group_by=${groupBy}`).then(setAppRep).catch((e) => setError(e.message))
  }, [groupBy])

  async function exportAudit() {
    try {
      const blob = await api.download('/admin/ops/reports/export/audit')
      downloadBlob(blob, `audit_${fmtDate(new Date().toISOString()).replace(/ /g, '_')}.csv`)
      toast.success('Audit CSV downloaded.')
    } catch (e) { toast.error(e.message) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load reports">{error}</Alert></div>
  if (!appRep || !caseRep) return <Spinner label="Generating reports…" />

  const maxCount = Math.max(...appRep.rows.map((r) => r.count), 1)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHead title="Reports" subtitle="Operational reporting generated from live database records — no mock data.">
        <button className="btn-secondary" onClick={exportAudit}>Export audit CSV</button>
      </PageHead>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink">Applications</h2>
            <select className="input !py-1.5 text-xs w-auto" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option value="status">By status</option>
              <option value="state">By state</option>
              <option value="scheme">By scheme</option>
              <option value="category">By category</option>
            </select>
          </div>
          <div className="space-y-2">
            {appRep.rows.map((r) => (
              <div key={r.key} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-muted">{r.key}</span>
                <div className="flex-1 h-3 bg-cream rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(r.count / maxCount) * 100}%` }} />
                </div>
                <span className="font-semibold text-ink w-8 text-right">{r.count}</span>
                <span className="text-xs text-muted w-12 text-right">{r.pct}%</span>
              </div>
            ))}
            {appRep.rows.length === 0 && <p className="text-sm text-muted">No applications recorded.</p>}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-line">
            <div>
              <div className="text-xs text-muted uppercase">Approved</div>
              <div className="text-2xl font-bold text-brand-700">{appRep.summary.approved}</div>
            </div>
            <div>
              <div className="text-xs text-muted uppercase">Rejected</div>
              <div className="text-2xl font-bold text-red-600">{appRep.summary.rejected}</div>
            </div>
            <div>
              <div className="text-xs text-muted uppercase">Approval rate</div>
              <div className="text-2xl font-bold text-ink">{appRep.summary.approval_rate}%</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-bold text-ink mb-4">Support cases</h2>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div>
              <div className="text-xs text-muted uppercase">Total</div>
              <div className="text-2xl font-bold text-ink">{caseRep.total}</div>
            </div>
            <div>
              <div className="text-xs text-muted uppercase">Open</div>
              <div className="text-2xl font-bold text-amber-600">{caseRep.open}</div>
            </div>
            <div>
              <div className="text-xs text-muted uppercase">Resolution rate</div>
              <div className="text-2xl font-bold text-brand-700">{caseRep.resolution_rate}%</div>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-ink mb-2">By issue type</h3>
          <div className="space-y-2">
            {caseRep.by_type.map((r) => (
              <div key={r.key} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-muted">{r.key.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-2 bg-cream rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(r.count / Math.max(caseRep.by_type[0]?.count || 1, 1)) * 100}%` }} />
                </div>
                <span className="font-semibold text-ink w-8 text-right">{r.count}</span>
              </div>
            ))}
            {caseRep.by_type.length === 0 && <p className="text-sm text-muted">No cases recorded.</p>}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-ink mb-1">Reports are live</h2>
        <p className="text-sm text-muted">
          All numbers are computed from the application database in real time. Use the
          <span className="font-semibold text-ink"> Admin → Audit Trail</span> page to review every recorded action,
          or export the full audit log as CSV for compliance review.
        </p>
      </div>
    </div>
  )
}
