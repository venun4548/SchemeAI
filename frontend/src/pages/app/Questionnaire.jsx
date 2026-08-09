import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'

function Field({ q, value, onChange }) {
  if (q.kind === 'select') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-400'
                  : 'border-line bg-white text-ink hover:border-brand-200'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    )
  }
  if (q.kind === 'boolean') {
    return (
      <div className="flex gap-3">
        {[true, false].map((b) => {
          const active = value === b
          const label = b ? 'Yes' : 'No'
          return (
            <button
              key={String(b)}
              type="button"
              onClick={() => onChange(b)}
              className={`flex-1 rounded-lg border px-4 py-3 text-center text-sm font-semibold transition ${
                active ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-400' : 'border-line bg-white text-ink hover:border-brand-200'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    )
  }
  return (
    <input
      className="input !py-3.5 !text-base"
      type="number"
      inputMode="decimal"
      min={q.min}
      max={q.max}
      value={value ?? ''}
      onChange={(e) => onChange(q.kind === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={q.hint || 'Enter value'}
    />
  )
}

export default function Questionnaire() {
  const [state, setState] = useState(null)
  const [question, setQuestion] = useState(null)
  const [value, setValue] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const navigate = useNavigate()

  async function loadStart() {
    try {
      const res = await api.get('/questionnaire/start')
      setState(res.session || { progress: 0 })
      setQuestion(res.question)
      setValue(res.question ? res.question.value ?? (res.question.kind === 'boolean' ? true : '') : null)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { loadStart() }, [])

  async function submit() {
    if (!question || busy) return
    if (value === null || value === '' || value === undefined) {
      toast.error('Please answer the question first.')
      return
    }
    setBusy(true)
    try {
      const res = await api.post('/questionnaire/answer', { key: question.key, value })
      if (res.completed) {
        toast.success('Interview complete! Your profile is ready.')
        navigate('/eligibility')
        return
      }
      setQuestion(res.question)
      setState({ progress: res.progress, answers: res.answers })
      setValue(res.question.value ?? (res.question.kind === 'boolean' ? true : ''))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    try {
      await api.post('/questionnaire/reset')
      toast.info('Interview reset.')
      loadStart()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load interview">{error}</Alert></div>
  if (!state || !question) {
    if (state?.completed) {
      return (
        <div className="max-w-lg mx-auto p-6">
          <Alert kind="success" title="Interview complete">
            Your profile is ready. See your eligibility scores and recommendations.
          </Alert>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary flex-1" onClick={() => navigate('/eligibility')}>View eligibility</button>
            <button className="btn-secondary" onClick={reset}>Restart</button>
          </div>
        </div>
      )
    }
    return <Spinner label="Preparing your interview…" />
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">AI Interview</h1>
          <p className="text-sm text-muted">A short adaptive interview — irrelevant questions are skipped.</p>
        </div>
        <button onClick={reset} className="btn-secondary !py-2">Restart</button>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs font-medium text-muted mb-1.5">
          <span>{state.progress?.toFixed ? `${state.progress}% complete` : `${state.progress}% complete`}</span>
          <span>{question.key}</span>
        </div>
        <div className="h-2 rounded-full bg-line overflow-hidden">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${state.progress ?? 0}%` }} />
        </div>
      </div>

      <div className="card p-6 md:p-8">
        <h2 className="text-xl font-bold text-ink mb-1">{question.prompt}</h2>
        {question.hint && <p className="text-sm text-muted mb-6">{question.hint}</p>}
        <Field q={question} value={value} onChange={setValue} />
        <div className="mt-8 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Answer is stored safely with your profile.</span>
          <button className="btn-primary !px-8" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
