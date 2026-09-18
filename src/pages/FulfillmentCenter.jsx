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
  Fulfilled: '#d1fae5,#065f46',
  Rejected: '#fee2e2,#991b1b',
}

export default function FulfillmentCenter() {
  const {
    requests = [],
    inventory = [],
    theme,
    user,
    currentBranch,
    showToast,
    fetchRequests,
    addNotification,
  } = useApp()

  const branchId =
    currentBranch?.id || user?.branch_id || user?.branchId || null

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
async function sendPrintJob(receiptData) {
  const { error } = await supabase
    .from("print_jobs")
    .insert({
      branch_id: user?.branch_id,
      payload: receiptData,
    });

  if (error) {
    console.error("Print queue failed:", error);
  } else {
    console.log("Print job sent successfully");
  }
}
  // ── Real-time subscription ───────────────────────────
  useEffect(() => {
    if (!supabase || !branchId) return

    const refresh = () => fetchRequests?.(branchId)

    const channel = supabase
      .channel(`fulfillment-requests-${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests', filter: `branch_id=eq.${branchId}` },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'request_items' },
        refresh
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [fetchRequests, branchId])

  // ── Derived data ───────────────────────────────────
  const departments = useMemo(() => {
    const set = new Set(requests.map(r => r.department).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [requests])

  // Child request_items are the source of truth for item-level lifecycle.
  // The parent request status is only an aggregate/container status.
  const getItemStatus = (request, requestItem) => {
    const explicit = requestItem?.status
    const requested = Number(requestItem?.qty || 0)
    const fulfilled = Number(requestItem?.fulfilled_qty || 0)
    const cancelled = Number(requestItem?.cancelled_qty || 0)
    const remaining = Math.max(0, requested - fulfilled - cancelled)

    // Quantity is the source of truth for lifecycle/tab placement.
    // A stale status must never put a fully resolved item back in Pending.
    if (requested > 0 && fulfilled >= requested) return 'Fulfilled'
    if (remaining <= 0 && cancelled >= requested && fulfilled <= 0) return 'Rejected'
    if (fulfilled > 0) return 'Partially Fulfilled'
    if (explicit === 'Rejected' && remaining > 0) return 'Rejected'
    return request?.status === 'Approved' ? 'Approved' : 'Pending'
  }

  // Flatten requests + request_items for display. Each child keeps its own
  // status, id, fulfilled quantity and rejection metadata.
  const flattenedItems = useMemo(() => {
    const items = []
    for (const req of requests) {
      const reqItems = Array.isArray(req.request_items) ? req.request_items : []
      if (reqItems.length === 0) {
        const requested = Number(req.quantity || req.qty || 0)
        const fulfilled = Number(req.fulfilled_qty || 0)
        const cancelled = Number(req.cancelled_qty || 0)
        const remaining = Math.max(0, requested - fulfilled - cancelled)
        const status = getItemStatus(req, {
          qty: requested,
          fulfilled_qty: fulfilled,
          cancelled_qty: cancelled,
          status: req.status,
        })
        items.push({
          ...req,
          _displayName: req.item_name || req.name || '—',
          _qty: requested,
          _unit: req.unit || 'pcs',
          _fulfilledQty: fulfilled,
          _cancelledQty: cancelled,
          _remainingQty: remaining,
          _requestId: req.id,
          _itemIndex: 0,
          _itemId: null,
          _itemStatus: status,
          _itemNotes: req.notes,
        })
      } else {
        for (let i = 0; i < reqItems.length; i++) {
          const ri = reqItems[i]
          items.push({
            ...req,
            ...ri,
            _displayName: ri.name || '—',
            _qty: Number(ri.qty || 0),
            _unit: ri.unit || 'pcs',
            _fulfilledQty: Number(ri.fulfilled_qty || 0),
            _cancelledQty: Number(ri.cancelled_qty || 0),
            _remainingQty: Math.max(0, Number(ri.qty || 0) - Number(ri.fulfilled_qty || 0) - Number(ri.cancelled_qty || 0)),
            _requestId: req.id,
            _itemId: ri.id,
            _itemIndex: i,
            _itemStatus: getItemStatus(req, ri),
            _itemNotes: ri.notes,
            _parentStatus: req.status,
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

    // IMPORTANT: Pending/Completed is determined by remaining quantity,
    // not by the historical item status.
    list = list.filter(item => {
      const remaining = Number(item?._remainingQty || 0)
      return activeTab === TAB_PENDING ? remaining > 0 : remaining <= 0
    })

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
    const fulfilled = Number(item._fulfilledQty || 0)
    const cancelled = Number(item._cancelledQty || 0)
    const remaining = Math.max(0, requested - fulfilled - cancelled)
    const available = inv?.quantity || 0
    const qty = Math.min(remaining, available)

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
      const alreadyCancelled = Number(item._cancelledQty || 0)
      const currentRemaining = Math.max(0, requested - alreadyFulfilled - alreadyCancelled)
      const safeQty = Math.min(Number(qty || 0), currentRemaining, Number(inv?.quantity || 0))

      if (safeQty <= 0) {
        throw new Error('There is no remaining quantity to dispatch.')
      }

      const newFulfilled = alreadyFulfilled + safeQty
      const remaining = Math.max(0, requested - newFulfilled - alreadyCancelled)

      // 1. Update ONLY the selected request item. Never use the parent request
      // status as the item's lifecycle.
      if (item._itemId) {
        const { error: itemError } = await supabase
          .from('request_items')
          .update({
            fulfilled_qty: newFulfilled,
            status: remaining <= 0 ? 'Fulfilled' : 'Partially Fulfilled',
            fulfilled_at: remaining <= 0 ? new Date().toISOString() : null,
            fulfilled_by: user?.id || null,
            fulfilled_by_name: user?.name || user?.full_name || user?.email || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item._itemId)

        if (itemError) {
          console.error('Update request_items error:', itemError)
          throw new Error(`Failed to update item: ${itemError.message}`)
        }
      }

      // 2. Re-read the child items and calculate the parent as an aggregate.
      // Rejected/pending children do not become fulfilled just because another
      // child was dispatched. A parent is Completed only when every child is
      // actually fulfilled. Mixed fulfilled/rejected remains Partially Fulfilled.
      const { data: latestItems, error: latestItemsError } = await supabase
        .from('request_items')
        .select('id, qty, fulfilled_qty, cancelled_qty, status')
        .eq('request_id', request.id)

      if (latestItemsError) throw latestItemsError

      const childItems = Array.isArray(latestItems) ? latestItems : []
      const allResolved = childItems.length > 0 && childItems.every(ri => {
        const requestedQty = Number(ri.qty || 0)
        const fulfilledQty = Number(ri.fulfilled_qty || 0)
        const cancelledQty = Number(ri.cancelled_qty || 0)
        return fulfilledQty + cancelledQty >= requestedQty
      })
      const allFulfilled = childItems.length > 0 && childItems.every(ri => {
        return Number(ri.fulfilled_qty || 0) >= Number(ri.qty || 0)
      })
      const anyFulfilled = childItems.some(ri => Number(ri.fulfilled_qty || 0) > 0)
      const allRejected = childItems.length > 0 && childItems.every(ri => ri.status === 'Rejected')

      let newStatus = request.status || 'Pending'
      if (allFulfilled) {
        newStatus = 'Completed'
      } else if (allResolved && anyFulfilled) {
        newStatus = 'Partially Fulfilled'
      } else if (allResolved && allRejected) {
        newStatus = 'Rejected'
      } else if (anyFulfilled) {
        newStatus = 'Partially Fulfilled'
      } else if (allRejected) {
        newStatus = 'Rejected'
      } else if (request.status === 'Rejected') {
        // Do not let a stale parent rejection remain after an item is actively
        // being fulfilled. The remaining parent lifecycle is recalculated.
        newStatus = 'Pending'
      }

      const parentUpdate = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }

      if (newStatus === 'Completed') {
        parentUpdate.fulfilled_at = new Date().toISOString()
        parentUpdate.fulfilled_by = user?.id || null
        parentUpdate.fulfilled_by_name = user?.name || user?.full_name || user?.email || null
      }

      const { error: reqError } = await supabase
        .from('requests')
        .update(parentUpdate)
        .eq('id', request.id)
        .eq('branch_id', branchId)
      if (reqError) {
        console.error('Update requests error:', reqError)
        throw new Error(`Failed to update request: ${reqError.message}`)
      }

      // 3. Deduct inventory
      if (inv && qty > 0) {
        const newQty = Math.max(0, (inv.quantity || 0) - safeQty)
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
          quantity: safeQty,
          unit: inv.unit,
          reference_type: 'fulfillment',
          reference_id: request.id,
          request_item_id: item._itemId || null,
          notes: notes || `Fulfilled ${item._displayName} from ${request.department}`,
          recorded_by: user?.id,
recorded_by_name: user?.name || user?.email,
        })

        if (txnError) {
          console.error('Insert transaction error:', txnError)
        }
      }

      // 4. Refresh data
      if (fetchRequests && branchId) {
        await fetchRequests(branchId)
      }

      showToast('success', 'Dispatched', `${fmtNum(safeQty)} ${item._unit} of ${item._displayName}`)

      // 5. Set receipt data and trigger print
     const receipt = {
      type: "fulfillment", 
  receipt: {
    items: [
      {
        name: item.name,
        quantity: safeQty,
        unit: item.unit,
      },
    ],
  },

  request,
  item,
  qty: safeQty,
  notes,
  user,
  fulfilled: newFulfilled,
  remaining,
  newStatus,
  timestamp: new Date(),
  branchName: request.branch_name || request.branchName,
}

setReceiptData(receipt)

      // Small delay to let React render the receipt, then print
      await sendPrintJob(receipt)

setTimeout(() => {
  setReceiptData(null)
}, 1000)
      resetDispatch()
    } catch (err) {
      console.error('Dispatch error:', err)
      showToast('error', 'Dispatch Failed', err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }

  // ── Reject ONE request item ───────────────────────────
  const handleReject = async () => {
    if (!rejectModal || processingRef.current) return
    if (!rejectReason.trim()) {
      showToast('error', 'Reason Required', 'Please provide a rejection reason')
      return
    }

    processingRef.current = true
    setLoading(true)

    try {
      const { request, item } = rejectModal
      const now = new Date().toISOString()

      if (item && item._itemId) {
        // Re-read the selected child so cancellation is based on the latest DB
        // quantities, not stale card data. This supports partial fulfillment.
        const { data: latestItem, error: latestItemError } = await supabase
          .from('request_items')
          .select('id, request_id, qty, fulfilled_qty, cancelled_qty, status')
          .eq('id', item._itemId)
          .eq('request_id', request.id)
          .maybeSingle()

        if (latestItemError) throw latestItemError
        if (!latestItem) throw new Error('Request item was not found.')

        const requestedQty = Number(latestItem.qty || 0)
        const fulfilledQty = Number(latestItem.fulfilled_qty || 0)
        const cancelledQty = Number(latestItem.cancelled_qty || 0)
        const remainingQty = Math.max(0, requestedQty - fulfilledQty - cancelledQty)

        if (remainingQty <= 0) {
          if (fetchRequests && branchId) await fetchRequests(branchId)
          resetReject()
          showToast('info', 'Nothing to Cancel', 'This item has no remaining quantity.')
          return
        }

        const { error: itemError } = await supabase
          .from('request_items')
          .update({
            cancelled_qty: cancelledQty + remainingQty,
            status: fulfilledQty > 0 ? 'Partially Fulfilled' : 'Rejected',
            rejection_reason: rejectReason.trim(),
            rejected_at: now,
            rejected_by: user?.id || null,
            rejected_by_name: user?.name || user?.full_name || user?.email || null,
            updated_at: now,
          })
          .eq('id', item._itemId)
          .eq('request_id', request.id)

        // Recalculate ONLY the parent aggregate. Never mark the parent Rejected
        // merely because one child was rejected.
        const { data: latestItems, error: latestItemsError } = await supabase
          .from('request_items')
          .select('id, qty, fulfilled_qty, cancelled_qty, status')
          .eq('request_id', request.id)

        if (latestItemsError) throw latestItemsError

        const childItems = Array.isArray(latestItems) ? latestItems : []
        const allResolved = childItems.length > 0 && childItems.every(ri => {
          const requestedQty = Number(ri.qty || 0)
          const fulfilledQty = Number(ri.fulfilled_qty || 0)
          const cancelledQty = Number(ri.cancelled_qty || 0)
          return fulfilledQty + cancelledQty >= requestedQty
        })
        const allFulfilled = childItems.length > 0 && childItems.every(ri => {
          return Number(ri.fulfilled_qty || 0) >= Number(ri.qty || 0)
        })
        const anyFulfilled = childItems.some(ri => Number(ri.fulfilled_qty || 0) > 0)
        const allRejected = childItems.length > 0 && childItems.every(ri => ri.status === 'Rejected')
        const hasPending = childItems.some(ri => {
          const requestedQty = Number(ri.qty || 0)
          const fulfilledQty = Number(ri.fulfilled_qty || 0)
          const cancelledQty = Number(ri.cancelled_qty || 0)
          return Math.max(0, requestedQty - fulfilledQty - cancelledQty) > 0
        })

        let parentStatus = request.status || 'Pending'
        if (allFulfilled) parentStatus = 'Completed'
        else if (allResolved && anyFulfilled) parentStatus = 'Partially Fulfilled'
        else if (allResolved && allRejected) parentStatus = 'Rejected'
        else if (anyFulfilled) parentStatus = 'Partially Fulfilled'
        else if (allRejected) parentStatus = 'Rejected'
        else if (hasPending) parentStatus = request.status === 'Approved' ? 'Approved' : 'Pending'

        const { error: parentError } = await supabase
          .from('requests')
          .update({
            status: parentStatus,
            updated_at: now,
          })
          .eq('id', request.id)
          .eq('branch_id', branchId)

        if (parentError) {
          console.error('Parent aggregate update error:', parentError)
          throw new Error(`Item rejected, but parent status could not be recalculated: ${parentError.message}`)
        }

        if (fetchRequests && branchId) await fetchRequests(branchId)

        showToast('info', 'Item Rejected', `${item._displayName} · ${request.department || 'Request'}`)
        resetReject()
        return
      }

      // Legacy single-item request with no request_items row. Only in this
      // legacy case is parent-level rejection safe.
      const { error } = await supabase
        .from('requests')
        .update({
          status: 'Rejected',
          rejection_reason: rejectReason.trim(),
          rejected_at: now,
          rejected_by: user?.id,
          updated_at: now,
        })
        .eq('id', request.id)
        .eq('branch_id', branchId)

      if (error) {
        console.error('Legacy reject update error:', error)
        throw new Error(`Failed to reject: ${error.message}`)
      }

      if (fetchRequests && branchId) await fetchRequests(branchId)
      showToast('info', 'Request Rejected', `${request.department || 'Request'}`)
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
    <div className="animate-fade-in responsive-page fulfillment-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Fulfillment Center</h2>
          <p style={{ fontSize: 12, color: theme.textMuted }}>
            {flattenedItems.filter(i => Number(i?._remainingQty || 0) > 0).length} pending · {flattenedItems.filter(i => Number(i?._remainingQty || 0) <= 0).length} completed
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
                ? flattenedItems.filter(i => Number(i?._remainingQty || 0) > 0).length
                : flattenedItems.filter(i => Number(i?._remainingQty || 0) <= 0).length}
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
        <div className="fulfillment-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filteredItems.map(item => {
            const inv = getInvItem(item._displayName)
            const name = item._displayName
            const requested = Number(item._qty || 0)
            const fulfilled = Number(item._fulfilledQty || 0)
            const cancelled = Number(item._cancelledQty || 0)
            const remaining = Math.max(0, requested - fulfilled - cancelled)
            const [pbg, pc] = (pColors[item.priority] || '#f3f4f6,#374151').split(',')
            const [sbg, sc] = (statusColors[item._itemStatus] || '#f3f4f6,#374151').split(',')
            const stock = getStockStatus(inv, requested)
            const isPending = remaining > 0

            return (
              <Card key={item._itemId ? `${item._requestId}-${item._itemId}` : `${item._requestId}-${item._itemIndex}`} style={{
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
                  <div className="fulfillment-quantity-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
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
                      {item._itemStatus}
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
                      <Btn variant="outline" onClick={() => setRejectModal({ request: { ...item, id: item._requestId }, item })}
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
        <Modal open onClose={resetReject} title="❌ Reject Item">
          {(() => {
            const { request, item } = rejectModal
            return (
              <>
                <div style={{
                  padding: '14px 16px', background: '#fee2e2', borderRadius: 10, marginBottom: 16,
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>{item?._displayName || request.department || 'Request Item'}</div>
                  <div style={{ fontSize: 12, color: '#991b1b' }}>
                    Request #{String(request.id || '').slice(0, 8)} · {request.created_by_name || '—'} · {fmtDate(request.created_at)}
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
                    placeholder="Why is this item being rejected?"
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
                    {loading ? 'Rejecting…' : 'Reject Item'}
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
