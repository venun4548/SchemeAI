import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, downloadBlob, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { statusBadge } from '../../components/Score'
import { useToast } from '../../context/ToastContext'

export default function ApplicationDetail() {
  const { id } = useParams()
  const [app, setApp] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function load() {
    try {
      setApp(await api.get(`/applications/${id}`))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [id])

  async function advance() {
    setBusy(true)
    try {
      setApp(await api.post(`/applications/${id}/advance`))
      toast.success('Step completed.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function pdf() {
    try {
      const blob = await api.download(`/applications/${id}/pdf`)
      downloadBlob(blob, `${app.application_id}.pdf`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load application">{error}</Alert></div>
  if (!app) return <Spinner label="Loading application…" />

  const b = statusBadge(app.status)

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink">{app.scheme_name}</h1>
            <span className={b.cls}>{b.label}</span>
          </div>
          <p className="text-sm text-muted mt-1">
            {app.application_id} · {app.applicant_name} · created {fmtDate(app.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={pdf}>Download PDF</button>
          {app.status === 'draft' && (
            <button className="btn-primary" onClick={advance} disabled={busy}>
              {busy ? 'Advancing…' : 'Complete next step'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-bold text-ink mb-4">Application roadmap</h3>
            <div className="space-y-4">
              {app.steps?.map((s, i) => {
                const done = i < app.current_step
                const current = i === app.current_step - 1
                return (
                  <div key={s.step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          done ? 'bg-brand-500 text-white' : current ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-400' : 'bg-line text-muted'
                        }`}
                      >
                        {done ? '✓' : s.step}
                      </span>
                      {i < app.steps.length - 1 && <span className={`w-0.5 flex-1 ${done ? 'bg-brand-300' : 'bg-line'}`} />}
                    </div>
                    <div className="pb-5">
                      <div className={`font-semibold ${done ? 'text-ink' : current ? 'text-brand-800' : 'text-muted'}`}>{s.title}</div>
                      <div className="text-sm text-muted mt-0.5">{s.detail}</div>
                      {done && <span className="badge-ok mt-1.5">Completed</span>}
                      {current && !done && <span className="badge-info mt-1.5">Current step</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-ink mb-4">Timeline</h3>
            <div className="space-y-3">
              {app.timeline?.map((t, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="h-2 w-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="text-ink"><span className="font-semibold capitalize">{t.status.replace(/_/g, ' ')}</span> — {t.note}</div>
                    <div className="text-xs text-muted">{fmtDate(t.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-bold text-ink mb-3">Verification QR</h3>
            {app.qr_b64 ? (
              <div className="flex flex-col items-center">
                <img src={`data:image/png;base64,${app.qr_b64}`} alt="QR code" className="w-40 h-40 rounded-lg border border-line" />
                <p className="text-xs text-muted mt-3 text-center">
                  Anyone can verify this application at the public verification page using the reference.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">QR not available.</p>
            )}
          </div>

          <div className="card p-5 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Applicant</span><span className="font-semibold text-ink">{app.applicant_name}</span></div>
            <div className="flex justify-between"><span className="text-muted">Eligibility score</span><span className="font-semibold text-ink">{app.eligibility_score}%</span></div>
            <div className="flex justify-between"><span className="text-muted">Documents</span><span className="font-semibold text-ink">{app.document_ids?.length ?? 0} attached</span></div>
            <div className="flex justify-between"><span className="text-muted">Updated</span><span className="font-semibold text-ink">{fmtDate(app.updated_at)}</span></div>
          </div>

          {app.risk_flags?.length > 0 && (
            <Alert kind="warn" title="Risk flags">
              <ul className="list-disc pl-4 space-y-1">{app.risk_flags.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </Alert>
          )}

          <Link to="/applications" className="btn-secondary w-full">← All applications</Link>
        </div>
      </div>
    </div>
  )
}
