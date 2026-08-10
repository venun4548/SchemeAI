import { useState, useEffect } from 'react'
import { api, fmtDate } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function Profile() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  
  const [profile, setProfile] = useState(null)
  const [completeness, setCompleteness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const [formData, setFormData] = useState({
    state: '',
    district: '',
    occupation: '',
    education: '',
    annual_income: '',
  })

  useEffect(() => {
    async function load() {
      try {
        const [profData, compData] = await Promise.all([
          api.get('/profile'),
          api.get('/profile/completeness')
        ])
        setProfile(profData)
        setCompleteness(compData)
        setFormData({
          state: profData.state || '',
          district: profData.district || '',
          occupation: profData.occupation || '',
          education: profData.education || '',
          annual_income: profData.annual_income || '',
        })
      } catch (err) {
        toast.error('Failed to load profile details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.citizen_id)
    toast.info('Citizen ID copied to clipboard!')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await api.put('/profile', {
        ...formData,
        annual_income: formData.annual_income ? Number(formData.annual_income) : null
      })
      setProfile(updated)
      
      const compData = await api.get('/profile/completeness')
      setCompleteness(compData)
      
      toast.success('Profile updated successfully')
      setEditMode(false)
    } catch (err) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted">Loading profile...</div>

  const pct = completeness ? Math.round(completeness.score * 100) : 0

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Profile</h1>
          <p className="text-muted">Manage your personal information and preferences.</p>
        </div>
        {!editMode && (
          <button onClick={() => setEditMode(true)} className="btn-secondary">
            Edit Profile
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="card text-center p-6 bg-gradient-to-br from-brand-50 to-white">
            <div className="h-20 w-20 mx-auto rounded-full bg-brand flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-sm">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : '👤'}
            </div>
            <h2 className="text-xl font-bold text-ink mb-1">{user.full_name}</h2>
            <div className="text-sm text-muted mb-4">{user.email}</div>
            
            <div className="bg-white p-3 rounded-lg border border-line shadow-sm text-left">
              <div className="text-xs font-semibold text-muted mb-1">SCHEMEAI CITIZEN ID</div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-brand-700 font-bold bg-brand-50 px-2 py-1 rounded">{user.citizen_id}</code>
                <button onClick={handleCopyId} className="text-brand-600 hover:text-brand-800 text-sm font-medium" title="Copy to clipboard">
                  Copy
                </button>
              </div>
            </div>
          </div>

          {completeness && (
            <div className="card p-5">
              <h3 className="font-bold text-ink text-sm mb-3">PROFILE COMPLETION</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink">{pct}% Complete</span>
              </div>
              <div className="w-full bg-line rounded-full h-2.5 mb-4 overflow-hidden">
                <div className="bg-brand h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
              </div>
              
              {completeness.missing_fields && completeness.missing_fields.length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-2">Missing information:</p>
                  <ul className="text-sm text-ink space-y-1">
                    {completeness.missing_fields.slice(0, 3).map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {f.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                  {!editMode && (
                    <button onClick={() => setEditMode(true)} className="text-brand-600 text-sm font-medium mt-3 hover:underline">
                      Complete Profile &rarr;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-ink text-sm">ACCOUNT DETAILS</h3>
            <div>
              <div className="text-xs text-muted">Created</div>
              <div className="text-sm font-medium">{fmtDate(user.created_at)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Status</div>
              <div className="text-sm font-medium flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                {user.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-ink mb-6">Personal Information</h2>
            
            {editMode ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" className="input bg-cream cursor-not-allowed opacity-70" value={user.full_name} disabled title="Contact support to change name" />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="input bg-cream cursor-not-allowed opacity-70" value={user.email} disabled />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input type="text" className="input" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>District</label>
                    <input type="text" className="input" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Occupation</label>
                    <select className="input" value={formData.occupation} onChange={e => setFormData({...formData, occupation: e.target.value})}>
                      <option value="">Select occupation</option>
                      <option value="farmer">Farmer</option>
                      <option value="student">Student</option>
                      <option value="employee">Salaried Employee</option>
                      <option value="self-employed">Self Employed / Business</option>
                      <option value="unemployed">Unemployed</option>
                      <option value="retired">Retired</option>
                      <option value="housewife">Homemaker</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Education</label>
                    <select className="input" value={formData.education} onChange={e => setFormData({...formData, education: e.target.value})}>
                      <option value="">Select education</option>
                      <option value="none">No formal education</option>
                      <option value="primary">Primary School</option>
                      <option value="secondary">Secondary School</option>
                      <option value="hs">Higher Secondary (10+2)</option>
                      <option value="graduate">Graduate</option>
                      <option value="postgraduate">Post-Graduate</option>
                      <option value="diploma">Diploma / ITI</option>
                    </select>
                  </div>
                  <div className="form-group sm:col-span-2">
                    <label>Annual Income (₹)</label>
                    <input type="number" className="input" placeholder="e.g. 250000" value={formData.annual_income} onChange={e => setFormData({...formData, annual_income: e.target.value})} />
                  </div>
                </div>
                
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-line mt-6">
                  <button type="button" onClick={() => setEditMode(false)} className="btn-ghost">Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <div className="text-xs text-muted mb-1 uppercase font-semibold tracking-wider">State</div>
                    <div className="font-medium text-ink">{profile?.state || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1 uppercase font-semibold tracking-wider">District</div>
                    <div className="font-medium text-ink">{profile?.district || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1 uppercase font-semibold tracking-wider">Occupation</div>
                    <div className="font-medium text-ink capitalize">{profile?.occupation || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1 uppercase font-semibold tracking-wider">Education</div>
                    <div className="font-medium text-ink capitalize">{profile?.education || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1 uppercase font-semibold tracking-wider">Annual Income</div>
                    <div className="font-medium text-ink">{profile?.annual_income ? `₹${profile.annual_income.toLocaleString('en-IN')}` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1 uppercase font-semibold tracking-wider">Phone</div>
                    <div className="font-medium text-ink">{user.phone || '—'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
