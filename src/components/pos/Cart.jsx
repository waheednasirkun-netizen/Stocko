import { useCallback } from 'react'
import { useApp } from '../../context/AppContext'

export default function Cart({ items, inventory, onUpdateQty, onRemoveItem, onClearCart, subtotal, discount, tax, total }) {
  const { theme } = useApp()
  const isDark = theme === 'dark'

  const bg = isDark ? '#0f172a' : '#ffffff'
  const cardBg = isDark ? '#1e293b' : '#f8fafc'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'
  const accent = '#6366f1'
  const danger = '#ef4444'
  const success = '#22c55e'

  const format = (n) => `Rs. ${(n || 0).toFixed(2)}`

  const getMaxStock = useCallback((id) => {
    const product = inventory.find(p => p.id === id)
    return product ? product.quantity || 0 : 0
  }, [inventory])

  const handleQtyInput = (item, value) => {
    const qty = parseInt(value, 10)
    if (isNaN(qty) || qty < 1) return
    const max = getMaxStock(item.id)
    onUpdateQty(item.id, Math.min(qty, max))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg, borderRadius: 16, border: `1px solid ${border}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: cardBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🛒</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: text }}>Cart</span>
          <span style={{ background: accent, color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{items.length}</span>
        </div>
        {items.length > 0 && <button onClick={onClearCart} style={{ background: 'none', border: 'none', cursor: 'pointer', color: danger, fontSize: 13, fontWeight: 500 }}>Clear All</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, color: muted, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🛒</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: text }}>Your cart is empty</div>
            <div style={{ fontSize: 13 }}>Click products to add them</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => {
              const maxStock = getMaxStock(item.id)
              const itemTotal = item.qty * item.price
              const isMaxed = item.qty >= maxStock
              return (
                <div key={item.id} style={{ padding: 14, borderRadius: 12, background: cardBg, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: text, lineHeight: 1.3, wordBreak: 'break-word' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{format(item.price)} / {item.unit || 'unit'}</div>
                    </div>
                    <button onClick={() => onRemoveItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: danger, fontSize: 16, padding: 4, flexShrink: 0 }}>🗑️</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => onUpdateQty(item.id, item.qty - 1)} disabled={item.qty <= 1} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${border}`, background: bg, color: text, cursor: item.qty <= 1 ? 'not-allowed' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: item.qty <= 1 ? 0.4 : 1 }}>−</button>
                      <input type="number" min={1} max={maxStock} value={item.qty} onChange={e => handleQtyInput(item, e.target.value)} style={{ width: 50, height: 32, textAlign: 'center', border: `1px solid ${border}`, borderRadius: 8, background: bg, color: text, fontSize: 14, fontWeight: 700, outline: 'none' }} />
                      <button onClick={() => onUpdateQty(item.id, item.qty + 1)} disabled={isMaxed} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${border}`, background: bg, color: text, cursor: isMaxed ? 'not-allowed' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isMaxed ? 0.4 : 1 }}>+</button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: accent }}>{format(itemTotal)}</div>
                  </div>
                  {isMaxed && maxStock > 0 && <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500 }}>⚠️ Max stock reached ({maxStock})</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${border}`, background: cardBg, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: muted }}>Subtotal</span><span style={{ fontWeight: 600, color: text }}>{format(subtotal)}</span></div>
          {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: muted }}>Discount</span><span style={{ fontWeight: 600, color: success }}>−{format(discount)}</span></div>}
          {tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: muted }}>Tax</span><span style={{ fontWeight: 600, color: text }}>+{format(tax)}</span></div>}
          <div style={{ borderTop: `1px solid ${border}`, marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: text }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: accent }}>{format(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}