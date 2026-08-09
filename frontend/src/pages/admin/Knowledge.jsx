import { useEffect, useState } from 'react'
import { api, fmtDate } from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import { useToast } from '../../context/ToastContext'

const empty = { title: '', content: '', source: '', category: 'policy', level: 'central', state: 'all' }

export default function AdminKnowledge() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(empty)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState(null)
  const toast = useToast()

  async function load() {
    try {
      setData(await api.get('/admin/knowledge'))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    if (!form.title) { toast.error('Title is required.'); return }
    setBusy(true)
    try {
      await api.post('/admin/knowledge', form)
      toast.success('Knowledge doc added.')
      setForm(empty)
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function indexAll() {
    setBusy(true)
    try {
      const res = await api.post('/admin/knowledge/index')
      toast.success(`Indexed ${res.indexed_chunks} chunks (${res.backend}).`)
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      await api.del(`/admin/knowledge/${id}`)
      toast.info('Document deleted.')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function search(e) {
    e.preventDefault()
    if (!searchQ.trim()) return
    try {
      setSearchRes(await api.post('/admin/knowledge/search', { query: searchQ }))
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (error) return <div className="p-6"><Alert kind="error" title="Could not load knowledge base">{error}</Alert></div>
  if (!data) return <Spinner label="Loading knowledge base…" />

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Knowledge Base</h1>
          <p className="text-sm text-muted">
            {data.total} docs · {data.chunks} chunks · RAG backend: {data.rag_backend}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={indexAll} disabled={busy}>Re-index all</button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add document</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={add} className="card p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Content</label><textarea className="input min-h-[100px]" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div><label className="label">Source</label><input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="policy">Policy</option><option value="scheme">Scheme</option><option value="faq">FAQ</option><option value="guideline">Guideline</option>
              </select>
            </div>
            <div>
              <label className="label">Level</label>
              <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                <option value="central">Central</option><option value="state">State</option>
              </select>
            </div>
            <div>
              <label className="label">State</label>
              <select className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                <option value="all">All states</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Telangana">Telangana</option>
                <option value="Karnataka">Karnataka</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.items.map((d) => (
          <div key={d.id} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-ink">{d.title}</h3>
              <button className="text-muted hover:text-red-600" onClick={() => remove(d.id)}>✕</button>
            </div>
            <p className="text-xs text-muted mt-1 capitalize">
              {d.category} · {d.level} · {d.state} · {d.chunk_count} chunks
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className={d.is_indexed ? 'badge-ok' : 'badge-warn'}>{d.is_indexed ? 'Indexed' : 'Not indexed'}</span>
              <span className="text-muted">{d.source}</span>
              <span className="text-muted ml-auto">{fmtDate(d.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-ink mb-3">Search the knowledge base (RAG)</h3>
        <form onSubmit={search} className="flex gap-2">
          <input className="input flex-1" placeholder="e.g. PM-KISAN eligibility 2026" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          <button type="submit" className="btn-primary">Search</button>
        </form>
        {searchRes && (
          <div className="mt-4 space-y-3">
            {searchRes.results.length === 0 && <p className="text-sm text-muted">No results.</p>}
            {searchRes.results.map((r, i) => (
              <div key={i} className="rounded-lg border border-line p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{r.title}</span>
                  <span className="chip bg-brand-50 text-brand-700">{Math.round(r.score * 100)}%</span>
                </div>
                <p className="text-sm text-muted mt-1 line-clamp-3">{r.content || r.snippet}</p>
                <div className="text-xs text-brand-700 mt-1">{r.source}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
