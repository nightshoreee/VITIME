import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { uploadImage, removeImages } from '../lib/storage'
import { friendlyError, validateImage } from '../lib/utils'
import { Field, ImagePicker, Spinner } from '../components/ui'

export default function NewPost() {
  const { user } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const { data: count } = useAsync(async () => (await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id)).count || 0, [user.id])
  const full = count != null && count >= 5

  const submit = async (e) => {
    e.preventDefault()
    const v = validateImage(file); if (v) return setErr(v)
    setBusy(true); setErr('')
    let path
    try {
      path = await uploadImage('posts', user.id, file)
      const { error } = await supabase.from('posts').insert({ user_id: user.id, image_path: path, caption: caption.trim() })   // limit enforced by DB trigger
      if (error) throw error
      toast('Posted!'); nav('/profile')
    } catch (ex) { if (path) await removeImages('posts', [path]); setErr(friendlyError(ex)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-extrabold">New post</h1>
      <p className="text-sm text-slate-500">{count == null ? '' : full ? 'You have used all 5 slots. Delete a post to add a new one.' : `${5 - count} of 5 slots left. Images only.`}</p>
      <ImagePicker label="Photo" file={file} onChange={(f) => { setFile(f); setErr(f ? validateImage(f) || '' : '') }} error={err} />
      <Field label="Caption"><textarea className="input" rows={3} maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Say something about this photo" /></Field>
      <button className="btn-primary w-full" disabled={busy || full || !file}>{busy ? <Spinner /> : 'Share post'}</button>
    </form>
  )
}
