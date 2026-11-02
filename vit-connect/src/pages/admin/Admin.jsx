import { useCallback, useEffect, useState } from 'react'
import { BarChart3, CalendarDays, Flag, Image as ImageIcon, LogOut, ScrollText, Settings2, ShieldCheck, Users, Zap } from 'lucide-react'
import { supabase, publicUrl } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { eventStatus, friendlyError, inr, timeAgo } from '../../lib/utils'
import { removeImages } from '../../lib/storage'
import { Avatar, Badge, Empty, ErrorBox, Field, Modal, PageLoader, Pager } from '../../components/ui'

const TABS = [['overview', BarChart3, 'Overview'], ['users', Users, 'Users'], ['posts', ImageIcon, 'Posts'], ['events', CalendarDays, 'Events'], ['boosts', Zap, 'Boosts'], ['reports', Flag, 'Reports'], ['payments', Settings2, 'Payments'], ['audit', ScrollText, 'Audit log']]
const PAGE = 15

export default function Admin() {
  const { signOut } = useAuth()
  const [tab, setTab] = useState('overview')
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4"><p className="flex items-center gap-2 font-extrabold"><ShieldCheck className="text-sun-500" /> Admin dashboard</p>
          <button onClick={signOut} className="flex items-center gap-1.5 text-sm font-bold text-white/80 hover:text-white"><LogOut size={16} /> Sign out</button></div>
        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin sections">
          {TABS.map(([k, Icon, l]) => <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold ${tab === k ? 'bg-white text-ink' : 'text-white/70 hover:bg-white/10'}`}><Icon size={15} />{l}</button>)}</nav>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        {tab === 'overview' && <Overview />}{tab === 'users' && <UsersTab />}{tab === 'posts' && <PostsTab />}{tab === 'events' && <EventsTab />}
        {tab === 'boosts' && <BoostsTab />}{tab === 'reports' && <ReportsTab />}{tab === 'payments' && <PaymentsTab />}{tab === 'audit' && <AuditTab />}
      </main>
    </div>
  )
}

function useModerate(after) {
  const { toast } = useToast()
  return async (action, target, note, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return false
    const { error } = await supabase.rpc('admin_moderate', { p_action: action, p_target: target, p_note: note || null })
    if (error) { toast(friendlyError(error), 'error'); return false }
    toast('Done'); after?.(); return true
  }
}

function Stat({ label, value, sub }) { return <div className="card p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="text-2xl font-extrabold">{value}</p>{sub && <p className="text-xs text-slate-400">{sub}</p>}</div> }

function Overview() {
  const { data: s, loading, error, reload } = useAsync(async () => { const { data, error } = await supabase.rpc('admin_stats'); if (error) throw error; return data }, [])
  if (loading) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const max = Math.max(1, ...s.signups_by_day.map((d) => d.n))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered users" value={s.users} sub={`+${s.new_users_7d} this week`} /><Stat label="Active (7 days)" value={s.active_users_7d} sub={`${s.suspended} suspended`} />
        <Stat label="Posts" value={s.posts} sub={`+${s.posts_7d} this week`} /><Stat label="Events" value={s.events} sub={`${s.upcoming_events} upcoming`} />
        <Stat label="Event registrations" value={s.registrations} /><Stat label="Likes / comments" value={`${s.likes} / ${s.comments}`} sub={`${s.follows} follows`} />
        <Stat label="Messages (7 days)" value={s.messages_7d} sub="count only, never content" /><Stat label="Hangout opt-ins" value={s.hangout_optins} sub={`${s.matches} matches`} />
        <Stat label="Pending boosts" value={s.pending_boosts} sub={`${s.active_boosts} active`} /><Stat label="Approved revenue" value={inr(s.revenue)} /><Stat label="Open reports" value={s.open_reports} />
      </div>
      <div className="card p-4"><p className="mb-3 font-extrabold">Sign-ups, last 14 days</p>
        <div className="flex h-32 items-end gap-1.5">{s.signups_by_day.map((d) => <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.n}`}><div className="w-full rounded-t bg-brand-500" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 4 : 1 }} /><span className="text-[9px] text-slate-400">{d.day.slice(0, 2)}</span></div>)}</div></div>
    </div>)
}

function UsersTab() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(0); const [sel, setSel] = useState(null)
  const { data, loading, error, reload } = useAsync(async () => { const { data, error } = await supabase.rpc('admin_list_users', { p_q: q, p_limit: PAGE, p_offset: page * PAGE }); if (error) throw error; return data }, [q, page])
  const moderate = useModerate(reload)
  const detail = useAsync(async () => {
    if (!sel) return null
    const [a, b] = await Promise.all([
      supabase.from('follows').select('u:profiles!follower_id(username,full_name)').eq('following_id', sel.id),
      supabase.from('follows').select('u:profiles!following_id(username,full_name)').eq('follower_id', sel.id)])
    return { followers: (a.data || []).map((x) => x.u), following: (b.data || []).map((x) => x.u) }
  }, [sel?.id])
  return (
    <div className="space-y-3">
      <input className="input max-w-sm" placeholder="Search name, username or reg. no." value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} aria-label="Search users" />
      {loading && !data ? <PageLoader /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Student', 'Reg. no.', 'Posts', 'Followers', 'Following', 'Hosted / joined', 'Joined', 'Status', ''].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{data.map((u) => (
            <tr key={u.id}><td className="px-3 py-2"><button className="text-left font-extrabold hover:underline" onClick={() => setSel(u)}>{u.full_name}</button><div className="text-xs text-slate-500">@{u.username}</div></td>
              <td className="px-3 py-2">{u.reg_no}</td><td className="px-3 py-2">{u.posts}</td><td className="px-3 py-2">{u.followers}</td><td className="px-3 py-2">{u.following}</td><td className="px-3 py-2">{u.events_hosted} / {u.events_joined}</td>
              <td className="px-3 py-2 text-xs">{timeAgo(u.created_at)}</td><td className="px-3 py-2">{u.suspended ? <Badge tone="rose">Suspended</Badge> : <Badge tone="mint">Active</Badge>}</td>
              <td className="px-3 py-2 text-right">{u.suspended ? <button className="btn-ghost !py-1 !text-xs" onClick={() => moderate('restore_user', u.id)}>Restore</button> : <button className="btn-ghost !py-1 !text-xs text-rose-600" onClick={() => moderate('suspend_user', u.id, null, `Suspend @${u.username}?`)}>Suspend</button>}</td></tr>))}</tbody></table>
          {data.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No users found.</p>}</div>)}
      <Pager page={page} pageSize={PAGE} total={data?.[0]?.total ?? 0} onChange={setPage} />
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.full_name || ''} wide>
        {sel && <div className="space-y-3 text-sm"><p>@{sel.username} · {sel.reg_no} · last seen {timeAgo(sel.last_seen_at)}</p>
          <p>Likes given: <b>{sel.likes_given}</b> · Comments: <b>{sel.comments_made}</b> · Events hosted: <b>{sel.events_hosted}</b> · Events joined: <b>{sel.events_joined}</b></p>
          {detail.loading ? <p>Loading…</p> : <div className="grid gap-3 sm:grid-cols-2">{[['Followers', detail.data?.followers], ['Following', detail.data?.following]].map(([t, l]) => <div key={t}><p className="mb-1 font-extrabold">{t} ({l?.length || 0})</p><ul className="max-h-48 overflow-y-auto text-xs text-slate-600">{(l || []).map((x) => <li key={x.username}>{x.full_name} (@{x.username})</li>)}</ul></div>)}</div>}</div>}
      </Modal>
    </div>)
}

function PostsTab() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(0)
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('posts').select('*, author:profiles!user_id(username,full_name), likes(count), comments(count)', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (q.trim()) query = query.ilike('caption', `%${q.trim().replace(/[%,]/g, '')}%`)
    const { data, count, error } = await query; if (error) throw error
    return { rows: data, count }
  }, [q, page])
  const moderate = useModerate(reload)
  const del = async (p) => { if (await moderate('delete_post', p.id, `@${p.author?.username}`, 'Delete this post and its image?')) removeImages('posts', [p.image_path]) }
  return (
    <div className="space-y-3">
      <input className="input max-w-sm" placeholder="Search captions" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} aria-label="Search posts" />
      {loading && !data ? <PageLoader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.rows.length === 0 ? <Empty icon={ImageIcon} title="No posts" /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{data.rows.map((p) => (
          <div key={p.id} className="card overflow-hidden"><img src={publicUrl('posts', p.image_path)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            <div className="space-y-1 p-2.5 text-xs"><p className="font-extrabold">@{p.author?.username}</p><p className="line-clamp-2 text-slate-500">{p.caption || '—'}</p><p className="text-slate-400">♥ {p.likes?.[0]?.count ?? 0} · 💬 {p.comments?.[0]?.count ?? 0}</p>
              <button className="font-bold text-rose-600" onClick={() => del(p)}>Delete</button></div></div>))}</div>)}
      <Pager page={page} pageSize={PAGE} total={data?.count ?? 0} onChange={setPage} />
    </div>)
}

function EventsTab() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(0); const [only, setOnly] = useState('all')
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('events_feed').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (q.trim()) query = query.or(`title.ilike.%${q.trim().replace(/[%,()]/g, '')}%,host_name.ilike.%${q.trim().replace(/[%,()]/g, '')}%`)
    if (only === 'boosted') query = query.eq('boosted', true)
    const { data, count, error } = await query; if (error) throw error
    return { rows: data, count }
  }, [q, page, only])
  const moderate = useModerate(reload)
  const del = async (e) => { if (await moderate('delete_event', e.id, e.title, `Delete event “${e.title}”?`)) removeImages('events', [e.image1_path, e.image2_path]) }
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><input className="input max-w-sm" placeholder="Search event or organizer" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} aria-label="Search events" />
        <select className="input w-40" value={only} onChange={(e) => { setOnly(e.target.value); setPage(0) }} aria-label="Filter"><option value="all">All events</option><option value="boosted">Boosted only</option></select></div>
      {loading && !data ? <PageLoader /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Event', 'Organizer', 'Date', 'Going', 'Status', ''].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{data.rows.map((e) => (
            <tr key={e.id}><td className="px-3 py-2 font-extrabold">{e.title}<div className="text-xs font-normal text-slate-500">{e.location}</div></td><td className="px-3 py-2">{e.host_name}<div className="text-xs text-slate-500">{e.host_reg_no}</div></td>
              <td className="px-3 py-2">{e.event_date}</td><td className="px-3 py-2">{e.attendee_count}</td>
              <td className="px-3 py-2"><div className="flex gap-1"><Badge>{eventStatus(e)}</Badge>{e.boosted && <Badge tone="sun">Boosted</Badge>}</div></td>
              <td className="px-3 py-2 text-right"><button className="btn-ghost !py-1 !text-xs text-rose-600" onClick={() => del(e)}>Delete</button></td></tr>))}</tbody></table>
          {data.rows.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No events found.</p>}</div>)}
      <Pager page={page} pageSize={PAGE} total={data?.count ?? 0} onChange={setPage} />
    </div>)
}

function BoostsTab() {
  const { toast } = useToast()
  const [status, setStatus] = useState('pending'); const [page, setPage] = useState(0); const [note, setNote] = useState({})
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('boost_requests').select('*, event:events(title), requester:profiles!user_id(username,full_name)', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (status !== 'all') query = query.eq('status', status)
    const { data, count, error } = await query; if (error) throw error
    return { rows: data, count }
  }, [status, page])
  const review = async (r, approve) => {
    if (!window.confirm(approve ? `Approve ${r.reference} for ${inr(r.amount)}? Only do this after you SEE the payment in your bank/UPI app.` : `Reject ${r.reference}?`)) return
    const { error } = await supabase.rpc('admin_review_boost', { p_id: r.id, p_approve: approve, p_note: note[r.id] || null })
    if (error) return toast(friendlyError(error), 'error')
    toast(approve ? 'Boost approved and live' : 'Request rejected'); reload()
  }
  return (
    <div className="space-y-3">
      <select className="input w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} aria-label="Status filter">{['pending', 'approved', 'rejected', 'all'].map((s) => <option key={s}>{s}</option>)}</select>
      <p className="text-xs text-slate-500">Match the reference/UTR and amount against your UPI app before approving. Boosts never activate automatically.</p>
      {loading && !data ? <PageLoader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.rows.length === 0 ? <Empty icon={Zap} title="No requests" /> : (
        <ul className="space-y-2">{data.rows.map((r) => (
          <li key={r.id} className="card space-y-2 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold">{r.reference} · {inr(r.amount)} · {r.plan_days} day{r.plan_days > 1 ? 's' : ''}</p>
              <Badge tone={r.status === 'approved' ? 'mint' : r.status === 'rejected' ? 'rose' : 'sun'}>{r.status === 'approved' && new Date(r.ends_at) < new Date() ? 'expired' : r.status}</Badge></div>
            <p className="text-slate-600">{r.event?.title} · by {r.requester?.full_name} (@{r.requester?.username}) · {new Date(r.created_at).toLocaleString()}</p>
            <p className="text-xs text-slate-500">Payer UTR: <b>{r.payer_utr || 'not submitted'}</b>{r.ends_at ? ` · ${new Date(r.starts_at).toLocaleDateString()} → ${new Date(r.ends_at).toLocaleDateString()}` : ''}{r.admin_note ? ` · note: ${r.admin_note}` : ''}</p>
            {r.status === 'pending' && <div className="flex flex-wrap gap-2"><input className="input max-w-xs" placeholder="Note (optional)" value={note[r.id] || ''} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} aria-label="Admin note" />
              <button className="btn-brand" onClick={() => review(r, true)}>Approve</button><button className="btn-ghost text-rose-600" onClick={() => review(r, false)}>Reject</button></div>}
          </li>))}</ul>)}
      <Pager page={page} pageSize={PAGE} total={data?.count ?? 0} onChange={setPage} />
    </div>)
}

function ReportsTab() {
  const [status, setStatus] = useState('open'); const [page, setPage] = useState(0)
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('reports').select('*, reporter:profiles!reporter_id(username)', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (status !== 'all') query = query.eq('status', status)
    const { data, count, error } = await query; if (error) throw error
    return { rows: data, count }
  }, [status, page])
  const moderate = useModerate(reload)
  const ACTION = { user: ['suspend_user', 'Suspend user'], post: ['delete_post', 'Delete post'], event: ['delete_event', 'Delete event'], comment: ['delete_comment', 'Delete comment'] }
  return (
    <div className="space-y-3">
      <select className="input w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} aria-label="Status filter">{['open', 'resolved', 'dismissed', 'all'].map((s) => <option key={s}>{s}</option>)}</select>
      {loading && !data ? <PageLoader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.rows.length === 0 ? <Empty icon={Flag} title="No reports" /> : (
        <ul className="space-y-2">{data.rows.map((r) => (
          <li key={r.id} className="card space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between"><p className="font-extrabold">{r.target_type} · {r.reason}</p><Badge tone={r.status === 'open' ? 'sun' : 'slate'}>{r.status}</Badge></div>
            <p className="text-slate-600">{r.details || 'No details'} <span className="text-xs text-slate-400">· by @{r.reporter?.username} · {timeAgo(r.created_at)} · target {r.target_id.slice(0, 8)}</span></p>
            {r.status === 'open' && <div className="flex flex-wrap gap-2">
              {ACTION[r.target_type] && <button className="btn-ghost !py-1.5 text-rose-600" onClick={async () => { if (await moderate(ACTION[r.target_type][0], r.target_id, `report ${r.id}`, `${ACTION[r.target_type][1]}?`)) moderate('resolve_report', r.id) }}>{ACTION[r.target_type][1]} & resolve</button>}
              <button className="btn-ghost !py-1.5" onClick={() => moderate('resolve_report', r.id)}>Mark resolved</button><button className="btn-ghost !py-1.5" onClick={() => moderate('dismiss_report', r.id)}>Dismiss</button></div>}
          </li>))}</ul>)}
      <Pager page={page} pageSize={PAGE} total={data?.count ?? 0} onChange={setPage} />
    </div>)
}

function PaymentsTab() {
  const { toast } = useToast()
  const [upi, setUpi] = useState(null); const [plans, setPlans] = useState(null)
  const load = useAsync(async () => { const { data } = await supabase.from('app_settings').select('key,value'); const s = Object.fromEntries((data || []).map((r) => [r.key, r.value])); setUpi(s.upi || { id: '', name: '' }); setPlans(s.boost_plans || []); return true }, [])
  const save = async () => {
    const clean = plans.map((p) => ({ days: Number(p.days), price: Number(p.price) })).filter((p) => p.days > 0 && p.price > 0)
    if (!upi.id.includes('@')) return toast('Enter a valid UPI ID (name@bank).', 'error')
    if (!clean.length) return toast('Add at least one plan.', 'error')
    const r = await supabase.from('app_settings').upsert([{ key: 'upi', value: { id: upi.id.trim(), name: upi.name.trim() } }, { key: 'boost_plans', value: clean }])
    if (r.error) return toast(friendlyError(r.error), 'error')
    toast('Payment settings saved')
  }
  if (load.loading || !plans) return <PageLoader />
  return (
    <div className="card max-w-lg space-y-4 p-5">
      <h2 className="font-extrabold">UPI & boost pricing</h2>
      <Field label="UPI ID"><input className="input" value={upi.id} onChange={(e) => setUpi({ ...upi, id: e.target.value })} placeholder="yourname@okbank" /></Field>
      <Field label="Payee name"><input className="input" value={upi.name} onChange={(e) => setUpi({ ...upi, name: e.target.value })} /></Field>
      <div><p className="mb-1 text-xs font-bold text-slate-600">Boost plans</p>
        {plans.map((p, i) => <div key={i} className="mb-2 flex items-center gap-2"><input className="input" type="number" min="1" value={p.days} onChange={(e) => setPlans(plans.map((x, j) => j === i ? { ...x, days: e.target.value } : x))} aria-label="Days" /><span className="text-sm">days</span>
          <input className="input" type="number" min="1" value={p.price} onChange={(e) => setPlans(plans.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} aria-label="Price" /><span className="text-sm">₹</span>
          <button className="text-rose-600" onClick={() => setPlans(plans.filter((_, j) => j !== i))} aria-label="Remove plan">✕</button></div>)}
        <button className="btn-ghost !py-1.5" onClick={() => setPlans([...plans, { days: 1, price: 29 }])}>+ Add plan</button></div>
      <button className="btn-primary w-full" onClick={save}>Save settings</button>
    </div>)
}

function AuditTab() {
  const [page, setPage] = useState(0)
  const { data, loading, error, reload } = useAsync(async () => { const { data, count, error } = await supabase.from('moderation_actions').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1); if (error) throw error; return { rows: data, count } }, [page])
  if (loading && !data) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  return (
    <div className="space-y-3">{data.rows.length === 0 ? <Empty icon={ScrollText} title="No admin actions yet" /> : (
      <div className="card overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['When', 'Action', 'Target', 'Note'].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{data.rows.map((a) => <tr key={a.id}><td className="px-3 py-2 text-xs">{new Date(a.created_at).toLocaleString()}</td><td className="px-3 py-2 font-bold">{a.action}</td><td className="px-3 py-2 text-xs">{a.target_id?.slice(0, 8) || '—'}</td><td className="px-3 py-2 text-xs text-slate-500">{a.note || ''}</td></tr>)}</tbody></table></div>)}
      <Pager page={page} pageSize={PAGE} total={data.count ?? 0} onChange={setPage} /></div>)
}
