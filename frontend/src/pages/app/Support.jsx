import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'

export default function Support() {
  const [cases, setCases] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [issueType, setIssueType] = useState('application_issue')
  
  const toast = useToast()

  useEffect(() => { loadCases() }, [])

  async function loadCases() {
    try {
      const res = await api.get('/support/cases')
      setCases(res.items || [])
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/support/cases', {
        subject,
        description,
        issue_type: issueType,
        priority: 'medium'
      })
      toast.success('Support case created successfully')
      setShowForm(false)
      setSubject('')
      setDescription('')
      loadCases()
    } catch (e) {
      toast.error('Could not create support case: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load cases">{error}</Alert></div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Help & Support</h1>
          <p className="text-sm text-muted">Manage your support tickets or raise a new request.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)} disabled={showForm}>
          New Support Request
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 bg-brand-50 border border-brand-200">
          <h3 className="font-bold text-brand-900 mb-4">Create Support Case</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Issue Type</label>
              <select className="input" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                <option value="application_issue">Application Issue</option>
                <option value="document_verification">Document Verification</option>
                <option value="eligibility_question">Eligibility Question</option>
                <option value="technical_problem">Technical Problem</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Subject</label>
              <input required className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Description</label>
              <textarea required className="input min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide details so our human support agents can assist you better." />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {cases.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            <p>You have no open support cases.</p>
          </div>
        ) : (
          cases.map(c => (
            <div key={c.id} className="card p-5 hover:border-brand-300 transition cursor-default">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-muted uppercase tracking-wider">{c.case_ref}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      c.status === 'open' ? 'bg-amber-100 text-amber-700' :
                      c.status === 'resolved' || c.status === 'closed' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-brand-100 text-brand-700'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="font-semibold text-ink">{c.subject}</h4>
                  <p className="text-sm text-muted mt-2 line-clamp-2">{c.description}</p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="text-xs text-muted">Created: {new Date(c.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
