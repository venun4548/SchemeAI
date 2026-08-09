import { Link } from 'react-router-dom'
import SmartImage from '../../components/SmartImage'

const agents = [
  { name: 'Profiling Agent', desc: 'Builds a structured citizen profile from a 23-question interview.', icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z' },
  { name: 'Eligibility Agent', desc: 'Scores 25+ schemes against your profile with explainable rules.', icon: 'M12 2 4 5v6c0 5.25 3.4 10.15 8 11 4.6-.85 8-5.75 8-11V5l-8-3z' },
  { name: 'Policy Agent', desc: 'Retrieves up-to-date policy context from a curated knowledge base.', icon: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 5H7V6h10v2zm0 5H7v-2h10v2zm0 5H7v-2h10v2z' },
  { name: 'Recommender Agent', desc: 'Ranks the best personal matches for your goals and state.', icon: 'M12 21l-8-8a4 4 0 0 1 5.66-5.66L12 8l2.34-2.34A4 4 0 1 1 20 13l-8 8z' },
  { name: 'Explainability Agent', desc: 'Explains, in plain language, why you are — or are not — eligible.', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z' },
  { name: 'Guidance Agent', desc: 'Builds a step-by-step application roadmap with time estimates.', icon: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z' },
  { name: 'Fraud Agent', desc: 'Screens links and application targets for scam risk.', icon: 'M12 1l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V5l9-4z' },
  { name: 'Documents Agent', desc: 'Checks which documents you have and what is still missing.', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z' },
]

const steps = [
  { n: '01', t: 'Tell us about yourself', d: 'Answer a short AI-guided interview, or import your profile.' },
  { n: '02', t: 'Meet your AI agents', d: 'Eight agents analyse, score, explain and guide in one pass.' },
  { n: '03', t: 'See what you qualify for', d: 'A ranked, explained list of central and state schemes.' },
  { n: '04', t: 'Apply with confidence', d: 'Track your application, verify with QR codes, and get reminders.' },
]

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-accent/20 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28 grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <span className="chip bg-white/10 text-white mb-5">Multi-Agent AI Assistant</span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Every government scheme you qualify for.{' '}
              <span className="text-brand-accent">Explained. In minutes.</span>
            </h1>
            <p className="mt-5 text-lg text-brand-100 max-w-xl">
              SchemeAI interviews you once, runs eight specialised AI agents, and surfaces the
              central and state schemes you are actually eligible for — with plain-language
              reasons, documents you need, and a step-by-step application plan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn-accent !px-6 !py-3 !text-base">
                Get started free
              </Link>
              <Link to="/schemes" className="btn !px-6 !py-3 !text-base bg-white/10 text-white hover:bg-white/20 border border-white/20">
                Browse 25+ schemes
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 max-w-md gap-4">
              {[
                ['25+', 'schemes'],
                ['8', 'AI agents'],
                ['6', 'languages'],
              ].map(([n, l]) => (
                <div key={l} className="text-white">
                  <div className="text-2xl font-bold">{n}</div>
                  <div className="text-brand-200 text-sm">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero image slot — commissioned photograph of citizens at a
              service centre; subjects on the right, clean space on the left */}
          <div className="hidden lg:block">
            <SmartImage
              slot="home-hero"
              eager
              className="rounded-xl2 ring-1 ring-white/20 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="section-title">From interview to application in 4 steps</h2>
          <p className="mt-3 text-muted">No more spreadsheet of 1,000 schemes. No more guessing.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="card p-6 hover:shadow-lift transition">
              <div className="text-brand-accent font-extrabold text-3xl">{s.n}</div>
              <h3 className="mt-3 font-bold text-ink">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agents */}
      <section className="bg-white border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="section-title">Eight specialist agents, one seamless result</h2>
            <p className="mt-3 text-muted">
              Each agent does one job and passes the work on — the same orchestration the dashboard shows you live.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((a) => (
              <div key={a.name} className="rounded-xl2 border border-line bg-cream p-5">
                <div className="h-10 w-10 rounded-lg bg-brand flex items-center justify-center text-white mb-3">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={a.icon} /></svg>
                </div>
                <h3 className="font-semibold text-ink">{a.name}</h3>
                <p className="mt-1.5 text-sm text-muted">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-24">
        <div className="rounded-xl2 bg-gradient-to-br from-brand-700 to-brand-900 p-10 md:p-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Your benefits are waiting.</h2>
          <p className="mt-3 text-brand-100 max-w-xl mx-auto">
            Find out what the government has for you — in under three minutes.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-accent !px-6 !py-3">Create your profile</Link>
            <Link to="/how-it-works" className="btn !px-6 !py-3 bg-white/10 text-white hover:bg-white/20 border border-white/20">
              Learn how it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
