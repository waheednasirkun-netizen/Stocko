import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum, userCan } from '../lib/constants'
import { transactionsApi } from '../lib/api'

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const TRANSACTION_TYPES = [
  { key: 'Stock IN',    label: 'Stock IN',    variant: 'primary',  icon: 'Plus',        perm: 'stockIn' },
  { key: 'Stock OUT',   label: 'Stock OUT',   variant: 'danger',   icon: 'Minus',       perm: 'stockOut' },
  { key: 'Wastage',     label: 'Wastage',     variant: 'warning',  icon: 'Trash2',      perm: 'recordWastage' },
  { key: 'Fulfillment', label: 'Fulfillment', variant: 'purple',   icon: 'CheckCircle', perm: 'recordFulfillmentTxn' },
]

const TYPE_FILTERS = ['All', 'Stock IN', 'Stock OUT', 'Wastage', 'Fulfillment']

const TYPE_STYLES = {
  'Stock IN':    { bg: '#dcfce7', color: '#166534', sign: '+' },
  'Stock OUT':   { bg: '#fee2e2', color: '#991b1b', sign: '-' },
  'Wastage':     { bg: '#fef9c3', color: '#854d0e', sign: '-' },
  'Fulfillment': { bg: '#f3e8ff', color: '#7c3aed', sign: '-' },
}

const DEFAULT_FORM = {
  item: '',
  category: '',
  unit: 'pcs',
  qty: '',
  source: '',
  notes: '',
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEARCHABLE DROPDOWN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function SearchableDropdown({
  items = [],
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
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : []
    if (!value?.trim()) return safeItems.slice(0, 8)
    const q = value.toLowerCase()
    return safeItems.filter(i => i.name?.toLowerCase().includes(q)).slice(0, 8)
  }, [items, value])

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

  const handleKeyDown = useCallback((e) => {
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
  }, [isOpen, filtered, focusedIdx, onSelect])

  const handleSelect = useCallback((item) => {
    onSelect(item)
    setIsOpen(false)
    setFocusedIdx(-1)
  }, [onSelect])

  const defaultRender = useCallback((item) => (
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
  ), [])

  const showEmpty = value?.trim().length > 0 && filtered.length === 0

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 500,
          color: '#374151',
          marginBottom: 5,
        }}>
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
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
      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{error}</div>
      )}

      {isOpen && (
        <div style={{
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
        }}>
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
            filtered.map((item, idx) => {
              const isFocused = idx === focusedIdx
              return (
                <div
                  key={item.id || `item-${idx}`}
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
            })
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN STOCK MOVEMENT COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function StockMovement() {
  const {
    transactions,
    setTransactions,
    inventory,
    templates,
    suppliers,
    theme,
    user,
    showToast,
    withActionLock,
    addNotification,
    setTab,
    setInventory,
  } = useApp()

  // ── UI State ──────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false)
  const [txnType, setTxnType] = useState('Stock IN')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')

  // ── Form State ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [errors, setErrors] = useState({})

  // ── Dropdown State ────────────────────────────────────────────────────
  const [templateSearch, setTemplateSearch] = useState('')
  const [invSearch, setInvSearch] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')

  const isStockIn = txnType === 'Stock IN'
  const isStockOut = txnType === 'Stock OUT' || txnType === 'Wastage' || txnType === 'Fulfillment'

  // ── Derived Data ────────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    let list = [...(transactions || [])].sort(
      (a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0)
    )
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => (t.item_name || t.item || '').toLowerCase().includes(q))
    }
    if (filterType !== 'All') {
      list = list.filter(t => t.type === filterType)
    }
    return list
  }, [transactions, search, filterType])

  // ── Helpers ─────────────────────────────────────────────────────────────
  const updateForm = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    // Clear error when user types
    setErrors(prev => prev[key] ? { ...prev, [key]: undefined } : prev)
  }, [])

  const resetForm = useCallback(() => {
    setForm({ ...DEFAULT_FORM })
    setErrors({})
    setTemplateSearch('')
    setInvSearch('')
    setSupplierSearch('')
  }, [])

  const openModal = useCallback((type) => {
    setTxnType(type)
    resetForm()
    setShowModal(true)
  }, [resetForm])

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const e = {}
    const itemName = form.item?.trim()
    const qty = Number(form.qty)

    if (!itemName) e.item = 'Item name is required'
    if (!form.qty || qty <= 0) e.qty = 'Quantity must be greater than 0'

    if (isStockOut && itemName) {
      const inv = inventory?.find(i => i.name?.toLowerCase() === itemName.toLowerCase())
      if (!inv) {
        e.item = `"${itemName}" not found in inventory`
      } else if (qty > (inv.quantity || 0)) {
        e.qty = `Max available: ${fmtNum(inv.quantity)} ${inv.unit || 'pcs'}`
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }, [form, isStockOut, inventory])

  // ── Optimistic Inventory Update ─────────────────────────────────────────
  const applyOptimisticInventory = useCallback((itemName, qtyDelta, unit) => {
    setInventory(prev => {
      if (!prev) return prev
      const idx = prev.findIndex(i => i.name?.toLowerCase() === itemName.toLowerCase())
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          quantity: Math.max(0, (Number(updated[idx].quantity) || 0) + qtyDelta),
          unit: unit || updated[idx].unit,
          updated_at: new Date().toISOString(),
        }
        return updated
      }
      if (qtyDelta > 0) {
        // New inventory item (Stock IN)
        return [
          {
            id: `temp-${Date.now()}`,
            name: itemName,
            quantity: qtyDelta,
            unit: unit || 'pcs',
            category: form.category || 'Other',
            branch_id: user?.branch_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]
      }
      return prev
    })
  }, [setInventory, user?.branch_id, form.category])

  const revertOptimisticInventory = useCallback((itemName) => {
    // Reload from server to ensure consistency
    setInventory(null) // Trigger reload in parent context
  }, [setInventory])

  // ── Submit Handler ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!validate() || isSubmitting) return

    const branchId = user?.branch_id
    if (!branchId) {
      showToast('error', 'Branch Error', 'No branch assigned to your account. Contact your administrator.')
      return
    }

    if (!userCan(TRANSACTION_TYPES.find(t => t.key === txnType)?.perm, user?.role)) {
      showToast('error', 'Permission Denied', 'You do not have permission to record this type of stock movement.')
      return
    }

    const itemName = form.item.trim()
    const quantity = Math.abs(Number(form.qty))
    const userName = user?.name || user?.full_name || 'Unknown'

    // Optimistic UI update
    const qtyDelta = isStockIn ? quantity : -quantity
    applyOptimisticInventory(itemName, qtyDelta, form.unit)

    // Optimistic transaction update
    const optimisticTxn = {
      id: `temp-${Date.now()}`,
      branch_id: branchId,
      item_name: itemName,
      type: txnType,
      quantity,
      unit: form.unit,
      price_per_unit: 0,
      total_amount: 0,
      source: form.source || null,
      category: form.category || null,
      notes: form.notes || null,
      recorded_by: user?.id,
      recorded_by_name: userName,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }
    setTransactions(prev => [optimisticTxn, ...(prev || [])])

    setIsSubmitting(true)

    try {
      let result
      if (isStockIn) {
        result = await transactionsApi.stockIn({
          item: itemName,
          qty: quantity,
          unit: form.unit,
          source: form.source,
          category: form.category,
          notes: form.notes,
          branchId,
          userId: user?.id,
          userName,
        })
      } else {
        result = await transactionsApi.stockOut({
          item: itemName,
          qty: quantity,
          unit: form.unit,
          type: txnType,
          notes: form.notes,
          branchId,
          userId: user?.id,
          userName,
        })
      }

      if (result.error) {
        // Revert optimistic updates
        setTransactions(prev => (prev || []).filter(t => t.id !== optimisticTxn.id))
        revertOptimisticInventory(itemName)
        showToast('error', 'Failed', result.error.message)
        return
      }

      // Replace optimistic with real data
      setTransactions(prev =>
        (prev || []).map(t => (t.id === optimisticTxn.id ? result.data : t))
      )

      showToast('success', `${txnType} Recorded`, `${itemName} — ${fmtNum(quantity)} ${form.unit}`)
      addNotification({
        title: txnType,
        msg: `${quantity} ${form.unit} of ${itemName}`,
        type: 'success',
      })
      setShowModal(false)
      resetForm()
    } catch (err) {
      // Revert optimistic updates
      setTransactions(prev => (prev || []).filter(t => t.id !== optimisticTxn.id))
      revertOptimisticInventory(itemName)
      console.error('[StockMovement] Unexpected error:', err)
      showToast('error', 'Failed', err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    validate, isSubmitting, user, form, txnType, isStockIn,
    applyOptimisticInventory, revertOptimisticInventory,
    setTransactions, setInventory, showToast, addNotification, resetForm,
  ])

  // ── Selection Handlers ──────────────────────────────────────────────────
  const handleTemplateSelect = useCallback((template) => {
    setTemplateSearch(template.name)
    setForm(prev => ({
      ...prev,
      item: template.name,
      category: template.category || '',
      unit: template.unit || 'pcs',
    }))
    setErrors(prev => ({ ...prev, item: undefined }))
  }, [])

  const handleInvSelect = useCallback((inv) => {
    setInvSearch(inv.name)
    setForm(prev => ({
      ...prev,
      item: inv.name,
      category: inv.category || '',
      unit: inv.unit || 'pcs',
    }))
    setErrors(prev => ({ ...prev, item: undefined }))
  }, [])

  const handleSupplierSelect = useCallback((supplier) => {
    setSupplierSearch(supplier.name)
    updateForm('source', supplier.name)
  }, [updateForm])

  const handleGoToTemplates = useCallback(() => {
    setShowModal(false)
    setTab('templates')
  }, [setTab])

  // ── Type Style Helper ─────────────────────────────────────────────────
  const getTypeStyle = useCallback((type) => {
    return TYPE_STYLES[type] || { bg: '#f3f4f6', color: '#374151', sign: '' }
  }, [])

  const allowedTransactionTypes = TRANSACTION_TYPES.filter(t => userCan(t.perm, user?.role))
  const canRecord = allowedTransactionTypes.length > 0

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: 0 }}>
            Stock Movement
          </h2>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: '4px 0 0 0' }}>
            All transactions — the source of truth for inventory
          </p>
        </div>
        {canRecord && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allowedTransactionTypes.map(t => (
              <Btn
                key={t.key}
                variant={t.variant}
                onClick={() => openModal(t.key)}
                disabled={isSubmitting}
              >
                <Ic n={t.icon} size={14} color="white" />
                {t.label}
              </Btn>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 16, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Ic
              n="Search"
              size={13}
              color="#9ca3af"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search transactions by item name…"
              style={{
                width: '100%',
                padding: '9px 10px 9px 32px',
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 13,
                background: theme.inputBg,
                color: theme.text,
                outline: 'none',
              }}
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{
              padding: '9px 12px',
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 8,
              fontSize: 13,
              background: theme.inputBg,
              color: theme.text,
              cursor: 'pointer',
              minWidth: 140,
            }}
          >
            {TYPE_FILTERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(search || filterType !== 'All') && (
            <button
              onClick={() => { setSearch(''); setFilterType('All') }}
              style={{
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#2563eb',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* Transactions Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filteredTransactions.length === 0 ? (
          <EmptyState
            icon="ArrowLeftRight"
            title="No transactions found"
            message={
              search || filterType !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Record a Stock IN to get started'
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: theme.bg }}>
                  {['Type', 'Item', 'Qty', 'Unit', 'Source', 'Notes', 'Recorded By', 'Date'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 600,
                        color: theme.textMuted,
                        borderBottom: `1px solid ${theme.border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(t => {
                  const style = getTypeStyle(t.type)
                  const itemName = t.item_name || t.item || '—'
                  const qty = t.quantity ?? t.qty ?? 0
                  const recordedBy = t.recorded_by_name || t.user || '—'
                  const dateStr = t.created_at || t.date
                  const isOptimistic = t._optimistic

                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: `1px solid ${theme.border}`,
                        opacity: isOptimistic ? 0.6 : 1,
                      }}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: style.bg,
                          color: style.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.text,
                      }}>
                        {itemName}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: style.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {style.sign}{fmtNum(qty)}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        fontSize: 13,
                        color: theme.textMuted,
                      }}>
                        {t.unit || '—'}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        fontSize: 13,
                        color: theme.textMuted,
                      }}>
                        {t.source || '—'}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        fontSize: 12,
                        color: theme.textMuted,
                        maxWidth: 180,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {t.notes || '—'}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        fontSize: 12,
                        color: theme.textMuted,
                      }}>
                        {recordedBy}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        fontSize: 12,
                        color: theme.textMuted,
                        whiteSpace: 'nowrap',
                      }}>
                        {dateStr ? new Date(dateStr).toLocaleString() : '—'}
                        {isOptimistic && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: '#9ca3af' }}>
                            (syncing…)
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filteredTransactions.length > 0 && (
          <div style={{
            padding: '10px 14px',
            fontSize: 12,
            color: theme.textMuted,
            textAlign: 'right',
            borderTop: `1px solid ${theme.border}`,
          }}>
            Showing {filteredTransactions.length} of {(transactions || []).length} transactions
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); resetForm() }}
        title={
          txnType === 'Stock IN' ? '📦 Record Stock IN'
          : txnType === 'Stock OUT' ? '📤 Record Stock OUT'
          : txnType === 'Wastage' ? '🗑️ Record Wastage'
          : '✅ Record Fulfillment'
        }
      >
        {/* Type Selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {allowedTransactionTypes.map(t => (
            <button
              key={t.key}
              onClick={() => { setTxnType(t.key); resetForm() }}
              disabled={isSubmitting}
              style={{
                flex: 1,
                minWidth: 100,
                padding: '8px 6px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: txnType === t.key ? 'none' : '1px solid #e5e7eb',
                background: txnType === t.key
                  ? (t.key === 'Stock IN' ? '#2563eb' : t.key === 'Stock OUT' ? '#dc2626' : t.key === 'Wastage' ? '#d97706' : '#7c3aed')
                  : '#f9fafb',
                color: txnType === t.key ? 'white' : '#6b7280',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Ic n={t.icon} size={12} color={txnType === t.key ? 'white' : '#6b7280'} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Item Selection */}
        {isStockIn ? (
          <div style={{ marginBottom: 14 }}>
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
          <div style={{ marginBottom: 14 }}>
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
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            marginBottom: 5,
          }}>
            Quantity <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="number"
            value={form.qty}
            onChange={e => updateForm('qty', e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="0"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${errors.qty ? '#ef4444' : theme.inputBorder}`,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              background: theme.inputBg,
              color: theme.text,
              outline: 'none',
            }}
          />
          {errors.qty && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{errors.qty}</div>
          )}
        </div>

        {/* Supplier / Source (Stock IN only) */}
        {isStockIn && (
          <div style={{ marginBottom: 14 }}>
            <SearchableDropdown
              items={(suppliers || []).map(s => ({ id: s.id, name: s.name }))}
              value={supplierSearch}
              onChange={v => { setSupplierSearch(v); updateForm('source', v) }}
              onSelect={handleSupplierSelect}
              placeholder="Search or type supplier…"
              label="Supplier / Source"
              theme={theme}
            />
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 18 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            marginBottom: 5,
          }}>
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={e => updateForm('notes', e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 8,
              fontSize: 13,
              resize: 'vertical',
              background: theme.inputBg,
              color: theme.text,
              outline: 'none',
              minHeight: 60,
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn
            variant="outline"
            onClick={() => { setShowModal(false); resetForm() }}
            disabled={isSubmitting}
          >
            Cancel
          </Btn>
          <Btn
            variant={isStockIn ? 'primary' : 'danger'}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Ic n="Loader2" size={14} className="spin" />
                Saving…
              </>
            ) : (
              `Record ${txnType}`
            )}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}