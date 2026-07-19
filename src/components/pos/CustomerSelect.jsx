import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { posApi } from '../../lib/pos'

export default function CustomerSelect({ selectedCustomer, onSelectCustomer }) {
  const { user, theme } = useApp()
  const isDark = theme === 'dark'

  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [creating, setCreating] = useState(false)

  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', email: '', opening_balance: 0, customer_code: '' })

  const searchTimeout = useRef(null)
  const dropdownRef = useRef(null)

  const bg = isDark ? '#0f172a' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'
  const accent = '#6366f1'
  const hoverBg = isDark ? '#252f47' : '#f1f5f9'

  const searchCustomers = useCallback(async (q) => {
    if (!user?.branch_id) return
    setLoading(true)
    const { data, error } = await posApi.searchCustomers(q, user.branch_id)
    if (error) { console.error(error.message); setCustomers([]) }
    else setCustomers(data || [])
    setLoading(false)
  }, [user?.branch_id])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchCustomers(query), 250)
    return () => clearTimeout(searchTimeout.current)
  }, [query, searchCustomers])

  useEffect(() => {
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (customer) => { onSelectCustomer(customer); setQuery(''); setShowDropdown(false) }
  const handleWalkIn = () => handleSelect({ id: null, name: 'Walk-in Customer', customer_code: 'WALK-IN', phone: '', address: '' })

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newCustomer.name.trim()) return
    setCreating(true)
    setCreateError(null)
    const { data, error } = await posApi.createCustomer({
      ...newCustomer,
      branch_id: user.branch_id,
      customer_code: newCustomer.customer_code || `CUST-${Date.now()}`,
    })
    if (error) { setCreateError(error.message); setCreating(false); return }
    handleSelect(data)
    setShowCreateModal(false)
    setNewCustomer({ name: '', phone: '', address: '', email: '', opening_balance: 0, customer_code: '' })
    setCreating(false)
  }

  const handleClear = () => { onSelectCustomer(null); setQuery('') }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      {selectedCustomer ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: isDark ? '#1e293b' : '#f0f0f7', borderRadius: 12, border: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{selectedCustomer.name?.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 600, color: text, fontSize: 14 }}>{selectedCustomer.name}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{selectedCustomer.customer_code}{selectedCustomer.phone && ` • ${selectedCustomer.phone}`}</div>
            </div>
          </div>
          <button onClick={handleClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 18 }}>✕</button>
        </div>
      ) : (
        <>
          <input value={query} onChange={e => { setQuery(e.target.value); setShowDropdown(true) }} onFocus={() => { setShowDropdown(true); if (customers.length === 0) searchCustomers('') }} placeholder="Search customer..." style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: `1px solid ${border}`, background: bg, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          {showDropdown && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: bg, border: `1px solid ${border}`, borderRadius: 12, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 320, overflowY: 'auto' }}>
              <button onClick={handleWalkIn} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${border}`, cursor: 'pointer', color: accent, fontWeight: 600, fontSize: 14 }}>👤 Walk-in Customer</button>
              <button onClick={() => { setShowCreateModal(true); setShowDropdown(false) }} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${border}`, cursor: 'pointer', color: text, fontWeight: 500, fontSize: 14 }}>➕ Create New Customer</button>
              {loading && <div style={{ padding: 16, textAlign: 'center', color: muted }}>Searching...</div>}
              {!loading && customers.length === 0 && query && <div style={{ padding: 16, textAlign: 'center', color: muted, fontSize: 13 }}>No customers found</div>}
              {customers.map(c => (
                <button key={c.id} onClick={() => handleSelect(c)} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${border}`, cursor: 'pointer', color: text, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }} onMouseEnter={e => e.target.style.background = hoverBg} onMouseLeave={e => e.target.style.background = 'transparent'}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#64748b', fontSize: 14, flexShrink: 0 }}>{c.name?.charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: muted }}>{c.customer_code}{c.phone && ` • ${c.phone}`}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowCreateModal(false)}>
          <div style={{ background: bg, borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${border}` }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: text, fontSize: 18 }}>Create New Customer</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: muted }}>✕</button>
            </div>
            {createError && <div style={{ padding: '10px 12px', background: '#fef2f2', color: '#ef4444', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{createError}</div>}
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[{ label: 'Customer Name *', key: 'name', type: 'text', required: true }, { label: 'Customer Code', key: 'customer_code', type: 'text' }, { label: 'Phone Number', key: 'phone', type: 'tel' }, { label: 'Email', key: 'email', type: 'email' }, { label: 'Opening Balance', key: 'opening_balance', type: 'number', min: 0, step: '0.01' }].map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: muted, marginBottom: 6 }}>{field.label}</label>
                    <input type={field.type} required={field.required} min={field.min} step={field.step} value={newCustomer[field.key]} onChange={e => setNewCustomer({ ...newCustomer, [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: isDark ? '#0f172a' : '#fff', color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: muted, marginBottom: 6 }}>Address</label>
                  <textarea value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: isDark ? '#0f172a' : '#fff', color: text, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: text, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Cancel</button>
                <button type="submit" disabled={creating || !newCustomer.name.trim()} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: accent, color: '#fff', cursor: creating || !newCustomer.name.trim() ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: creating || !newCustomer.name.trim() ? 0.6 : 1 }}>{creating ? 'Creating...' : 'Create Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}