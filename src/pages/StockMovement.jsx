import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum, fmtPKR, userCan } from '../lib/constants'
import { transactionsApi } from '../lib/api'

const TXN_TYPES = ['Stock IN', 'Wastage']

/* ─── Searchable Dropdown for Templates / Inventory ─────────────────────── */
function SearchableDropdown({
  items,
  value,
  onChange,
  onSelect,
  placeholder,
  label,
  error,
  theme,
  renderItem,
  emptyMessage,
  emptyAction,
  emptyActionLabel,
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
        setFocusedIdx(prev => (prev + 1) % filtered.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIdx(prev => (prev - 1 + filtered.length) % filtered.length)
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIdx >= 0 && focusedIdx < filtered.length) {
          onSelect(filtered[focusedIdx])
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

  const handleSelect = (item) => {
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

  const showEmpty = value.trim().length > 0 && filtered.length === 0

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
          {showEmpty ? (
            <div style={{ padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>
                {emptyMessage || 'No items found'}
              </div>
              {emptyAction && (
                <button
                  onClick={() => { emptyAction(); setIsOpen(false) }}
                  style={{
                    padding: '6px 14px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {emptyActionLabel || 'Go to Templates'}
                </button>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
              Start typing to search…
            </div>
          ) : (
            <>
              {filtered.map((item, idx) => {
                const isFocused = idx === focusedIdx
                return (
                  <div
                    key={item.id || idx}
                    ref={el => itemRefs.current[idx] = el}
                    onClick={() => handleSelect(item)}
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
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main StockMovement Component ─────────────────────────────────────── */
export default function StockMovement() {
  const { transactions, setTransactions, inventory, templates, suppliers, theme,
    user, allUnits, showToast, withActionLock, addNotification, setTab } = useApp()

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

  const [form, setForm] = useState({
    item:'', category:'', unit:'pcs', qty:'', source:'', notes:'',
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
    setForm({ item:'', category:'', unit:'pcs', qty:'', source:'', notes:'' })
    setErrors({})
    setTemplateSearch('')
    setSelectedTemplate(null)
    setInvSearch('')
    setSelectedInv(null)
    setSupplierSearch('')
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

    // Debug: log user object and branch_id
    console.log('[StockMovement] User object:', user)
    console.log('[StockMovement] branch_id from user:', user?.branch_id)

    // Safely get branch_id with fallbacks
    const branchId = user?.branch_id || user?.branchId || null

    if (!branchId) {
      console.error('[StockMovement] No branch_id found in user:', user)
      showToast('error', 'Branch Error', 'No branch assigned to your account. Please contact administrator.')
      return
    }

    return withActionLock(async () => {
      processingRef.current = true
      setLoading(true)
      try {
        let result
        if (txnType === 'Stock IN') {
          result = await transactionsApi.stockIn({
            item: form.item.trim(),
            qty: Number(form.qty),
            unit: form.unit,
            price: 0,
            source: form.source,
            category: form.category,
            notes: form.notes,
            branchId: branchId,
            userId: user?.id,
            userName: user?.name || user?.full_name || 'Unknown',
          })
        } else {
          result = await transactionsApi.stockOut({
            item: form.item.trim(),
            qty: Number(form.qty),
            unit: form.unit,
            type: 'Wastage',
            notes: form.notes,
            branchId: branchId,
            userId: user?.id,
            userName: user?.name || user?.full_name || 'Unknown',
          })
        }
        if (result.error) {
          console.error('[StockMovement] API error:', result.error)
          showToast('error', 'Failed', result.error.message)
          return
        }

        // Update transactions in state immediately for UI
        setTransactions(prev => [result.data, ...prev])

        showToast('success', `${txnType} Recorded`, `${form.item} — ${fmtNum(form.qty)} ${form.unit}`)
        addNotification({ title: txnType, msg: `${form.qty} ${form.unit} of ${form.item}`, type:'success' })
        setShowModal(false)
        resetForm()
      } catch (err) {
        console.error('[StockMovement] Unexpected error:', err)
        showToast('error', 'Failed', err.message || 'An unexpected error occurred')
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

  // Navigate to templates page when no template found
  const handleGoToTemplates = () => {
    setShowModal(false)
    setTab('templates') // or use your router navigation
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
                    {['Type','Item','Qty','Unit','Source','Notes','Recorded By','Date'].map(h => (
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
              label="Item Template"
              error={errors.item}
              theme={theme}
              emptyMessage="No template found. Create this item first from the Item Templates page."
              emptyAction={handleGoToTemplates}
              emptyActionLabel="Go to Item Templates"
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
              label="Inventory Item"
              error={errors.item}
              theme={theme}
            />
          </div>
        )}

        {/* Quantity */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
            Quantity <span style={{ color:'#ef4444' }}>*</span>
          </label>
          <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)}
            min="0.01" step="0.01" placeholder="0"
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.qty?'#ef4444':theme.inputBorder}`,
              borderRadius:8, fontSize:14, fontWeight:600, background:theme.inputBg, color:theme.text }}/>
          {errors.qty && <div className="field-error">{errors.qty}</div>}
        </div>

        {/* Supplier (Stock IN only) */}
        {txnType === 'Stock IN' && (
          <div style={{ marginBottom:14 }}>
            <SearchableDropdown
              items={(suppliers || []).map(s => ({ id: s.id, name: s.name }))}
              value={supplierSearch}
              onChange={v => { setSupplierSearch(v); set('source', v) }}
              onSelect={(supplier) => { setSupplierSearch(supplier.name); set('source', supplier.name) }}
              placeholder="Search or type supplier…"
              label="Supplier"
              theme={theme}
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
    </div>
  )
}