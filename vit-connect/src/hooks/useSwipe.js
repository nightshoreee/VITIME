import { useEffect, useRef } from 'react'

export const SWIPE_MIN = 70

// Returns 'right' (finger moved left→right), 'left' (right→left) or null.
// Requires a mostly-horizontal gesture so vertical scrolling is never hijacked.
export function swipeIntent(dx, dy, min = SWIPE_MIN) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 2) return null
  return dx > 0 ? 'right' : 'left'
}

// Gestures that start on inputs, forms, or [data-no-swipe] regions (carousels, chip rows) are ignored.
const IGNORE = 'input,textarea,select,form,[data-no-swipe],[contenteditable="true"]'

export function useSwipe(onSwipe) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !onSwipe) return undefined
    let sx = 0, sy = 0, ok = false
    const start = (e) => {
      ok = e.touches.length === 1 && !e.target.closest?.(IGNORE)
      sx = e.touches[0].clientX; sy = e.touches[0].clientY
    }
    const end = (e) => {
      if (!ok) return
      ok = false
      const t = e.changedTouches[0]
      const dir = swipeIntent(t.clientX - sx, t.clientY - sy)
      if (dir) onSwipe(dir)
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchend', end, { passive: true })
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end) }
  }, [onSwipe])
  return ref
}
