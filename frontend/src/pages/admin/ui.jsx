export function Chip({ children, tone = 'gray', className = '' }) {
  const tones = {
    green: 'bg-brand-50 text-brand-700 border-brand-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    gray: 'bg-cream text-muted border-line',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }
  return (
    <span className={`chip border ${tones[tone] || tones.gray} ${className}`}>{children}</span>
  )
}

export function StatCard({ label, value, sub, tone = 'green', onClick }) {
  const accents = {
    green: 'text-brand-700',
    violet: 'text-violet-700',
    amber: 'text-amber-600',
    red: 'text-red-600',
    ink: 'text-ink',
  }
  const ring = {
    green: 'bg-brand-50',
    violet: 'bg-violet-50',
    amber: 'bg-amber-50',
    red: 'bg-red-50',
    ink: 'bg-cream',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card p-4 text-left transition ${onClick ? 'hover:shadow-lift cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</div>
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${ring[tone]}`} />
      </div>
      <div className={`mt-1 text-3xl font-bold ${accents[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </button>
  )
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

const STATUS_TONES = {
  green: 'green',
  amber: 'amber',
  red: 'red',
  violet: 'violet',
  blue: 'blue',
  gray: 'gray',
}

export function AppStatus({ status }) {
  const map = {
    approved: { tone: 'green', label: 'Approved' },
    disbursed: { tone: 'green', label: 'Disbursed' },
    under_review: { tone: 'blue', label: 'Under review' },
    submitted: { tone: 'violet', label: 'Submitted' },
    in_progress: { tone: 'amber', label: 'In progress' },
    draft: { tone: 'gray', label: 'Draft' },
    rejected: { tone: 'red', label: 'Rejected' },
  }
  const cfg = map[status] || { tone: 'gray', label: status }
  return <Chip tone={STATUS_TONES[cfg.tone]}>{cfg.label}</Chip>
}

export function ReviewStatus({ status }) {
  const map = {
    new: { tone: 'gray', label: 'New' },
    needs_review: { tone: 'blue', label: 'Needs review' },
    documents_required: { tone: 'amber', label: 'Docs required' },
    under_review: { tone: 'violet', label: 'Under review' },
    decision: { tone: 'green', label: 'Decision made' },
    unreviewed: { tone: 'gray', label: 'Unreviewed' },
    verified: { tone: 'green', label: 'Verified' },
    rejected: { tone: 'red', label: 'Rejected' },
    reupload_requested: { tone: 'amber', label: 'Re-upload requested' },
    escalated: { tone: 'red', label: 'Escalated' },
    review: { tone: 'amber', label: 'In review' },
    approved: { tone: 'green', label: 'Approved' },
    failed: { tone: 'red', label: 'Failed' },
  }
  const cfg = map[status] || { tone: 'gray', label: status }
  return <Chip tone={STATUS_TONES[cfg.tone]}>{cfg.label}</Chip>
}

export function CaseStatus({ status }) {
  const map = {
    open: { tone: 'blue', label: 'Open' },
    assigned: { tone: 'violet', label: 'Assigned' },
    in_progress: { tone: 'amber', label: 'In progress' },
    waiting_for_user: { tone: 'amber', label: 'Waiting on user' },
    escalated: { tone: 'red', label: 'Escalated' },
    resolved: { tone: 'green', label: 'Resolved' },
    closed: { tone: 'gray', label: 'Closed' },
  }
  const cfg = map[status] || { tone: 'gray', label: status }
  return <Chip tone={STATUS_TONES[cfg.tone]}>{cfg.label}</Chip>
}

export function Lifecycle({ status }) {
  const map = {
    draft: { tone: 'gray', label: 'Draft' },
    review: { tone: 'amber', label: 'Awaiting approval' },
    verified: { tone: 'blue', label: 'Verified' },
    published: { tone: 'green', label: 'Published' },
    update_required: { tone: 'amber', label: 'Update required' },
    archived: { tone: 'red', label: 'Archived' },
  }
  const cfg = map[status] || { tone: 'gray', label: status }
  return <Chip tone={STATUS_TONES[cfg.tone]}>{cfg.label}</Chip>
}

export function Pri({ priority }) {
  const map = {
    critical: { tone: 'red', label: 'Critical' },
    high: { tone: 'amber', label: 'High' },
    medium: { tone: 'blue', label: 'Medium' },
    normal: { tone: 'gray', label: 'Normal' },
    low: { tone: 'gray', label: 'Low' },
  }
  const cfg = map[priority] || { tone: 'gray', label: priority }
  return <Chip tone={STATUS_TONES[cfg.tone]}>{cfg.label}</Chip>
}

export function Severity({ severity }) {
  const map = {
    critical: { tone: 'red', label: 'Critical' },
    high: { tone: 'amber', label: 'High' },
    medium: { tone: 'blue', label: 'Medium' },
    low: { tone: 'gray', label: 'Low' },
  }
  const cfg = map[severity] || { tone: 'gray', label: severity }
  return <Chip tone={STATUS_TONES[cfg.tone]}>{cfg.label}</Chip>
}

export function Empty({ message = 'No records found.' }) {
  return <p className="px-5 py-10 text-center text-muted">{message}</p>
}

export function fmtDT(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgo(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}
