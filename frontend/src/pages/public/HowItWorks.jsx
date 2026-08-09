import { Link } from 'react-router-dom'
import SmartImage from '../../components/SmartImage'

const phases = [
  {
    title: '1 · Onboarding',
    items: [
      'Create an account with your email and phone.',
      'Choose your preferred language (6 supported).',
      'Answer the 23-question AI interview — skip logic hides irrelevant questions, so it takes about 3 minutes.',
    ],
  },
  {
    title: '2 · Eight agents run',
    items: [
      'Profiling Agent cleans and validates your profile.',
      'Eligibility Agent scores every active scheme against explainable rules.',
      'Policy Agent pulls context from a curated knowledge base (RAG).',
      'Recommender Agent ranks matches for your goals and state.',
      'Explainability Agent writes the “why” in plain language.',
      'Guidance Agent drafts a step-by-step application plan.',
      'Fraud Agent screens links and identity readiness.',
      'Documents Agent lists what you have and what is missing.',
    ],
  },
  {
    title: '3 · Take action',
    items: [
      'Review ranked recommendations and per-scheme scores.',
      'Compare up to 5 schemes side by side.',
      'Upload documents and let AI analyse them (type, expiry, blur, duplicates).',
      'Start an application, follow the guided steps, and track progress.',
      'Verify any application anywhere with its QR code.',
    ],
  },
  {
    title: '4 · Stay on top',
    items: [
      'Receive deadline alerts and new-scheme updates.',
      'Ask the voice assistant anything in your language.',
      'Add family members and get recommendations for them too.',
      'Download shareable eligibility and application reports.',
    ],
  },
]

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="chip badge-ok mb-4">How it works</span>
        <h1 className="section-title">How SchemeAI works</h1>
        <p className="mt-4 text-muted text-lg">
          One interview in. A transparent multi-agent pipeline in the middle. Clear, actionable results out.
        </p>
      </div>

      <SmartImage
        slot="howitworks-journey"
        overlay="bottom"
        className="rounded-xl2 shadow-card"
      />

      <div className="space-y-8 mt-10">
        {phases.map((p) => (
          <div key={p.title} className="card p-6 md:p-8">
            <h2 className="text-xl font-bold text-ink mb-4">{p.title}</h2>
            <ul className="space-y-3">
              {p.items.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-ink leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link to="/register" className="btn-accent !px-8 !py-3 !text-base">
          Start now — it’s free
        </Link>
      </div>
    </div>
  )
}
