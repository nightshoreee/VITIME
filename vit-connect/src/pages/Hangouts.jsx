import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Flag, Heart, Plus, ShieldAlert, SkipForward, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { blockUser } from '../lib/posts'
import { ACTIVITIES, GENDERS, SLOTS, VIBES, label } from '../lib/constants'
import { fmtDate, friendlyError } from '../lib/utils'
import { Avatar, Badge, Chip, Empty, ErrorBox, Field, Modal, MultiSelect, PageLoader, Spinner, Toggle } from '../components/ui'
import ReportModal from '../components/ReportModal'

const BLANK = { dating_enabled: false, friends_enabled: false, seeking_genders: [], activities: [], vibes: [], availability: [], show_bio: true, show_interests: true }

export default function Hangouts() {
  const { user } = useAuth()
  const [tab, setTab] = useState('discover')
  const hp = useAsync(async () => (await supabase.from('hangout_profiles').select('*').eq('user_id', user.id).maybeSingle()).data || BLANK, [user.id])
  if (hp.loading) return <PageLoader />
  if (hp.error) return <ErrorBox error={hp.error} onRetry={hp.reload} />
  const tabs = [['discover', 'Discover'], ['groups', 'Groups'], ['matches', 'Matches'], ['prefs', 'Preferences']]
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Hangouts</h1>
      <div role="tablist" className="flex gap-1 rounded-2xl bg-slate-200/60 p-1">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-xl py-2 text-xs font-extrabold ${tab === k ? 'bg-white shadow' : 'text-slate-500'}`}>{l}</button>)}
      </div>
      {tab === 'discover' && <Discover prefs={hp.data} goPrefs={() => setTab('prefs')} />}
      {tab === 'groups' && <Groups prefs={hp.data} goPrefs={() => setTab('prefs')} />}
      {tab === 'matches' && <Matches />}
      {tab === 'prefs' && <Prefs initial={hp.data} onSaved={hp.reload} />}
    </div>
  )
}

function Discover({ prefs, goPrefs }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [mode, setMode] = useState(prefs.dating_enabled ? 'dating' : 'friends')
  const [s, setS] = useState(null)
  const [state, setState] = useState('idle')   // idle | loading | empty
  const [report, setReport] = useState(false)
  const [match, setMatch] = useState(null)
  const enabled = mode === 'dating' ? prefs.dating_enabled : prefs.friends_enabled

  const find = async () => {
    setState('loading'); setS(null)
    const { data, error } = await supabase.rpc('next_hangout_suggestion', { p_mode: mode })
    if (error) { setState('idle'); return toast(friendlyError(error), 'error') }
    if (!data?.length) return setState('empty')
    setS(data[0]); setState('idle')
  }
  const respond = async (action) => {
    const { data, error } = await supabase.rpc('respond_hangout_suggestion', { p_id: s.suggestion_id, p_action: action })
    if (error) return toast(friendlyError(error), 'error')
    setS(null)
    if (data?.matched) setMatch(data); else { toast(action === 'accepted' ? 'Interest sent. You are only matched if they accept too.' : action === 'rejected' ? 'Rejected. You will not see them again.' : 'Skipped'); }
  }
  const block = async () => {
    if (!window.confirm('Block this person? Neither of you will see the other.')) return
    try { await blockUser(user.id, s.candidate_id); toast('Blocked'); setS(null) } catch (e) { toast(friendlyError(e), 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2"><Chip active={mode === 'friends'} onClick={() => { setMode('friends'); setS(null); setState('idle') }}>Friends & hangouts</Chip><Chip active={mode === 'dating'} onClick={() => { setMode('dating'); setS(null); setState('idle') }}><Heart size={12} /> Dating (18+)</Chip></div>
      {!enabled ? (
        <Empty icon={mode === 'dating' ? Heart : Users} title={mode === 'dating' ? 'Dating is off' : 'Hangouts are off'}
          text="This is opt-in. Nobody can see or be matched with you until you turn it on, and you can turn it off any time."
          action={<button className="btn-brand mt-2" onClick={goPrefs}>Set up preferences</button>} />
      ) : (
        <>
          {!s && <div className="card space-y-3 p-5 text-center">
            <p className="text-sm text-slate-600">{state === 'empty' ? 'No compatible people right now. Try again later or widen your preferences.' : 'We pick someone who is opted in and compatible with your preferences and availability.'}</p>
            <button className="btn-primary" onClick={find} disabled={state === 'loading'}>{state === 'loading' ? <Spinner /> : 'Find someone'}</button></div>}
          {s && (
            <div className="card animate-pop space-y-3 p-5">
              <div className="flex items-center gap-3"><Avatar path={s.avatar_path} name={s.full_name} size={64} />
                <div><p className="text-lg font-extrabold">{s.full_name}</p><p className="text-sm text-slate-500">@{s.username}</p><Badge tone={mode === 'dating' ? 'rose' : 'mint'}>{mode === 'dating' ? 'Dating suggestion' : 'Friend suggestion'}</Badge></div></div>
              {s.bio && <p className="text-sm">{s.bio}</p>}
              {s.interests?.length > 0 && <div className="flex flex-wrap gap-1.5">{s.interests.map((i) => <Badge key={i} tone="brand">{i}</Badge>)}</div>}
              {(s.shared_activities?.length > 0 || s.shared_vibes?.length > 0) && <p className="text-xs text-slate-500">You both like: {[...s.shared_activities.map((a) => label(ACTIVITIES, a)), ...s.shared_vibes.map((v) => label(VIBES, v))].join(', ')}</p>}
              <div className="grid grid-cols-3 gap-2">
                <button className="btn-ghost" onClick={() => respond('rejected')}><X size={16} /> Reject</button>
                <button className="btn-ghost" onClick={() => respond('skipped')}><SkipForward size={16} /> Skip</button>
                <button className="btn-brand" onClick={() => respond('accepted')}><Check size={16} /> Accept</button></div>
              <div className="flex justify-center gap-4 text-xs font-bold text-slate-400"><button onClick={() => setReport(true)} className="flex items-center gap-1"><Flag size={12} /> Report</button><button onClick={block} className="flex items-center gap-1"><ShieldAlert size={12} /> Block</button></div>
              <ReportModal open={report} onClose={() => setReport(false)} targetType="user" targetId={s.candidate_id} />
            </div>)}
        </>
      )}
      <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-500">Safety: meet in public places, tell a friend, and never share your hostel room or live location. Chats unlock only after you both accept.</p>
      <Modal open={!!match} onClose={() => setMatch(null)} title="It's a match 🎉">
        <p className="text-sm">You both said yes. {match?.mode === 'dating' ? 'A private dating chat is now open.' : 'A chat is now open.'}</p>
        <button className="btn-brand mt-4 w-full" onClick={() => nav(`/chats/${match.conversation_id}`)}>Open chat</button>
      </Modal>
    </div>
  )
}

function Matches() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: m, error } = await supabase.from('matches').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const ids = m.map((x) => (x.user_a === user.id ? x.user_b : x.user_a))
    const { data: ps } = ids.length ? await supabase.from('profiles').select('id,username,full_name,avatar_path').in('id', ids) : { data: [] }
    return m.map((x) => ({ ...x, other: (ps || []).find((p) => p.id === (x.user_a === user.id ? x.user_b : x.user_a)) }))
  }, [user.id])
  if (loading) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data.length) return <Empty icon={Heart} title="No matches yet" text="Matches appear when you and someone else both accept." />
  return <ul className="space-y-2">{data.map((m) => (
    <li key={m.id} className="card flex items-center justify-between p-3.5">
      <div className="flex items-center gap-3"><Avatar path={m.other?.avatar_path} name={m.other?.full_name} /><div><p className="font-extrabold">{m.other?.full_name}</p><Badge tone={m.mode === 'dating' ? 'rose' : 'mint'}>{m.mode === 'dating' ? 'Dating match' : 'Friend connection'}</Badge></div></div>
      {m.conversation_id && <Link className="btn-ghost" to={`/chats/${m.conversation_id}`}>Chat</Link>}
    </li>))}</ul>
}

function Groups({ prefs, goPrefs }) {
  const { toast } = useToast()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(null)
  const [f, setF] = useState({ title: '', activity: 'hills', area: '', desc: '', time: '', max: 8 })
  const { data, loading, error, reload } = useAsync(async () => { const { data, error } = await supabase.rpc('list_hangout_groups'); if (error) throw error; return data }, [])
  if (!prefs.friends_enabled) return <Empty icon={Users} title="Group hangouts are off" text="Turn on 'Friends & hangouts' in Preferences to see and join groups." action={<button className="btn-brand mt-2" onClick={goPrefs}>Open preferences</button>} />
  const join = async (g) => { const { data, error } = await supabase.rpc('join_hangout_group', { p_group: g.id }); if (error) return toast(friendlyError(error), 'error'); nav(`/chats/${data}`) }
  const create = async (e) => {
    e.preventDefault()
    const { error } = await supabase.rpc('create_hangout_group', { p_title: f.title.trim(), p_activity: f.activity, p_area: f.area.trim(), p_desc: f.desc.trim(), p_time: f.time ? new Date(f.time).toISOString() : null, p_max: Number(f.max) })
    if (error) return toast(friendlyError(error), 'error')
    toast('Group created'); setOpen(false); reload()
  }
  const showMembers = async (g) => {
    const { data } = await supabase.from('conversation_members').select('user_id, profile:profiles!user_id(username,full_name,avatar_path)').eq('conversation_id', g.conversation_id)
    setView({ g, members: data || [] })
  }
  return (
    <div className="space-y-3">
      <button className="btn-brand w-full" onClick={() => setOpen(true)}><Plus size={16} /> Start a group hangout</button>
      {loading ? <PageLoader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <Empty icon={Users} title="No groups yet" text="Start one: a lake walk, a cafe crawl, a hill trek." /> :
        data.map((g) => (
          <div key={g.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between"><div><h3 className="font-extrabold">{g.title}</h3><p className="text-xs text-slate-500">{label(ACTIVITIES, g.activity)}{g.area ? ` · ${g.area}` : ''}{g.meet_time ? ` · ${fmtDate(g.meet_time.slice(0, 10))}` : ''} · by {g.creator_name}</p></div><Badge>{g.member_count}/{g.max_members}</Badge></div>
            {g.description && <p className="text-sm">{g.description}</p>}
            <div className="flex gap-2">{g.joined ? <Link to={`/chats/${g.conversation_id}`} className="btn-brand">Open chat</Link> : <button className="btn-brand" onClick={() => join(g)}>Join</button>}
              {g.joined && <button className="btn-ghost" onClick={() => showMembers(g)}>Participants</button>}</div>
          </div>))}
      <Modal open={open} onClose={() => setOpen(false)} title="New group hangout">
        <form onSubmit={create} className="space-y-3">
          <Field label="Title"><input className="input" required minLength={3} maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Activity"><select className="input" value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })}>{ACTIVITIES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></Field>
          <Field label="General area" hint="Keep it general (e.g. 'Lake side'). Never an exact address."><input className="input" maxLength={80} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
          <Field label="When"><input className="input" type="datetime-local" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
          <Field label="Max people"><input className="input" type="number" min="2" max="30" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></Field>
          <Field label="Description"><textarea className="input" rows={2} maxLength={300} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field>
          <button className="btn-primary w-full">Create group</button></form>
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.g.title || ''}>
        <ul className="space-y-2">{view?.members.map((m) => <li key={m.user_id}><Link to={`/u/${m.profile?.username}`} className="flex items-center gap-2.5"><Avatar path={m.profile?.avatar_path} name={m.profile?.full_name} size={34} /><span className="text-sm font-bold">{m.profile?.full_name}</span></Link></li>)}</ul>
      </Modal>
    </div>
  )
}

function Prefs({ initial, onSaved }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  useEffect(() => setF(initial), [initial])
  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('hangout_profiles').upsert({ ...f, user_id: user.id })
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    toast('Preferences saved'); onSaved()
  }
  return (
    <div className="space-y-4">
      <div className="card divide-y divide-slate-100 px-4">
        <Toggle label="Friends & group hangouts" desc="Be suggested to others and join group hangouts." checked={f.friends_enabled} onChange={(v) => setF({ ...f, friends_enabled: v })} />
        <Toggle label="Dating (18+ only)" desc="Requires a verified date of birth. Chat unlocks only after mutual acceptance." checked={f.dating_enabled} onChange={(v) => setF({ ...f, dating_enabled: v })} />
      </div>
      <div className="card space-y-4 p-4">
        <Field label="I'd like to meet"><MultiSelect options={GENDERS} value={f.seeking_genders} onChange={(v) => setF({ ...f, seeking_genders: v })} /><span className="mt-1 block text-xs text-slate-400">Leave empty for anyone. Matching needs to work both ways.</span></Field>
        <Field label="Activities"><MultiSelect options={ACTIVITIES} value={f.activities} onChange={(v) => setF({ ...f, activities: v })} /></Field>
        <Field label="Vibe"><MultiSelect options={VIBES} value={f.vibes} onChange={(v) => setF({ ...f, vibes: v })} /></Field>
        <Field label="Availability"><MultiSelect options={SLOTS} value={f.availability} onChange={(v) => setF({ ...f, availability: v })} /></Field>
      </div>
      <div className="card divide-y divide-slate-100 px-4">
        <Toggle label="Show my bio to suggestions" checked={f.show_bio} onChange={(v) => setF({ ...f, show_bio: v })} />
        <Toggle label="Show my interests to suggestions" checked={f.show_interests} onChange={(v) => setF({ ...f, show_interests: v })} />
      </div>
      <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Save preferences'}</button>
    </div>
  )
}
