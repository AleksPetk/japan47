import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingState } from './AsyncState'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingState />
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}
