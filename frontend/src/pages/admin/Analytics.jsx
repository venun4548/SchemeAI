import { useEffect, useState } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'

function Bar({ items, color }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.state || i.scheme || i.category || i.type || i.status || i.date} className="flex items-center gap-3">
          <span className="w-32 text-xs text-muted truncate text-right">{i.state || i.scheme || i.category || i.type || i.status || i.date}</span>
          <div className="h-2.5 flex-1 rounded-full bg-line overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
          <span className="w-8 text-xs font-semibold text-ink">{i.count}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminAnalytics() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/analytics').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load analytics">{error}</Alert></div>
  if (!data) return <Spinner label="Loading analytics…" />

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-ink">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink">Application outcomes</h3>
            <div className="text-xs text-muted">{data.statuses.reduce((a, b) => a + b.count, 0)} apps</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div className="rounded-lg bg-brand-50 border border-brand-100 p-3">
              <div className="text-2xl font-bold text-brand-700">{data.success_rate}%</div>
              <div className="text-[11px] text-muted">Success</div>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <div className="text-2xl font-bold text-red-600">{data.rejection_rate}%</div>
              <div className="text-[11px] text-muted">Rejected</div>
            </div>
            <div className="rounded-lg bg-cream border border-line p-3">
              <div className="text-2xl font-bold text-ink">{data.statuses.find((s) => s.status === 'under_review')?.count ?? 0}</div>
              <div className="text-[11px] text-muted">Under review</div>
            </div>
          </div>
          <Bar items={data.statuses} color="bg-brand-500" />
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-ink mb-4">Most applied schemes</h3>
          <Bar items={data.most_applied} color="bg-brand-accent" />
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-ink mb-4">Users by state</h3>
          <Bar items={data.state_usage} color="bg-brand-500" />
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-ink mb-4">Event types</h3>
          <Bar items={data.events} color="bg-teal-500" />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold text-ink mb-4">Activity (last 30 days)</h3>
        {data.activity.length === 0 ? (
          <p className="text-sm text-muted">No recorded activity yet.</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.activity.map((a, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-muted">{a.events}</span>
                <div
                  className="w-full rounded-t bg-brand-500"
                  style={{ height: `${Math.max(6, (a.events / Math.max(1, ...data.activity.map((x) => x.events))) * 100)}%` }}
                  title={`${a.date}: ${a.events} events`}
                />
              </div>
            ))}
          </div>
        )}
        {data.activity.length > 0 && <div className="text-[10px] text-muted mt-1">{fmtDate(data.activity[0].date)} → {fmtDate(data.activity[data.activity.length - 1].date)}</div>}
      </div>
    </div>
  )
}
