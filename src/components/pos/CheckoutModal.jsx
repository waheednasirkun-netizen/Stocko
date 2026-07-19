import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'

const METHODS = { CASH: 'cash', CARD: 'card', BANK_TRANSFER: 'bank_transfer', CREDIT: 'credit' }
const LABELS = { [METHODS.CASH]: 'Cash', [METHODS.CARD]: 'Card', [METHODS.BANK_TRANSFER]: 'Bank Transfer', [METHODS.CREDIT]: 'Credit' }

export default function CheckoutModal({ isOpen, onClose, onConfirm, cartItems, customer, invoiceNo, subtotal, discount, tax, total }) {
  const { theme } = useApp()
  const isDark = theme === 'dark'

  const [method, setMethod] = useState(METHODS.CASH)
  const [paid, setPaid] = useState(total.toFixed(2))
  const [remarks, setRemarks] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  const bg = isDark ? '#0f172a' : '#ffffff'
  const cardBg = isDark ? '#1e293b' : '#f8fafc'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'
  const accent = '#6366f1'
  const danger = '#ef4444'

  const format = (n) => `Rs. ${(n || 0).toFixed(2)}`

  const due = useMemo(() => Math.max(0, total - (parseFloat(paid) || 0)), [paid, total])
  const change = useMemo(() => Math.max(0, (parseFloat(paid) || 0) - total), [paid, total])
  const status = useMemo(() => { const p = parseFloat(paid) || 0; return p >= total ? 'paid' : p > 0 ? 'partial' : 'unpaid' }, [paid, total])

  useEffect(() => { if (isOpen) { setMethod(METHODS.CASH); setPaid(total.toFixed(2)); setRemarks(''); setError(null); setProcessing(false) } }, [isOpen, total])

  const handleMethod = (m) => { setMethod(m); setError(null); m === METHODS.CREDIT ? setPaid('0') : setPaid(total.toFixed(2)) }
  const handlePaid = (e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) { setPaid(v); setError(null) } }

  const handleConfirm = useCallback(async () => {
    setError(null)
    const p = parseFloat(paid) || 0
    if (cartItems.length === 0) { setError('Cannot checkout empty cart.'); return }
    if (p < 0) { setError('Paid amount cannot be negative.'); return }
    if (method !== METHODS.CREDIT && p <= 0) { setError('Please enter a valid payment amount.'); return }
    setProcessing(true)
    try {
      await onConfirm({ paymentMethod: method, paidAmount: p, dueAmount: due, changeAmount: change, paymentStatus: status, remarks })
    } catch (err) { setError(err.message || 'Checkout failed.') }
    finally { setProcessing(false) }
  }, [cartItems, paid, method, due, change, status, remarks, onConfirm])

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: bg, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${border}` }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: cardBg, borderRadius: '20px 20px 0 0' }}>
          <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: text }}>Checkout</h2><div style={{ fontSize: 13, color: muted, marginTop: 4 }}>Invoice: <strong>{invoiceNo}</strong></div></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: muted }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {error && <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: danger, fontSize: 13, fontWeight: 500, marginBottom: 16 }}>{error}</div>}
          <div style={{ padding: '14px 16px', background: cardBg, borderRadius: 10, marginBottom: 20, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6, textTransform: 'uppercase' }}>Customer</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: text }}>{customer?.name || 'Walk-in Customer'}</div>
            {customer?.phone && <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{customer.phone}</div>}
          </div>
          <div style={{ padding: '14px 16px', background: cardBg, borderRadius: 10, marginBottom: 20, border: `1px solid ${border}`, maxHeight: 180, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 10, textTransform: 'uppercase' }}>Items ({cartItems.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cartItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}><span style={{ color: muted, flexShrink: 0 }}>{item.qty}x</span><span style={{ color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span></div>
                  <span style={{ fontWeight: 600, color: text, flexShrink: 0, marginLeft: 8 }}>{format(item.qty * item.price)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: 16, background: cardBg, borderRadius: 10, marginBottom: 20, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: muted }}>Subtotal</span><span style={{ fontWeight: 600, color: text }}>{format(subtotal)}</span></div>
            {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: muted }}>Discount</span><span style={{ fontWeight: 600, color: '#22c55e' }}>−{format(discount)}</span></div>}
            {tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: muted }}>Tax</span><span style={{ fontWeight: 600, color: text }}>+{format(tax)}</span></div>}
            <div style={{ borderTop: `1px solid ${border}`, marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: text }}>Total</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: accent }}>{format(total)}</span>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 10, textTransform: 'uppercase' }}>Payment Method</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {Object.values(METHODS).map(m => (
                <button key={m} onClick={() => handleMethod(m)} style={{ padding: '12px 16px', borderRadius: 10, border: `2px solid ${method === m ? accent : border}`, background: method === m ? (isDark ? '#1e1b4b' : '#eef2ff') : bg, color: method === m ? accent : text, cursor: 'pointer', fontSize: 14, fontWeight: method === m ? 700 : 500 }}>
                  {m === METHODS.CASH && '💵'}{m === METHODS.CARD && '💳'}{m === METHODS.BANK_TRANSFER && '🏦'}{m === METHODS.CREDIT && '📝'} {LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 10, textTransform: 'uppercase' }}>Amount Paid</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: muted }}>Rs.</span>
              <input type="text" inputMode="decimal" value={paid} onChange={handlePaid} disabled={method === METHODS.CREDIT} style={{ width: '100%', padding: '14px 16px 14px 56px', borderRadius: 10, border: `2px solid ${border}`, background: method === METHODS.CREDIT ? (isDark ? '#0f172a' : '#f0f0f0') : bg, color: text, fontSize: 20, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              {due > 0 && <div style={{ flex: 1, padding: '10px 14px', background: '#fef3c7', borderRadius: 8, textAlign: 'center' }}><div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, textTransform: 'uppercase' }}>Due</div><div style={{ fontSize: 18, fontWeight: 800, color: '#92400e' }}>{format(due)}</div></div>}
              {change > 0 && <div style={{ flex: 1, padding: '10px 14px', background: '#dcfce7', borderRadius: 8, textAlign: 'center' }}><div style={{ fontSize: 11, color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Change</div><div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>{format(change)}</div></div>}
              {due === 0 && change === 0 && method !== METHODS.CREDIT && <div style={{ flex: 1, padding: '10px 14px', background: '#dcfce7', borderRadius: 8, textAlign: 'center' }}><div style={{ fontSize: 11, color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Status</div><div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>Paid in Full</div></div>}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 10, textTransform: 'uppercase' }}>Remarks (Optional)</div>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} placeholder="Add notes..." style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${border}`, background: bg, color: text, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px 24px', borderTop: `1px solid ${border}`, display: 'flex', gap: 12 }}>
          <button onClick={onClose} disabled={processing} style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${border}`, background: 'transparent', color: text, cursor: processing ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 600, opacity: processing ? 0.6 : 1 }}>Cancel</button>
          <button onClick={handleConfirm} disabled={processing || cartItems.length === 0} style={{ flex: 2, padding: 14, borderRadius: 12, border: 'none', background: accent, color: '#fff', cursor: processing || cartItems.length === 0 ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, opacity: processing || cartItems.length === 0 ? 0.6 : 1 }}>
            {processing ? 'Processing...' : `✓ Complete Sale ${format(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}