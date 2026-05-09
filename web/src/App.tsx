import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/auth'
import { useAppStore } from './store'
import Layout from './components/Layout'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import History from './pages/History'
import Shifts from './pages/Shifts'
import Points from './pages/Points'
import Camera from './pages/Camera'
import Confirm from './pages/Confirm'
import ManualEntry from './pages/ManualEntry'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const { setUser } = useAppStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          googleAccessToken: (session as { provider_token?: string | null }).provider_token ?? '',
        })
        setAuthenticated(true)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          googleAccessToken: (session as { provider_token?: string | null }).provider_token ?? '',
        })
        setAuthenticated(true)
      } else {
        setUser(null)
        setAuthenticated(false)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<Home />} />
          <Route path="history" element={<History />} />
          <Route path="shifts" element={<Shifts />} />
          <Route path="points" element={<Points />} />
          <Route path="camera" element={<Camera />} />
          <Route path="confirm" element={<Confirm />} />
          <Route path="manual-entry" element={<ManualEntry />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
