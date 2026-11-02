import { supabase } from './supabase'

export const POST_SELECT = '*, author:profiles!user_id(username,full_name,avatar_path), likes(count), comments(count)'

// Adds liked/saved flags + counts for the current user.
export async function decoratePosts(rows, uid) {
  if (!rows?.length) return []
  const ids = rows.map((r) => r.id)
  const [l, s] = await Promise.all([
    supabase.from('likes').select('post_id').eq('user_id', uid).in('post_id', ids),
    supabase.from('saved_posts').select('post_id').eq('user_id', uid).in('post_id', ids),
  ])
  const L = new Set((l.data || []).map((x) => x.post_id))
  const S = new Set((s.data || []).map((x) => x.post_id))
  return rows.map((r) => ({
    ...r, liked: L.has(r.id), saved: S.has(r.id),
    like_count: r.likes?.[0]?.count ?? 0, comment_count: r.comments?.[0]?.count ?? 0,
  }))
}

export async function blockUser(me, other) {
  const { error } = await supabase.from('blocks').insert({ blocker_id: me, blocked_id: other })
  if (error && !error.message.includes('duplicate')) throw error
}
