import { useState } from 'react'
import { api, downloadBlob } from '../../lib/api'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'

export default function Reports() {
  const [busy, setBusy] = useState(null)
  const toast = useToast()

  async function download(path, filename) {
    setBusy('eligibility')
    try {
      const blob = await api.download(path)
      downloadBlob(blob, filename)
      toast.success('Report downloaded.')
    } catch (e) {
      toast.error(e.message, 'Download failed')
    } finally {
      setBusy(null)
    }
  }

  async function comparisonPdf() {
    setBusy('comparison')
    try {
      const buf = await api.post('/reports/comparison/pdf', { scheme_ids: [], analysis: {} })
      downloadBlob(new Blob([buf]), 'comparison-report.pdf')
      toast.success('Report downloaded.')
    } catch (e) {
      toast.error(e.message, 'Download failed')
    } finally {
      setBusy(null)
    }
  }

  async function emailEligibility() {
    setBusy('email')
    try {
      await api.post('/reports/eligibility/email')
      toast.success('Eligibility report emailed to you.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Reports</h1>
        <p className="text-sm text-muted">Download or email your personalised reports.</p>
      </div>

      <Alert kind="info">
        Reports are generated on the server with styled PDFs — eligibility summaries, comparison verdicts and application records.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <h3 className="font-bold text-ink mb-1">Eligibility summary</h3>
          <p className="text-sm text-muted mb-4">Top schemes, scores and explanations as a shareable PDF.</p>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => download('/reports/eligibility/pdf', 'eligibility-report.pdf')} disabled={busy === 'eligibility'}>
              {busy === 'eligibility' ? 'Generating…' : 'Download PDF'}
            </button>
            <button className="btn-secondary" onClick={emailEligibility} disabled={busy === 'email'}>
              {busy === 'email' ? 'Sending…' : 'Email me'}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-ink mb-1">Scheme comparison</h3>
          <p className="text-sm text-muted mb-4">Download the comparison verdict as a PDF.</p>
          <button className="btn-secondary w-full" onClick={comparisonPdf} disabled={busy === 'comparison'}>
            {busy === 'comparison' ? 'Generating…' : 'Download PDF'}
          </button>
        </div>

        <div className="card p-6 sm:col-span-2">
          <h3 className="font-bold text-ink mb-1">Application records</h3>
          <p className="text-sm text-muted mb-4">
            Each application has its own PDF and QR code. Go to <b>Applications → open an application → Download PDF</b>.
          </p>
          <p className="text-xs text-muted">
            The PDF includes the application reference, roadmap, timeline, eligibility score and a scannable verification QR.
          </p>
        </div>
      </div>
    </div>
  )
}
