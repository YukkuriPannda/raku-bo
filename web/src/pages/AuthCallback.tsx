import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/auth'

const EXPO_CALLBACK = 'rakubo://auth/callback'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // モバイルブラウザからのアクセス（IPアドレス経由）→ Expo Go にリダイレクト
    if (window.location.hostname !== 'localhost') {
      const hash = window.location.hash
      const search = window.location.search
      window.location.href = EXPO_CALLBACK + search + hash
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
