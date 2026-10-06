import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'

const METHODS = { CASH: 'cash', CARD: 'card', BANK_TRANSFER: 'bank_transfer', CREDIT: 'credit' }
const LABELS = { [METHODS.CASH]: 'Cash', [METHODS.CARD]: 'Card', [METHODS.BANK_TRANSFER]: 'Bank Transfer', [METHODS.CREDIT]: 'Credit' }

export default function CheckoutModal({ isOpen, onClose, onConfirm, cartItems, customer, invoiceNo, subtotal, discount, tax, total }) {
  const { theme } = useApp()

  const [method, setMethod] = useState(METHODS.CASH)
  const [paid, setPaid] = useState(total.toFixed(2))
  const [remarks, setRemarks] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  /* ── Stocko Design Tokens (theme-aware) ── */
  const bg = theme.cardBg || '#ffffff'
  const cardBg = theme.bg || '#f8fafc'
  const border = theme.border || '#e2e8f0'
  const text = theme.text || '#0f172a'
  const muted = theme.textMuted || '#64748b'
  const accent = theme.primary || '#3b82f6'
  const accentLight = theme.primaryBg || '#eff6ff'
  const danger = '#ef4444'
  const success = '#22c55e'
  const warning = '#f59e0b'

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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: bg, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${border}`, boxShadow: theme.shadowLg || '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: cardBg, borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: text, letterSpacing: -0.3 }}>Checkout</h2>
            <div style={{ fontSize: 13, color: muted, marginTop: 4, fontWeight: 500 }}>Invoice: <strong style={{ color: text }}>{invoiceNo}</strong></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: muted, width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = theme.cardHover || '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Error */}
          {error && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: danger, fontSize: 13, fontWeight: 500, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠</span> {error}
            </div>
          )}

          {/* Customer */}
          <div style={{ padding: '14px 16px', background: cardBg, borderRadius: 12, marginBottom: 20, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: text }}>{customer?.name || 'Walk-in Customer'}</div>
            {customer?.phone && <div style={{ fontSize: 13, color: muted, marginTop: 2, fontWeight: 500 }}>{customer.phone}</div>}
          </div>

          {/* Items */}
          <div style={{ padding: '14px 16px', background: cardBg, borderRadius: 12, marginBottom: 20, border: `1px solid ${border}`, maxHeight: 180, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Items ({cartItems.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cartItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0, alignItems: 'center' }}>
                    <span style={{ color: muted, flexShrink: 0, fontWeight: 600, fontSize: 12, background: cardBg === theme.bg ? theme.cardHover || '#f1f5f9' : '#334155', padding: '2px 8px', borderRadius: 6 }}>{item.qty}x</span>
                    <span style={{ color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{item.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: text, flexShrink: 0, marginLeft: 8, fontSize: 13 }}>{format(item.qty * item.price)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div style={{ padding: 18, background: cardBg, borderRadius: 12, marginBottom: 20, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: muted, fontWeight: 500 }}>Subtotal</span>
              <span style={{ fontWeight: 600, color: text }}>{format(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: muted, fontWeight: 500 }}>Discount</span>
                <span style={{ fontWeight: 600, color: success }}>−{format(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: muted, fontWeight: 500 }}>Tax</span>
                <span style={{ fontWeight: 600, color: text }}>+{format(tax)}</span>
              </div>
            )}
            <div style={{ borderTop: `1px solid ${border}`, marginTop: 6, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: text }}>Total</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: accent, letterSpacing: -0.5 }}>{format(total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Method</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {Object.values(METHODS).map(m => (
                <button key={m} onClick={() => handleMethod(m)} style={{
                  padding: '14px 16px', borderRadius: 12, border: `2px solid ${method === m ? accent : border}`,
                  background: method === m ? accentLight : bg, color: method === m ? accent : text,
                  cursor: 'pointer', fontSize: 14, fontWeight: method === m ? 700 : 500,
                  transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: method === m ? `0 0 0 3px ${accent}20` : 'none'
                }}>
                  <span style={{ fontSize: 18 }}>
                    {m === METHODS.CASH && '💵'}{m === METHODS.CARD && '💳'}{m === METHODS.BANK_TRANSFER && '🏦'}{m === METHODS.CREDIT && '📝'}
                  </span>
                  {LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Paid */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount Paid</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: muted }}>Rs.</span>
              <input type="text" inputMode="decimal" value={paid} onChange={handlePaid} disabled={method === METHODS.CREDIT} style={{
                width: '100%', padding: '16px 16px 16px 60px', borderRadius: 12, border: `2px solid ${border}`,
                background: method === METHODS.CREDIT ? cardBg : bg,
                color: text, fontSize: 22, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s'
              }} onFocus={e => e.target.style.borderColor = accent} onBlur={e => e.target.style.borderColor = border} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              {due > 0 && (
                <div style={{ flex: 1, padding: '12px 16px', background: '#fef3c7', borderRadius: 10, textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Due</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#92400e', marginTop: 4 }}>{format(due)}</div>
                </div>
              )}
              {change > 0 && (
                <div style={{ flex: 1, padding: '12px 16px', background: '#dcfce7', borderRadius: 10, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Change</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', marginTop: 4 }}>{format(change)}</div>
                </div>
              )}
              {due === 0 && change === 0 && method !== METHODS.CREDIT && (
                <div style={{ flex: 1, padding: '12px 16px', background: '#dcfce7', borderRadius: 10, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', marginTop: 4 }}>Paid in Full</div>
                </div>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remarks (Optional)</div>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} placeholder="Add notes..." style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, border: `1px solid ${border}`,
              background: bg, color: text, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              transition: 'border-color 0.15s', lineHeight: 1.5
            }} onFocus={e => e.target.style.borderColor = accent} onBlur={e => e.target.style.borderColor = border} />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px 24px 24px', borderTop: `1px solid ${border}`, display: 'flex', gap: 12, background: cardBg, borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} disabled={processing} style={{
            flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${border}`,
            background: 'transparent', color: text, cursor: processing ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 600, opacity: processing ? 0.6 : 1,
            transition: 'all 0.15s'
          }}>Cancel</button>
          <button onClick={handleConfirm} disabled={processing || cartItems.length === 0} style={{
            flex: 2, padding: 14, borderRadius: 12, border: 'none',
            background: accent, color: '#fff', cursor: processing || cartItems.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 700, opacity: processing || cartItems.length === 0 ? 0.6 : 1,
            transition: 'all 0.15s', boxShadow: `0 4px 14px ${accent}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            {processing ? 'Processing...' : `✓ Complete Sale ${format(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}