const features = [
  {
    icon: 'M12 2 4 5v6c0 5.25 3.4 10.15 8 11 4.6-.85 8-5.75 8-11V5l-8-3zm-1.2 14.8-3.6-3.6 1.4-1.4 2.2 2.2 4.6-4.6 1.4 1.4-6 6z',
    title: 'Explainable eligibility scoring',
    desc: 'Every scheme is scored 0–100 with the exact rules matched and missed, confidence, and approval probability — not a black box.',
  },
  {
    icon: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z',
    title: 'Step-by-step application guidance',
    desc: 'Each recommendation comes with a numbered roadmap, time estimate, and live progress tracking as you complete steps.',
  },
  {
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    title: 'Document intelligence',
    desc: 'Upload Aadhaar, income certificates or bank passbooks. AI detects document type, expiry, blur, duplicates and fake-risk.',
  },
  {
    icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z',
    title: 'Family-aware recommendations',
    desc: 'Add family members and get scheme matches for each — scholarships for kids, pensions for elders, and more.',
  },
  {
    icon: 'M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-8 2h2v2h-2V8zm0 4h2v4h-2v-4z',
    title: 'AI-guided interview',
    desc: 'A 23-question adaptive interview with skip logic keeps it short. Resume anytime; answers are saved and reused.',
  },
  {
    icon: 'M12 1l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V5l9-4z',
    title: 'Scam & fraud screening',
    desc: 'Official-domain link checks and identity-readiness flags warn you before you share data anywhere.',
  },
  {
    icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
    title: 'Voice assistant in 6 languages',
    desc: 'Ask "what am I eligible for?" or "track my application" by voice in English, Hindi, Telugu, Tamil, Kannada or Marathi.',
  },
  {
    icon: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.83V4.5a1.5 1.5 0 0 0-3 0v.67A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z',
    title: 'Deadline alerts & notifications',
    desc: 'Never miss an application window. AI-generated summaries and trend flags keep you current on new schemes.',
  },
  {
    icon: 'M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2 2H5V5h11l5 5v9a2 2 0 0 1-2 2z',
    title: 'Shareable reports & QR verification',
    desc: 'Download eligibility and application PDFs, or let anyone verify an application via its QR reference.',
  },
]

export default function Features() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="chip badge-ok mb-4">Features</span>
        <h1 className="section-title">Everything a scheme searcher needs</h1>
        <p className="mt-4 text-muted text-lg">
          SchemeAI wraps discovery, explanation, documents and applications in one intelligent assistant.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card p-6 hover:shadow-lift transition">
            <div className="h-11 w-11 rounded-lg bg-brand flex items-center justify-center text-white mb-4">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={f.icon} /></svg>
            </div>
            <h2 className="font-bold text-ink">{f.title}</h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
