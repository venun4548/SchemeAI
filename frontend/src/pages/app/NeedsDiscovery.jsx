import { useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'

const NEEDS = [
  { icon: '🌾', label: 'Agriculture Support', val: 'AGRICULTURE' },
  { icon: '🎓', label: 'Education', val: 'EDUCATION' },
  { icon: '💼', label: 'Employment', val: 'EMPLOYMENT' },
  { icon: '🏠', label: 'Housing', val: 'HOUSING' },
  { icon: '🏥', label: 'Healthcare', val: 'HEALTHCARE' },
  { icon: '👩', label: 'Women & Child Welfare', val: 'WOMEN_CHILD' },
  { icon: '💰', label: 'Financial Assistance', val: 'FINANCIAL' },
  { icon: '🏪', label: 'Business Support', val: 'BUSINESS' },
  { icon: '♿', label: 'Disability Support', val: 'DISABILITY' },
  { icon: '👴', label: 'Senior Citizen Support', val: 'SENIOR' },
]

export default function NeedsDiscovery({ onComplete }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function submit(valOverride) {
    const input = valOverride || text.trim()
    if (!input) return
    setBusy(true)
    try {
      await api.post('/questionnaire/needs/analyze', { text: input })
      onComplete()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="text-center mb-8 mt-4">
        <h1 className="text-3xl font-bold text-ink mb-3">What are you looking for?</h1>
        <p className="text-muted">Tell us what you need help with, and our AI will understand your requirements.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {NEEDS.map((n) => (
          <button
            key={n.val}
            onClick={() => submit(n.label)}
            disabled={busy}
            className="flex flex-col items-center justify-center p-5 rounded-xl border border-line bg-white hover:border-brand-300 hover:bg-brand-50 transition shadow-sm hover:shadow-md"
          >
            <span className="text-3xl mb-3">{n.icon}</span>
            <span className="text-xs font-bold text-ink text-center leading-tight uppercase tracking-wide">{n.label}</span>
          </button>
        ))}
      </div>

      <div className="card p-6 md:p-8 bg-brand-900 text-white relative overflow-hidden shadow-lg">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        <h3 className="text-lg font-bold mb-3 relative z-10 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-brand-300" fill="currentColor"><path d="M9.46 8.35L11 5l1.54 3.35L16 9.89l-3.46 1.54L11 14.78l-1.54-3.35L6 9.89l3.46-1.54zM21 2l-1.28 2.72L17 6l2.72 1.28L21 10l1.28-2.72L25 6l-2.72-1.28L21 2zm-5 13l-1.28 2.72L12 19l2.72 1.28L16 23l1.28-2.72L20 19l-2.72-1.28L16 15z"/></svg>
          Or describe it in your own words
        </h3>
        <div className="flex gap-3 relative z-10 flex-col sm:flex-row">
          <input
            type="text"
            className="input !bg-white/10 !border-white/20 !text-white placeholder:text-white/50 focus:!bg-white/20 flex-1 !py-3"
            placeholder="e.g., I need financial support for my farming..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={busy}
          />
          <button
            className="btn-primary !bg-white !text-brand-900 hover:!bg-cream disabled:opacity-70 whitespace-nowrap !py-3 !px-8 shadow-sm"
            onClick={() => submit()}
            disabled={busy || !text.trim()}
          >
            {busy ? 'Analyzing...' : 'Analyze Needs'}
          </button>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <button onClick={onComplete} className="text-sm font-semibold text-muted hover:text-ink transition border-b border-transparent hover:border-ink">
          Skip for now
        </button>
      </div>
    </div>
  )
}
