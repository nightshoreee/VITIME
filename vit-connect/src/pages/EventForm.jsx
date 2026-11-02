import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, publicUrl } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { CATEGORIES } from '../lib/constants'
import { friendlyError, validateImage } from '../lib/utils'
import { removeImages, uploadImage } from '../lib/storage'
import { ErrorBox, Field, ImagePicker, PageLoader, Spinner } from '../components/ui'

const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }

export default function EventForm() {
  const { id } = useParams()
  const editing = !!id
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [f, setF] = useState({ title: '', location: '', description: '', category: 'Other', event_date: '', start_time: '', end_time: '', deadline: '', max: '' })
  const [files, setFiles] = useState([null, null])
  const [existing, setExisting] = useState(['', ''])
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const [orig, setOrig] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const reg = useAsync(async () => (await supabase.from('profile_private').select('reg_no').eq('id', user.id).single()).data?.reg_no, [user.id])
  const loaded = useAsync(async () => {
    if (!editing) return null
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single()
    if (error) throw error
    return data
  }, [id])

  useEffect(() => {
    const e = loaded.data
    if (!e) return
    if (e.organizer_id !== user.id) { toast('Only the organizer can edit this event.', 'error'); nav(`/events/${id}`); return }
    setOrig(e)
    setF({ title: e.title, location: e.location, description: e.description, category: e.category, event_date: e.event_date, start_time: e.start_time.slice(0, 5), end_time: e.end_time.slice(0, 5), deadline: toLocalInput(e.registration_deadline), max: e.max_participants ?? '' })
    setExisting([publicUrl('events', e.image1_path), publicUrl('events', e.image2_path)])
  }, [loaded.data]) // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault()
    const v = {}
    if (f.title.trim().length < 3) v.title = 'Event name needs at least 3 characters.'
    if (f.location.trim().length < 2) v.location = 'Enter a location.'
    if (f.description.trim().length < 10) v.description = 'Write at least 10 characters.'
    if (!f.event_date) v.event_date = 'Pick a date.'
    if (!f.start_time) v.start_time = 'Pick a start time.'
    if (!f.end_time || f.end_time <= f.start_time) v.end_time = 'End time must be after the start time.'
    if (f.deadline && f.event_date && new Date(f.deadline) > new Date(`${f.event_date}T${f.end_time || '23:59'}`)) v.deadline = 'Deadline must be before the event ends.'
    if (f.max !== '' && !(Number(f.max) >= 1)) v.max = 'Enter a number of 1 or more.'
    files.forEach((file, i) => { if (file) { const m = validateImage(file); if (m) v[`img${i}`] = m } else if (!editing) v[`img${i}`] = 'Image required.' })
    setErrs(v)
    if (Object.keys(v).length) return
    setBusy(true)
    const uploaded = []
    try {
      const paths = [orig?.image1_path, orig?.image2_path]
      for (let i = 0; i < 2; i++) if (files[i]) { const p = await uploadImage('events', user.id, files[i]); uploaded.push(p); paths[i] = p }
      const row = { title: f.title.trim(), location: f.location.trim(), description: f.description.trim(), category: f.category, event_date: f.event_date, start_time: f.start_time, end_time: f.end_time,
        registration_deadline: f.deadline ? new Date(f.deadline).toISOString() : null, max_participants: f.max === '' ? null : Number(f.max), image1_path: paths[0], image2_path: paths[1] }
      let eventId = id
      if (editing) { const { error } = await supabase.from('events').update(row).eq('id', id); if (error) throw error
        await removeImages('events', [files[0] && orig.image1_path, files[1] && orig.image2_path]) }
      else { const { data, error } = await supabase.from('events').insert({ ...row, organizer_id: user.id, host_name: profile.full_name, host_reg_no: reg.data || '' }).select('id').single(); if (error) throw error; eventId = data.id }
      toast(editing ? 'Event updated' : 'Event created'); nav(`/events/${eventId}`)
    } catch (ex) { await removeImages('events', uploaded); toast(friendlyError(ex), 'error') } finally { setBusy(false) }
  }

  if (loaded.loading || reg.loading) return <PageLoader />
  if (loaded.error) return <ErrorBox error={loaded.error} onRetry={loaded.reload} />
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="text-2xl font-extrabold">{editing ? 'Edit event' : 'Host an event'}</h1>
      <Field label="Event name" error={errs.title}><input className="input" maxLength={100} value={f.title} onChange={set('title')} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Host name" hint="Filled from your profile"><input className="input bg-slate-100" value={editing ? orig?.host_name || '' : profile.full_name} readOnly /></Field>
        <Field label="Host registration number" hint="Filled from your profile"><input className="input bg-slate-100" value={editing ? orig?.host_reg_no || '' : reg.data || ''} readOnly /></Field>
      </div>
      <Field label="Location" error={errs.location}><input className="input" maxLength={150} value={f.location} onChange={set('location')} placeholder="e.g. Anna Auditorium" /></Field>
      <Field label="Short description" error={errs.description}><textarea className="input" rows={4} maxLength={500} value={f.description} onChange={set('description')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <ImagePicker label="Image 1 (event / product)" file={files[0]} existingUrl={existing[0]} error={errs.img0} onChange={(x) => setFiles([x, files[1]])} />
        <ImagePicker label="Image 2 (event / product)" file={files[1]} existingUrl={existing[1]} error={errs.img1} onChange={(x) => setFiles([files[0], x])} />
      </div>
      <div className="card space-y-3 p-4">
        <p className="text-sm font-extrabold">Schedule & registration</p>
        <Field label="Category"><select className="input" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date" error={errs.event_date}><input className="input" type="date" value={f.event_date} onChange={set('event_date')} /></Field>
          <Field label="Start" error={errs.start_time}><input className="input" type="time" value={f.start_time} onChange={set('start_time')} /></Field>
          <Field label="End" error={errs.end_time}><input className="input" type="time" value={f.end_time} onChange={set('end_time')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Registration deadline" error={errs.deadline} hint="Optional"><input className="input" type="datetime-local" value={f.deadline} onChange={set('deadline')} /></Field>
          <Field label="Participant limit" error={errs.max} hint="Optional"><input className="input" type="number" min="1" value={f.max} onChange={set('max')} /></Field>
        </div>
      </div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : editing ? 'Save changes' : 'Publish event'}</button>
    </form>
  )
}
