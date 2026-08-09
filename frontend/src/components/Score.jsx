export function ScoreRing({ score, size = 88, stroke = 9 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (Math.min(100, Math.max(0, score)) / 100) * c
  const color = score >= 75 ? '#2E8B57' : score >= 45 ? '#C79A2D' : '#C0392B'
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDF0EA" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold text-ink leading-none">{Math.round(score)}</div>
        <div className="text-[10px] text-muted mt-0.5">score</div>
      </div>
    </div>
  )
}

export function ScoreBar({ score, className = '' }) {
  const color = score >= 75 ? 'bg-brand-500' : score >= 45 ? 'bg-brand-accent' : 'bg-red-500'
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 flex-1 rounded-full bg-line overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="text-xs font-semibold text-ink w-9 text-right">{Math.round(score)}%</span>
    </div>
  )
}

export function statusBadge(status) {
  const map = {
    draft: ['badge-info', 'Draft'],
    in_progress: ['badge-info', 'In progress'],
    submitted: ['badge-warn', 'Submitted'],
    under_review: ['badge-warn', 'Under review'],
    approved: ['badge-ok', 'Approved'],
    disbursed: ['badge-ok', 'Disbursed'],
    rejected: ['badge-bad', 'Rejected'],
    analyzed: ['badge-ok', 'Analyzed'],
    pending: ['badge-warn', 'Pending'],
  }
  const [cls, label] = map[status] || ['badge-info', status]
  return { cls, label }
}
