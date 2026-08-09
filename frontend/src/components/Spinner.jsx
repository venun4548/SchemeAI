export default function Spinner({ size = 'md', label = 'Loading…' }) {
  const px = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted">
      <div className={`spinner ${px}`} />
      <p className="text-sm">{label}</p>
    </div>
  )
}
