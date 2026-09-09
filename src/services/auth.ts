import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const authConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase: SupabaseClient | null = authConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase authentication is not configured.')
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Supabase authentication is not configured.')
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Supabase authentication is not configured.')
  return supabase.auth.signUp({ email, password })
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}

export function subscribeToAuth(callback: (session: Session | null) => void) {
  if (!supabase) return () => undefined
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}
