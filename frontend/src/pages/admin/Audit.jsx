import { useEffect, useState, useCallback } from 'react'
import { api, downloadBlob } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'
import { Chip, Empty, PageHead, fmtDT } from './ui'

export default function AdminAudit() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ entity: '', action: '', result: '', q: '' })
  const [detail, setDetail] = useState(null)
  const toast = useToast()

  const load = useCallback(async (f = filters) => {
    try {
      const params = new URLSearchParams()
      if (f.entity) params.set('entity', f.entity)
      if (f.action) params.set('action', f.action)
      if (f.result) params.set('result', f.result)
      if (f.q) params.set('q', f.q)
      setData(await api.get(`/admin/ops/audit?${params.toString()}`))
    } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  async function exportCsv() {
    try {
      const blob = await api.download('/admin/ops/reports/export/audit')
      downloadBlob(blob, 'audit_export.csv')
      toast.success('Audit CSV downloaded.')
    } catch (e) { toast.error(e.message) }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load audit log">{error}</Alert></div>
  if (!data) return <Spinner label="Loading audit log…" />

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHead title="Audit Trail" subtitle="Immutable record of every sensitive action taken on the platform.">
        <button className="btn-secondary" onClick={exportCsv}>Export CSV</button>
      </PageHead>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <select className="input" value={filters.entity} onChange={(e) => { const f = { ...filters, entity: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All entities</option>
            <option value="user">User</option>
            <option value="application">Application</option>
            <option value="document">Document</option>
            <option value="case">Support case</option>
            <option value="scheme">Scheme</option>
            <option value="agent">Agent</option>
            <option value="incident">Incident</option>
          </select>
          <select className="input" value={filters.action} onChange={(e) => { const f = { ...filters, action: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All actions</option>
            {data.top_actions.slice(0, 12).map((a) => <option key={a.action} value={a.action}>{a.action} ({a.count})</option>)}
          </select>
          <select className="input" value={filters.result} onChange={(e) => { const f = { ...filters, result: e.target.value }; setFilters(f); load(f) }}>
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
          <input className="input" placeholder="Search actor / entity / id" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && load(filters)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream text-left text-muted">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Entity</th>
                <th className="px-4 py-3 font-semibold">Entity name / id</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((a) => (
                <tr key={a.id} className="hover:bg-cream cursor-pointer" onClick={() => setDetail(a)}>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDT(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{a.actor_name}</p>
                    <p className="text-xs text-muted">{a.actor_role}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Chip tone={a.action.includes('reject') || a.action.includes('delete') || a.action.includes('disabled') || a.action.includes('archive') ? 'amber' : 'green'}>
                      {a.action.replace(/\./g, ' ')}
                    </Chip>
                  </td>
                  <td className="px-4 py-3 text-muted">{a.entity}</td>
                  <td className="px-4 py-3 text-muted max-w-[220px] truncate">{a.entity_name || a.entity_id}</td>
                  <td className="px-4 py-3">
                    <Chip tone={a.result === 'failure' ? 'red' : 'green'}>{a.result}</Chip>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{a.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.items.length === 0 && <Empty message="No audit events match the current filters." />}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <div className="relative card w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin p-6 space-y-4">
            <h2 className="text-xl font-bold text-ink">Audit event</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ['Action', detail.action],
                ['Actor', `${detail.actor_name} (${detail.actor_role})`],
                ['Entity', detail.entity],
                ['Entity name', detail.entity_name || '—'],
                ['Entity id', detail.entity_id || '—'],
                ['Result', detail.result],
                ['IP address', detail.ip || '—'],
                ['Timestamp', fmtDT(detail.created_at)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted uppercase">{k}</dt>
                  <dd className="font-medium text-ink break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {detail.reason && (
              <div>
                <div className="text-xs text-muted uppercase mb-1">Reason</div>
                <p className="text-sm text-ink bg-cream rounded-lg p-3">{detail.reason}</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted uppercase mb-1">Old value</div>
                <pre className="bg-cream rounded-lg p-3 text-xs text-muted overflow-x-auto scrollbar-thin max-h-48 overflow-y-auto">
                  {JSON.stringify(detail.old_value, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs text-muted uppercase mb-1">New value</div>
                <pre className="bg-cream rounded-lg p-3 text-xs text-muted overflow-x-auto scrollbar-thin max-h-48 overflow-y-auto">
                  {JSON.stringify(detail.new_value, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
