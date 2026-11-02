import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configured = Boolean(url && key)

// Only the public anon key is used in the browser. Security is enforced by RLS in the database.
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const publicUrl = (bucket, path) =>
  path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null
