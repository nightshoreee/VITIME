import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAsync } from '../hooks/useAsync'
import { CATEGORIES } from '../lib/constants'
import { eventStatus } from '../lib/utils'
import { Chip, Empty, ErrorBox, Skeleton } from '../components/ui'
import EventCard from '../components/EventCard'

export default function Events() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [status, setStatus] = useState('upcoming')
  const [sort, setSort] = useState('soonest')
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('events_feed').select('*').order('event_date', { ascending: false }).limit(200)
    if (error) throw error
    return data
  }, [])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    let r = (data || []).filter((e) =>
      (cat === 'All' || e.category === cat) &&
      (status === 'all' || (status === 'upcoming' ? eventStatus(e) !== 'completed' : eventStatus(e) === 'completed')) &&
      (!term || [e.title, e.location, e.host_name, e.description].some((s) => s.toLowerCase().includes(term))))
    const key = (e) => `${e.event_date}T${e.start_time}`
    r = [...r].sort((a, b) => sort === 'soonest' ? key(a).localeCompare(key(b)) : sort === 'newest' ? b.created_at.localeCompare(a.created_at) : b.attendee_count - a.attendee_count)
    return [...r.filter((e) => e.boosted && eventStatus(e) !== 'completed'), ...r.filter((e) => !(e.boosted && eventStatus(e) !== 'completed'))]   // boosted always first
  }, [data, q, cat, status, sort])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">Events</h1><Link to="/events/new" className="btn-brand"><Plus size={16} /> Host</Link></div>
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !pl-9" placeholder="Search events, places, hosts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" /></div>
      <div data-no-swipe className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">{['All', ...CATEGORIES].map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      <div className="flex gap-2">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="upcoming">Upcoming & live</option><option value="completed">Completed</option><option value="all">All</option></select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="soonest">Soonest first</option><option value="newest">Newest listed</option><option value="popular">Most popular</option></select>
      </div>
      {loading ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-60" />)}</div>
        : error ? <ErrorBox error={error} onRetry={reload} />
        : rows.length === 0 ? <Empty icon={CalendarDays} title="No events match" text="Try a different search or category, or host your own." />
        : <div className="grid gap-3 sm:grid-cols-2">{rows.map((e) => <EventCard key={e.id} ev={e} />)}</div>}
    </div>
  )
}
