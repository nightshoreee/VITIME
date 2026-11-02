import { Link } from 'react-router-dom'
import { CalendarDays, MapPin, Users, Zap } from 'lucide-react'
import { publicUrl } from '../lib/supabase'
import { eventStatus, fmtDate, fmtTime } from '../lib/utils'
import { Badge } from './ui'

export const StatusBadge = ({ ev }) => {
  const s = eventStatus(ev)
  return s === 'ongoing' ? <Badge tone="mint">● Live now</Badge> : s === 'completed' ? <Badge>Completed</Badge> : <Badge tone="brand">Upcoming</Badge>
}

export default function EventCard({ ev, compact }) {
  return (
    <Link to={`/events/${ev.id}`} className={`card block overflow-hidden transition hover:shadow-md ${ev.boosted ? 'ring-2 ring-sun-500' : ''} ${compact ? 'w-72 shrink-0 snap-start' : ''}`}>
      <div className="relative">
        <img src={publicUrl('events', ev.image1_path)} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
        <div className="absolute left-2 top-2 flex gap-1.5">
          {ev.boosted && <span className="inline-flex items-center gap-1 rounded-full bg-sun-500 px-2.5 py-0.5 text-[11px] font-extrabold text-ink"><Zap size={12} /> Boosted · Sponsored</span>}
        </div>
        <div className="absolute right-2 top-2"><StatusBadge ev={ev} /></div>
      </div>
      <div className="space-y-1.5 p-3.5">
        <div className="flex items-center justify-between gap-2"><h3 className="truncate font-extrabold">{ev.title}</h3><Badge>{ev.category}</Badge></div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={13} /> {fmtDate(ev.event_date)} · {fmtTime(ev.start_time)}–{fmtTime(ev.end_time)}</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} /> <span className="truncate">{ev.location}</span></p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Users size={13} /> {ev.attendee_count}{ev.max_participants ? ` / ${ev.max_participants}` : ''} going · by {ev.host_name}</p>
      </div>
    </Link>
  )
}
