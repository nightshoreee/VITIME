import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { MailCheck, ShieldCheck, Home as HomeIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, configured } from '../lib/supabase'
import { Field, Spinner } from '../components/ui'
import { GENDERS } from '../lib/constants'
import { friendlyError, isAdult, isVitEmail, REG_RE, USERNAME_RE } from '../lib/utils'

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-brand-50 to-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-sun-500"><HomeIcon /></span>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {!configured && <p className="mb-3 rounded-xl bg-sun-50 p-3 text-xs font-semibold text-sun-600">Supabase is not configured. Copy .env.example to .env and add your project URL and anon key.</p>}
        <div className="card p-5">{children}</div>
        {footer && <p className="mt-4 text-center text-sm text-slate-500">{footer}</p>}
      </div>
    </div>
  )
}
const Err = ({ msg }) => msg ? <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700" role="alert">{msg}</p> : null

export function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [f, setF] = useState({ email: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!isVitEmail(f.email)) return setErr('Use your @vitstudent.ac.in email address.')
    setBusy(true)
    try { await signIn(f.email, f.password); nav(loc.state?.from || '/', { replace: true }) }
    catch (ex) { setErr(friendlyError(ex)) } finally { setBusy(false) }
  }
  return (
    <Shell title="Welcome back" subtitle="Sign in with your VIT student email" footer={<>New here? <Link className="font-bold text-brand-600" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="VIT email"><input className="input" type="email" autoComplete="email" placeholder="name.2022@vitstudent.ac.in" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <Err msg={err} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Sign in'}</button>
        <div className="flex justify-between text-sm"><Link className="font-bold text-brand-600" to="/forgot">Forgot password?</Link><Link className="text-slate-400" to="/admin/login">Admin</Link></div>
      </form>
    </Shell>
  )
}

export function Register() {
  const { signUp } = useAuth()
  const [f, setF] = useState({ full_name: '', reg_no: '', username: '', email: '', gender: 'prefer_not_to_say', dob: '', password: '', confirm: '' })
  const [errs, setErrs] = useState({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    const v = {}
    if (f.full_name.trim().length < 2) v.full_name = 'Enter your full name.'
    if (!REG_RE.test(f.reg_no.trim().toUpperCase())) v.reg_no = 'Format: 22BCE1234'
    if (!USERNAME_RE.test(f.username.trim().toLowerCase())) v.username = '3–20 characters: letters, numbers, underscore.'
    if (!isVitEmail(f.email)) v.email = 'Must end with @vitstudent.ac.in'
    if (!f.dob) v.dob = 'Required for age checks. It is never shown publicly.'
    else if (!isAdult(f.dob, new Date(Date.now() + 2 * 365 * 864e5))) v.dob = 'You must be at least 16 to join.'
    if (f.password.length < 8) v.password = 'At least 8 characters.'
    if (f.password !== f.confirm) v.confirm = 'Passwords do not match.'
    setErrs(v)
    if (Object.keys(v).length) return
    setBusy(true)
    try {
      const { data: avail } = await supabase.rpc('check_signup_available', { p_username: f.username, p_reg_no: f.reg_no })
      if (avail?.username_taken) { setErrs({ username: 'That username is taken.' }); return }
      if (avail?.reg_taken) { setErrs({ reg_no: 'This registration number is already registered.' }); return }
      await signUp(f); setDone(true)
    } catch (ex) { setErr(friendlyError(ex)) } finally { setBusy(false) }
  }

  if (done) return (
    <Shell title="Check your inbox">
      <div className="space-y-3 text-center"><MailCheck className="mx-auto text-mint-600" size={40} />
        <p className="text-sm">We sent a verification link to <b>{f.email}</b>. Open it to activate your account, then sign in.</p>
        <Link to="/login" className="btn-primary w-full">Go to sign in</Link></div>
    </Shell>
  )
  return (
    <Shell title="Join VIT Connect" subtitle="Only verified @vitstudent.ac.in students can register" footer={<>Have an account? <Link className="font-bold text-brand-600" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Full name" error={errs.full_name}><input className="input" value={f.full_name} onChange={set('full_name')} autoComplete="name" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Registration no." error={errs.reg_no}><input className="input uppercase" placeholder="22BCE1234" value={f.reg_no} onChange={set('reg_no')} maxLength={9} /></Field>
          <Field label="Username" error={errs.username}><input className="input lowercase" value={f.username} onChange={set('username')} autoComplete="username" maxLength={20} /></Field>
        </div>
        <Field label="VIT email" error={errs.email}><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender" hint="Private. Used only for matching you opt into.">
            <select className="input" value={f.gender} onChange={set('gender')}>{GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
          </Field>
          <Field label="Date of birth" error={errs.dob}><input className="input" type="date" value={f.dob} onChange={set('dob')} max={new Date().toISOString().slice(0, 10)} /></Field>
        </div>
        <Field label="Password" error={errs.password}><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Field label="Confirm password" error={errs.confirm}><input className="input" type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
        <Err msg={err} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Create account'}</button>
        <p className="text-center text-xs text-slate-400">The email domain is verified again by the database. Your registration number and date of birth stay private.</p>
      </form>
    </Shell>
  )
}

export function Forgot() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!isVitEmail(email)) return setErr('Use your @vitstudent.ac.in email address.')
    const { error } = await resetPassword(email)
    if (error) setErr(friendlyError(error)); else setSent(true)
  }
  return (
    <Shell title="Reset password" subtitle="We'll email you a reset link" footer={<Link className="font-bold text-brand-600" to="/login">Back to sign in</Link>}>
      {sent ? <p className="text-center text-sm">If that address is registered, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="VIT email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Err msg={err} /><button className="btn-primary w-full">Send reset link</button>
        </form>)}
    </Shell>
  )
}

export function ResetPassword() {
  const { session, updatePassword, loading } = useAuth()
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (pw.length < 8) return setErr('Use at least 8 characters.')
    try { await updatePassword(pw); nav('/', { replace: true }) } catch (ex) { setErr(friendlyError(ex)) }
  }
  if (loading) return null
  return (
    <Shell title="Choose a new password">
      {!session ? <p className="text-center text-sm">This reset link is invalid or has expired. <Link className="font-bold text-brand-600" to="/forgot">Request a new one</Link>.</p> : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Err msg={err} /><button className="btn-primary w-full">Update password</button>
        </form>)}
    </Shell>
  )
}

// Separate admin entry. Access is decided by the database (is_admin()), not by this page.
export function AdminLogin() {
  const { signIn, signOut } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      await signIn(f.email, f.password)
      const { data } = await supabase.rpc('is_admin')
      if (!data) { await signOut(); throw new Error('This account is not authorised for admin access.') }
      nav('/admin', { replace: true })
    } catch (ex) { setErr(friendlyError(ex)) } finally { setBusy(false) }
  }
  return (
    <Shell title="Admin sign in" subtitle="Authorised owner only" footer={<Link className="font-bold text-brand-600" to="/login">Student sign in</Link>}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-xs font-semibold text-brand-700"><ShieldCheck size={16} /> Admin rights are checked on the server for every action.</div>
        <Field label="Email"><input className="input" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <Err msg={err} /><button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Sign in'}</button>
      </form>
    </Shell>
  )
}
