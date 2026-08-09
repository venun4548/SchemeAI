import { useEffect, useRef, useState } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { statusBadge } from '../../components/Score'
import { useToast } from '../../context/ToastContext'

function docLabel(t) {
  return (t || 'document').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function Documents() {
  const [docs, setDocs] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(null)
  const fileRef = useRef(null)
  const toast = useToast()

  async function load() {
    try {
      const res = await api.get('/documents')
      setDocs(res)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [])

  async function upload(file) {
    if (!file) return
    if (!['.png', '.jpg', '.jpeg', '.webp', '.pdf'].some((e) => file.name.toLowerCase().endsWith(e))) {
      toast.error('Unsupported file type. Use PNG, JPG, WEBP or PDF.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File exceeds 10 MB.')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const doc = await api.upload('/documents/upload', fd)
      toast.success('Document analysed successfully.')
      await load()
    } catch (e) {
      toast.error(e.message, 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function reanalyze(id) {
    setAnalyzing(id)
    try {
      await api.post(`/documents/${id}/analyze`)
      toast.success('Re-analysed.')
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setAnalyzing(null)
    }
  }

  async function remove(id) {
    try {
      await api.del(`/documents/${id}`)
      toast.info('Document deleted.')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load documents">{error}</Alert></div>
  if (!docs) return <Spinner label="Loading documents…" />

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Documents</h1>
          <p className="text-sm text-muted">Upload documents once — AI detects type, expiry, blur and risk.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          className="hidden"
          onChange={(e) => upload(e.target.files[0])}
        />
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Analysing…' : '+ Upload document'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.items.map((d) => {
          const b = statusBadge(d.status)
          const report = d.analyzer_report || {}
          return (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-ink truncate">{d.display_name}</div>
                  <div className="text-xs text-muted mt-0.5">{docLabel(d.doc_type)} · {(d.file_size / 1024).toFixed(0)} KB</div>
                </div>
                <span className={b.cls}>{b.label}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-cream border border-line p-2.5">
                  <div className="text-[11px] text-muted">Verified</div>
                  <div className="font-semibold text-ink">{d.is_verified ? 'Yes' : 'Pending'}</div>
                </div>
                <div className="rounded-lg bg-cream border border-line p-2.5">
                  <div className="text-[11px] text-muted">Expiry</div>
                  <div className="font-semibold text-ink">{fmtDate(d.expiry_date)}</div>
                </div>
                <div className="rounded-lg bg-cream border border-line p-2.5">
                  <div className="text-[11px] text-muted">Blurry</div>
                  <div className="font-semibold text-ink">{d.is_blurry ? 'Yes' : 'No'}</div>
                </div>
                <div className="rounded-lg bg-cream border border-line p-2.5">
                  <div className="text-[11px] text-muted">Duplicate</div>
                  <div className="font-semibold text-ink">{d.is_duplicate ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {(report.confidence != null || report.fake_risk != null) && (
                <div className="mt-3 space-y-1.5 text-xs">
                  {report.confidence != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Detection confidence</span>
                      <span className="font-semibold text-ink">{report.confidence}%</span>
                    </div>
                  )}
                  {report.fake_risk != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Tamper risk</span>
                      <span className={`font-semibold ${report.fake_risk > 0.5 ? 'text-red-600' : 'text-brand-700'}`}>
                        {(report.fake_risk * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {d.extracted_fields && Object.keys(d.extracted_fields).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(d.extracted_fields).slice(0, 5).map(([k, v]) => (
                    <span key={k} className="chip bg-brand-50 text-brand-700">
                      {k.replace(/_/g, ' ')}: <b>{String(v)}</b>
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button className="btn-secondary flex-1 !py-2 text-xs" onClick={() => reanalyze(d.id)} disabled={analyzing === d.id}>
                  {analyzing === d.id ? 'Analysing…' : 'Re-analyse'}
                </button>
                <button className="btn-ghost flex-1 !py-2 text-xs text-red-600 hover:bg-red-50" onClick={() => remove(d.id)}>
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {docs.items.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-muted mb-2">No documents yet.</p>
          <p className="text-sm text-muted">Upload an Aadhaar or income certificate to see the AI document analysis.</p>
        </div>
      )}
    </div>
  )
}
