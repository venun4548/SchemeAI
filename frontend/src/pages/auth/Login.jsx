import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import SmartImage from '../../components/SmartImage'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('demo@schemeai.in')
  const [password, setPassword] = useState('Demo@123')
  const [isAdmin, setIsAdmin] = useState(false)
  const [busy, setBusy] = useState(false)

  const from = location.state?.from || '/dashboard'

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const user = await login(email.trim().toLowerCase(), password.trim(), isAdmin)
      toast.success(`Welcome back, ${user.full_name}!`)
      const dest = (user.role && user.role.includes('ADMIN') || user.role === 'CONTENT_REVIEWER' || user.role === 'SUPPORT_AGENT' || user.role === 'AI_OPERATIONS' || user.role === 'ANALYST')
        ? '/admin'
        : (from.startsWith('/admin') ? '/dashboard' : from)
      navigate(dest, { replace: true })
    } catch (err) {
      toast.error(err.message, 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream grid lg:grid-cols-2">
      {/* Login form — calm negative space */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="h-9 w-9 rounded-lg bg-brand flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 17V11a8 8 0 0 1 16 0v6" />
                  <circle cx="8" cy="15" r="1.8" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="17" r="1.8" fill="currentColor" stroke="none" />
                  <circle cx="16" cy="15" r="1.8" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="text-lg font-bold text-ink">
                Sign in to <span className="text-brand-accent">SchemeAI</span>
              </span>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="h-4 w-4 text-brand rounded border-gray-300 focus:ring-brand"
                />
                <label htmlFor="isAdmin" className="text-sm text-ink font-medium">
                  Log in as Administrator
                </label>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 rounded-lg bg-cream border border-line p-3 text-xs text-muted">
              <p className="font-semibold text-ink mb-1">Demo accounts</p>
              <p>Citizen: demo@schemeai.in / Demo@123</p>
              <p>Admin: admin@schemeai.in / Admin@123 (Check Admin box)</p>
            </div>

            <p className="mt-6 text-center text-sm text-muted">
              New here?{' '}
              <Link to="/register" className="font-semibold text-brand-700 hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Secure access image slot — subject right, calm negative space */}
      <div className="relative hidden lg:block min-h-[560px]">
        <SmartImage slot="login-side" fill />
        <div className="absolute inset-0 flex flex-col justify-end p-10 bg-gradient-to-t from-green-950/60 via-transparent to-transparent">
          <p className="text-white/90 font-medium leading-relaxed max-w-sm text-sm">
            “Government benefits without the guesswork.”
          </p>
        </div>
      </div>
    </div>
  )
}
