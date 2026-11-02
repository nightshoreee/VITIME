import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bookmark, CalendarDays, Flag, Grid3x3, MessageCircle, Pencil, ShieldAlert, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { decoratePosts, POST_SELECT, blockUser } from '../lib/posts'
import { friendlyError, eventStatus } from '../lib/utils'
import { Avatar, Badge, Empty, ErrorBox, Modal, PageLoader } from '../components/ui'
import PostCard from '../components/PostCard'
import EventCard from '../components/EventCard'
import FollowButton from '../components/FollowButton'
import ReportModal from '../components/ReportModal'

export default function Profile() {
  const { username } = useParams()
  const { user, profile: me } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [tab, setTab] = useState('posts')
  const [list, setList] = useState(null)
  const [report, setReport] = useState(false)
  const uname = username || me.username
  const own = uname === me.username

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const { data: p, error } = await supabase.from('profiles').select('*').eq('username', uname).maybeSingle()
    if (error) throw error
    if (!p) return null
    const head = (t, col) => supabase.from(t).select('*', { count: 'exact', head: true }).eq(col, p.id)
    const [fo, fi, isF, posts, saved, hosted, joined] = await Promise.all([
      head('follows', 'following_id'), head('follows', 'follower_id'),
      supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', p.id).maybeSingle(),
      supabase.from('posts').select(POST_SELECT).eq('user_id', p.id).order('created_at', { ascending: false }),
      own ? supabase.from('saved_posts').select(`post:posts(${POST_SELECT})`).eq('user_id', user.id).order('created_at', { ascending: false }) : { data: [] },
      supabase.from('events_feed').select('*').eq('organizer_id', p.id).order('event_date', { ascending: false }),
      own ? supabase.from('event_attendees').select('event_id').eq('user_id', user.id) : { data: [] },
    ])
    const jIds = (joined.data || []).map((j) => j.event_id)
    const joinedEv = jIds.length ? (await supabase.from('events_feed').select('*').in('id', jIds)).data || [] : []
    return {
      p, followers: fo.count || 0, following: fi.count || 0, isFollowing: !!isF.data,
      posts: await decoratePosts(posts.data || [], user.id),
      saved: await decoratePosts((saved.data || []).map((s) => s.post).filter(Boolean), user.id),
      hosted: hosted.data || [], joined: joinedEv,
    }
  }, [uname])

  if (loading) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return <Empty icon={UserX} title="User not found" text="This account may not exist or is unavailable." />
  const { p } = data

  const openList = async (kind) => {
    const col = kind === 'followers' ? 'following_id' : 'follower_id'
    const other = kind === 'followers' ? 'follower' : 'following'
    const { data: rows } = await supabase.from('follows').select(`u:profiles!${other}_id(username,full_name,avatar_path)`).eq(col, p.id).limit(200)
    setList({ kind, rows: (rows || []).map((r) => r.u).filter(Boolean) })
  }
  const message = async () => {
    const { data: cid, error } = await supabase.rpc('start_dm', { other: p.id })
    if (error) return toast(friendlyError(error), 'error')
    nav(`/chats/${cid}`)
  }
  const block = async () => {
    if (!window.confirm(`Block @${p.username}?`)) return
    try { await blockUser(user.id, p.id); toast('Blocked'); nav('/') } catch (e) { toast(friendlyError(e), 'error') }
  }
  const evs = own ? [...data.hosted, ...data.joined.filter((j) => !data.hosted.some((h) => h.id === j.id))] : data.hosted
  const tabs = [['posts', Grid3x3, 'Posts'], ...(own ? [['saved', Bookmark, 'Saved']] : []), ['events', CalendarDays, 'Events']]
  const posts = tab === 'saved' ? data.saved : data.posts

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <Avatar path={p.avatar_path} name={p.full_name} size={84} />
          <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-extrabold">{p.full_name}</h1><p className="text-sm text-slate-500">@{p.username}</p>
            <div className="mt-2 flex gap-5 text-center text-sm">
              <div><b className="block">{data.posts.length}</b><span className="text-xs text-slate-500">Posts</span></div>
              <button onClick={() => openList('followers')}><b className="block">{data.followers}</b><span className="text-xs text-slate-500">Followers</span></button>
              <button onClick={() => openList('following')}><b className="block">{data.following}</b><span className="text-xs text-slate-500">Following</span></button></div></div>
        </div>
        {p.bio && <p className="mt-3 text-sm">{p.bio}</p>}
        {(own || p.show_interests) && p.interests?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{p.interests.map((i) => <Badge key={i} tone="brand">{i}</Badge>)}</div>}
        <div className="mt-4 flex flex-wrap gap-2">
          {own ? <Link to="/profile/edit" className="btn-ghost"><Pencil size={16} /> Edit profile</Link> : <>
            <FollowButton userId={p.id} following={data.isFollowing} onChange={(on) => setData((d) => ({ ...d, followers: d.followers + (on ? 1 : -1) }))} />
            <button className="btn-ghost" onClick={message}><MessageCircle size={16} /> Message</button>
            <button className="btn-ghost" onClick={() => setReport(true)} aria-label="Report user"><Flag size={16} /></button>
            <button className="btn-ghost" onClick={block} aria-label="Block user"><ShieldAlert size={16} /></button></>}
        </div>
      </div>

      <div role="tablist" className="flex border-b border-slate-200">{tabs.map(([k, Icon, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-extrabold ${tab === k ? 'border-ink' : 'border-transparent text-slate-400'}`}><Icon size={16} /> {l}</button>))}</div>

      {tab === 'events' ? (evs.length ? <div className="grid gap-3 sm:grid-cols-2">{evs.map((e) => <EventCard key={e.id} ev={e} />)}</div> : <Empty icon={CalendarDays} title="No events" text={own ? 'Events you host or join appear here.' : 'No hosted events.'} />)
        : posts.length ? <div className="space-y-4">{posts.map((x) => <PostCard key={x.id} post={x} onDeleted={reload} />)}</div>
        : <Empty icon={tab === 'saved' ? Bookmark : Grid3x3} title={tab === 'saved' ? 'Nothing saved' : 'No posts yet'} text={tab === 'saved' ? 'Saved posts are private to you.' : own ? 'Share your first photo (up to 5 posts).' : ''} action={own && tab === 'posts' ? <Link to="/post/new" className="btn-brand mt-2">New post</Link> : null} />}

      <Modal open={!!list} onClose={() => setList(null)} title={list?.kind === 'followers' ? 'Followers' : 'Following'}>
        {list?.rows.length ? <ul className="space-y-2">{list.rows.map((u) => <li key={u.username}><Link onClick={() => setList(null)} to={`/u/${u.username}`} className="flex items-center gap-2.5"><Avatar path={u.avatar_path} name={u.full_name} size={36} /><span><b className="block text-sm">{u.full_name}</b><span className="text-xs text-slate-500">@{u.username}</span></span></Link></li>)}</ul> : <p className="text-sm text-slate-400">Nobody here yet.</p>}
      </Modal>
      <ReportModal open={report} onClose={() => setReport(false)} targetType="user" targetId={p.id} />
    </div>
  )
}
