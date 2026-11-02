import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Flag, Heart, MessageCircle, Send, Share2, Trash2 } from 'lucide-react'
import { supabase, publicUrl } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { friendlyError, timeAgo } from '../lib/utils'
import { removeImages } from '../lib/storage'
import { Avatar, Spinner } from './ui'
import ReportModal from './ReportModal'

export default function PostCard({ post, onDeleted }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [p, setP] = useState(post)
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState(false)
  const mine = p.user_id === user.id

  const toggleLike = async () => {
    const was = p.liked
    setP((x) => ({ ...x, liked: !was, like_count: x.like_count + (was ? -1 : 1) }))
    const { error } = was
      ? await supabase.from('likes').delete().eq('post_id', p.id).eq('user_id', user.id)
      : await supabase.from('likes').insert({ post_id: p.id, user_id: user.id })
    if (error) { setP((x) => ({ ...x, liked: was, like_count: x.like_count + (was ? 1 : -1) })); toast(friendlyError(error), 'error') }
  }
  const toggleSave = async () => {
    const was = p.saved
    setP((x) => ({ ...x, saved: !was }))
    const { error } = was
      ? await supabase.from('saved_posts').delete().eq('post_id', p.id).eq('user_id', user.id)
      : await supabase.from('saved_posts').insert({ post_id: p.id, user_id: user.id })
    if (error) { setP((x) => ({ ...x, saved: was })); toast(friendlyError(error), 'error') }
    else toast(was ? 'Removed from saved' : 'Saved')
  }
  const share = async () => {
    const url = `${window.location.origin}/post/${p.id}`
    try {
      if (navigator.share) await navigator.share({ title: `${p.author?.full_name} on VIT Connect`, url })
      else { await navigator.clipboard.writeText(url); toast('Link copied') }
    } catch { /* user cancelled */ }
  }
  const loadComments = async () => {
    setOpen((o) => !o)
    if (comments) return
    const { data, error } = await supabase.from('comments').select('*, author:profiles!user_id(username,full_name,avatar_path)').eq('post_id', p.id).order('created_at').limit(100)
    if (error) toast(friendlyError(error), 'error'); else setComments(data)
  }
  const addComment = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    const { data, error } = await supabase.from('comments').insert({ post_id: p.id, user_id: user.id, body: text.trim() })
      .select('*, author:profiles!user_id(username,full_name,avatar_path)').single()
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    setComments((c) => [...(c || []), data]); setText(''); setP((x) => ({ ...x, comment_count: x.comment_count + 1 }))
  }
  const delComment = async (id) => {
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) return toast(friendlyError(error), 'error')
    setComments((c) => c.filter((x) => x.id !== id)); setP((x) => ({ ...x, comment_count: Math.max(0, x.comment_count - 1) }))
  }
  const del = async () => {
    if (!window.confirm('Delete this post? This frees up one of your 5 post slots.')) return
    const { error } = await supabase.from('posts').delete().eq('id', p.id)
    if (error) return toast(friendlyError(error), 'error')
    await removeImages('posts', [p.image_path]); toast('Post deleted'); onDeleted?.(p.id)
  }

  return (
    <article className="card overflow-hidden">
      <div className="flex items-center justify-between p-3.5">
        <Link to={`/u/${p.author?.username}`} className="flex items-center gap-2.5">
          <Avatar path={p.author?.avatar_path} name={p.author?.full_name} size={38} />
          <div><p className="text-sm font-extrabold leading-tight">{p.author?.full_name}</p><p className="text-xs text-slate-500">@{p.author?.username} · {timeAgo(p.created_at)}</p></div>
        </Link>
        <div className="flex gap-1">
          {mine ? <button onClick={del} aria-label="Delete post" className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={18} /></button>
            : <button onClick={() => setReport(true)} aria-label="Report post" className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><Flag size={18} /></button>}
        </div>
      </div>
      <img src={publicUrl('posts', p.image_path)} alt={p.caption || 'Post image'} loading="lazy" className="aspect-square w-full bg-slate-100 object-cover" onDoubleClick={() => !p.liked && toggleLike()} />
      <div className="space-y-2 p-3.5">
        <div className="flex items-center gap-1">
          <button onClick={toggleLike} aria-pressed={p.liked} aria-label={p.liked ? 'Unlike' : 'Like'} className="flex items-center gap-1 rounded-full p-2 text-sm font-bold hover:bg-slate-100">
            <Heart size={22} className={p.liked ? 'fill-rose-500 text-rose-500' : ''} /> {p.like_count}
          </button>
          <button onClick={loadComments} aria-label="Comments" className="flex items-center gap-1 rounded-full p-2 text-sm font-bold hover:bg-slate-100"><MessageCircle size={22} /> {p.comment_count}</button>
          <button onClick={share} aria-label="Share" className="rounded-full p-2 hover:bg-slate-100"><Share2 size={22} /></button>
          <button onClick={toggleSave} aria-pressed={p.saved} aria-label={p.saved ? 'Unsave' : 'Save'} className="ml-auto rounded-full p-2 hover:bg-slate-100"><Bookmark size={22} className={p.saved ? 'fill-ink' : ''} /></button>
        </div>
        {p.caption && <p className="text-sm"><Link to={`/u/${p.author?.username}`} className="mr-1.5 font-extrabold">{p.author?.username}</Link>{p.caption}</p>}
        {open && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            {!comments ? <Spinner className="text-brand-600" /> : comments.length === 0 ? <p className="text-xs text-slate-400">No comments yet. Say something kind.</p> :
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  <Avatar path={c.author?.avatar_path} name={c.author?.full_name} size={26} />
                  <p className="flex-1"><Link to={`/u/${c.author?.username}`} className="mr-1 font-extrabold">{c.author?.username}</Link>{c.body}</p>
                  {(c.user_id === user.id || mine) && <button onClick={() => delComment(c.id)} aria-label="Delete comment" className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>}
                </div>
              ))}
            <form onSubmit={addComment} className="flex gap-2">
              <input className="input" placeholder="Add a comment…" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} aria-label="Add a comment" />
              <button className="btn-brand !px-3" disabled={busy || !text.trim()} aria-label="Post comment"><Send size={16} /></button>
            </form>
          </div>
        )}
      </div>
      <ReportModal open={report} onClose={() => setReport(false)} targetType="post" targetId={p.id} />
    </article>
  )
}
