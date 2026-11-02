import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { decoratePosts, POST_SELECT } from '../lib/posts'
import { Empty, ErrorBox, Skeleton } from './ui'
import PostCard from './PostCard'

const PAGE = 10

// Personalised feed: posts from people you follow + your own.
export default function Feed() {
  const { user } = useAuth()
  const [state, setState] = useState({ posts: [], loading: true, error: null, more: false, ids: null })
  const [busy, setBusy] = useState(false)

  const fetchPage = useCallback(async (ids, offset) => {
    const { data, error } = await supabase.from('posts').select(POST_SELECT).in('user_id', ids)
      .order('created_at', { ascending: false }).range(offset, offset + PAGE - 1)
    if (error) throw error
    return { rows: await decoratePosts(data, user.id), more: data.length === PAGE }
  }, [user.id])

  const init = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
      if (error) throw error
      const ids = [user.id, ...data.map((f) => f.following_id)]
      const { rows, more } = await fetchPage(ids, 0)
      setState({ posts: rows, loading: false, error: null, more, ids })
    } catch (error) { setState((s) => ({ ...s, loading: false, error })) }
  }, [fetchPage, user.id])
  useEffect(() => { init() }, [init])

  const loadMore = async () => {
    setBusy(true)
    try { const { rows, more } = await fetchPage(state.ids, state.posts.length); setState((s) => ({ ...s, posts: [...s.posts, ...rows], more })) }
    catch (error) { setState((s) => ({ ...s, error })) }
    setBusy(false)
  }

  if (state.loading) return <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-96" />)}</div>
  if (state.error) return <ErrorBox error={state.error} onRetry={init} />
  if (!state.posts.length) return <Empty icon={ImageIcon} title="Your feed is quiet" text="Follow a few students or share your first photo to fill it up." action={<Link to="/post/new" className="btn-brand mt-2">Share a photo</Link>} />
  return (
    <div className="space-y-4">
      {state.posts.map((p) => <PostCard key={p.id} post={p} onDeleted={(id) => setState((s) => ({ ...s, posts: s.posts.filter((x) => x.id !== id) }))} />)}
      {state.more && <button className="btn-ghost w-full" disabled={busy} onClick={loadMore}>{busy ? 'Loading…' : 'Load more'}</button>}
    </div>
  )
}
