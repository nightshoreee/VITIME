import { Link } from 'react-router-dom'
import { CalendarPlus, Image, Users } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Create() {
  const { user } = useAuth()
  const { data: count } = useAsync(async () => {
    const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    return count || 0
  }, [user.id])
  const left = 5 - (count ?? 0)
  const items = [
    { to: '/post/new', icon: Image, title: 'Share a photo', text: count == null ? '…' : `${left} of 5 post slots free`, tone: 'bg-brand-50 text-brand-600' },
    { to: '/events/new', icon: CalendarPlus, title: 'Host an event', text: 'Add details, photos and products', tone: 'bg-sun-50 text-sun-600' },
    { to: '/hangouts', icon: Users, title: 'Start a group hangout', text: 'Hills, lakes, cafés and more', tone: 'bg-mint-50 text-mint-600' },
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Create</h1>
      {items.map(({ to, icon: Icon, title, text, tone }) => (
        <Link key={to} to={to} className="card flex items-center gap-4 p-4 transition hover:shadow-md">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><Icon /></span>
          <span><span className="block font-extrabold">{title}</span><span className="text-sm text-slate-500">{text}</span></span>
        </Link>
      ))}
    </div>
  )
}
