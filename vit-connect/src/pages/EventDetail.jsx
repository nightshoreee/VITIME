import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Clock, Flag, MapPin, MessageCircle, Pencil, Trash2, UserRound, Users, Zap, ShoppingBag, Plus, Hash } from 'lucide-react'
import { supabase, publicUrl } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { eventStatus, fmtDate, fmtTime, friendlyError, inr } from '../lib/utils'
import { removeImages } from '../lib/storage'
import { Avatar, Badge, Carousel, Empty, ErrorBox, Field, Modal, PageLoader } from '../components/ui'
import { StatusBadge } from '../components/EventCard'
import ReportModal from '../components/ReportModal'

export default function EventDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState(false)
  const [prod, setProd] = useState(null)   // product being added/edited

  const { data, loading, error, reload } = useAsync(async () => {
    const [e, a, p] = await Promise.all([
      supabase.from('events_feed').select('*').eq('id', id).maybeSingle(),
      supabase.from('event_attendees').select('user_id, created_at, profile:profiles!user_id(username,full_name,avatar_path)').eq('event_id', id).order('created_at').limit(200),
      supabase.from('products').select('*').eq('event_id', id).order('created_at'),
    ])
    if (e.error) throw e.error
    return { ev: e.data, attendees: a.data || [], products: p.data || [] }
  }, [id])

  if (loading) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data.ev) return <Empty icon={CalendarDays} title="Event not found" text="It may have been removed by the organizer." action={<Link className="btn-brand mt-2" to="/events">Browse events</Link>} />

  const { ev, attendees, products } = data
  const owner = ev.organizer_id === user.id
  const joined = attendees.some((a) => a.user_id === user.id)
  const status = eventStatus(ev)
  const full = ev.max_participants && ev.attendee_count >= ev.max_participants
  const closed = ev.registration_deadline && new Date() > new Date(ev.registration_deadline)
  const canJoin = status !== 'completed' && !closed && !full

  const act = async (fn, okMsg) => {
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    if (okMsg) toast(okMsg)
    reload()
  }
  const rsvp = () => act(() => supabase.from('event_attendees').insert({ event_id: id, user_id: user.id }), 'You are registered!')
  const cancel = () => act(() => supabase.from('event_attendees').delete().eq('event_id', id).eq('user_id', user.id), 'Registration cancelled')
  const remove = async () => {
    if (!window.confirm('Delete this event permanently? Registrations and products will be removed.')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) return toast(friendlyError(error), 'error')
    await removeImages('events', [ev.image1_path, ev.image2_path]); toast('Event deleted'); nav('/events')
  }
  const saveProduct = async (e) => {
    e.preventDefault()
    const row = { name: prod.name.trim(), price: Number(prod.price), available: prod.available, order_instructions: prod.order_instructions.trim() }
    if (row.name.length < 2 || !(row.price >= 0)) return toast('Enter a product name and a valid price.', 'error')
    const q = prod.id ? supabase.from('products').update(row).eq('id', prod.id) : supabase.from('products').insert({ ...row, event_id: id })
    await act(() => q, 'Product saved'); setProd(null)
  }

  return (
    <div className="space-y-5">
      <Carousel images={[publicUrl('events', ev.image1_path), publicUrl('events', ev.image2_path)]} alt={ev.title} />
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge ev={ev} /><Badge>{ev.category}</Badge>
        {ev.boosted && <span className="inline-flex items-center gap-1 rounded-full bg-sun-500 px-2.5 py-0.5 text-[11px] font-extrabold text-ink"><Zap size={12} /> Boosted · Sponsored</span>}
      </div>
      <h1 className="text-2xl font-extrabold">{ev.title}</h1>
      <div className="card divide-y divide-slate-100 text-sm">
        {[
          [CalendarDays, `${fmtDate(ev.event_date)}`], [Clock, `${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}`], [MapPin, ev.location],
          [UserRound, `Hosted by ${ev.host_name}`], [Hash, `Host reg. no. ${ev.host_reg_no}`],
          [Users, `${ev.attendee_count}${ev.max_participants ? ` / ${ev.max_participants}` : ''} registered${ev.registration_deadline ? ` · register by ${new Date(ev.registration_deadline).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}`],
        ].map(([Icon, text], i) => <p key={i} className="flex items-center gap-3 px-4 py-3"><Icon size={16} className="text-brand-600" /> {text}</p>)}
      </div>
      <p className="whitespace-pre-line text-sm text-slate-700">{ev.description}</p>
      {ev.organizer_username && <p className="text-sm text-slate-500">Organizer: <Link className="font-bold text-brand-600" to={`/u/${ev.organizer_username}`}>@{ev.organizer_username}</Link></p>}

      <div className="flex flex-wrap gap-2">
        {!owner && (joined
          ? <button className="btn-ghost" disabled={busy} onClick={cancel}>Cancel registration</button>
          : <button className="btn-brand" disabled={busy || !canJoin} onClick={rsvp}>{status === 'completed' ? 'Event ended' : closed ? 'Registration closed' : full ? 'Event full' : 'Register / RSVP'}</button>)}
        {(joined || owner) && ev.conversation_id && <Link to={`/chats/${ev.conversation_id}`} className="btn-ghost"><MessageCircle size={16} /> Event chat</Link>}
        {owner && <>
          <Link to={`/events/${id}/edit`} className="btn-ghost"><Pencil size={16} /> Edit</Link>
          {status !== 'completed' && <Link to={`/events/${id}/boost`} className="btn-primary"><Zap size={16} className="text-sun-500" /> Boost</Link>}
          <button className="btn-ghost text-rose-600" onClick={remove}><Trash2 size={16} /> Delete</button>
        </>}
        {!owner && <button className="btn-ghost" onClick={() => setReport(true)} aria-label="Report event"><Flag size={16} /></button>}
      </div>

      <section aria-label="Products">
        <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-lg font-extrabold"><ShoppingBag size={18} /> Products for sale</h2>
          {owner && <button className="btn-ghost !py-1.5" onClick={() => setProd({ name: '', price: '', available: true, order_instructions: '' })}><Plus size={14} /> Add</button>}</div>
        {products.length === 0 ? <p className="text-sm text-slate-400">{owner ? 'Add items you are selling at this event.' : 'No products listed.'}</p> : (
          <ul className="space-y-2">{products.map((p) => (
            <li key={p.id} className="card flex items-start justify-between gap-3 p-3.5">
              <div><p className="font-extrabold">{p.name} <span className="font-bold text-brand-600">{inr(p.price)}</span></p>
                <p className="text-xs text-slate-500">{p.order_instructions || 'Ask the host at the event.'}</p></div>
              <div className="flex flex-col items-end gap-1.5">{p.available ? <Badge tone="mint">Available</Badge> : <Badge tone="rose">Sold out</Badge>}
                {owner && <div className="flex gap-1"><button className="text-xs font-bold text-brand-600" onClick={() => setProd({ ...p })}>Edit</button>
                  <button className="text-xs font-bold text-rose-600" onClick={() => window.confirm('Remove product?') && act(() => supabase.from('products').delete().eq('id', p.id), 'Product removed')}>Remove</button></div>}</div>
            </li>))}</ul>)}
      </section>

      <section aria-label="Participants">
        <h2 className="mb-2 text-lg font-extrabold">Who's going</h2>
        {attendees.length === 0 ? <p className="text-sm text-slate-400">No registrations yet.</p> : (
          <div className="flex flex-wrap gap-2">{attendees.slice(0, 40).map((a) => (
            <Link key={a.user_id} to={`/u/${a.profile?.username}`} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-xs font-bold ring-1 ring-slate-200"><Avatar path={a.profile?.avatar_path} name={a.profile?.full_name} size={26} />{a.profile?.full_name}</Link>))}</div>)}
      </section>

      <Modal open={!!prod} onClose={() => setProd(null)} title={prod?.id ? 'Edit product' : 'Add product'}>
        {prod && <form onSubmit={saveProduct} className="space-y-3">
          <Field label="Product name"><input className="input" maxLength={80} value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} required /></Field>
          <Field label="Price (₹)"><input className="input" type="number" min="0" step="0.01" value={prod.price} onChange={(e) => setProd({ ...prod, price: e.target.value })} required /></Field>
          <Field label="How to order"><textarea className="input" rows={2} maxLength={300} value={prod.order_instructions} onChange={(e) => setProd({ ...prod, order_instructions: e.target.value })} placeholder="e.g. Message me or pay at the stall" /></Field>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={prod.available} onChange={(e) => setProd({ ...prod, available: e.target.checked })} /> Available</label>
          <button className="btn-primary w-full" disabled={busy}>Save product</button></form>}
      </Modal>
      <ReportModal open={report} onClose={() => setReport(false)} targetType="event" targetId={id} />
    </div>
  )
}
