import { useEffect, useRef } from 'react'
import { Loader2, X, ImagePlus, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { publicUrl } from '../lib/supabase'

export const Spinner = ({ className = '' }) => <Loader2 className={`animate-spin ${className}`} size={20} aria-label="Loading" />
export const PageLoader = () => <div className="grid min-h-[40vh] place-items-center text-brand-600"><Spinner className="h-8 w-8" /></div>
export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      {Icon && <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon size={24} /></div>}
      <h3 className="text-base font-extrabold">{title}</h3>
      {text && <p className="max-w-xs text-sm text-slate-500">{text}</p>}
      {action}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="card flex items-start gap-3 border-rose-200 p-4 text-sm text-rose-700" role="alert">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-bold">Something went wrong</p>
        <p className="text-rose-600">{error?.message || String(error)}</p>
        {onRetry && <button className="mt-2 font-bold underline" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} data-no-swipe
        className={`max-h-[90vh] w-full animate-pop overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Avatar({ path, name = '?', size = 40, className = '' }) {
  const src = publicUrl('avatars', path)
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return src
    ? <img src={src} alt="" loading="lazy" style={{ width: size, height: size }} className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`} />
    : <div style={{ width: size, height: size, fontSize: size / 2.6 }} className={`grid shrink-0 place-items-center rounded-full bg-brand-100 font-extrabold text-brand-700 ${className}`} aria-hidden>{initials}</div>
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-rose-600" role="alert">{error}</span>}
    </label>
  )
}

export const Badge = ({ tone = 'slate', children }) => {
  const t = { slate: 'bg-slate-100 text-slate-600', sun: 'bg-sun-100 text-sun-600', mint: 'bg-mint-50 text-mint-600', brand: 'bg-brand-100 text-brand-700', rose: 'bg-rose-100 text-rose-700' }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${t}`}>{children}</span>
}

export const Chip = ({ active, children, ...p }) => <button type="button" aria-pressed={!!active} className={`chip ${active ? 'chip-on' : 'hover:bg-slate-50'}`} {...p}>{children}</button>

// options: [{value,label}] ; value: string[]
export function MultiSelect({ options, value = [], onChange, max }) {
  const toggle = (v) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v))
    else if (!max || value.length < max) onChange([...value, v])
  }
  return <div className="flex flex-wrap gap-2">{options.map((o) => <Chip key={o.value} active={value.includes(o.value)} onClick={() => toggle(o.value)}>{o.label}</Chip>)}</div>
}

export function Toggle({ checked, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div><p className="text-sm font-bold">{label}</p>{desc && <p className="text-xs text-slate-500">{desc}</p>}</div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

export function ImagePicker({ label, file, onChange, existingUrl, error }) {
  const preview = file ? URL.createObjectURL(file) : existingUrl
  return (
    <div>
      {label && <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>}
      <label className="relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-brand-500">
        {preview ? <img src={preview} alt="Preview" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-xs font-bold"><ImagePlus /> Tap to choose (JPG, PNG, WebP · max 3 MB)</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </label>
      {error && <p className="mt-1 text-xs font-semibold text-rose-600" role="alert">{error}</p>}
    </div>
  )
}

export function Pager({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize))
  return (
    <div className="flex items-center justify-between pt-3 text-sm">
      <span className="text-slate-500">{total || 0} result{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <button className="btn-ghost !px-2.5 !py-1.5" disabled={page <= 0} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="font-bold">{page + 1} / {pages}</span>
        <button className="btn-ghost !px-2.5 !py-1.5" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

// Horizontal image carousel; marked data-no-swipe so page-swipe never fights it.
export function Carousel({ images, alt }) {
  return (
    <div data-no-swipe className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl" role="group" aria-label={`${alt} images`}>
      {images.filter(Boolean).map((src, i) => <img key={i} src={src} alt={`${alt} ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full shrink-0 snap-center object-cover" />)}
    </div>
  )
}
