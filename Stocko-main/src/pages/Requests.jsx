import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum, DEPARTMENTS } from '../lib/constants'

export default function RequestList() {
  const { demands, inventory, theme, user, createDemand, showToast } = useApp()

  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterSt, setFilterSt] = useState('All')

  // Items being requested (support multiple)
  const [items, setItems] = useState([{ id: 1, itemId: null, name: '', category: '', unit: '', qty: '', notes: '', search: '', showDrop: false, activeIndex: -1 }])
  const [errors, setErrors] = useState({})
  const [department, setDepartment] = useState('')
  const processingRef = useRef(false)
  const dropRefs = useRef({})

  // Inventory search suggestions
  const getSuggestions = useCallback((query) => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return inventory
      .filter(i => i.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [inventory])

  const filtered = useMemo(() => {
    let list = [...demands].sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
    if (search) list = list.filter(d => (d.item_name || d.name || '').toLowerCase().includes(search.toLowerCase()))
    if (filterSt !== 'All') list = list.filter(d => d.status === filterSt)
    return list
  }, [demands, search, filterSt])

  // Add a new item row
  const addItemRow = () => {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1
    setItems(prev => [...prev, { id: newId, itemId: null, name: '', category: '', unit: '', qty: '', notes: '', search: '', showDrop: false, activeIndex: -1 }])
  }

  // Remove an item row
  const removeItemRow = (id) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter(i => i.id !== id))
    setErrors(prev => {
      const next = { ...prev }
      delete next[`item_${id}`]
      delete next[`qty_${id}`]
      return next
    })
  }

  // Update item field
  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  // Select inventory item
  const selectInventoryItem = (rowId, item) => {
    setItems(prev => prev.map(i => {
      if (i.id !== rowId) return i
      return { ...i, itemId: item.id, name: item.name, category: item.category || '', unit: item.unit || 'pcs', search: item.name, showDrop: false, activeIndex: -1 }
    }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[`item_${rowId}`]
      return next
    })
  }

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e, rowId) => {
    const row = items.find(i => i.id === rowId)
    if (!row) return
    const suggestions = getSuggestions(row.search)
    if (!row.showDrop || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = row.activeIndex < suggestions.length - 1 ? row.activeIndex + 1 : 0
      updateItem(rowId, 'activeIndex', nextIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = row.activeIndex > 0 ? row.activeIndex - 1 : suggestions.length - 1
      updateItem(rowId, 'activeIndex', nextIndex)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (row.activeIndex >= 0 && row.activeIndex < suggestions.length) {
        selectInventoryItem(rowId, suggestions[row.activeIndex])
      }
    } else if (e.key === 'Escape') {
      updateItem(rowId, 'showDrop', false)
      updateItem(rowId, 'activeIndex', -1)
    }
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      items.forEach(item => {
        const ref = dropRefs.current[item.id]
        if (ref && !ref.contains(e.target)) {
          updateItem(item.id, 'showDrop', false)
          updateItem(item.id, 'activeIndex', -1)
        }
      })
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [items])

  const handleSubmit = async () => {
    const errs = {}
    if (!department) errs.department = 'Department required'

    items.forEach(item => {
      if (!item.name.trim()) errs[`item_${item.id}`] = 'Item required'
      if (!item.qty || Number(item.qty) <= 0) errs[`qty_${item.id}`] = 'Quantity must be > 0'
    })

    if (Object.keys(errs).length) { setErrors(errs); return }
    if (processingRef.current) return

    setLoading(true)
    processingRef.current = true
    try {
      // Submit each item as a separate request (or batch if API supports it)
      // Using the existing createDemand API for each item
      for (const item of items) {
        const result = await createDemand({
          name: item.name.trim(),
          category: item.category,
          unit: item.unit,
          qty: Number(item.qty),
          priority: 'Medium',
          department: department,
          notes: item.notes,
        })
        if (result?.blocked) {
          showToast('error', 'Cannot Create Request', result.message)
          if (result.reason === 'insufficient_stock') {
            setErrors(prev => ({ ...prev, [`qty_${item.id}`]: `Max: ${fmtNum(result.available)} ${result.unit}` }))
          }
          return
        }
      }

      showToast('success', 'Request Created', `${items.length} item${items.length > 1 ? 's' : ''} submitted`)
      setShowModal(false)
      setItems([{ id: 1, itemId: null, name: '', category: '', unit: '', qty: '', notes: '', search: '', showDrop: false, activeIndex: -1 }])
      setDepartment('')
      setErrors({})
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }

  const canCreate = user?.role !== undefined // All authenticated users can create

  const statusColors = {
    Pending: '#fef3c7,#92400e',
    Approved: '#dcfce7,#166534',
    'Partially Fulfilled': '#dbeafe,#1e40af',
    Completed: '#d1fae5,#065f46',
    Rejected: '#fee2e2,#991b1b',
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Request List</h2>
          <p style={{ fontSize: 12, color: theme.textMuted }}>
            {demands.filter(d => d.status === 'Pending').length} pending · {demands.length} total
          </p>
        </div>
        {canCreate && (
          <Btn id="btn-new-request" variant="primary" onClick={() => setShowModal(true)}>
            <Ic n="Plus" size={14} color="white" /> New Request
          </Btn>
        )}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 16, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Ic n="Search" size={13} color="#9ca3af"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{
                width: '100%', padding: '8px 10px 8px 28px', border: `1px solid ${theme.inputBorder}`,
                borderRadius: 7, fontSize: 13, background: theme.inputBg, color: theme.text
              }} />
          </div>
          {['All', 'Pending', 'Approved', 'Partially Fulfilled', 'Completed', 'Rejected'].map(s => (
            <button key={s} onClick={() => setFilterSt(s)}
              style={{
                padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
                background: filterSt === s ? '#2563eb' : theme.bg, color: filterSt === s ? 'white' : theme.textMuted
              }}>
              {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0
          ? <EmptyState icon="ClipboardList" title="No requests" message="Create a request to get started" />
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: theme.bg }}>
                    {['Item', 'Category', 'Qty', 'Department', 'Status', 'Created By', 'Date'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left', fontSize: 12,
                        fontWeight: 600, color: theme.textMuted, borderBottom: `1px solid ${theme.border}`,
                        whiteSpace: 'nowrap'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const name = d.item_name || d.name || '—'
                    const qty = d.quantity || d.qty
                    const [sbg, sc] = (statusColors[d.status] || '#f3f4f6,#374151').split(',')
                    const createdBy = d.created_by_name || d.createdBy || '—'
                    const dateStr = d.created_at || d.createdAt
                    return (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: theme.text }}>{name}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>{d.category || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: theme.text }}>
                          {fmtNum(qty)} {d.unit}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>{d.department || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: 11,
                            fontWeight: 600, background: sbg, color: sc
                          }}>{d.status}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textMuted }}>{createdBy}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                          {dateStr ? new Date(dateStr).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>

      {/* Create Request Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}); setItems([{ id: 1, itemId: null, name: '', category: '', unit: '', qty: '', notes: '', search: '', showDrop: false, activeIndex: -1 }]); setDepartment('') }} title="📋 New Request">

        {/* Department selector */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
            Department <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select value={department} onChange={e => setDepartment(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', border: `1px solid ${errors.department ? '#ef4444' : theme.inputBorder}`,
              borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text
            }}>
            <option value="">Select department…</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          {errors.department && <div className="field-error">{errors.department}</div>}
        </div>

        {/* Item rows */}
        {items.map((item, idx) => {
          const suggestions = getSuggestions(item.search)
          const hasErrorItem = errors[`item_${item.id}`]
          const hasErrorQty = errors[`qty_${item.id}`]
          return (
            <div key={item.id} style={{
              background: theme.bg || '#f8fafc',
              border: `1px solid ${theme.border || '#e2e8f0'}`,
              borderRadius: 10,
              padding: '14px 16px',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted }}>Item #{idx + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeItemRow(item.id)}
                    style={{
                      background: 'transparent', border: 'none', color: '#9ca3af',
                      cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4
                    }}>
                    <Ic n="X" size={12} /> Remove
                  </button>
                )}
              </div>

              {/* Item Search */}
              <div style={{ marginBottom: 12, position: 'relative' }} ref={el => { dropRefs.current[item.id] = el }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
                  Item <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={item.search}
                  onChange={e => {
                    updateItem(item.id, 'search', e.target.value)
                    updateItem(item.id, 'showDrop', true)
                    updateItem(item.id, 'activeIndex', -1)
                    if (!e.target.value.trim()) {
                      updateItem(item.id, 'name', '')
                      updateItem(item.id, 'category', '')
                      updateItem(item.id, 'unit', '')
                      updateItem(item.id, 'itemId', null)
                    }
                  }}
                  onFocus={() => updateItem(item.id, 'showDrop', true)}
                  onKeyDown={e => handleKeyDown(e, item.id)}
                  placeholder="Search inventory item…"
                  autoComplete="off"
                  style={{
                    width: '100%', padding: '10px 12px', border: `1px solid ${hasErrorItem ? '#ef4444' : theme.inputBorder}`,
                    borderRadius: 8, fontSize: 14, background: theme.inputBg, color: theme.text,
                    boxSizing: 'border-box'
                  }}
                />
                {hasErrorItem && <div className="field-error">{hasErrorItem}</div>}

                {/* Dropdown */}
                {item.showDrop && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: theme.cardBg || '#ffffff',
                    border: `1px solid ${theme.border || '#e2e8f0'}`,
                    borderRadius: 8,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    zIndex: 50,
                    maxHeight: 280,
                    overflowY: 'auto',
                  }}>
                    {suggestions.map((s, sIdx) => (
                      <div
                        key={s.id || sIdx}
                        onClick={() => selectInventoryItem(item.id, s)}
                        onMouseEnter={() => updateItem(item.id, 'activeIndex', sIdx)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          background: sIdx === item.activeIndex ? (theme.primaryLight || '#eff6ff') : 'transparent',
                          borderBottom: sIdx < suggestions.length - 1 ? `1px solid ${theme.border || '#f1f5f9'}` : 'none',
                          transition: 'background 0.12s ease',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                          {s.category || '—'} • {s.unit || 'pcs'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected item display */}
                {item.name && !item.showDrop && (
                  <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
                    Selected: <span style={{ fontWeight: 600, color: theme.text }}>{item.name}</span>
                    {item.category && <span> • {item.category}</span>}
                    {item.unit && <span> • {item.unit}</span>}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
                  Quantity <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    value={item.qty}
                    onChange={e => updateItem(item.id, 'qty', e.target.value)}
                    min="0.01"
                    step="0.01"
                    placeholder="0"
                    style={{
                      flex: 1,
                      padding: '10px 12px', border: `1px solid ${hasErrorQty ? '#ef4444' : theme.inputBorder}`,
                      borderRadius: 8, fontSize: 14, fontWeight: 600, background: theme.inputBg, color: theme.text
                    }}
                  />
                  {item.unit && (
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: theme.textMuted,
                      minWidth: 40, textAlign: 'center'
                    }}>{item.unit}</span>
                  )}
                </div>
                {hasErrorQty && <div className="field-error">{hasErrorQty}</div>}
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Notes</label>
                <textarea
                  value={item.notes}
                  onChange={e => updateItem(item.id, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Optional…"
                  style={{
                    width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`,
                    borderRadius: 8, fontSize: 13, resize: 'vertical', background: theme.inputBg, color: theme.text,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )
        })}

        {/* Add another item */}
        <div style={{ marginBottom: 18 }}>
          <button onClick={addItemRow}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: `1px dashed ${theme.border || '#cbd5e1'}`,
              borderRadius: 8, padding: '10px 14px', width: '100%',
              color: theme.textMuted, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', justifyContent: 'center'
            }}>
            <Ic n="Plus" size={14} /> Add Another Item
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="outline" onClick={() => {
            setShowModal(false)
            setErrors({})
            setItems([{ id: 1, itemId: null, name: '', category: '', unit: '', qty: '', notes: '', search: '', showDrop: false, activeIndex: -1 }])
            setDepartment('')
          }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Request'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}