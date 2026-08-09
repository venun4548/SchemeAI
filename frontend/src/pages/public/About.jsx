import { Link } from 'react-router-dom'
import SmartImage from '../../components/SmartImage'

const concepts = [
  {
    slot: 'about-does-discover',
    step: 'Discover',
    title: 'Discover',
    desc: 'Find the central and state schemes meant for you — not a wall of 1,000 PDFs.',
  },
  {
    slot: 'about-does-understand',
    step: 'Understand',
    title: 'Understand',
    desc: 'Plain-language eligibility explained, rule by rule, in the language you speak.',
  },
  {
    slot: 'about-does-prepare',
    step: 'Prepare',
    title: 'Prepare',
    desc: 'Know exactly which documents you need — and what is still missing.',
  },
  {
    slot: 'about-does-navigate',
    step: 'Navigate',
    title: 'Navigate',
    desc: 'Follow a guided, step-by-step plan through the official application.',
  },
  {
    slot: 'about-does-track',
    step: 'Track',
    title: 'Track',
    desc: 'Check your status, verify with QR codes and get deadline reminders.',
  },
]

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <SmartImage
          slot="about-hero"
          eager
          overlay="bottom"
          className="h-[52vh] min-h-[340px] w-full"
        />
        <div className="absolute inset-0 flex items-end">
          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 pb-10 md:pb-14">
            <span className="chip bg-white/90 text-brand-700 mb-4 shadow-sm">About SchemeAI</span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm max-w-2xl">
              Why we built SchemeAI
            </h1>
            <p className="mt-4 text-lg text-brand-50 max-w-2xl">
              Governments publish thousands of welfare schemes. Most people never find the ones
              meant for them.
            </p>
          </div>
        </div>
      </section>

      {/* Purpose */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SmartImage slot="about-purpose" className="rounded-xl2 shadow-card" />
          <div>
            <h2 className="section-title">A service that meets you where you are</h2>
            <div className="mt-6 space-y-6 text-ink leading-relaxed">
              <div>
                <h3 className="font-bold text-lg mb-2">The problem</h3>
                <p className="text-muted">
                  Eligible households miss pensions, scholarships, loans and subsidies every year
                  because scheme details live across hundreds of portals, PDFs and WhatsApp
                  forwards. The information is fragmented, jargon-heavy and rarely personalised.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Our approach</h3>
                <p className="text-muted">
                  SchemeAI interviews you once and runs a transparent pipeline of eight specialist
                  AI agents. Instead of “top 10 lists”, you get a ranked set of schemes with the
                  exact rules you satisfy, the documents required, an application roadmap and
                  plain-language reasons. Every conclusion is explainable — you can see which rule
                  made the difference.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What SchemeAI does */}
      <section className="bg-white border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 md:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="section-title">What SchemeAI does</h2>
            <p className="mt-3 text-muted">
              One connected journey, from the first search to the final status update.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {concepts.map((c) => (
              <div key={c.slot} className="group flex flex-col overflow-hidden rounded-xl2 border border-line bg-cream">
                <SmartImage slot={c.slot} className="aspect-[4/3]" />
                <div className="p-4 flex-1">
                  <div className="text-xs font-bold text-brand-accent uppercase tracking-wider">
                    {c.step}
                  </div>
                  <h3 className="mt-1 font-bold text-ink">{c.title}</h3>
                  <p className="mt-1.5 text-sm text-muted leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 md:py-20">
        <div className="card p-6 md:p-8">
          <h2 className="font-bold text-lg mb-2">Transparency</h2>
          <p className="text-muted leading-relaxed">
            SchemeAI is a demonstration project and is not affiliated with any government body.
            Scheme data is curated for illustration. Always confirm final eligibility and
            deadlines on official portals, which we link to for every scheme. We never sell or
            share your personal data.
          </p>
        </div>
        <div className="mt-10 text-center">
          <Link to="/register" className="btn-accent !px-8 !py-3 !text-base">
            Try it for yourself
          </Link>
        </div>
      </section>
    </div>
  )
}
