import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Safe diagnostics only - never log key material or tokens.
console.log('[Stocko] Supabase URL configured:', !!supabaseUrl)
console.log('[Stocko] Supabase public key configured:', !!supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Stocko] Missing Supabase environment variables')
  throw new Error(
    'supabaseUrl and supabaseAnonKey are required. Check your .env / build env.'
  )
}

// Browser singleton. Vite HMR can re-evaluate this module; reuse the same
// client on window so we never stack multiple GoTrue auto-refresh loops.
const globalKey = '__stocko_supabase_client__'
const existing =
  typeof window !== 'undefined' ? window[globalKey] : null

export const supabase =
  existing ||
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

if (typeof window !== 'undefined') {
  window[globalKey] = supabase
}

console.log('[Stocko] Supabase client ready (singleton)')
