import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export async function ensureSupabaseSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const expiresSoon = !data.session?.expires_at || data.session.expires_at * 1000 <= Date.now() + 30_000
  if (!expiresSoon && data.session) return data.session

  const refreshed = await supabase.auth.refreshSession()
  if (refreshed.error) throw refreshed.error
  if (!refreshed.data.session) throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요.')
  return refreshed.data.session
}
