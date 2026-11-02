import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, ShieldCheck, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { friendlyError, inr } from '../lib/utils'
import { Badge, ErrorBox, Field, PageLoader } from '../components/ui'

export default function Boost() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const [days, setDays] = useState(null)
  const [busy, setBusy] = useState(false)
  const [utr, setUtr] = useState('')

  const { data, loading, error, reload } = useAsync(async () => {
    const [ev, st, rq] = await Promise.all([
      supabase.from('events').select('id,title,organizer_id').eq('id', id).maybeSingle(),
      supabase.from('app_settings').select('key,value'),
      supabase.from('boost_requests').select('*').eq('event_id', id).order('created_at', { ascending: false }),
    ])
    if (ev.error) throw ev.error
    const s = Object.fromEntries((st.data || []).map((r) => [r.key, r.value]))
    return { ev: ev.data, upi: s.upi, plans: s.boost_plans || [], reqs: rq.data || [] }
  }, [id])

  if (loading) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data.ev || data.ev.organizer_id !== user.id) return <ErrorBox error={{ message: 'Only the organizer can boost this event.' }} />
  const { ev, upi, plans, reqs } = data
  const pending = reqs.find((r) => r.status === 'pending')
  const now = new Date()
  const active = reqs.find((r) => r.status === 'approved' && new Date(r.starts_at) <= now && new Date(r.ends_at) > now)
  const plan = plans.find((p) => p.days === days)
  const upiLink = (r) => `upi://pay?pa=${encodeURIComponent(upi?.id || '')}&pn=${encodeURIComponent(upi?.name || '')}&am=${r.amount}&cu=INR&tn=${encodeURIComponent(r.reference)}`

  const create = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('request_boost', { p_event: id, p_days: days })
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    toast('Payment request created'); reload()
  }
  const submitUtr = async () => {
    if (!/^[0-9A-Za-z]{6,30}$/.test(utr.trim())) return toast('Enter the UPI transaction ID (6–30 letters/numbers).', 'error')
    const { error } = await supabase.from('boost_requests').update({ payer_utr: utr.trim() }).eq('id', pending.id)
    if (error) return toast(friendlyError(error), 'error')
    toast('Transaction ID saved. The admin will verify it.'); setUtr(''); reload()
  }
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast('Copied'))

  return (
    <div className="space-y-5">
      <div><Link to={`/events/${id}`} className="text-sm font-bold text-brand-600">← {ev.title}</Link><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold"><Zap className="text-sun-500" /> Boost this event</h1>
        <p className="text-sm text-slate-500">Boosted events appear above regular events on Home and Events, labelled “Boosted · Sponsored”.</p></div>

      {active && <div className="card border-l-4 border-l-sun-500 p-4 text-sm"><Badge tone="sun">Active</Badge> <span className="ml-2 font-bold">Boosted until {new Date(active.ends_at).toLocaleString()}</span></div>}

      {!pending ? (
        <section className="card space-y-3 p-4">
          <h2 className="font-extrabold">1. Choose a duration</h2>
          <div className="grid grid-cols-3 gap-2">{plans.map((p) => (
            <button key={p.days} onClick={() => setDays(p.days)} aria-pressed={days === p.days} className={`rounded-2xl p-3 text-center ring-1 transition ${days === p.days ? 'bg-ink text-white ring-ink' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
              <span className="block text-lg font-extrabold">{p.days}d</span><span className="text-sm font-bold">{inr(p.price)}</span></button>))}</div>
          {plan && <p className="text-sm">You will pay <b>{inr(plan.price)}</b> for {plan.days} day{plan.days > 1 ? 's' : ''}.</p>}
          <button className="btn-brand w-full" disabled={!plan || busy} onClick={create}>Create payment request</button>
        </section>
      ) : (
        <section className="card space-y-4 p-4">
          <div className="flex items-center justify-between"><h2 className="font-extrabold">2. Pay via UPI</h2><Badge tone="sun">Awaiting payment verification</Badge></div>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><QRCodeSVG value={upiLink(pending)} size={168} /></div>
            <dl className="w-full space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="font-extrabold">{inr(pending.amount)}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-500">UPI ID</dt><dd className="flex items-center gap-1.5 font-extrabold">{upi?.id}<button onClick={() => copy(upi?.id)} aria-label="Copy UPI ID"><Copy size={14} /></button></dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Pay to</dt><dd className="font-bold">{upi?.name}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-500">Payment reference</dt><dd className="flex items-center gap-1.5 font-extrabold">{pending.reference}<button onClick={() => copy(pending.reference)} aria-label="Copy reference"><Copy size={14} /></button></dd></div>
            </dl>
          </div>
          <p className="text-xs text-slate-500">Put the reference in the UPI note. On mobile you can also <a className="font-bold text-brand-600" href={upiLink(pending)}>open your UPI app</a>.</p>
          <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-700"><ShieldCheck size={16} className="mt-0.5 shrink-0" />
            Payments are not verified automatically. The admin checks the payment in the bank account and approves it. Your boost starts only after approval, never from a screenshot.</div>
          <Field label="UPI transaction ID (UTR)" hint={pending.payer_utr ? `Submitted: ${pending.payer_utr}` : 'After paying, enter the transaction ID to help the admin match it.'}>
            <div className="flex gap-2"><input className="input" value={utr} onChange={(e) => setUtr(e.target.value)} maxLength={30} placeholder="e.g. 412345678901" /><button className="btn-primary" onClick={submitUtr}>Save</button></div></Field>
        </section>
      )}

      {reqs.length > 0 && (
        <section><h2 className="mb-2 font-extrabold">Your requests</h2>
          <ul className="space-y-2">{reqs.map((r) => (
            <li key={r.id} className="card flex items-center justify-between p-3.5 text-sm">
              <div><p className="font-extrabold">{r.reference} · {r.plan_days}d · {inr(r.amount)}</p><p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}{r.ends_at ? ` · ends ${new Date(r.ends_at).toLocaleDateString()}` : ''}{r.admin_note ? ` · ${r.admin_note}` : ''}</p></div>
              <Badge tone={r.status === 'approved' ? 'mint' : r.status === 'rejected' ? 'rose' : 'sun'}>{r.status === 'approved' && r.ends_at && new Date(r.ends_at) < now ? 'expired' : r.status}</Badge>
            </li>))}</ul></section>)}
    </div>
  )
}
