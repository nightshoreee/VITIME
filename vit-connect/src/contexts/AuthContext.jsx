import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isVitEmail } from '../lib/utils'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (sess) => {
    if (!sess) { setProfile(null); setIsAdmin(false); return }
    const { data: adm } = await supabase.rpc('is_admin')   // decided by the database, not the client
    setIsAdmin(!!adm)
    if (adm) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', sess.user.id).maybeSingle()
    setProfile(data)
    supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', sess.user.id).then(() => {})
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      load(data.session).finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      setTimeout(() => load(s), 0)   // never call supabase inside the callback synchronously
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const value = useMemo(() => ({
    session, user: session?.user ?? null, profile, isAdmin, loading,
    refreshProfile: () => load(session),
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) throw error
      return data
    },
    signUp: async (f) => {
      if (!isVitEmail(f.email)) throw new Error('Only @vitstudent.ac.in email addresses can register.')
      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim().toLowerCase(), password: f.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { full_name: f.full_name.trim(), username: f.username.trim().toLowerCase(), reg_no: f.reg_no.trim().toUpperCase(), gender: f.gender, dob: f.dob },
        },
      })
      if (error) throw error
      return data
    },
    signOut: async () => { await supabase.auth.signOut() },
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` }),
    updatePassword: async (password) => { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error },
  }), [session, profile, isAdmin, loading, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
