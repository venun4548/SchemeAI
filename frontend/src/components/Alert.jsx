export default function Alert({ kind = 'info', title, children, className = '' }) {
  const styles = {
    info: 'bg-blue-50 text-blue-900 border-blue-200',
    success: 'bg-brand-50 text-brand-800 border-brand-200',
    warn: 'bg-amber-50 text-amber-900 border-amber-200',
    error: 'bg-red-50 text-red-900 border-red-200',
  }
  const dot = {
    info: 'bg-blue-500',
    success: 'bg-brand-500',
    warn: 'bg-amber-500',
    error: 'bg-red-500',
  }
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${styles[kind]} ${className}`}>
      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${dot[kind]}`} />
      <div className="min-w-0 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>
      </div>
    </div>
  )
}
