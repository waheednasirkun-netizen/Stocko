import { useCallback } from 'react'
import { useApp } from '../../context/AppContext'

export default function Cart({ items, inventory, onUpdateQty, onRemoveItem, onClearCart, subtotal, discount, tax, total }) {
  const { theme } = useApp()

  /* ── Stocko Design Tokens (theme-aware) ── */
  const bg = theme?.bg || '#f8fafc'
  const cardBg = theme?.cardBg || '#ffffff'
  const border = theme?.border || '#e2e8f0'
  const text = theme?.text || '#0f172a'
  const muted = theme?.textMuted || '#64748b'
  const inputBg = theme?.inputBg || '#ffffff'
  const accent = theme?.primary || '#3b82f6'
  const accentLight = theme?.primaryBg || '#eff6ff'

  const money = n => `Rs. ${Number(n || 0).toFixed(2)}`
  const maxStock = useCallback(id => Number(inventory.find(p => p.id === id)?.quantity || 0), [inventory])

  const setQty = (item, value) => {
    const qty = Number.parseInt(value, 10)
    if (Number.isFinite(qty) && qty >= 1) onUpdateQty(item.id, Math.min(qty, maxStock(item.id)))
  }

  const qtyButton = (disabled) => ({
    width: 32, height: 32,
    border: `1px solid ${border}`,
    borderRadius: 8,
    background: cardBg,
    color: text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize: 16,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  })

  return (
    <section style={{
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: cardBg,
      border: `1px solid ${border}`,
      borderRadius: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <header style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${border}`,
      }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <strong style={{ color: text, fontSize: 16, fontWeight: 700 }}>Current Order</strong>
            <span style={{
              padding: '3px 10px',
              borderRadius: 8,
              background: accentLight,
              color: accent,
              fontSize: 11,
              fontWeight: 700,
            }}>{items.length}</span>
          </div>
          <div style={{ marginTop: 4, color: muted, fontSize: 12, fontWeight: 500 }}>Walk-In Customer</div>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            style={{
              border: 0,
              background: 'transparent',
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Clear Order
          </button>
        )}
      </header>

      {/* Items List */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, background: bg }}>
        {!items.length ? (
          <div style={{
            height: '100%',
            minHeight: 240,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
          }}>
            <div>
              <div style={{
                width: 56, height: 56,
                margin: '0 auto 16px',
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                background: accentLight,
                fontSize: 26,
              }}>🛒</div>
              <div style={{ color: text, fontWeight: 700, fontSize: 15 }}>Your cart is empty</div>
              <div style={{ marginTop: 6, color: muted, fontSize: 13, fontWeight: 500 }}>Select a product to begin an order</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => {
              const max = maxStock(item.id)
              const maxed = item.qty >= max
              return (
                <article key={item.id} style={{
                  padding: 14,
                  borderRadius: 12,
                  border: `1px solid ${border}`,
                  background: cardBg,
                  transition: 'box-shadow 0.15s',
                }}>
                  {/* Item Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: text, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{item.name}</div>
                      <div style={{ marginTop: 4, color: muted, fontSize: 11, fontWeight: 500 }}>
                        {money(item.price)} / {item.unit || 'unit'}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemoveItem(item.id)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: '#ef4444',
                        cursor: 'pointer',
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 700,
                        transition: 'background 0.15s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      ×
                    </button>
                  </div>

                  {/* Quantity Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        disabled={item.qty <= 1}
                        onClick={() => onUpdateQty(item.id, item.qty - 1)}
                        style={qtyButton(item.qty <= 1)}
                      >
                        −
                      </button>
                      <input
                        aria-label={`${item.name} quantity`}
                        type="number"
                        min="1"
                        max={max}
                        value={item.qty}
                        onChange={e => setQty(item, e.target.value)}
                        style={{
                          width: 44,
                          height: 32,
                          border: `1px solid ${border}`,
                          borderLeft: 0,
                          borderRight: 0,
                          textAlign: 'center',
                          background: inputBg,
                          color: text,
                          fontWeight: 700,
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        disabled={maxed}
                        onClick={() => onUpdateQty(item.id, item.qty + 1)}
                        style={qtyButton(maxed)}
                      >
                        +
                      </button>
                    </div>
                    <strong style={{ color: text, fontSize: 14, fontWeight: 800 }}>{money(item.qty * item.price)}</strong>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer Totals */}
      <footer style={{
        marginTop: 'auto',
        padding: '16px 20px 20px',
        borderTop: `1px solid ${border}`,
        background: cardBg,
      }}>
        <Row label="Subtotal" value={money(subtotal)} />
        {discount > 0 && <Row label="Discount" value={`−${money(discount)}`} color="#22c55e" />}
        {tax > 0 && <Row label="Tax" value={`+${money(tax)}`} />}
        <div style={{
          marginTop: 12,
          paddingTop: 14,
          borderTop: `1px solid ${border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}>
          <strong style={{ color: text, fontSize: 15 }}>Total</strong>
          <strong style={{
            color: accent,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: '-0.5px',
          }}>{money(total)}</strong>
        </div>
      </footer>
    </section>
  )

  function Row({ label, value, color }) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 8,
        fontSize: 13,
      }}>
        <span style={{ color: muted, fontWeight: 500 }}>{label}</span>
        <strong style={{ color: color || text, fontWeight: 700 }}>{value}</strong>
      </div>
    )
  }
}