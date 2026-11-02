import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './ui'
import FollowButton from './FollowButton'

export default function PeopleSearch() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [following, setFollowing] = useState(new Set())

  useEffect(() => {
    supabase.from('follows').select('following_id').eq('follower_id', user.id).then(({ data }) => setFollowing(new Set((data || []).map((x) => x.following_id))))
  }, [user.id])

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim().replace(/[%,()]/g, '')
      let query = supabase.from('profiles').select('id,username,full_name,avatar_path').neq('id', user.id).limit(6)
      query = term ? query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`) : query.order('created_at', { ascending: false })
      const { data } = await query
      setRows(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, user.id])

  return (
    <section className="card p-4" aria-label="Find students">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input !pl-9" placeholder="Find students by name or username" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
      </div>
      {rows.length === 0 ? <p className="py-2 text-center text-sm text-slate-400">No students found.</p> : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3">
              <Link to={`/u/${r.username}`} className="flex min-w-0 items-center gap-2.5"><Avatar path={r.avatar_path} name={r.full_name} size={36} /><span className="min-w-0"><span className="block truncate text-sm font-extrabold">{r.full_name}</span><span className="block truncate text-xs text-slate-500">@{r.username}</span></span></Link>
              <FollowButton small userId={r.id} following={following.has(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
