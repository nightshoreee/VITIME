// Pure helpers (no network) so they can be unit tested.
export const VIT_EMAIL_RE = /^[a-z0-9._%+-]+@vitstudent\.ac\.in$/i
export const REG_RE = /^[0-9]{2}[A-Z]{3}[0-9]{4}$/
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export const isVitEmail = (e) => VIT_EMAIL_RE.test((e || '').trim())

export function validateImage(file) {
  if (!file) return 'Please choose an image.'
  if (!IMAGE_TYPES.includes(file.type)) return 'Only JPG, PNG or WebP images are allowed.'
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be smaller than 3 MB.'
  return null
}

export function isAdult(dob, now = new Date()) {
  if (!dob) return false
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return false
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  return d <= cutoff
}

export function eventWindow(ev) {
  const start = new Date(`${ev.event_date}T${ev.start_time}`)
  const end = new Date(`${ev.event_date}T${ev.end_time}`)
  return { start, end }
}

// 'upcoming' | 'ongoing' | 'completed'
export function eventStatus(ev, now = new Date()) {
  const { start, end } = eventWindow(ev)
  if (now < start) return 'upcoming'
  if (now <= end) return 'ongoing'
  return 'completed'
}

export function timeAgo(date, now = new Date()) {
  const s = Math.max(0, Math.floor((now - new Date(date)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtTime = (t) => new Date(`2000-01-01T${t}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
export const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export function friendlyError(e) {
  const m = e?.message || String(e || 'Something went wrong')
  const rules = [
    ['POST_LIMIT', 'You already have 5 posts. Delete one to free a slot.'],
    ['RATE_LIMIT', 'You are doing that too fast. Please wait a moment and try again.'],
    ['EVENT_FULL', 'This event has reached its participant limit.'],
    ['DEADLINE_PASSED', 'Registration for this event has closed.'],
    ['EVENT_COMPLETED', 'This event has already ended.'],
    ['AGE_RESTRICTED', 'Dating is only available to verified adults (18+). Add your date of birth in Edit profile.'],
    ['NOT_OPTED_IN', 'Turn this feature on in your preferences first.'],
    ['REQUEST_PENDING', 'Wait for them to accept your message request before sending more.'],
    ['REQUEST_DECLINED', 'This person declined your message request.'],
    ['BLOCKED', 'You cannot message this user.'],
    ['profiles_username_key', 'That username is already taken.'],
    ['profile_private_reg_no_key', 'That registration number is already registered.'],
    ['Only @vitstudent.ac.in', 'Only @vitstudent.ac.in email addresses can register.'],
    ['Invalid login credentials', 'Incorrect email or password.'],
    ['Email not confirmed', 'Please verify your email first. Check your inbox for the confirmation link.'],
    ['row-level security', 'You do not have permission to do that.'],
    ['Failed to fetch', 'Network problem. Check your connection and try again.'],
  ]
  for (const [k, v] of rules) if (m.includes(k)) return v
  return m.replace(/^[A-Z_]{4,}:\s*/, '')
}
