import { useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'

export default function ApplicationReadiness({ app, scheme, onPortalOpen }) {
  const [opening, setOpening] = useState(false)
  const toast = useToast()
  
  const portalUrl = scheme?.application_portal || app?.qr_payload?.portal_url
  
  async function handleOpenPortal() {
    if (!portalUrl) {
      toast.error("Official portal URL is not available for this scheme.")
      return
    }
    setOpening(true)
    try {
      await api.post('/applications/read_official', { scheme_id: scheme?.id || app?.scheme_id })
      window.open(portalUrl, '_blank')
      if (onPortalOpen) onPortalOpen()
    } catch (e) {
      toast.error("Could not log portal exit: " + e.message)
    } finally {
      setOpening(false)
    }
  }

  const score = app?.eligibility_score || 0
  const docsOk = app?.document_ids?.length > 0 || (scheme?.required_documents?.length === 0)
  const profileOk = score > 40
  
  const allReady = profileOk && docsOk

  return (
    <div className="card p-6 border-2 border-brand-200">
      <h3 className="font-bold text-ink mb-4 text-lg">Application Readiness</h3>
      
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-3">
          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${profileOk ? 'bg-brand' : 'bg-red-500'}`}>
            {profileOk ? '✓' : '!'}
          </span>
          <span className="text-sm font-semibold text-ink">Profile Eligibility (Score: {score}%)</span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${docsOk ? 'bg-brand' : 'bg-red-500'}`}>
            {docsOk ? '✓' : '!'}
          </span>
          <span className="text-sm font-semibold text-ink">Required Documents Ready</span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">✓</span>
          <span className="text-sm font-semibold text-ink">Identity Verification (Citizen ID)</span>
        </div>
      </div>
      
      {allReady ? (
        <div className="bg-brand-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-brand-800 font-medium">
            You meet the primary criteria for this scheme. You can proceed to the official government portal to submit your final application.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 p-4 rounded-lg mb-6 border border-amber-200">
          <p className="text-sm text-amber-800 font-medium">
            Your profile or documents are incomplete. Proceeding may result in application rejection.
          </p>
        </div>
      )}

      <button 
        onClick={handleOpenPortal} 
        disabled={opening}
        className={`w-full !py-3 ${allReady ? 'btn-primary' : 'btn-secondary'}`}
      >
        {opening ? 'Opening Portal...' : 'Open Official Application Portal'}
      </button>
      <p className="text-xs text-muted mt-3 text-center">
        This will open the external official portal in a new tab. We will log this action for your tracking timeline.
      </p>
    </div>
  )
}
