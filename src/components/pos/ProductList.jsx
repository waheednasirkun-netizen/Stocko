import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { posApi } from '../../lib/api';

export default function ProductList({
  onAddToCart,
  cartItems = [],
}) {
  const { user, theme } = useApp()

  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const searchTimeout = useRef(null)

  /* ── Stocko Design Tokens (theme-aware) ── */
  const bg = theme.cardBg || '#ffffff'
  const cardBg = theme.bg || '#f8fafc'
  const cardBorder = theme.border || '#e2e8f0'
  const text = theme.text || '#0f172a'
  const muted = theme.textMuted || '#64748b'
  const accent = theme.primary || '#3b82f6'
  const accentLight = theme.primaryBg || '#eff6ff'
  const hoverBg = theme.cardHover || '#f1f5f9'
  const inputBg = theme.inputBg || '#ffffff'
  const inputBorder = theme.inputBorder || '#d1d5db'

  const loadProducts = useCallback(async (query = '') => {
    if (!user?.branch_id) return
    setLoading(true)
    const { data, error } = await posApi.searchInventory(query, user.branch_id, 48)
    if (error) { console.error(error.message); setProducts([]) }
    else setProducts(data || [])
    setLoading(false)
  }, [user?.branch_id])

  useEffect(() => { loadProducts() }, [loadProducts])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => loadProducts(search), 250)
    return () => clearTimeout(searchTimeout.current)
  }, [search, loadProducts])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Enter' && search.trim() && products.length === 1) { handleAdd(products[0]); setSearch(''); inputRef.current?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [search, products])

  const handleAdd = (product) => {
    const inCart = cartItems.find(c => c.id === product.id)
    if ((inCart?.qty || 0) >= product.quantity) return
    onAddToCart(product)
  }

  const getAvailable = (product) => {
    const inCart = cartItems.find(c => c.id === product.id)
    return product.quantity - (inCart ? inCart.qty : 0)
  }

  const stockColor = (stock) => stock <= 0 ? '#ef4444' : stock <= 5 ? '#f59e0b' : '#22c55e'
  const stockBg = (stock) => stock <= 0 ? '#fee2e2' : stock <= 5 ? '#fef3c7' : '#dcfce7'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: muted, opacity: 0.6 }}>🔍</span>
        <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products... (Press / to focus, Enter to add)" style={{ width: '100%', padding: '14px 16px 14px 48px', borderRadius: 12, border: `2px solid ${search ? accent : inputBorder}`, background: inputBg, color: text, fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }} onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}15` }} onBlur={e => { if (!search) { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none' } }} />
        {search && <button onClick={() => { setSearch(''); loadProducts('') }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: muted, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = hoverBg} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>}
      </div>

      {/* Count */}
      <span style={{ fontSize: 13, color: muted, fontWeight: 500 }}>{loading ? 'Loading...' : `${products.length} products`}</span>

      {/* Product Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, overflowY: 'auto', flex: 1, padding: '4px 2px' }}>
        {products.map(product => {
          const available = getAvailable(product)
          const disabled = available <= 0
          return (
            <button key={product.id} onClick={() => handleAdd(product)} disabled={disabled} style={{ display: 'flex', flexDirection: 'column', padding: 16, borderRadius: 14, border: `2px solid ${disabled ? '#ef444430' : cardBorder}`, background: disabled ? (theme.cardHover || '#fef2f2') : bg, cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all 0.2s ease', opacity: disabled ? 0.5 : 1, position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }} onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = accent; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${accent}15` } }} onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = cardBorder; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' } }}>
              <div style={{ position: 'absolute', top: 10, right: 10, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: stockColor(available), background: stockBg(available), border: `1px solid ${stockColor(available)}20` }}>{available}</div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 10, border: `1px solid ${cardBorder}` }}>📦</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: text, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 36 }}>{product.name}</div>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8, fontWeight: 500 }}>{product.unit || 'unit'}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: accent, marginTop: 'auto', letterSpacing: -0.3 }}>Rs. {product.selling_price?.toFixed(2) || '0.00'}</div>
            </button>
          )
        })}
      </div>

      {/* Empty State */}
      {!loading && products.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, color: muted, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: text }}>No products found</div>
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>Try a different search term</div>
        </div>
      )}
    </div>
  )
}