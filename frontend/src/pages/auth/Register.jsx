import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import SmartImage from '../../components/SmartImage'

const languages = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'kn', label: 'Kannada' },
  { code: 'mr', label: 'Marathi' },
]

export default function Register() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', language: 'en' })
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      const user = await register({ ...form, password: form.password })
      toast.success(`Welcome, ${user.full_name}!`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message, 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cream grid lg:grid-cols-2">
      {/* Sign-up form */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-ink">Create your account</h1>
              <p className="text-sm text-muted mt-1">Free forever. Your data stays yours.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={form.full_name} onChange={set('full_name')} placeholder="Asha Kumar" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
              </div>
              <div>
                <label className="label">Phone (optional)</label>
                <input className="input" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="label">Preferred language</label>
                <select className="input" value={form.language} onChange={set('language')}>
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} onChange={set('password')} placeholder="8+ characters" required />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-brand-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Family profile image slot */}
      <div className="relative hidden lg:block min-h-[560px]">
        <SmartImage slot="signup-side" fill />
        <div className="absolute inset-0 flex flex-col justify-end p-10 bg-gradient-to-t from-ink/60 via-transparent to-transparent">
          <p className="text-white/95 font-medium leading-relaxed max-w-sm text-sm">
            One profile for the whole family — benefits in every language you speak.
          </p>
        </div>
      </div>
    </div>
  )
}
