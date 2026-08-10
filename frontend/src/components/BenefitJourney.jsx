import { Link } from 'react-router-dom'

const STAGES = [
  { key: 'profile_created', label: 'CREATE PROFILE', to: '/profile' },
  { key: 'needs_identified', label: 'UNDERSTAND NEEDS', to: '/questionnaire' },
  { key: 'schemes_discovered', label: 'DISCOVER SCHEMES', to: '/recommendations' },
  { key: 'eligibility_checked', label: 'CHECK ELIGIBILITY', to: '/eligibility' },
  { key: 'eligibility_explained', label: 'UNDERSTAND WHY', to: '/eligibility' },
  { key: 'documents_checked', label: 'CHECK DOCUMENTS', to: '/documents' },
  { key: 'application_ready', label: 'APPLICATION READY', to: '/applications' },
  { key: 'official_application', label: 'OFFICIAL APPLICATION', to: '/applications' },
  { key: 'track_status', label: 'TRACK STATUS', to: '/applications' },
  { key: 'support', label: 'GET SUPPORT', to: '/help' },
  { key: 'notifications', label: 'RECEIVE NOTIFICATIONS', to: '/notifications' },
]

export default function BenefitJourney({ journey, currentStage }) {
  if (!journey) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-line">
        <h3 className="font-bold text-ink text-lg">MY BENEFIT JOURNEY</h3>
        <p className="text-xs text-brand-700 font-semibold mt-1 uppercase tracking-wider">
          CURRENT STAGE: {currentStage}
        </p>
      </div>
      <div className="p-5 flex flex-col gap-3">
        {STAGES.map((s, i) => {
          const isDone = journey[s.key]
          const isCurrent = s.label === currentStage
          
          let icon = <span className="h-5 w-5 rounded-full border-2 border-slate-300 bg-white shrink-0" /> // pending
          if (isDone) {
            icon = (
              <span className="h-5 w-5 rounded-full bg-brand flex items-center justify-center shrink-0 text-white font-bold text-xs">
                ✓
              </span>
            )
          } else if (isCurrent) {
            icon = (
              <span className="h-5 w-5 rounded-full border-4 border-brand bg-white shrink-0 shadow-sm" />
            )
          }

          return (
            <Link key={s.key} to={s.to} className="flex items-center gap-3 group relative pl-1">
              {i < STAGES.length - 1 && (
                <div className={`absolute top-6 left-[13px] w-[2px] h-4 ${isDone ? 'bg-brand' : 'bg-slate-200'}`} />
              )}
              {icon}
              <span className={`text-sm font-semibold tracking-wide ${isDone ? 'text-ink' : (isCurrent ? 'text-brand-700' : 'text-slate-400')}`}>
                {s.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
