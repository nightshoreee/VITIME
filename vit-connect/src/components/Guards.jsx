import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PageLoader } from './ui'
import { ShieldAlert } from 'lucide-react'

export function RequireAuth({ children }) {
  const { session, profile, isAdmin, loading, signOut } = useAuth()
  const loc = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (!profile) return <Notice title="Setting up your profile" text="Your profile was not found. Try signing out and registering again, or contact the admin." onOut={signOut} />
  if (profile.suspended) return <Notice title="Account suspended" text="Your account has been suspended by the moderators. Contact the admin if you think this is a mistake." onOut={signOut} />
  return children
}

export function RequireAdmin({ children }) {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace />
  return children
}

export function PublicOnly({ children }) {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <PageLoader />
  if (session) return <Navigate to={isAdmin ? '/admin' : '/'} replace />
  return children
}

function Notice({ title, text, onOut }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-sm p-6 text-center">
        <ShieldAlert className="mx-auto mb-2 text-rose-600" size={32} />
        <h1 className="text-lg font-extrabold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
        <button className="btn-primary mt-4" onClick={onOut}>Sign out</button>
      </div>
    </div>
  )
}
