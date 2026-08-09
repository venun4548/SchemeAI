import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import Spinner from '../../components/Spinner'
import SmartImage from '../../components/SmartImage'

const categoryShowcase = [
  {
    slot: 'schemes-agriculture',
    title: 'Agriculture',
    desc: 'Crop, income and farmer welfare support across states.',
  },
  {
    slot: 'schemes-education',
    title: 'Education',
    desc: 'Scholarships and study aid for students at every level.',
  },
  {
    slot: 'schemes-healthcare',
    title: 'Healthcare',
    desc: 'Health protection and treatment cover for families.',
  },
]

export default function Schemes() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('all')
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('all')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (level !== 'all') params.set('state', level)
    if (q.trim()) params.set('q', q.trim())
    api.get(`/public/schemes${params.toString() ? `?${params}` : ''}`)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
  }, [category, level, q])

  const categories = useMemo(
    () => (data ? ['all', ...data.categories] : ['all']),
    [data],
  )

  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <SmartImage
          slot="schemes-hero"
          eager
          overlay="bottom"
          className="h-[46vh] min-h-[320px] w-full"
        />
        <div className="absolute inset-0 flex items-end">
          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 pb-10">
            <span className="chip bg-white/90 text-brand-700 mb-4 shadow-sm">Scheme directory</span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm max-w-2xl">
              Explore central & state schemes
            </h1>
            <p className="mt-4 text-lg text-brand-50 max-w-2xl">
              A curated catalogue of schemes. Sign in to see your personalised scores and
              recommendations.
            </p>
          </div>
        </div>
      </section>

      {/* Category showcase */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 md:py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {categoryShowcase.map((c) => (
            <Link
              key={c.slot}
              to="/register"
              className="group flex flex-col overflow-hidden rounded-xl2 border border-line bg-white shadow-card transition hover:shadow-lift"
            >
              <SmartImage slot={c.slot} className="aspect-[16/9]" />
              <div className="p-5">
                <h3 className="font-bold text-ink group-hover:text-brand-700">{c.title}</h3>
                <p className="mt-1.5 text-sm text-muted leading-relaxed">{c.desc}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-brand-accent">
                  Check eligibility →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Directory */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16 md:pb-20">
      <div className="flex flex-col sm:flex-row gap-3 mb-8 max-w-3xl mx-auto">
        <input
          className="input flex-1"
          placeholder="Search schemes… (e.g. farmer, pension, loan)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input sm:w-56" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
          ))}
        </select>
        <select className="input sm:w-56" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">All states</option>
          <option value="all">Any state</option>
          <option value="Andhra Pradesh">Andhra Pradesh</option>
          <option value="Telangana">Telangana</option>
          <option value="Karnataka">Karnataka</option>
          <option value="Tamil Nadu">Tamil Nadu</option>
          <option value="Maharashtra">Maharashtra</option>
          <option value="Delhi">Delhi</option>
        </select>
      </div>

      {error && <p className="text-center text-red-600">{error}</p>}
      {!data && !error && <Spinner label="Loading schemes…" />}

      {data && (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((s) => (
              <div key={s.id} className="card p-5 flex flex-col hover:shadow-lift transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-ink leading-snug">{s.name}</h3>
                  {s.is_trending && <span className="chip bg-amber-50 text-amber-700 shrink-0">🔥 Trending</span>}
                </div>
                <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">
                  {s.ministry || 'Government of India'}
                </p>
                <p className="text-sm text-muted line-clamp-3 flex-1">{s.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="chip bg-brand-50 text-brand-700">{s.category}</span>
                  <span className="chip bg-cream text-muted">{s.level === 'central' ? 'Central' : s.state_specific}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{s.amount || 'See details'}</span>
                  <Link to="/register" className="btn-secondary !py-1.5 !px-3 text-xs">
                    Check eligibility
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {data.items.length === 0 && (
            <p className="text-center text-muted py-10">No schemes match your filters.</p>
          )}
        </>
      )}
      </section>
    </div>
  )
}
