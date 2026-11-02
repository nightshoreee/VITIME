import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { supabase } from '../lib/supabase'
import { eventStatus } from '../lib/utils'
import { CATEGORIES } from '../lib/constants'
import { useState } from 'react'
import { Chip, Empty, ErrorBox, Skeleton } from '../components/ui'
import EventCard from '../components/EventCard'
import Feed from '../components/Feed'
import Icebreaker from '../components/Icebreaker'
import PeopleSearch from '../components/PeopleSearch'

export default function Home() {
  const { profile } = useAuth()
  const [cat, setCat] = useState('All')
  const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const ev = useAsync(async () => {
    const { data, error } = await supabase.from('events_feed').select('*').order('event_date').order('start_time').limit(60)
    if (error) throw error
    return data.filter((e) => eventStatus(e) !== 'completed')
  }, [])
  const list = (ev.data || []).filter((e) => cat === 'All' || e.category === cat)
  const boosted = list.filter((e) => e.boosted)
  const regular = list.filter((e) => !e.boosted)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">{greet}, {profile.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">Here's what's happening around campus.</p>
      </div>

      <div data-no-swipe className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="toolbar" aria-label="Event categories">
        {['All', ...CATEGORIES].map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>

      <Icebreaker />

      {ev.loading ? <Skeleton className="h-64" /> : ev.error ? <ErrorBox error={ev.error} onRetry={ev.reload} /> : (
        <>
          {boosted.length > 0 && (
            <section aria-label="Boosted events">
              <h2 className="mb-2 flex items-center gap-1.5 text-lg font-extrabold"><Zap size={18} className="text-sun-500" /> Boosted events</h2>
              <div data-no-swipe className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">{boosted.map((e) => <EventCard key={e.id} ev={e} compact />)}</div>
            </section>
          )}
          <section aria-label="Upcoming events">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-extrabold">Upcoming events</h2><Link to="/events" className="flex items-center gap-1 text-sm font-bold text-brand-600">See all <ArrowRight size={14} /></Link></div>
            {regular.length === 0 && boosted.length === 0 ? <Empty icon={CalendarDays} title="No events yet" text="Be the first to host something on campus." action={<Link className="btn-brand mt-2" to="/events/new">Create an event</Link>} />
              : <div className="grid gap-3 sm:grid-cols-2">{regular.slice(0, 4).map((e) => <EventCard key={e.id} ev={e} />)}</div>}
          </section>
        </>
      )}

      <PeopleSearch />
      <section aria-label="Feed"><h2 className="mb-2 text-lg font-extrabold">Your feed</h2><Feed /></section>
    </div>
  )
}
