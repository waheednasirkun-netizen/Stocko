import { useState, useMemo, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState, SearchDropdown, StatusPill } from '../components/ui'
import { fmtNum, DEPARTMENTS, userCan } from '../lib/constants'
import { useConfirm } from '../components/ui'

const REQUEST_STATUSES = ['Pending', 'Approved', 'Partially Fulfilled', 'Completed', 'Rejected']

const REQUEST_STATUS_COLORS = {
  'Pending': '#fef3c7,#92400e',
  'Approved': '#dbeafe,#1e40af',
  'Partially Fulfilled': '#e0e7ff,#3730a3',
  'Completed': '#dcfce7,#166534',
  'Rejected': '#fee2e2,#991b1b',
}

export default function RequestList() {
  const { 
    requests = [], // ← FALLBACK: default to empty array if undefined
    inventory = [], // ← FALLBACK
    theme, 
    user, 
    createRequest, 
    approveRequest, 
    rejectRequest, 
    fulfillRequest, 
    partialFulfillRequest, 
    deleteRequest, 
    showToast,
    createNotification,
    createActivityLog
  } = useApp()
  const { confirm } = useConfirm()

  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterSt, setFilterSt] = useState('All')
  const [filterDept, setFilterDept] = useState('All')
  const [filterDate, setFilterDate] = useState('')

  // For request items (multiple items per request)
  const [requestItems, setRequestItems] = useState([
    { id: 1, templateId: '', name: '', category: '', unit: '', qty: '', notes: '', searchItem: '', showDrop: false }
  ])

  const [form, setForm] = useState({
    department: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const processingRef = useRef(false)
  const itemIdCounter = useRef(2)

  // Statistics from Supabase data
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const pending = requests.filter(r => r.status === 'Pending').length
    const approvedToday = requests.filter(r => r.status === 'Approved' && (r.approved_at || '').startsWith(today)).length
    const completedToday = requests.filter(r => r.status === 'Completed' && (r.completed_at || '').startsWith(today)).length
    const partiallyFulfilled = requests.filter(r => r.status === 'Partially Fulfilled').length
    return { pending, approvedToday, completedToday, partiallyFulfilled }
  }, [requests])

  // Item template suggestions for each row
  const getItemSuggestions = useCallback((searchItem) => {
    if (!searchItem.trim()) return []
    const q = searchItem.toLowerCase()
    return inventory.filter(i => i.name.toLowerCase().includes(q)).slice(0, 6)
  }, [inventory])

  // Filtered requests
  const filtered = useMemo(() => {
    let list = [...requests].sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
    if (search) {
      list = list.filter(r => 
        (r.item_name || r.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.department || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.created_by_name || r.createdBy || '').toLowerCase().includes(search.toLowerCase())
      )
    }
    if (filterSt !== 'All') list = list.filter(r => r.status === filterSt)
    if (filterDept !== 'All') list = list.filter(r => r.department === filterDept)
    if (filterDate) {
      list = list.filter(r => {
        const dateStr = r.created_at || r.createdAt || ''
        return dateStr.startsWith(filterDate)
      })
    }
    return list
  }, [requests, search, filterSt, filterDept, filterDate])

  const setFormField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Add new item row
  const addItemRow = () => {
    const newId = itemIdCounter.current++
    setRequestItems(prev => [...prev, { 
      id: newId, templateId: '', name: '', category: '', unit: '', qty: '', notes: '', searchItem: '', showDrop: false 
    }])
  }

  // Remove item row
  const removeItemRow = (id) => {
    if (requestItems.length <= 1) return
    setRequestItems(prev => prev.filter(item => item.id !== id))
  }

  // Update item field
  const updateItemField = (id, field, value) => {
    setRequestItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // Select template for item
  const selectTemplate = (id, item) => {
    setRequestItems(prev => prev.map(reqItem => 
      reqItem.id === id ? { 
        ...reqItem, 
        templateId: item.id,
        name: item.name, 
        category: item.category, 
        unit: item.unit,
        searchItem: item.name,
        showDrop: false 
      } : reqItem
    ))
  }

  const handleSubmit = async () => {
    const errs = {}
    if (!form.department) errs.department = 'Department required'

    // Validate items
    const validItems = requestItems.filter(item => item.name.trim() && item.qty && Number(item.qty) > 0)
    if (validItems.length === 0) {
      errs.items = 'At least one valid item is required'
    }

    if (Object.keys(errs).length) { setErrors(errs); return }
    if (processingRef.current) return

    setLoading(true)
    processingRef.current = true
    try {
      const items = validItems.map(item => ({
        name: item.name.trim(),
        category: item.category,
        unit: item.unit,
        qty: Number(item.qty),
        notes: item.notes,
      }))

      const result = await createRequest({
        department: form.department,
        notes: form.notes,
        items: items,
      })

      if (result?.blocked) {
        showToast('error', 'Cannot Create Request', result.message)
        return
      }

      showToast('success', 'Request Created', `${items.length} item(s) requested from ${form.department}`)

      // Create notification and activity log
      if (createNotification) {
        await createNotification({
          type: 'request_created',
          title: 'New Request',
          message: `${form.department} requested ${items.length} item(s)`,
          link: '/requests'
        })
      }

      if (createActivityLog) {
        await createActivityLog({
          action: 'REQUEST_CREATED',
          description: `${form.department} created a request with ${items.length} item(s)`,
          metadata: { department: form.department, itemCount: items.length }
        })
      }

      setShowModal(false)
      setForm({ department: '', notes: '' })
      setRequestItems([{ id: 1, templateId: '', name: '', category: '', unit: '', qty: '', notes: '', searchItem: '', showDrop: false }])
      itemIdCounter.current = 2
      setErrors({})
    } catch (error) {
      showToast('error', 'Error', 'Failed to create request')
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }

  const handleApprove = async (r) => {
    if (processingRef.current) return
    processingRef.current = true
    try {
      await approveRequest(r.id)
      showToast('success', 'Request Approved', `${r.item_name || r.name} approved`)

      if (createNotification) {
        await createNotification({
          type: 'request_approved',
          title: 'Request Approved',
          message: `Request for ${r.item_name || r.name} has been approved`,
          link: '/requests'
        })
      }

      if (createActivityLog) {
        await createActivityLog({
          action: 'REQUEST_APPROVED',
          description: `Request for ${r.item_name || r.name} was approved`,
          metadata: { requestId: r.id }
        })
      }
    } catch (error) {
      showToast('error', 'Error', 'Failed to approve request')
    } finally {
      processingRef.current = false
    }
  }

  const handleReject = async (r) => {
    const ok = await confirm({
      title: 'Reject Request',
      message: `Reject request for "${r.item_name || r.name}"?`,
      variant: 'danger', confirmLabel: 'Reject',
    })
    if (!ok) return

    try {
      await rejectRequest(r.id)
      showToast('info', 'Request Rejected', `${r.item_name || r.name} rejected`)

      if (createNotification) {
        await createNotification({
          type: 'request_rejected',
          title: 'Request Rejected',
          message: `Request for ${r.item_name || r.name} has been rejected`,
          link: '/requests'
        })
      }

      if (createActivityLog) {
        await createActivityLog({
          action: 'REQUEST_REJECTED',
          description: `Request for ${r.item_name || r.name} was rejected`,
          metadata: { requestId: r.id }
        })
      }
    } catch (error) {
      showToast('error', 'Error', 'Failed to reject request')
    }
  }

  const handleFulfill = async (r) => {
    if (processingRef.current) return
    processingRef.current = true
    try {
      await fulfillRequest(r.id)
      showToast('success', 'Request Fulfilled', `${r.item_name || r.name} fulfilled and inventory updated`)

      if (createNotification) {
        await createNotification({
          type: 'request_fulfilled',
          title: 'Request Fulfilled',
          message: `Request for ${r.item_name || r.name} has been fulfilled`,
          link: '/requests'
        })
      }

      if (createActivityLog) {
        await createActivityLog({
          action: 'REQUEST_FULFILLED',
          description: `Request for ${r.item_name || r.name} was fulfilled and inventory updated`,
          metadata: { requestId: r.id }
        })
      }
    } catch (error) {
      showToast('error', 'Error', 'Failed to fulfill request')
    } finally {
      processingRef.current = false
    }
  }

  const handlePartialFulfill = async (r) => {
    if (processingRef.current) return
    processingRef.current = true
    try {
      await partialFulfillRequest(r.id)
      showToast('success', 'Partially Fulfilled', `${r.item_name || r.name} partially fulfilled`)

      if (createNotification) {
        await createNotification({
          type: 'request_partial',
          title: 'Request Partially Fulfilled',
          message: `Request for ${r.item_name || r.name} is partially fulfilled`,
          link: '/requests'
        })
      }

      if (createActivityLog) {
        await createActivityLog({
          action: 'REQUEST_PARTIAL',
          description: `Request for ${r.item_name || r.name} was partially fulfilled`,
          metadata: { requestId: r.id }
        })
      }
    } catch (error) {
      showToast('error', 'Error', 'Failed to partially fulfill request')
    } finally {
      processingRef.current = false
    }
  }

  const handleDelete = async (r) => {
    const ok = await confirm({
      title: 'Delete Request',
      message: `Delete request for "${r.item_name || r.name}"?`,
      variant: 'danger', confirmLabel: 'Delete',
    })
    if (!ok) return
    await deleteRequest(r.id)
    showToast('info', 'Request Deleted', '')
  }

  // Permissions
  const canCreate = userCan('createRequest', user?.role)
  const canApprove = userCan('approveRequest', user?.role)
  const canFulfill = userCan('fulfillRequest', user?.role)
  const canDelete = userCan('deleteRequest', user?.role)
  const isAdmin = user?.role === 'Admin'
  const isManager = user?.role === 'Manager'
  const isInventoryOfficer = user?.role === 'Store Keeper'
  const isWorker = user?.role === 'Kitchen Staff'

  // Filter requests by role
  const visibleRequests = useMemo(() => {
    if (isAdmin || isManager || isInventoryOfficer) return filtered
    if (isWorker) return filtered.filter(r => r.created_by === user?.id || r.createdBy === user?.id)
    return filtered
  }, [filtered, isAdmin, isManager, isInventoryOfficer, isWorker, user])

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Request List</h2>
          <p style={{ fontSize:12, color:theme.textMuted }}>
            {stats.pending} pending · {requests.length} total
          </p>
        </div>
        {canCreate && (
          <Btn id="btn-new-request" variant="primary" onClick={() => setShowModal(true)}>
            <Ic n="Plus" size={14} color="white"/> New Request
          </Btn>
        )}
      </div>

      {/* Statistics Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginBottom:16 }}>
        {[
          { label: 'Pending Requests', value: stats.pending, color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Approved Today', value: stats.approvedToday, color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Completed Today', value: stats.completedToday, color: '#22c55e', bg: '#dcfce7' },
          { label: 'Partially Fulfilled', value: stats.partiallyFulfilled, color: '#6366f1', bg: '#e0e7ff' },
        ].map(stat => (
          <Card key={stat.label} style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:stat.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Ic n="ClipboardList" size={18} color={stat.color}/>
            </div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:theme.text }}>{fmtNum(stat.value)}</div>
              <div style={{ fontSize:12, color:theme.textMuted }}>{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom:16, padding:'12px 14px' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:160 }}>
            <Ic n="Search" size={13} color="#9ca3af"
              style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by item, department, or requester…"
              style={{ width:'100%', padding:'8px 10px 8px 28px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}/>
          </div>

          {/* Status Filter */}
          <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:7, fontSize:12, border:`1px solid ${theme.inputBorder}`,
              background:theme.inputBg, color:theme.text, minWidth:120 }}>
            <option value="All">All Statuses</option>
            {REQUEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Department Filter */}
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:7, fontSize:12, border:`1px solid ${theme.inputBorder}`,
              background:theme.inputBg, color:theme.text, minWidth:120 }}>
            <option value="All">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Date Filter */}
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:7, fontSize:12, border:`1px solid ${theme.inputBorder}`,
              background:theme.inputBg, color:theme.text }}/>

          {filterDate && (
            <button onClick={() => setFilterDate('')}
              style={{ padding:'7px 12px', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', 
                border:'none', background:theme.bg, color:theme.textMuted }}>
              Clear Date
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        {visibleRequests.length === 0
          ? <EmptyState icon="ClipboardList" title="No requests" message="Create a request to get started"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:theme.bg }}>
                    {['Item','Category','Qty','Department','Status','Requested By','Approved By','Date','Actions'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12,
                        fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}`,
                        whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRequests.map(r => {
                    const name = r.item_name || r.name || '—'
                    const qty = r.quantity || r.qty
                    const [sbg, sc] = (REQUEST_STATUS_COLORS[r.status] || '#f3f4f6,#374151').split(',')
                    const requestedBy = r.created_by_name || r.createdBy || '—'
                    const approvedBy = r.approved_by_name || r.approvedBy || '—'
                    const dateStr = r.created_at || r.createdAt
                    return (
                      <tr key={r.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{name}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{r.category || '—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>
                          {fmtNum(qty)} {r.unit}
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{r.department || '—'}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11,
                            fontWeight:600, background:sbg, color:sc }}>{r.status}</span>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{requestedBy}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{approvedBy}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                          {dateStr ? new Date(dateStr).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ display:'flex', gap:4 }}>
                            {/* Manager can approve/reject pending */}
                            {(canApprove || isManager) && r.status === 'Pending' && (
                              <>
                                <button onClick={() => handleApprove(r)}
                                  style={{ padding:'4px 8px', background:'#dcfce7', color:'#166534',
                                    border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                                  Approve
                                </button>
                                <button onClick={() => handleReject(r)}
                                  style={{ padding:'4px 8px', background:'#fee2e2', color:'#991b1b',
                                    border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                                  Reject
                                </button>
                              </>
                            )}

                            {/* Inventory Officer can fulfill approved/partially fulfilled */}
                            {(canFulfill || isInventoryOfficer) && (r.status === 'Approved' || r.status === 'Partially Fulfilled') && (
                              <>
                                <button onClick={() => handleFulfill(r)}
                                  style={{ padding:'4px 8px', background:'#dbeafe', color:'#1e40af',
                                    border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                                  Fulfill
                                </button>
                                <button onClick={() => handlePartialFulfill(r)}
                                  style={{ padding:'4px 8px', background:'#e0e7ff', color:'#3730a3',
                                    border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                                  Partial
                                </button>
                              </>
                            )}

                            {/* Delete button */}
                            {(canDelete || isAdmin) && (
                              <button onClick={() => handleDelete(r)}
                                style={{ padding:'4px 6px', background:'transparent', color:'#9ca3af',
                                  border:'none', borderRadius:6, cursor:'pointer' }}>
                                <Ic n="Trash2" size={13}/>
                              </button>
                            )}
                          </div>
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
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title="📋 New Request">

        {/* Department */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
            Department <span style={{ color:'#ef4444' }}>*</span>
          </label>
          <select value={form.department} onChange={e => setFormField('department', e.target.value)}
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.department ? '#ef4444' : theme.inputBorder}`,
              borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
            <option value="">Select department…</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {errors.department && <div className="field-error">{errors.department}</div>}
        </div>

        {/* Request Items */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:8 }}>
            Request Items <span style={{ color:'#ef4444' }}>*</span>
          </label>

          {requestItems.map((item, index) => (
            <div key={item.id} style={{ 
              marginBottom:12, 
              padding:12, 
              borderRadius:8, 
              border:`1px solid ${theme.border}`,
              background:theme.bg 
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:600, color:theme.textMuted }}>Item #{index + 1}</span>
                {requestItems.length > 1 && (
                  <button onClick={() => removeItemRow(item.id)}
                    style={{ padding:'2px 6px', background:'transparent', color:'#ef4444',
                      border:'none', borderRadius:4, cursor:'pointer', fontSize:11 }}>
                    <Ic n="Trash2" size={12}/> Remove
                  </button>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8, marginBottom:8 }}>
                {/* Item search with dropdown */}
                <div style={{ position:'relative' }}>
                  <input value={item.searchItem}
                    onChange={e => { 
                      updateItemField(item.id, 'searchItem', e.target.value)
                      updateItemField(item.id, 'name', e.target.value)
                      updateItemField(item.id, 'showDrop', true)
                    }}
                    onFocus={() => updateItemField(item.id, 'showDrop', true)}
                    placeholder="Search item template…"
                    style={{ width:'100%', padding:'8px 10px', border:`1px solid ${theme.inputBorder}`,
                      borderRadius:6, fontSize:13, background:theme.inputBg, color:theme.text }}/>
                  <SearchDropdown 
                    show={item.showDrop && getItemSuggestions(item.searchItem).length > 0} 
                    items={getItemSuggestions(item.searchItem)}
                    onSelect={selectedItem => selectTemplate(item.id, selectedItem)}
                  />
                </div>

                {/* Quantity */}
                <input type="number" value={item.qty} 
                  onChange={e => updateItemField(item.id, 'qty', e.target.value)}
                  min="0.01" step="0.01" placeholder="Qty"
                  style={{ padding:'8px 10px', border:`1px solid ${theme.inputBorder}`,
                    borderRadius:6, fontSize:13, background:theme.inputBg, color:theme.text }}/>

                {/* Unit (read-only from template) */}
                <input value={item.unit || 'pcs'} readOnly
                  placeholder="Unit"
                  style={{ padding:'8px 10px', border:`1px solid ${theme.inputBorder}`,
                    borderRadius:6, fontSize:13, background:theme.bg, color:theme.textMuted }}/>
              </div>

              {/* Category display */}
              {item.category && (
                <div style={{ fontSize:11, color:theme.textMuted, marginBottom:4 }}>
                  Category: {item.category}
                </div>
              )}

              {/* Item notes */}
              <input value={item.notes}
                onChange={e => updateItemField(item.id, 'notes', e.target.value)}
                placeholder="Optional notes for this item…"
                style={{ width:'100%', padding:'6px 10px', border:`1px solid ${theme.inputBorder}`,
                  borderRadius:6, fontSize:12, background:theme.inputBg, color:theme.text }}/>
            </div>
          ))}

          {errors.items && <div className="field-error" style={{ marginBottom:8 }}>{errors.items}</div>}

          <button onClick={addItemRow}
            style={{ padding:'8px 14px', background:theme.bg, color:theme.text, border:`1px solid ${theme.border}`,
              borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
            <Ic n="Plus" size={12} color={theme.text}/> Add Item
          </button>
        </div>

        {/* Request Notes */}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Request Notes</label>
          <textarea value={form.notes} onChange={e => setFormField('notes', e.target.value)} rows={2}
            placeholder="Optional notes for this request…"
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`,
              borderRadius:8, fontSize:13, resize:'vertical', background:theme.inputBg, color:theme.text }}/>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Request'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}