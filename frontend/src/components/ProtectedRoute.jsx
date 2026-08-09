import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'SCHEME_ADMIN',
  'CONTENT_REVIEWER',
  'SUPPORT_AGENT',
  'AI_OPERATIONS',
  'ANALYST'
]

export function ProtectedRoute({ admin = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="Checking session…" />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  
  if (admin && !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <Outlet />
}
