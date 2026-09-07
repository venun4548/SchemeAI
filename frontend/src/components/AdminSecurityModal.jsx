import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function AdminSecurityModal({ onSuccess, onCancel }) {
  const { verifySecondary, cancelSecondary, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pin.trim()) return

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await verifySecondary(pin.trim())
      setSuccess('Verification successful')
      toast.success('Verification successful')
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      const errMsg = err.message?.includes('Invalid security PIN')
        ? 'Invalid security PIN/password. Access denied.'
        : (err.message || 'Invalid security PIN/password. Access denied.')
      setError(errMsg)
      toast.error(errMsg)
    } finally {
      setBusy(false)
    }
  }

  function handleCancel() {
    if (onCancel) {
      onCancel()
    } else {
      cancelSecondary()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="card w-full max-w-md p-6 sm:p-8 bg-surface shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Admin Security Verification</h2>
            <p className="text-xs text-muted">Two-factor elevated privilege check</p>
          </div>
        </div>

        <p className="text-sm text-ink/80 mb-5">
          Enter your secondary security PIN/password to continue.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
            <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-red-500 mt-0.5" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-green-500" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="admin-security-pin">
              Security PIN / Password
            </label>
            <input
              id="admin-security-pin"
              type="password"
              className="input"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                if (error) setError('')
              }}
              placeholder="Enter security PIN / password"
              autoFocus
              required
              disabled={busy || !!success}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary w-full sm:w-1/2"
              onClick={handleCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary w-full sm:w-1/2"
              disabled={busy || !pin.trim() || !!success}
            >
              {busy ? 'Verifying…' : 'Verify & Continue'}
            </button>
          </div>
        </form>

        <div className="mt-5 pt-4 border-t border-line text-xs text-muted flex items-center justify-between">
          <span>Logged in as: <strong className="text-ink font-semibold">{user?.email}</strong></span>
        </div>
      </div>
    </div>
  )
}
