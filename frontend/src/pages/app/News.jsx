import { useEffect, useState } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'

export default function News() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [cats, setCats] = useState([])
  const [filterCat, setFilterCat] = useState('all')
  const [trendingOnly, setTrendingOnly] = useState(false)
  const [summarizing, setSummarizing] = useState(null)
  const toast = useToast()

  useEffect(() => {
    api.get('/news/categories').then((r) => setCats(r.categories || [])).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (filterCat !== 'all') params.set('category', filterCat)
    if (trendingOnly) params.set('trending', 'true')
    setData(null)
    api.get(`/news${params.toString() ? `?${params}` : ''}`)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
  }, [filterCat, trendingOnly])

  async function toggleBookmark(id) {
    try {
      const res = await api.post(`/news/${id}/bookmark`)
      toast.info(res.bookmarked ? 'Bookmarked.' : 'Removed bookmark.')
      setData((d) => ({
        ...d,
        items: d.items.map((n) => (n.id === id ? { ...n, bookmarked: res.bookmarked } : n)),
      }))
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function summarize(n) {
    setSummarizing(n.id)
    try {
      const res = await api.post(`/news/${n.id}/summarize`)
      setData((d) => ({
        ...d,
        items: d.items.map((x) => (x.id === n.id ? { ...x, ai_summary: res.ai_summary } : x)),
      }))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSummarizing(null)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load news">{error}</Alert></div>

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">What’s New</h1>
          <p className="text-sm text-muted">Scheme updates, new launches and trending benefits.</p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="input sm:w-48" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="all">All categories</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-ink whitespace-nowrap">
            <input type="checkbox" checked={trendingOnly} onChange={(e) => setTrendingOnly(e.target.checked)} className="h-4 w-4 rounded border-line" />
            Trending
          </label>
        </div>
      </div>

      {!data ? (
        <Spinner label="Loading news…" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((n) => (
            <div key={n.id} className="card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="chip bg-brand-50 text-brand-700">{n.category}</span>
                  {n.is_new && <span className="chip bg-red-50 text-red-700">New</span>}
                  {n.is_trending && <span className="chip bg-amber-50 text-amber-700">🔥 Trending</span>}
                </div>
                <button onClick={() => toggleBookmark(n.id)} className="text-muted hover:text-brand-accent" aria-label="Bookmark">
                  {n.bookmarked ? '★' : '☆'}
                </button>
              </div>
              <h3 className="font-bold text-ink mt-2 leading-snug">{n.title}</h3>
              <p className="text-sm text-muted mt-1 flex-1 line-clamp-3">{n.summary || n.ai_summary}</p>
              {n.ai_summary && (
                <div className="mt-3 rounded-lg bg-brand-50 border border-brand-100 p-3">
                  <div className="text-[11px] font-semibold text-brand-700 uppercase mb-0.5">AI summary</div>
                  <p className="text-sm text-brand-900">{n.ai_summary}</p>
                </div>
              )}
              {!n.ai_summary && (
                <button className="btn-secondary mt-3 !py-1.5 text-xs" onClick={() => summarize(n)} disabled={summarizing === n.id}>
                  {summarizing === n.id ? 'Summarising…' : '✨ Summarize with AI'}
                </button>
              )}
              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
                <span>{n.source || 'SchemeAI'}</span>
                <span>{fmtDate(n.published_at)}</span>
              </div>
              {n.link && (
                <a href={n.link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-700 hover:underline mt-1">
                  Official source →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {data && data.items.length === 0 && <p className="text-center text-muted py-10">No news to show.</p>}
    </div>
  )
}
