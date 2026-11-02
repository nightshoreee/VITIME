import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { timeAgo } from '../lib/utils'
import { Avatar, Empty, ErrorBox, PageLoader } from '../components/ui'

const TEXT = { like: 'liked your post', comment: 'commented on your post', follow: 'started following you', event_register: 'registered for your event', event_update: 'updated an event you joined', message: 'sent you a message', match: 'You have a new match', boost_approved: 'Your boost was approved and is now live', boost_rejected: 'Your boost request was rejected' }
const href = (n) => ({ like: `/post/${n.entity_id}`, comment: `/post/${n.entity_id}`, follow: n.actor ? `/u/${n.actor.username}` : '/', event_register: `/events/${n.entity_id}`, event_update: `/events/${n.entity_id}`, message: `/chats/${n.entity_id}`, match: `/chats/${n.entity_id}`, boost_approved: `/events/${n.entity_id}/boost`, boost_rejected: `/events/${n.entity_id}/boost` }[n.type] || '/')

export default function Notifications() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('notifications').select('*, actor:profiles!actor_id(username,full_name,avatar_path)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(60)
    if (error) throw error
    return data
  }, [user.id])
  useEffect(() => {
    const ch = supabase.channel(`notif-page-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, reload).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [reload, user.id])
  const markAll = async () => { await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false); reload() }
  const markOne = (n) => !n.read && supabase.from('notifications').update({ read: true }).eq('id', n.id)

  if (loading && !data) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">Notifications</h1>{data.some((n) => !n.read) && <button className="text-sm font-bold text-brand-600" onClick={markAll}>Mark all read</button>}</div>
      {data.length === 0 ? <Empty icon={Bell} title="All caught up" text="Likes, comments, follows, event updates and messages show up here." /> : (
        <ul className="space-y-2">{data.map((n) => (
          <li key={n.id}><Link to={href(n)} onClick={() => markOne(n)} className={`card flex items-center gap-3 p-3.5 ${n.read ? '' : 'ring-2 ring-brand-200'}`}>
            <Avatar path={n.actor?.avatar_path} name={n.actor?.full_name || 'VIT'} size={40} />
            <p className="flex-1 text-sm">{n.actor && <b>{n.actor.full_name} </b>}{TEXT[n.type] || 'New activity'}{n.data?.title ? `: ${n.data.title}` : ''}{n.data?.preview ? <span className="block truncate text-slate-500">“{n.data.preview}”</span> : null}</p>
            <span className="text-[11px] text-slate-400">{timeAgo(n.created_at)}</span></Link></li>))}</ul>)}
    </div>
  )
}
