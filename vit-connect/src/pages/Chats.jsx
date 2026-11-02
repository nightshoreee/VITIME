import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { timeAgo } from '../lib/utils'
import { Avatar, Badge, Empty, ErrorBox, PageLoader } from '../components/ui'

export default function Chats() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(async () => { const { data, error } = await supabase.rpc('my_conversations'); if (error) throw error; return data }, [])
  useEffect(() => {
    const ch = supabase.channel(`chats-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, reload).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [reload, user.id])
  if (loading && !data) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const requests = data.filter((c) => c.my_status === 'request')
  const chats = data.filter((c) => c.my_status === 'active')
  const Row = ({ c }) => (
    <Link to={`/chats/${c.id}`} className="card flex items-center gap-3 p-3.5">
      {c.other_id ? <Avatar path={c.other_avatar} name={c.other_name} size={46} /> : <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-mint-50 text-mint-600"><Users size={20} /></span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><p className="truncate font-extrabold">{c.title || c.other_name}</p>
          {c.type === 'dating' && <Badge tone="rose"><Heart size={10} /> Dating</Badge>}{c.type === 'group' && <Badge tone="mint">Group</Badge>}{c.type === 'event' && <Badge tone="sun">Event</Badge>}</div>
        <p className="truncate text-sm text-slate-500">{c.last_body || 'No messages yet'}</p></div>
      <div className="flex flex-col items-end gap-1"><span className="text-[11px] text-slate-400">{timeAgo(c.last_at)}</span>{Number(c.unread) > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-[11px] font-extrabold text-white">{c.unread}</span>}</div>
    </Link>)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Messages</h1>
      {requests.length > 0 && <section><h2 className="mb-2 text-sm font-extrabold text-slate-500">Message requests ({requests.length})</h2><div className="space-y-2">{requests.map((c) => <Row key={c.id} c={c} />)}</div></section>}
      {chats.length === 0 && requests.length === 0 ? <Empty icon={MessageCircle} title="No conversations yet" text="Message someone from their profile, join an event chat, or match in Hangouts." /> : <div className="space-y-2">{chats.map((c) => <Row key={c.id} c={c} />)}</div>}
    </div>
  )
}
