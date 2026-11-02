import { useEffect, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Icebreaker() {
  const [list, setList] = useState([])
  const [i, setI] = useState(0)
  useEffect(() => {
    supabase.from('icebreakers').select('text').then(({ data }) => {
      if (data?.length) { setList(data.map((d) => d.text)); setI(Math.floor(Math.random() * data.length)) }
    })
  }, [])
  const next = () => setI((cur) => { if (list.length < 2) return cur; let n; do { n = Math.floor(Math.random() * list.length) } while (n === cur); return n })
  if (!list.length) return null
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-5 text-white" aria-label="Random icebreaker">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sun-500/20" aria-hidden />
      <p className="flex items-center gap-1.5 text-xs font-bold text-sun-500"><Sparkles size={14} /> Start a conversation</p>
      <p className="mt-2 text-lg font-extrabold leading-snug" aria-live="polite">{list[i]}</p>
      <button onClick={next} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20"><RefreshCw size={14} /> Another question</button>
    </section>
  )
}
