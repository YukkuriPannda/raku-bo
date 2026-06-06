import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/auth'

const FALLBACK_APP_CALLBACK = 'rakubo://auth/callback'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // モバイルアプリからのアクセス → app_redirect パラメータのスキームにリダイレクト
    // Expo Go:    exp://IP:PORT/--/auth/callback
    // Standalone: rakubo://auth/callback
    if (window.location.hostname !== 'localhost') {
      const params = new URLSearchParams(window.location.search)
      const appRedirect = params.get('app_redirect') ?? FALLBACK_APP_CALLBACK
      params.delete('app_redirect')
      const restSearch = params.toString() ? '?' + params.toString() : ''
      const hash = window.location.hash
      window.location.href = appRedirect + restSearch + hash
      return
    }

    // Web アプリの通常認証フロー（localhost）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/', { replace: true })
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/', { replace: true })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">ログイン中...</p>
    </div>
  )
}
