import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import Alert from '../../components/Alert'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)
  const toast = useToast()

  const submit = (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill in all fields.')
      return
    }
    setSent(true)
    toast.success('Message sent. We’ll get back to you soon.')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="chip badge-ok mb-4">Contact</span>
        <h1 className="section-title">Talk to the team</h1>
        <p className="mt-4 text-muted text-lg">
          Questions, feedback or partnership ideas — we’d love to hear from you.
        </p>
      </div>

      {sent ? (
        <Alert kind="success" title="Thank you!">
          Your message has been recorded. For demo purposes we don’t actually send mail — write to
          hello@schemeai.in to reach us.
        </Alert>
      ) : (
        <form onSubmit={submit} className="card p-6 md:p-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label className="label">Message</label>
            <textarea
              className="input min-h-[140px]"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="How can we help?"
            />
          </div>
          <button type="submit" className="btn-primary w-full sm:w-auto">
            Send message
          </button>
        </form>
      )}
    </div>
  )
}
