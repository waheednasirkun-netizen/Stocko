import { useEffect, useRef, useState } from 'react'
import { Ic, Modal } from '../ui'
import { useApp } from '../../context/AppContext'

function formatTime(value) {
  if (!value) return 'Any time'
  const [h, m = 0] = String(value).split(':').map(Number)
  if (Number.isNaN(h)) return value
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CompletionModal({
  open = false,
  assignment = null,
  loading = false,
  onClose,
  onComplete,
}) {
  const { theme } = useApp()
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setNote('')
    setPhoto(null)
    setError('')
    setPreview('')
  }, [open, assignment?.id])

  useEffect(() => {
    if (!photo) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  if (!assignment) return null

  const requireNote = Boolean(assignment.require_note)
  const requirePhoto = Boolean(assignment.require_photo)
  const title = assignment.title || assignment.name || 'Assignment'

  const submit = async event => {
    event.preventDefault()
    setError('')

    if (requireNote && !note.trim()) {
      setError('A completion note is required for this assignment.')
      return
    }

    if (requirePhoto && !photo) {
      setError('Photo proof is required before you can check this assignment.')
      return
    }

    if (typeof onComplete !== 'function') return

    await onComplete(assignment, {
      note: note.trim(),
      photo,
      completed_at: new Date().toISOString(),
      scheduled_date: today(),
      status: 'completed',
    })
  }

  return (
    <Modal open={open} onClose={() => !loading && onClose?.()} title="Check assignment" width={560}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
        <div style={{ border: `1px solid ${theme?.border || '#e4e7ec'}`, borderRadius: 13, padding: 14, background: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: '#ecfdf3', color: '#027a48', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Ic n="CheckCircle" size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: theme?.text || '#101828', fontSize: 15, fontWeight: 800 }}>{title}</div>
              {assignment.description && (
                <div style={{ marginTop: 4, color: theme?.textMuted || '#667085', fontSize: 12.5, lineHeight: 1.5 }}>{assignment.description}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                <span style={chip}><Ic n="RefreshCw" size={12} /> {String(assignment.recurrence || 'daily').replaceAll('_', ' ')}</span>
                <span style={chip}><Ic n="Activity" size={12} /> {assignment.start_time || assignment.deadline_time ? `${formatTime(assignment.start_time)} – ${formatTime(assignment.deadline_time)}` : formatTime(assignment.scheduled_time)}</span>
                <span style={chip}><Ic n="Shield" size={12} /> {Number(assignment.time_limit_minutes || 0)} min</span>
              </div>
            </div>
          </div>
        </div>

        <label>
          <span style={label}>Completion note {requireNote && <b style={{ color: '#dc2626' }}>*</b>}</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="What was checked, completed or found?"
            style={input}
          />
        </label>

        <div>
          <span style={label}>Photo proof {requirePhoto && <b style={{ color: '#dc2626' }}>*</b>}</span>
          <div
            style={{
              border: '1px dashed #cbd5e1',
              borderRadius: 12,
              padding: 14,
              background: theme?.inputBg || theme?.cardBg || '#fbfcfe',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={e => {
                setPhoto(e.target.files?.[0] || null)
                setError('')
              }}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef2ff', color: '#4f46e5', display: 'grid', placeItems: 'center' }}>
                  <Ic n="FileText" size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#344054' }}>{photo ? photo.name : 'Attach an image'}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: '#98a2b3' }}>{requirePhoto ? 'Required evidence' : 'Optional evidence'}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                style={secondaryButton}
              >
                <Ic n="FileText" size={14} /> Choose photo
              </button>
            </div>

            {preview && (
              <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden', border: `1px solid ${theme?.border || '#e4e7ec'}`, maxHeight: 220, background: '#fff' }}>
                <img src={preview} alt="Selected proof" style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 11, borderRadius: 10, background: '#fef3f2', color: '#b42318', fontSize: 12 }}>
            <Ic n="AlertTriangle" size={15} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, paddingTop: 2 }}>
          <button type="button" onClick={onClose} disabled={loading} style={secondaryButton}>Cancel</button>
          <button
            type="submit"
            disabled={loading}
            style={{
              border: 0,
              borderRadius: 9,
              padding: '9px 16px',
              background: '#16a34a',
              color: '#fff',
              fontWeight: 750,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .65 : 1,
            }}
          >
            {loading ? 'Checking…' : 'Mark as checked'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const input = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 42,
  border: '1px solid #dbe3ef',
  borderRadius: 10,
  padding: '10px 12px',
  background: '#fff',
  color: '#172033',
  fontSize: 13,
  outline: 'none',
  resize: 'vertical',
}

const label = {
  display: 'block',
  marginBottom: 6,
  color: '#475467',
  fontSize: 12,
  fontWeight: 700,
}

const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 23,
  padding: '2px 8px',
  borderRadius: 999,
  background: '#fff',
  color: '#667085',
  border: '1px solid #e4e7ec',
  fontSize: 10.5,
  fontWeight: 700,
}


const secondaryButton = {
  border: '1px solid #dbe3ef',
  borderRadius: 9,
  padding: '8px 12px',
  background: '#fff',
  color: '#344054',
  fontSize: 12,
  fontWeight: 750,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}
