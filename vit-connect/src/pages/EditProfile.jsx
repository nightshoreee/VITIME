import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { GENDERS } from '../lib/constants'
import { friendlyError, USERNAME_RE, validateImage } from '../lib/utils'
import { removeImages, uploadImage } from '../lib/storage'
import { Avatar, Field, PageLoader, Spinner, Toggle } from '../components/ui'

export default function EditProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [f, setF] = useState({ full_name: profile.full_name, username: profile.username, bio: profile.bio || '', interests: (profile.interests || []).join(', '), show_interests: profile.show_interests })
  const [priv, setPriv] = useState({ gender: 'prefer_not_to_say', dob: '', reg_no: '' })
  const [file, setFile] = useState(null)
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const loaded = useAsync(async () => (await supabase.from('profile_private').select('*').eq('id', user.id).single()).data, [user.id])
  useEffect(() => { if (loaded.data) setPriv({ gender: loaded.data.gender, dob: loaded.data.dob || '', reg_no: loaded.data.reg_no }) }, [loaded.data])
  const hadDob = !!loaded.data?.dob

  const save = async (e) => {
    e.preventDefault()
    const v = {}
    if (f.full_name.trim().length < 2) v.full_name = 'Enter your name.'
    if (!USERNAME_RE.test(f.username)) v.username = '3–20 characters: a-z, 0-9, underscore.'
    if (file) { const m = validateImage(file); if (m) v.file = m }
    setErrs(v); if (Object.keys(v).length) return
    setBusy(true)
    let newPath
    try {
      if (file) newPath = await uploadImage('avatars', user.id, file)
      const interests = [...new Set(f.interests.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 15)
      const { error } = await supabase.from('profiles').update({ full_name: f.full_name.trim(), username: f.username, bio: f.bio.trim(), interests, show_interests: f.show_interests, ...(newPath ? { avatar_path: newPath } : {}) }).eq('id', user.id)
      if (error) throw error
      const pv = { gender: priv.gender, ...(!hadDob && priv.dob ? { dob: priv.dob } : {}) }
      const r2 = await supabase.from('profile_private').update(pv).eq('id', user.id)
      if (r2.error) throw r2.error
      if (newPath && profile.avatar_path) await removeImages('avatars', [profile.avatar_path])
      await refreshProfile(); toast('Profile saved'); nav('/profile')
    } catch (ex) { if (newPath) await removeImages('avatars', [newPath]); toast(friendlyError(ex), 'error') } finally { setBusy(false) }
  }
  if (loaded.loading) return <PageLoader />
  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <h1 className="text-2xl font-extrabold">Edit profile</h1>
      <div className="flex items-center gap-4">
        <label className="relative cursor-pointer"><Avatar path={profile.avatar_path} name={f.full_name} size={84} className={file ? 'hidden' : ''} />
          {file && <img src={URL.createObjectURL(file)} alt="New avatar" className="h-[84px] w-[84px] rounded-full object-cover" />}
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-ink text-white"><Camera size={14} /></span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose profile photo" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        {errs.file && <p className="text-xs font-semibold text-rose-600">{errs.file}</p>}
      </div>
      <Field label="Full name" error={errs.full_name}><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="Username" error={errs.username}><input className="input lowercase" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></Field>
      <Field label="Registration number" hint="Private. Shown only as host number on events you create."><input className="input bg-slate-100" value={priv.reg_no} readOnly /></Field>
      <Field label="Bio"><textarea className="input" rows={3} maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
      <Field label="Interests" hint="Comma separated, up to 15"><input className="input" value={f.interests} onChange={(e) => setF({ ...f, interests: e.target.value })} placeholder="music, football, coding" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gender (private)"><select className="input" value={priv.gender} onChange={(e) => setPriv({ ...priv, gender: e.target.value })}>{GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
        <Field label="Date of birth (private)" hint={hadDob ? 'Locked once set' : 'Needed for dating (18+)'}><input className="input" type="date" disabled={hadDob} value={priv.dob} onChange={(e) => setPriv({ ...priv, dob: e.target.value })} /></Field>
      </div>
      <div className="card px-4"><Toggle label="Show my interests on my profile" checked={f.show_interests} onChange={(v) => setF({ ...f, show_interests: v })} /></div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Save changes'}</button>
    </form>
  )
}
