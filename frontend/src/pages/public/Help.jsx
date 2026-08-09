import { useState } from 'react'
import { Link } from 'react-router-dom'
import SmartImage from '../../components/SmartImage'

const topics = [
  {
    to: '/how-it-works',
    title: 'How SchemeAI works',
    desc: 'Understand the interview, the eight agents and how results are produced.',
  },
  {
    to: '/schemes',
    title: 'Browse schemes',
    desc: 'Explore the full central and state scheme directory.',
  },
  {
    to: '/contact',
    title: 'Contact the team',
    desc: 'Questions, feedback or partnership ideas — write to us.',
  },
  {
    to: '/register',
    title: 'Get started',
    desc: 'Create your free profile and find schemes you qualify for.',
  },
]

const faqs = [
  {
    q: 'Is SchemeAI connected to any government?',
    a: 'No. SchemeAI is a demonstration project and is not affiliated with any government body. Always confirm final eligibility and deadlines on the official portals we link to for every scheme.',
  },
  {
    q: 'Is my data shared or sold?',
    a: 'Never. Your personal data stays yours and is used only to personalise your scheme matches.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes — creating a profile and using SchemeAI is free. No paid plans.',
  },
  {
    q: 'Which languages are supported?',
    a: 'Six: English, Hindi, Telugu, Tamil, Kannada and Marathi.',
  },
  {
    q: 'Where can I verify an application?',
    a: 'Every application carries a QR code that verifies its status anywhere, on any device.',
  },
]

export default function Help() {
  const [open, setOpen] = useState(0)

  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <SmartImage
          slot="help-support"
          eager
          overlay="bottom"
          className="h-[46vh] min-h-[320px] w-full"
        />
        <div className="absolute inset-0 flex items-end">
          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 pb-10">
            <span className="chip bg-white/90 text-brand-700 mb-4 shadow-sm">Help & support</span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm max-w-2xl">
              We’re here to help
            </h1>
            <p className="mt-4 text-lg text-brand-50 max-w-2xl">
              Patient, human help — the way every citizen should be served.
            </p>
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 md:py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {topics.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="card p-5 hover:shadow-lift transition"
            >
              <h3 className="font-bold text-ink group-hover:text-brand-700">{t.title}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{t.desc}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-brand-accent">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-y border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 md:py-16">
          <h2 className="section-title text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={open === i}
                >
                  <span className="font-semibold text-ink">{f.q}</span>
                  <span
                    className={`shrink-0 text-brand-accent transition-transform ${open === i ? 'rotate-45' : ''}`}
                  >
                    +
                  </span>
                </button>
                {open === i && (
                  <p className="px-5 pb-5 text-sm text-muted leading-relaxed">{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 md:py-16 text-center">
        <h2 className="section-title">Still stuck?</h2>
        <p className="mt-3 text-muted max-w-xl mx-auto">
          Write to us and a real person will get back to you — in your language.
        </p>
        <div className="mt-6">
          <Link to="/contact" className="btn-accent !px-8 !py-3">
            Contact the team
          </Link>
        </div>
      </section>
    </div>
  )
}
