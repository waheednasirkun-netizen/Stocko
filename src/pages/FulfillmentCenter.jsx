import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum } from '../lib/constants'
import DispatchReceipt from '../components/DispatchReceipt/DispatchReceipt'

const TAB_PENDING = 'Pending'
const TAB_COMPLETED = 'Completed'

const pColors = {
  Critical: '#fee2e2,#991b1b',
  High: '#fef9c3,#854d0e',
  Medium: '#dbeafe,#1e40af',
  Low: '#dcfce7,#166534',
}

const statusColors = {
  Pending: '#fef3c7,#92400e',
  Approved: '#dcfce7,#166534',
  'Partially Fulfilled': '#dbeafe,#1e40af',
  Completed: '#d1fae5,#065f46',
  Rejected: '#fee2e2,#991b1b',
}

export default function FulfillmentCenter() {
  const {
    requests = [],
    inventory = [],
    theme,
    user,
    showToast,
    fetchRequests,
    addNotification,
  } = useApp()

  // ── Tabs ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(TAB_PENDING)

  // ── Search & Filters ─────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')

  // ── Modals ───────────────────────────────────────────
  const [dispatchModal, setDispatchModal] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [dispatchQty, setDispatchQty] = useState('')
  const [dispatchNotes, setDispatchNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const processingRef = useRef(false)

  // ── Receipt print state ──────────────────────────────
  const [receiptData, setReceiptData] = useState(null)

  // ── Real-time subscription ───────────────────────────
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('fulfillment-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests' },
        () => {
          fetchRequests?.()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [fetchRequests])

  // ── Derived data ───────────────────────────────────
  const departments = useMemo(() => {
    const set = new Set(requests.map(r => r.department).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [requests])

  const pendingStatuses = ['Pending', 'Approved', 'Partially Fulfilled']
  const completedStatuses = ['Completed', 'Rejected']

  // Flatten requests + request_items for display
  const flattenedItems = useMemo(() => {
    const items = []
    for (const req of requests) {
      const reqItems = req.request_items || []
      if (reqItems.length === 0) {
        items.push({
          ...req,
          _displayName: req.item_name || req.name || '—',
          _qty: Number(req.quantity || req.qty || 0),
          _unit: req.unit || 'pcs',
          _fulfilledQty: Number(req.fulfilled_qty || 0),
          _requestId: req.id,
          _itemIndex: 0,
          _itemId: null,
        })
      } else {
        for (let i = 0; i < reqItems.length; i++) {
          const ri = reqItems[i]
          items.push({
            ...req,
            _displayName: ri.name || '—',
            _qty: Number(ri.qty || 0),
            _unit: ri.unit || 'pcs',
            _fulfilledQty: Number(ri.fulfilled_qty || 0),
            _requestId: req.id,
            _itemId: ri.id,
            _itemIndex: i,
            _itemNotes: ri.notes,
          })
        }
      }
    }
    return items
  }, [requests])

  const filteredItems = useMemo(() => {
    let list = [...flattenedItems].sort((a, b) => {
      const pOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 }
      return (pOrder[a?.priority] ?? 2) - (pOrder[b?.priority] ?? 2)
    })

    const allowed = activeTab === TAB_PENDING ? pendingStatuses : completedStatuses
    list = list.filter(d => allowed.includes(d.status))

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(d => (d._displayName || '').toLowerCase().includes(q))
    }

    if (filterDept !== 'All') {
      list = list.filter(d => d.department === filterDept)
    }

    if (filterPriority !== 'All') {
      list = list.filter(d => d.priority === filterPriority)
    }

    return list
  }, [flattenedItems, activeTab, search, filterDept, filterPriority])

  const getInvItem = useCallback((itemName) => {
    return (inventory || []).find(i => i?.name && i.name.toLowerCase() === (itemName || '').toLowerCase())
  }, [inventory])

  const getStockStatus = (inv, requestedQty) => {
    if (!inv) return { color: '#dc2626', bg: '#fee2e2', label: 'Out of Stock', icon: '🔴' }
    if (inv.quantity <= 0) return { color: '#dc2626', bg: '#fee2e2', label: 'Out of Stock', icon: '🔴' }
    if (inv.quantity < requestedQty) return { color: '#ca8a04', bg: '#fef9c3', label: 'Low Stock', icon: '🟡' }
    return { color: '#16a34a', bg: '#dcfce7', label: 'In Stock', icon: '🟢' }
  }

  const resetDispatch = () => {
    setDispatchModal(null)
    setDispatchQty('')
    setDispatchNotes('')
  }

  const resetReject = () => {
    setRejectModal(null)
    setRejectReason('')
  }

  // ── Dispatch Full ────────────────────────────────────
  const handleDispatchFull = async () => {
    if (!dispatchModal || processingRef.current) return
    const { request, item, inv } = dispatchModal
    const requested = Number(item._qty || 0)
    const available = inv?.quantity || 0
    const qty = Math.min(requested, available)

    if (qty <= 0) {
      showToast('error', 'Cannot Dispatch', 'No stock available')
      return
    }

    await executeDispatch(request, item, inv, qty, dispatchNotes)
  }

  // ── Partial Dispatch ─────────────────────────────────
  const handlePartialDispatch = async () => {
    if (!dispatchModal || processingRef.current) return
    const qty = Number(dispatchQty)
    if (!qty || qty <= 0) {
      showToast('error', 'Invalid Quantity', 'Enter a positive number')
      return
    }
    const { request, item, inv } = dispatchModal
    const available = inv?.quantity || 0
    if (qty > available) {
      showToast('error', 'Insufficient Stock', `Only ${fmtNum(available)} ${inv?.unit} available`)
      return
    }
    await executeDispatch(request, item, inv, qty, dispatchNotes)
  }

  // ── Execute Dispatch ─────────────────────────────────
  const executeDispatch = async (request, item, inv, qty, notes) => {
    if (processingRef.current) return
    processingRef.current = true
    setLoading(true)

    try {
      const requested = Number(item._qty || 0)
      const alreadyFulfilled = Number(item._fulfilledQty || 0)
      const newFulfilled = alreadyFulfilled + qty
      const remaining = Math.max(0, requested - newFulfilled)

      // Determine new status
      let newStatus = request.status
      if (remaining <= 0) {
        const allItems = request.request_items || []
        const thisItemFulfilled = newFulfilled >= requested
        const otherItemsFulfilled = allItems.every((ri, idx) => {
          if (idx === item._itemIndex) return thisItemFulfilled
          return Number(ri.fulfilled_qty || 0) >= Number(ri.qty || 0)
        })
        newStatus = otherItemsFulfilled ? 'Completed' : 'Partially Fulfilled'
      } else if (newFulfilled > 0) {
        newStatus = 'Partially Fulfilled'
      }

      // 1. Update request_items fulfilled_qty
      if (item._itemId) {
        const { error: itemError } = await supabase
          .from('request_items')
          .update({ fulfilled_qty: newFulfilled })
          .eq('id', item._itemId)

        if (itemError) {
          console.error('Update request_items error:', itemError)
          throw new Error(`Failed to update item: ${itemError.message}`)
        }
      }

      // 2. Update request status
      const { error: reqError } = await supabase
        .from('requests')
        .update({
          status: newStatus,
          fulfilled_at: newStatus === 'Completed' ? new Date().toISOString() : request.fulfilled_at,
        })
        .eq('id', request.id)

      if (reqError) {
        console.error('Update requests error:', reqError)
        throw new Error(`Failed to update request: ${reqError.message}`)
      }

      // 3. Deduct inventory
      if (inv && qty > 0) {
        const newQty = Math.max(0, (inv.quantity || 0) - qty)
        const { error: invError } = await supabase
          .from('inventory')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', inv.id)

        if (invError) {
          console.error('Update inventory error:', invError)
          throw new Error(`Failed to update inventory: ${invError.message}`)
        }

        // Check low stock threshold
        const threshold = inv.threshold || inv.min_stock || 0
        if (newQty <= threshold && threshold > 0) {
          showToast('warning', 'Low Stock Alert', `${inv.name} reached minimum threshold (${fmtNum(newQty)} ${inv.unit})`)
          addNotification?.({
            type: 'warning',
            title: 'Low Stock Alert',
            message: `${inv.name} reached minimum threshold (${fmtNum(newQty)} ${inv.unit})`,
          })
        }

        // Create transaction log
        const { error: txnError } = await supabase.from('transactions').insert({
          item_id: inv.id,
          item_name: inv.name,
          type: 'OUT',
          quantity: qty,
          unit: inv.unit,
          reference_type: 'fulfillment',
          reference_id: request.id,
          notes: notes || `Fulfilled request from ${request.department}`,
          created_by: user?.id,
          created_by_name: user?.name || user?.email,
        })

        if (txnError) {
          console.error('Insert transaction error:', txnError)
        }
      }

      // 4. Refresh data
      if (fetchRequests) {
        await fetchRequests()
      }

      showToast('success', 'Dispatched', `${fmtNum(qty)} ${item._unit} of ${item._displayName}`)

      // 5. Set receipt data and trigger print
      setReceiptData({
        request,
        item,
        qty,
        notes,
        user,
        fulfilled: newFulfilled,
        remaining,
        newStatus,
        timestamp: new Date(),
        branchName: request.branch_name || request.branchName,
      })

      // Small delay to let React render the receipt, then print
      setTimeout(() => {
        window.print()
        // Clear receipt data after print dialog closes
        setTimeout(() => setReceiptData(null), 1000)
      }, 100)

      resetDispatch()
    } catch (err) {
      console.error('Dispatch error:', err)
      showToast('error', 'Dispatch Failed', err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }

  // ── Reject Request ───────────────────────────────────
  const handleReject = async () => {
    if (!rejectModal || processingRef.current) return
    if (!rejectReason.trim()) {
      showToast('error', 'Reason Required', 'Please provide a rejection reason')
      return
    }

    processingRef.current = true
    setLoading(true)

    try {
      const { request } = rejectModal

      const { error } = await supabase
        .from('requests')
        .update({
          status: 'Rejected',
          rejection_reason: rejectReason.trim(),
          rejected_at: new Date().toISOString(),
          rejected_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (error) {
        console.error('Reject update error:', error)
        throw new Error(`Failed to reject: ${error.message}`)
      }

      // Refresh data
      if (fetchRequests) {
        await fetchRequests()
      }

      showToast('info', 'Request Rejected', `${request.department}`)
      resetReject()
    } catch (err) {
      console.error('Reject error:', err)
      showToast('error', 'Rejection Failed', err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }

  // ── Format helpers ───────────────────────────────────
  const fmtDate = (str) => {
    if (!str) return '—'
    const d = new Date(str)
    const now = new Date()
    const diff = now - d
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  const canFulfill = user?.role !== undefined

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Fulfillment Center</h2>
          <p style={{ fontSize: 12, color: theme.textMuted }}>
            {requests.filter(r => pendingStatuses.includes(r.status)).length} pending · {requests.filter(r => completedStatuses.includes(r.status)).length} completed
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Ic n="Search" size={14} color="#9ca3af"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests…"
              style={{
                padding: '8px 10px 8px 30px', border: `1px solid ${theme.inputBorder}`,
                borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text, width: 200
              }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${theme.border}` }}>
        {[TAB_PENDING, TAB_COMPLETED].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? '#2563eb' : 'transparent'}`,
              background: 'transparent',
              color: activeTab === tab ? '#2563eb' : theme.textMuted,
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'all 0.15s ease',
            }}
          >
            {tab}
            <span style={{
              marginLeft: 6,
              padding: '1px 7px',
              borderRadius: 10,
              fontSize: 11,
              background: activeTab === tab ? '#dbeafe' : theme.bg,
              color: activeTab === tab ? '#1e40af' : theme.textMuted,
            }}>
              {tab === TAB_PENDING
                ? requests.filter(r => pendingStatuses.includes(r.status)).length
                : requests.filter(r => completedStatuses.includes(r.status)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <Card style={{ marginBottom: 16, padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ic n="Filter" size={13} color={theme.textMuted} />
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted }}>Filters:</span>
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 12,
              border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text
            }}>
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 12,
              border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text
            }}>
            {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
          </select>
          {(filterDept !== 'All' || filterPriority !== 'All') && (
            <button onClick={() => { setFilterDept('All'); setFilterPriority('All') }}
              style={{
                fontSize: 11, color: '#2563eb', background: 'transparent', border: 'none',
                cursor: 'pointer', fontWeight: 500
              }}>
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Cards Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={activeTab === TAB_PENDING ? 'Inbox' : 'CheckCircle'}
          title={activeTab === TAB_PENDING ? 'No pending requests' : 'No completed requests'}
          message={activeTab === TAB_PENDING ? 'All requests have been handled. Great work!' : 'Completed and rejected requests appear here.'}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filteredItems.map(item => {
            const inv = getInvItem(item._displayName)
            const name = item._displayName
            const requested = Number(item._qty || 0)
            const fulfilled = Number(item._fulfilledQty || 0)
            const remaining = Math.max(0, requested - fulfilled)
            const [pbg, pc] = (pColors[item.priority] || '#f3f4f6,#374151').split(',')
            const [sbg, sc] = (statusColors[item.status] || '#f3f4f6,#374151').split(',')
            const stock = getStockStatus(inv, requested)
            const isPending = pendingStatuses.includes(item.status)

            return (
              <Card key={`${item.id}-${item._itemIndex}`} style={{
                border: item.priority === 'Critical' ? '2px solid #ef4444' : `1px solid ${theme.border}`,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: theme.text, flex: 1, lineHeight: 1.3 }}>{name}</h3>
                    <span style={{
                      padding: '3px 9px', borderRadius: 6, fontSize: 11,
                      fontWeight: 600, background: pbg, color: pc, marginLeft: 8, flexShrink: 0
                    }}>
                      {item.priority}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Ic n="Building" size={11} /> {item.department || '—'}
                    </span>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>·</span>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>
                      by {item.created_by_name || item.createdBy || '—'}
                    </span>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>·</span>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>
                      {fmtDate(item.created_at || item.createdAt)}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ padding: '10px 12px', background: theme.bg, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 3, fontWeight: 600, letterSpacing: 0.5 }}>REQUESTED</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{fmtNum(requested)} <span style={{ fontSize: 11, fontWeight: 500 }}>{item._unit}</span></div>
                    </div>
                    <div style={{ padding: '10px 12px', background: theme.bg, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 3, fontWeight: 600, letterSpacing: 0.5 }}>FULFILLED</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{fmtNum(fulfilled)} <span style={{ fontSize: 11, fontWeight: 500 }}>{item._unit}</span></div>
                    </div>
                    <div style={{ padding: '10px 12px', background: theme.bg, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 3, fontWeight: 600, letterSpacing: 0.5 }}>REMAINING</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: remaining > 0 ? '#dc2626' : '#16a34a' }}>
                        {fmtNum(remaining)} <span style={{ fontSize: 11, fontWeight: 500 }}>{item._unit}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 8, background: stock.bg, marginBottom: 12
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: stock.color, letterSpacing: 0.5 }}>AVAILABLE STOCK</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: stock.color }}>
                        {inv ? `${fmtNum(inv.quantity)} ${inv.unit}` : 'Not in stock'}
                      </div>
                    </div>
                    <div style={{ fontSize: 18 }}>{stock.icon}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 11,
                      fontWeight: 600, background: sbg, color: sc
                    }}>
                      {item.status}
                    </span>
                    {item.rejection_reason && (
                      <span style={{ fontSize: 11, color: '#dc2626', fontStyle: 'italic' }}>
                        Reason: {item.rejection_reason}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <div style={{
                      fontSize: 12, color: theme.textMuted, padding: '8px 10px',
                      background: theme.bg, borderRadius: 6, marginBottom: 12
                    }}>
                      <span style={{ fontWeight: 600 }}>Notes:</span> {item.notes}
                    </div>
                  )}

                  {isPending && canFulfill && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="success" onClick={() => setDispatchModal({ request: { ...item, id: item._requestId }, item, inv })}
                        style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
                        <Ic n="Package" size={13} color="white" /> Dispatch
                      </Btn>
                      <Btn variant="outline" onClick={() => setRejectModal({ request: { ...item, id: item._requestId } })}
                        style={{ fontSize: 12 }}>
                        <Ic n="XCircle" size={13} /> Reject
                      </Btn>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModal && (
        <Modal open onClose={resetDispatch} title="📦 Dispatch Items">
          {(() => {
            const { request, item, inv } = dispatchModal
            const name = item._displayName
            const requested = Number(item._qty || 0)
            const alreadyFulfilled = Number(item._fulfilledQty || 0)
            const remaining = Math.max(0, requested - alreadyFulfilled)
            const available = inv?.quantity || 0
            const qty = Number(dispatchQty)
            const overLimit = qty > available
            const canPartial = qty > 0 && qty <= available && qty <= remaining
            const canFull = remaining > 0 && available > 0

            return (
              <>
                <div style={{
                  padding: '14px 16px', background: theme.bg, borderRadius: 10, marginBottom: 16,
                  border: `1px solid ${theme.border}`
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, marginBottom: 8 }}>{name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 600 }}>DEPARTMENT</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{request.department}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 600 }}>REQUESTED</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{fmtNum(requested)} {item._unit}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 600 }}>ALREADY FULFILLED</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{fmtNum(alreadyFulfilled)} {item._unit}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 600 }}>REMAINING</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{fmtNum(remaining)} {item._unit}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 600 }}>AVAILABLE</div>
                      <div style={{
                        fontSize: 13, fontWeight: 700,
                        color: available >= remaining ? '#16a34a' : available > 0 ? '#ca8a04' : '#dc2626'
                      }}>
                        {fmtNum(available)} {item._unit}
                        {available >= remaining ? ' 🟢' : available > 0 ? ' 🟡' : ' 🔴'}
                      </div>
                    </div>
                  </div>
                </div>

                {canFull && (
                  <Btn variant="success" onClick={handleDispatchFull} disabled={loading || processingRef.current}
                    style={{ width: '100%', justifyContent: 'center', marginBottom: 14, padding: '12px' }}>
                    <Ic n="CheckCircle" size={15} color="white" />
                    <span style={{ marginLeft: 6 }}>
                      Dispatch Full ({fmtNum(Math.min(remaining, available))} {item._unit})
                    </span>
                  </Btn>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14
                }}>
                  <div style={{ flex: 1, height: 1, background: theme.border }} />
                  <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500 }}>OR CUSTOM QUANTITY</span>
                  <div style={{ flex: 1, height: 1, background: theme.border }} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    Dispatch Quantity <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      autoFocus
                      type="number"
                      value={dispatchQty}
                      onChange={e => setDispatchQty(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && canPartial && !processingRef.current) {
                          e.preventDefault()
                          handlePartialDispatch()
                        }
                      }}
                      min="0.01"
                      step="0.01"
                      placeholder="0"
                      style={{
                        flex: 1, padding: '11px 12px', fontSize: 15, fontWeight: 600,
                        border: `1px solid ${overLimit ? '#ef4444' : canPartial ? '#16a34a' : theme.inputBorder}`,
                        borderRadius: 8, background: theme.inputBg, color: theme.text
                      }}
                    />
                    <span style={{ fontSize: 14, color: theme.textMuted, fontWeight: 500 }}>{item._unit}</span>
                  </div>
                  {overLimit && (
                    <p style={{ fontSize: 12, color: '#dc2626', marginTop: 5 }}>
                      ⚠️ Exceeds available stock ({fmtNum(available)} {item._unit})
                    </p>
                  )}
                  {canPartial && (
                    <p style={{ fontSize: 11, color: '#16a34a', marginTop: 5 }}>
                      ✓ Ready to dispatch. Press Enter or click below.
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    Notes <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    value={dispatchNotes}
                    onChange={e => setDispatchNotes(e.target.value)}
                    rows={2}
                    placeholder="Add any notes…"
                    style={{
                      width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`,
                      borderRadius: 8, fontSize: 13, resize: 'vertical',
                      background: theme.inputBg, color: theme.text, boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Btn variant="outline" onClick={resetDispatch}>Cancel</Btn>
                  <Btn variant="success" onClick={handlePartialDispatch}
                    disabled={loading || processingRef.current || !canPartial}>
                    {loading ? 'Dispatching…' : 'Partial Dispatch'}
                  </Btn>
                </div>
              </>
            )
          })()}
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <Modal open onClose={resetReject} title="❌ Reject Request">
          {(() => {
            const { request } = rejectModal
            return (
              <>
                <div style={{
                  padding: '14px 16px', background: '#fee2e2', borderRadius: 10, marginBottom: 16,
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>{request.department}</div>
                  <div style={{ fontSize: 12, color: '#991b1b' }}>
                    Request from {request.created_by_name || '—'} · {fmtDate(request.created_at)}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    Rejection Reason <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    autoFocus
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this request being rejected?"
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: `1px solid ${!rejectReason.trim() ? '#ef4444' : theme.inputBorder}`,
                      borderRadius: 8, fontSize: 13, resize: 'vertical',
                      background: theme.inputBg, color: theme.text, boxSizing: 'border-box'
                    }}
                  />
                  {!rejectReason.trim() && (
                    <p style={{ fontSize: 12, color: '#dc2626', marginTop: 5 }}>
                      ⚠️ A reason is required
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Btn variant="outline" onClick={resetReject}>Cancel</Btn>
                  <Btn variant="danger" onClick={handleReject}
                    disabled={loading || processingRef.current || !rejectReason.trim()}>
                    {loading ? 'Rejecting…' : 'Reject Request'}
                  </Btn>
                </div>
              </>
            )
          })()}
        </Modal>
      )}

      {/* Print Receipt — hidden until print triggered */}
      {receiptData && (
        <DispatchReceipt
          request={receiptData.request}
          item={receiptData.item}
          qty={receiptData.qty}
          notes={receiptData.notes}
          user={receiptData.user}
          fulfilled={receiptData.fulfilled}
          remaining={receiptData.remaining}
          newStatus={receiptData.newStatus}
          timestamp={receiptData.timestamp}
          branchName={receiptData.branchName}
        />
      )}
    </div>
  )
}