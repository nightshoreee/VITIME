import { useState } from 'react'
import { Modal, Field } from './ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { REPORT_REASONS } from '../lib/constants'
import { friendlyError } from '../lib/utils'

export default function ReportModal({ open, onClose, targetType, targetId }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    const { error } = await supabase.from('reports').insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason, details: details.trim() })
    setBusy(false)
    if (error) return toast(error.code === '23505' ? 'You already reported this.' : friendlyError(error), 'error')
    toast('Report sent. Moderators will review it.'); setDetails(''); onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={`Report ${targetType}`}>
      <div className="space-y-3">
        <Field label="Reason">
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Details (optional)"><textarea className="input" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
        <button className="btn-danger w-full" disabled={busy} onClick={submit}>Send report</button>
      </div>
    </Modal>
  )
}
