import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum, fmtPKR, userCan } from '../lib/constants'
import { transactionsApi, templatesApi } from '../lib/api'

const TXN_TYPES = ['Stock IN', 'Wastage']

const CATEGORIES = [
  'Frozen Food', 'Vegetables', 'Dairy', 'Meat', 'Grocery',
  'Packaging', 'Sauces', 'Beverages', 'Cleaning Supplies',
  'Disposable Items', 'Spices', 'Other',
]

/* ─── Searchable Dropdown for Templates / Inventory ─────────────────────── */
function SearchableDropdown({
  items,                  // array of { id, name, category?, unit?, ... }
  value,                  // current input value
  onChange,               // (value) => void  — raw text change
  onSelect,               // (item) => void   — when user selects an item
  placeholder,
  label,
  error,
  theme,
  renderItem,             // optional custom render
  showCreateOption,       // boolean — show "Create new" at bottom
  onCreate,               // () => void
  createLabel = "Can't find this item?",
  createButtonText = "Create New Template",
}) {
  const [isOpen, setIsOpen]     = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const containerRef = useRef(null)
  const inputRef     = useRef(null)
  const listRef      = useRef(null)
  const itemRefs     = useRef([])

  const filtered = useMemo(() => {
    if (!value.trim()) return items.slice(0, 8)
    const q = value.toLowerCase()
    return items.filter(i => i.name.toLowerCase().includes(q)).slice(0, 8)
  }, [items, value])

  const totalItems = filtered.length + (showCreateOption ? 1 : 0)

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIdx >= 0 && focusedIdx < filtered.length) {
      itemRefs.current[focusedIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIdx, isOpen, filtered.length])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setFocusedIdx(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setIsOpen(true)
        setFocusedIdx(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIdx(prev => (prev + 1) % totalItems)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIdx(prev => (prev - 1 + totalItems) % totalItems)
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIdx >= 0 && focusedIdx < filtered.length) {
          onSelect(filtered[focusedIdx])
          setIsOpen(false)
          setFocusedIdx(-1)
        } else if (showCreateOption && focusedIdx === filtered.length) {
          onCreate?.()
          setIsOpen(false)
          setFocusedIdx(-1)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setFocusedIdx(-1)
        break
      case 'Tab':
        setIsOpen(false)
        setFocusedIdx(-1)
        break
    }
  }

  const handleSelect = (item, idx) => {
    onSelect(item)
    setIsOpen(false)
    setFocusedIdx(-1)
  }

  const defaultRender = (item) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.name}</div>
        {item.category && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{item.category}</div>
        )}
      </div>
      {item.unit && (
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{item.unit}</div>
      )}
    </div>
  )

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setIsOpen(true); setFocusedIdx(-1) }}
        onFocus={() => { setIsOpen(true); setFocusedIdx(-1) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '10px 12px',
          border: `1px solid ${error ? '#ef4444' : theme.inputBorder}`,
          borderRadius: 8,
          fontSize: 14,
          background: theme.inputBg,
          color: theme.text,
          outline: 'none',
        }}
      />
      {error && <div className="field-error">{error}</div>}

      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#fff',
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            zIndex: 50,
            maxHeight: 280,
            overflowY: 'auto',
            padding: '6px 0',
          }}
        >
          {filtered.length === 0 && !showCreateOption ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
              No items found
            </div>
          ) : (
            <>
              {filtered.map((item, idx) => {
                const isFocused = idx === focusedIdx
                return (
                  <div
                    key={item.id || idx}
                    ref={el => itemRefs.current[idx] = el}
                    onClick={() => handleSelect(item, idx)}
                    onMouseEnter={() => setFocusedIdx(idx)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      background: isFocused ? '#eff6ff' : 'transparent',
                      borderLeft: isFocused ? '3px solid #2563eb' : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    {renderItem ? renderItem(item) : defaultRender(item)}
                  </div>
                )
              })}
              {showCreateOption && (
                <div
                  ref={el => itemRefs.current[filtered.length] = el}
                  onClick={() => { onCreate?.(); setIsOpen(false); setFocusedIdx(-1) }}
                  onMouseEnter={() => setFocusedIdx(filtered.length)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    background: focusedIdx === filtered.length ? '#f0fdf4' : 'transparent',
                    borderLeft: focusedIdx === filtered.length ? '3px solid #16a34a' : '3px solid transparent',
                    borderTop: `1px solid ${theme.border}`,
                    marginTop: 4,
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{createLabel}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
                    + {createButtonText}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Quick Template Creation Modal ──────────────────────────────────────── */
function QuickTemplateModal({ open, onClose, theme, onCreated, branchId, userId }) {
  const [form, setForm] = useState({ name: '', category: '', unit: 'pcs', low_stock_threshold: '', notes: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Template name is required'
    if (!form.category) e.category = 'Category is required'
    if (!form.unit) e.unit = 'Unit is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate() || saving) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
      default_price: 0,
      enabled: true,
      branch_id: branchId,
      created_by: userId,
    }
    const { data, error } = await templatesApi.create(payload)
    setSaving(false)
    if (error) {
      // Try to show error, but still close if it's a duplicate
      if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
        // Silently close and let user search again
        onClose()
        return
      }
      return
    }
    onCreated(data)
    onClose()
    setForm({ name: '', category: '', unit: 'pcs', low_stock_threshold: '', notes: '' })
    setErrors({})
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Template">
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
          Item Name <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          value={form.name}
          onChange={e => setField('name', e.target.value)}
          placeholder="e.g., Chicken Breast"
          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.name ? '#ef4444' : theme.inputBorder}`,
            borderRadius: 8, fontSize: 14, background: theme.inputBg, color: theme.text }}
        />
        {errors.name && <div className="field-error">{errors.name}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
            Category <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            value={form.category}
            onChange={e => setField('category', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.category ? '#ef4444' : theme.inputBorder}`,
              borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text }}
          >
            <option value="">Select…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <div className="field-error">{errors.category}</div>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
            Unit <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            value={form.unit}
            onChange={e => setField('unit', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.unit ? '#ef4444' : theme.inputBorder}`,
              borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text }}
          >
            {['pcs', 'kg', 'g', 'L', 'ml', 'box', 'carton', 'bag', 'bottle', 'pack', 'tray'].map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          {errors.unit && <div className="field-error">{errors.unit}</div>}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
          Minimum Threshold
        </label>
        <input
          type="number"
          min="0"
          value={form.low_stock_threshold}
          onChange={e => setField('low_stock_threshold', e.target.value)}
          placeholder="0"
          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`,
            borderRadius: 8, fontSize: 14, background: theme.inputBg, color: theme.text }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Creating…' : 'Create Template'}
        </Btn>
      </div>
    </Modal>
  )
}

/* ─── Main StockMovement Component ─────────────────────────────────────── */
export default function StockMovement() {
  const { transactions, setTransactions, inventory, templates, suppliers, theme,
    user, allUnits, showToast, withActionLock, addNotification } = useApp()

  const [showModal, setShowModal]   = useState(false)
  const [txnType,   setTxnType]     = useState('Stock IN')
  const [loading,   setLoading]     = useState(false)
  const [search,    setSearch]      = useState('')
  const [filterType,setFilterType]  = useState('All')
  const processingRef = useRef(false)

  // Template search state (Stock IN)
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Inventory search state (Wastage)
  const [invSearch, setInvSearch] = useState('')
  const [selectedInv, setSelectedInv] = useState(null)

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')

  // Quick template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  const [form, setForm] = useState({
    item:'', category:'', unit:'pcs', qty:'', price:'',
    source:'', notes:'', department:'',
  })
  const [errors, setErrors] = useState({})

  // Filtered transaction history
  const filtered = useMemo(() => {
    let list = [...transactions]
      .sort((a,b) => new Date(b.created_at||b.date) - new Date(a.created_at||a.date))
    if (search) list = list.filter(t => (t.item_name||t.item||'').toLowerCase().includes(search.toLowerCase()))
    if (filterType !== 'All') list = list.filter(t => t.type === filterType)
    return list
  }, [transactions, search, filterType])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Reset form when modal opens or type changes
  const resetForm = useCallback(() => {
    setForm({ item:'', category:'', unit:'pcs', qty:'', price:'', source:'', notes:'', department:'' })
    setErrors({})
    setTemplateSearch('')
    setSelectedTemplate(null)
    setInvSearch('')
    setSelectedInv(null)
    setSupplierSearch('')
    setSelectedSupplier('')
  }, [])

  const openModal = (type) => {
    setTxnType(type)
    resetForm()
    setShowModal(true)
  }

  const validate = () => {
    const e = {}
    if (!form.item.trim()) e.item = 'Item name required'
    if (!form.qty || Number(form.qty) <= 0) e.qty = 'Quantity must be > 0'
    if (txnType === 'Stock IN' && (!form.price || Number(form.price) < 0)) e.price = 'Valid price required'
    if (txnType === 'Wastage') {
      const inv = inventory.find(i => i.name.toLowerCase() === form.item.toLowerCase())
      if (!inv) e.item = `"${form.item}" not found in inventory`
      else if (Number(form.qty) > inv.quantity) e.qty = `Max available: ${fmtNum(inv.quantity)} ${inv.unit}`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate() || processingRef.current) return
    return withActionLock(async () => {
      processingRef.current = true
      setLoading(true)
      try {
        let result
        if (txnType === 'Stock IN') {
          result = await transactionsApi.stockIn({
            item: form.item.trim(), qty: Number(form.qty), unit: form.unit,
            price: Number(form.price)||0, source: form.source, category: form.category,
            notes: form.notes, branchId: user?.branch_id, userId: user?.id, userName: user?.name,
          })
        } else {
          result = await transactionsApi.stockOut({
            item: form.item.trim(), qty: Number(form.qty), unit: form.unit,
            type: 'Wastage', notes: form.notes,
            branchId: user?.branch_id, userId: user?.id, userName: user?.name,
          })
        }
        if (result.error) { showToast('error', 'Failed', result.error.message); return }
        setTransactions(prev => [result.data, ...prev])
        showToast('success', `${txnType} Recorded`, `${form.item} — ${fmtNum(form.qty)} ${form.unit}`)
        addNotification({ title: txnType, msg: `${form.qty} ${form.unit} of ${form.item}`, type:'success' })
        setShowModal(false)
        resetForm()
      } finally {
        setLoading(false)
        processingRef.current = false
      }
    })
  }

  // Handle template selection (Stock IN)
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
    setTemplateSearch(template.name)
    set('item', template.name)
    set('category', template.category || '')
    set('unit', template.unit || 'pcs')
  }

  // Handle inventory selection (Wastage)
  const handleInvSelect = (inv) => {
    setSelectedInv(inv)
    setInvSearch(inv.name)
    set('item', inv.name)
    set('category', inv.category || '')
    set('unit', inv.unit || 'pcs')
  }

  // Handle supplier selection
  const handleSupplierSelect = (supplier) => {
    setSelectedSupplier(supplier.name)
    setSupplierSearch(supplier.name)
    set('source', supplier.name)
  }

  // Handle quick template creation
  const handleTemplateCreated = (template) => {
    handleTemplateSelect(template)
  }

  const typeColor = (t) => ({
    'Stock IN':    { bg:'#dcfce7', color:'#166534' },
    'Wastage':     { bg:'#fef9c3', color:'#854d0e' },
    'Fulfillment': { bg:'#f3e8ff', color:'#7c3aed' },
  }[t] || { bg:'#f3f4f6', color:'#374151' })

  const canDo = userCan('stockIn', user?.role)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Stock Movement</h2>
          <p style={{ fontSize:12, color:theme.textMuted }}>All transactions — the source of truth for inventory</p>
        </div>
        {canDo && (
          <div style={{ display:'flex', gap:8 }}>
            <Btn id="btn-stock-in" variant="primary"
              onClick={() => openModal('Stock IN')}>
              <Ic n="Plus" size={14} color="white"/> Stock IN
            </Btn>
            <Btn variant="warning"
              onClick={() => openModal('Wastage')}>
              <Ic n="Trash2" size={14}/> Wastage
            </Btn>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom:16, padding:'12px 14px' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:160 }}>
            <Ic n="Search" size={13} color="#9ca3af"
              style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item…"
              style={{ width:'100%', padding:'8px 10px 8px 28px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}/>
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding:'8px 10px', border:`1px solid ${theme.inputBorder}`,
              borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}>
            {['All','Stock IN','Wastage','Fulfillment'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </Card>

      {/* Transactions table */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        {filtered.length === 0
          ? <EmptyState icon="ArrowLeftRight" title="No transactions" message="Record a Stock IN to get started"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:theme.bg }}>
                    {['Type','Item','Qty','Unit','Price/Unit','Source','Notes','Recorded By','Date'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12,
                        fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}`,
                        whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const { bg, color } = typeColor(t.type)
                    const itemName = t.item_name || t.item || '—'
                    const qty = t.quantity ?? t.qty
                    const price = t.price_per_unit || t.price
                    const recordedBy = t.recorded_by_name || t.user || '—'
                    const dateStr = t.created_at || t.date
                    return (
                      <tr key={t.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11,
                            fontWeight:600, background:bg, color, whiteSpace:'nowrap' }}>
                            {t.type}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>
                          {itemName}
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:13,
                          color: t.type==='Stock IN' ? '#16a34a' : '#dc2626', fontWeight:600 }}>
                          {t.type==='Stock IN' ? '+' : '-'}{fmtNum(qty)}
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{t.unit||'—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>
                          {price > 0 ? fmtPKR(price) : '—'}
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>
                          {t.source || '—'}
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, maxWidth:160,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {t.notes || '—'}
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>
                          {recordedBy}
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                          {dateStr ? new Date(dateStr).toLocaleString() : '—'}
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

      {/* Stock IN / Wastage Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm() }}
        title={txnType === 'Stock IN' ? '📦 Record Stock IN' : '🗑️ Record Wastage'}>

        {/* Type selector */}
        <div style={{ display:'flex', gap:8, marginBottom:18 }}>
          {TXN_TYPES.map(t => (
            <button key={t} onClick={() => { setTxnType(t); resetForm() }}
              style={{ flex:1, padding:'7px 4px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer',
                border: txnType===t ? 'none' : '1px solid #e5e7eb',
                background: txnType===t ? (t==='Stock IN'?'#2563eb':'#d97706') : '#f9fafb',
                color: txnType===t ? 'white' : '#6b7280' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Item selection — Template for Stock IN, Inventory for Wastage */}
        {txnType === 'Stock IN' ? (
          <div style={{ marginBottom:14 }}>
            <SearchableDropdown
              items={templates || []}
              value={templateSearch}
              onChange={setTemplateSearch}
              onSelect={handleTemplateSelect}
              placeholder="Search templates…"
              label={`Item Name ${selectedTemplate ? '(from template)' : ''}`}
              error={errors.item}
              theme={theme}
              showCreateOption={templateSearch.trim().length > 0 && !templates?.some(t => t.name.toLowerCase() === templateSearch.toLowerCase())}
              onCreate={() => setShowTemplateModal(true)}
            />
          </div>
        ) : (
          <div style={{ marginBottom:14 }}>
            <SearchableDropdown
              items={inventory || []}
              value={invSearch}
              onChange={setInvSearch}
              onSelect={handleInvSelect}
              placeholder="Search existing inventory…"
              label="Select Inventory Item"
              error={errors.item}
              theme={theme}
            />
          </div>
        )}

        {/* Category + Unit row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
              Category
            </label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}
            >
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {allUnits.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Qty + Price row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
              Quantity <span style={{ color:'#ef4444' }}>*</span>
            </label>
            <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)}
              min="0.01" step="0.01" placeholder="0"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.qty?'#ef4444':theme.inputBorder}`,
                borderRadius:8, fontSize:14, fontWeight:600, background:theme.inputBg, color:theme.text }}/>
            {errors.qty && <div className="field-error">{errors.qty}</div>}
          </div>
          {txnType === 'Stock IN' && (
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
                Price / Unit (PKR) <span style={{ color:'#ef4444' }}>*</span>
              </label>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)}
                min="0" step="0.01" placeholder="0.00"
                style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.price?'#ef4444':theme.inputBorder}`,
                  borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
              {errors.price && <div className="field-error">{errors.price}</div>}
            </div>
          )}
        </div>

        {/* Supplier (Stock IN only) */}
        {txnType === 'Stock IN' && (
          <div style={{ marginBottom:14 }}>
            <SearchableDropdown
              items={(suppliers || []).map(s => ({ id: s.id, name: s.name }))}
              value={supplierSearch}
              onChange={v => { setSupplierSearch(v); set('source', v) }}
              onSelect={handleSupplierSelect}
              placeholder="Search or type supplier…"
              label="Supplier"
              theme={theme}
              createLabel="New supplier?"
              createButtonText="Use this name"
              showCreateOption={supplierSearch.trim().length > 0 && !(suppliers || []).some(s => s.name.toLowerCase() === supplierSearch.toLowerCase())}
              onCreate={() => { set('source', supplierSearch); setSelectedSupplier(supplierSearch) }}
            />
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            placeholder="Optional notes…"
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`,
              borderRadius:8, fontSize:13, resize:'vertical', background:theme.inputBg, color:theme.text }}/>
        </div>

        {/* Total preview (Stock IN) */}
        {txnType === 'Stock IN' && form.qty && form.price && (
          <div style={{ padding:'10px 14px', background:'#f0f9ff', border:'1px solid #bae6fd',
            borderRadius:8, marginBottom:16, fontSize:13, color:'#0369a1' }}>
            Total Amount: <strong>{fmtPKR(Number(form.qty) * Number(form.price))}</strong>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); resetForm() }}>Cancel</Btn>
          <Btn
            variant={txnType==='Stock IN' ? 'primary' : 'warning'}
            onClick={handleSubmit}
            disabled={loading || processingRef.current}
          >
            {loading ? 'Saving…' : `Record ${txnType}`}
          </Btn>
        </div>
      </Modal>

      {/* Quick Template Creation Modal */}
      <QuickTemplateModal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        theme={theme}
        onCreated={handleTemplateCreated}
        branchId={user?.branch_id}
        userId={user?.id}
      />
    </div>
  )
}