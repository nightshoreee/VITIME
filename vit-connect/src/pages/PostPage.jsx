import { useParams } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { decoratePosts, POST_SELECT } from '../lib/posts'
import { Empty, ErrorBox, PageLoader } from '../components/ui'
import PostCard from '../components/PostCard'

export default function PostPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('posts').select(POST_SELECT).eq('id', id).maybeSingle()
    if (error) throw error
    return data ? (await decoratePosts([data], user.id))[0] : null
  }, [id])
  if (loading) return <PageLoader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return <Empty icon={ImageOff} title="Post not found" text="It may have been deleted." />
  return <PostCard post={data} />
}
