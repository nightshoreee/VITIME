import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, Heart, Home, MessageCircle, Plus, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useSwipe } from '../hooks/useSwipe'
import { Avatar } from './ui'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/hangouts', label: 'Hangouts', icon: Heart },
  { to: '/create', label: 'Create', icon: Plus, center: true },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const notifText = { like: 'liked your post', comment: 'commented on your post', follow: 'started following you', event_register: 'registered for your event', event_update: 'An event you joined was updated', message: 'sent you a message', match: 'You have a new match!', boost_approved: 'Your boost was approved', boost_rejected: 'Your boost request was rejected' }

function browserNotify(n) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
  new Notification('VIT Connect', { body: notifText[n.type] || 'New notification' })
}

export default function Layout() {
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const inRoom = !!useMatch('/chats/:id')
  const [counts, setCounts] = useState({ n: 0, m: 0 })
  const pathRef = useRef(loc.pathname)
  pathRef.current = loc.pathname

  // Swipe left→right = Home, right→left = Profile. Disabled in chat rooms.
  const onSwipe = useCallback((dir) => {
    const target = dir === 'right' ? '/' : '/profile'
    if (pathRef.current !== target) nav(target)
  }, [nav])
  const swipeRef = useSwipe(inRoom ? null : onSwipe)

  const refresh = useCallback(async () => {
    const [n, c] = await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
      supabase.rpc('my_conversations'),
    ])
    setCounts({ n: n.count || 0, m: (c.data || []).reduce((a, x) => a + Number(x.unread), 0) })
  }, [user.id])

  useEffect(() => { refresh() }, [refresh, loc.pathname])
  useEffect(() => {
    const ch = supabase.channel(`badges-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p) => { refresh(); if (p.eventType === 'INSERT') browserNotify(p.new) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh, user.id])

  const Dot = ({ n }) => n > 0 ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white">{n > 9 ? '9+' : n}</span> : null

  return (
    <div ref={swipeRef} className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 rounded-xl px-2 py-1 font-extrabold" aria-label="Go to Home">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-sun-500"><Home size={16} /></span>
            <span className="hidden sm:inline">VIT Connect</span><span className="sm:hidden">Home</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link to="/chats" aria-label="Messages" className="relative rounded-full p-2 hover:bg-slate-100"><MessageCircle size={22} /><Dot n={counts.m} /></Link>
            <Link to="/notifications" aria-label="Notifications" className="relative rounded-full p-2 hover:bg-slate-100"><Bell size={22} /><Dot n={counts.n} /></Link>
            <Link to="/profile" aria-label="Go to your profile" className="ml-1 rounded-full"><Avatar path={profile.avatar_path} name={profile.full_name} size={34} /></Link>
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-3xl px-4 pt-4 ${inRoom ? 'pb-4' : 'pb-28'}`}><Outlet /></main>

      {!inRoom && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur" aria-label="Main">
          <ul className="mx-auto flex h-16 max-w-3xl items-center justify-around px-2">
            {NAV.map(({ to, label, icon: Icon, end, center }) => (
              <li key={to}>
                <NavLink to={to} end={end} aria-label={label}
                  className={({ isActive }) => center
                    ? 'grid h-12 w-12 -translate-y-3 place-items-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/40'
                    : `flex w-16 flex-col items-center gap-0.5 text-[11px] font-bold ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>
                  {center ? <Icon size={26} /> : <><Icon size={22} />{label}</>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
