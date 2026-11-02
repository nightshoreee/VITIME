import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { friendlyError } from '../lib/utils'

export default function FollowButton({ userId, following = false, onChange, small }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [on, setOn] = useState(following)
  const [busy, setBusy] = useState(false)
  useEffect(() => setOn(following), [following])
  if (userId === user.id) return null
  const toggle = async () => {
    setBusy(true)
    const q = on
      ? supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId)
      : supabase.from('follows').insert({ follower_id: user.id, following_id: userId })
    const { error } = await q
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    setOn(!on); onChange?.(!on)
  }
  return <button disabled={busy} onClick={toggle} className={`${on ? 'btn-ghost' : 'btn-brand'} ${small ? '!px-3 !py-1.5 !text-xs' : ''}`}>{on ? 'Following' : 'Follow'}</button>
}
