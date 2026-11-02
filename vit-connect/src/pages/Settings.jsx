import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogOut, Trash2, UserCog } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { removeAllUserFiles } from '../lib/storage'
import { friendlyError } from '../lib/utils'
import { Avatar, Field, Modal, Toggle } from '../components/ui'

const PREFS = [['likes', 'Likes'], ['comments', 'Comments'], ['follows', 'New followers'], ['events', 'Event registrations & updates'], ['messages', 'Messages']]

export default function Settings() {
  const { user, profile, signOut, resetPassword, updatePassword, refreshProfile } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [del, setDel] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const blocked = useAsync(async () => (await supabase.from('blocks').select('blocked_id, p:profiles!blocked_id(username,full_name,avatar_path)').eq('blocker_id', user.id)).data || [], [user.id])
  const prefs = profile.notif_prefs || {}
  const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission

  const setPref = async (k, v) => {
    const { error } = await supabase.from('profiles').update({ notif_prefs: { ...prefs, [k]: v } }).eq('id', user.id)
    if (error) toast(friendlyError(error), 'error'); else refreshProfile()
  }
  const setVis = async (v) => { const { error } = await supabase.from('profiles').update({ show_interests: v }).eq('id', user.id); if (error) toast(friendlyError(error), 'error'); else refreshProfile() }
  const changePw = async (e) => { e.preventDefault(); if (pw.length < 8) return toast('Use at least 8 characters.', 'error'); try { await updatePassword(pw); setPw(''); toast('Password updated') } catch (x) { toast(friendlyError(x), 'error') } }
  const unblock = async (id) => { await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', id); blocked.reload() }
  const askPush = async () => { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Browser alerts enabled (while the app is open).' : 'Permission not granted.', r === 'granted' ? 'success' : 'error') }
  const deleteAccount = async () => {
    setBusy(true)
    try {
      await removeAllUserFiles(user.id)
      const { error } = await supabase.rpc('delete_my_account'); if (error) throw error
      await signOut(); toast('Account deleted'); nav('/login')
    } catch (e) { toast(friendlyError(e), 'error') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Settings</h1>
      <Link to="/profile/edit" className="card flex items-center gap-3 p-4"><UserCog className="text-brand-600" /><span className="font-extrabold">Edit profile</span></Link>

      <section className="card divide-y divide-slate-100 px-4"><h2 className="py-3 font-extrabold">Privacy</h2>
        <Toggle label="Show interests on my profile" checked={profile.show_interests} onChange={setVis} />
        <div className="py-3"><p className="mb-2 text-sm font-bold">Blocked users</p>
          {blocked.data?.length ? <ul className="space-y-2">{blocked.data.map((b) => <li key={b.blocked_id} className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><Avatar path={b.p?.avatar_path} name={b.p?.full_name} size={28} />@{b.p?.username}</span><button className="text-xs font-bold text-brand-600" onClick={() => unblock(b.blocked_id)}>Unblock</button></li>)}</ul> : <p className="text-xs text-slate-400">You have not blocked anyone.</p>}</div></section>

      <section className="card divide-y divide-slate-100 px-4"><h2 className="py-3 font-extrabold">Notifications</h2>
        {PREFS.map(([k, l]) => <Toggle key={k} label={l} checked={prefs[k] !== false} onChange={(v) => setPref(k, v)} />)}
        <div className="py-3 text-sm"><p className="font-bold">Browser alerts</p>
          <p className="mb-2 text-xs text-slate-500">Shown while the app is open in a background tab. Installed-app push needs extra server setup and is not enabled.</p>
          {perm === 'unsupported' ? <p className="text-xs text-slate-400">Not supported on this browser.</p> : perm === 'granted' ? <p className="text-xs font-bold text-mint-600">Enabled</p> : perm === 'denied' ? <p className="text-xs text-slate-400">Blocked in browser settings.</p> : <button className="btn-ghost" onClick={askPush}>Enable browser alerts</button>}</div></section>

      <section className="card space-y-3 p-4"><h2 className="font-extrabold">Account</h2>
        <p className="text-sm text-slate-500">{user.email}</p>
        <form onSubmit={changePw} className="flex gap-2"><input className="input" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password" /><button className="btn-primary">Update</button></form>
        <button className="btn-ghost" onClick={async () => { const { error } = await resetPassword(user.email); toast(error ? friendlyError(error) : 'Reset link sent to your email', error ? 'error' : 'success') }}>Email me a reset link</button>
        <div className="flex flex-wrap gap-2 pt-2">
          <button className="btn-ghost" onClick={async () => { await signOut(); nav('/login') }}><LogOut size={16} /> Log out</button>
          <button className="btn-ghost text-rose-600" onClick={() => setDel(true)}><Trash2 size={16} /> Delete account</button></div></section>

      <Modal open={del} onClose={() => setDel(false)} title="Delete account">
        <p className="text-sm text-slate-600">This permanently deletes your profile, posts, images, events, messages and registrations. It cannot be undone.</p>
        <div className="mt-3"><Field label="Type DELETE to confirm"><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field></div>
        <button className="btn-danger mt-3 w-full" disabled={confirm !== 'DELETE' || busy} onClick={deleteAccount}>Delete my account</button>
      </Modal>
    </div>
  )
}
