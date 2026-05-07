import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const isMisconfigured =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

if (isMisconfigured) {
  console.warn('Missing Supabase env vars. Copy .env.example to .env and fill in values.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes:
        'openid email profile https://www.googleapis.com/auth/calendar.readonly',
    },
  })
  if (error) throw error
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const getSession = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export const getGoogleAccessToken = (session: { provider_token?: string | null } | null): string | null => {
  return session?.provider_token ?? null
}
