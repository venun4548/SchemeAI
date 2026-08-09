import { Link } from 'react-router-dom'
import SmartImage from './SmartImage'

const groups = [
  {
    title: 'Product',
    links: [
      { to: '/features', label: 'Features' },
      { to: '/how-it-works', label: 'How It Works' },
      { to: '/schemes', label: 'Browse Schemes' },
      { to: '/about', label: 'About' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/contact', label: 'Contact' },
      { to: '/login', label: 'Sign in' },
      { to: '/register', label: 'Create account' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      {/* Wide public-service band — evening citizen-service centre */}
      <div className="relative">
        <SmartImage slot="footer-band" overlay="bottom" className="aspect-[21/9] max-h-64 w-full" />
        <div className="absolute inset-0 flex items-end">
          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 pb-8">
            <p className="text-white font-semibold text-lg md:text-2xl max-w-xl leading-snug">
              A digital public service for every citizen — in your language, with your documents.
            </p>
            <Link
              to="/register"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95 shadow-sm"
            >
              Get started free
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 17V11a8 8 0 0 1 16 0v6" />
                <circle cx="8" cy="15" r="1.8" fill="currentColor" stroke="none" />
                <circle cx="12" cy="17" r="1.8" fill="currentColor" stroke="none" />
                <circle cx="16" cy="15" r="1.8" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="text-lg font-bold text-ink">
              Scheme<span className="text-brand-accent">AI</span>
            </span>
          </div>
          <p className="text-sm text-muted max-w-sm">
            A multi-agent AI assistant that finds government schemes you qualify for, explains why,
            and guides you through the application — in your language, with your documents.
          </p>
          <p className="text-xs text-muted/80 mt-4">
            © {new Date().getFullYear()} SchemeAI. A demonstration project — not affiliated with any government.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h4 className="text-sm font-semibold text-ink mb-3">{g.title}</h4>
            <ul className="space-y-2">
              {g.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-muted hover:text-brand-700">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  )
}
