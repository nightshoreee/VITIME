import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Flag, Send, ShieldAlert, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { blockUser } from '../lib/posts'
import { friendlyError, timeAgo } from '../lib/utils'
import { Avatar, Badge, ErrorBox, Modal, PageLoader } from '../components/ui'
import ReportModal from '../components/ReportModal'

export default function ChatRoom() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [info, setInfo] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [people, setPeople] = useState({})
  const [text, setText] = useState('')
  const [err, setErr] = useState(null)
  const [showMembers, setShowMembers] = useState(false)
  const [report, setReport] = useState(false)
  const bottom = useRef(null)

  const markRead = useCallback(() => supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', id).eq('user_id', user.id), [id, user.id])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [c, m, mem] = await Promise.all([
        supabase.from('conversations').select('*').eq('id', id).maybeSingle(),
        supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(100),
        supabase.from('conversation_members').select('user_id,status,profile:profiles!user_id(username,full_name,avatar_path)').eq('conversation_id', id),
      ])
      if (!alive) return
      if (c.error || m.error) return setErr(c.error || m.error)
      if (!c.data) return setErr({ message: 'Conversation not found or you are not a member.' })
      const members = mem.data || []
      setPeople(Object.fromEntries(members.map((x) => [x.user_id, { ...x.profile, status: x.status }])))
      setInfo({ ...c.data, members, myStatus: members.find((x) => x.user_id === user.id)?.status })
      setMsgs([...m.data].reverse()); markRead()
    })()
    const ch = supabase.channel(`room-${id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
      (p) => { setMsgs((x) => (x.some((y) => y.id === p.new.id) ? x : [...x, p.new])); markRead() }).subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [id, user.id, markRead])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim(); if (!body) return
    setText('')
    const { data, error } = await supabase.from('messages').insert({ conversation_id: id, sender_id: user.id, body }).select().single()
    if (error) { setText(body); return toast(friendlyError(error), 'error') }
    setMsgs((x) => (x.some((y) => y.id === data.id) ? x : [...x, data]))
  }
  const setStatus = async (status) => {
    const { error } = await supabase.from('conversation_members').update({ status }).eq('conversation_id', id).eq('user_id', user.id)
    if (error) return toast(friendlyError(error), 'error')
    if (status === 'declined') nav('/chats'); else setInfo((i) => ({ ...i, myStatus: status }))
  }
  const other = info && ['dm', 'dating'].includes(info.type) ? info.members.find((m) => m.user_id !== user.id) : null
  const block = async () => {
    if (!window.confirm('Block this person? They will no longer be able to message you.')) return
    try { await blockUser(user.id, other.user_id); await setStatus('declined'); toast('Blocked') } catch (e) { toast(friendlyError(e), 'error') }
  }
  const leave = async () => {
    if (!window.confirm('Leave this chat?')) return
    const { error } = await supabase.from('conversation_members').delete().eq('conversation_id', id).eq('user_id', user.id)
    if (error) toast(friendlyError(error), 'error'); else nav('/chats')
  }

  if (err) return <ErrorBox error={err} />
  if (!info) return <PageLoader />
  const title = info.title || other?.profile?.full_name || 'Chat'
  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <Link to="/chats" aria-label="Back to messages" className="rounded-full p-1.5 hover:bg-slate-100"><ArrowLeft /></Link>
        {other ? <Link to={`/u/${other.profile?.username}`}><Avatar path={other.profile?.avatar_path} name={other.profile?.full_name} size={38} /></Link> : null}
        <div className="min-w-0 flex-1"><p className="truncate font-extrabold">{title}</p>
          {info.type === 'dating' && <Badge tone="rose">Dating match</Badge>}{info.type !== 'dm' && info.type !== 'dating' && <button onClick={() => setShowMembers(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500"><Users size={12} /> {info.members.length} participants</button>}</div>
        {other ? <><button onClick={() => setReport(true)} aria-label="Report user" className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><Flag size={18} /></button><button onClick={block} aria-label="Block user" className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><ShieldAlert size={18} /></button></>
          : <button onClick={leave} className="text-xs font-bold text-rose-600">Leave</button>}
      </div>

      {info.myStatus === 'request' && (
        <div className="my-3 rounded-2xl bg-sun-50 p-3 text-sm"><p className="font-bold">{title} wants to message you.</p>
          <div className="mt-2 flex gap-2"><button className="btn-brand !py-1.5" onClick={() => setStatus('active')}>Accept</button><button className="btn-ghost !py-1.5" onClick={() => setStatus('declined')}>Decline</button><button className="btn-ghost !py-1.5 text-rose-600" onClick={block}>Block</button></div></div>)}

      <div className="flex-1 space-y-2 overflow-y-auto py-3" aria-live="polite">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No messages yet. Say hi 👋</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === user.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md bg-white ring-1 ring-slate-200'}`}>
                {!mine && !other && <p className="text-[11px] font-extrabold text-brand-600">{people[m.sender_id]?.full_name || 'Member'}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/60' : 'text-slate-400'}`}>{timeAgo(m.created_at)}</p>
              </div>
            </div>)
        })}
        <div ref={bottom} />
      </div>

      {info.myStatus === 'active' ? (
        <form onSubmit={send} className="flex gap-2 border-t border-slate-200 pt-3">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Message…" aria-label="Message" />
          <button className="btn-brand" disabled={!text.trim()} aria-label="Send"><Send size={18} /></button>
        </form>) : <p className="border-t pt-3 text-center text-xs text-slate-400">Accept the request to reply.</p>}

      <Modal open={showMembers} onClose={() => setShowMembers(false)} title="Participants">
        <ul className="space-y-2">{info.members.map((m) => <li key={m.user_id}><Link to={`/u/${m.profile?.username}`} className="flex items-center gap-2.5"><Avatar path={m.profile?.avatar_path} name={m.profile?.full_name} size={34} /><span className="text-sm font-bold">{m.profile?.full_name}</span></Link></li>)}</ul>
      </Modal>
      {other && <ReportModal open={report} onClose={() => setReport(false)} targetType="user" targetId={other.user_id} />}
    </div>
  )
}
