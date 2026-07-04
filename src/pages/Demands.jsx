import { useState, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState, SearchDropdown, StatusPill } from '../components/ui'
import { fmtNum, DEPARTMENTS, userCan } from '../lib/constants'
import { useConfirm } from '../components/ui'
import TestSupabase from '../components/TestSupabase'

const PRIORITIES = ['Critical','High','Medium','Low']

export default function DemandList() {
  const { demands, inventory, theme, user, createDemand, approveDemand, rejectDemand, deleteDemand, showToast } = useApp()
  const { confirm } = useConfirm()

  const [showModal, setShowModal] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [filterSt,  setFilterSt]  = useState('All')
  const [filterPr,  setFilterPr]  = useState('All')
  const [searchItem, setSearchItem] = useState('')
  const [showDrop,   setShowDrop]   = useState(false)
  const processingRef = useRef(false)

  const [form, setForm] = useState({
    name:'', category:'', unit:'pcs', qty:'',
    priority:'Medium', department:'', notes:'',
  })
  const [errors, setErrors] = useState({})

  const itemSuggestions = useMemo(() => {
    if (!searchItem.trim()) return []
    const q = searchItem.toLowerCase()
    return inventory.filter(i => i.name.toLowerCase().includes(q)).slice(0, 6)
  }, [searchItem, inventory])

  const filtered = useMemo(() => {
    let list = [...demands].sort((a,b) => new Date(b.created_at||b.createdAt) - new Date(a.created_at||a.createdAt))
    if (search)           list = list.filter(d => (d.item_name||d.name||'').toLowerCase().includes(search.toLowerCase()))
    if (filterSt !== 'All') list = list.filter(d => d.status === filterSt)
    if (filterPr !== 'All') list = list.filter(d => d.priority === filterPr)
    return list
  }, [demands, search, filterSt, filterPr])

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))

  const handleSubmit = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Item required'
    if (!form.qty || Number(form.qty) <= 0) errs.qty = 'Quantity must be > 0'
    if (!form.department) errs.department = 'Department required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (processingRef.current) return

    setLoading(true)
    processingRef.current = true
    try {
      const result = await createDemand({
        name: form.name.trim(), category: form.category, unit: form.unit,
        qty: Number(form.qty), priority: form.priority,
        department: form.department, notes: form.notes,
      })
      if (result?.blocked) {
        showToast('error', 'Cannot Create Demand', result.message)
        if (result.reason === 'insufficient_stock') {
          setErrors({ qty: `Max: ${fmtNum(result.available)} ${result.unit}` })
        }
        return
      }
      showToast('success', 'Demand Created', `${form.name} — ${fmtNum(form.qty)} ${form.unit}`)
      setShowModal(false)
      setForm({ name:'', category:'', unit:'pcs', qty:'', priority:'Medium', department:'', notes:'' })
      setSearchItem('')
      setErrors({})
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }

  const handleDelete = async (d) => {
    const ok = await confirm({
      title: 'Delete Demand',
      message: `Delete demand for "${d.item_name||d.name}"?`,
      variant: 'danger', confirmLabel: 'Delete',
    })
    if (!ok) return
    await deleteDemand(d.id)
    showToast('info', 'Demand Deleted', '')
  }

  const canCreate  = userCan('createDemand', user?.role)
  const canApprove = userCan('fulfillDemand', user?.role)

  const pColors = {
    Critical:'#fee2e2,#991b1b', High:'#fef9c3,#854d0e',
    Medium:'#dbeafe,#1e40af',   Low:'#dcfce7,#166534',
  }

  return (
    <div className="animate-fade-in">
      <TestSupabase />
      
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Demand List</h2>
          <p style={{ fontSize:12, color:theme.textMuted }}>
            {demands.filter(d=>d.status==='Pending').length} pending · {demands.length} total
          </p>
        </div>
        {canCreate && (
          <Btn id="btn-new-demand" variant="primary" onClick={() => setShowModal(true)}>
            <Ic n="Plus" size={14} color="white"/> New Demand
          </Btn>
        )}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom:16, padding:'12px 14px' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:160 }}>
            <Ic n="Search" size={13} color="#9ca3af"
              style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ width:'100%', padding:'8px 10px 8px 28px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}/>
          </div>
          {['All','Pending','Fulfilled','Rejected','Approved'].map(s => (
            <button key={s} onClick={() => setFilterSt(s)}
              style={{ padding:'7px 12px', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', border:'none',
                background: filterSt===s ? '#2563eb' : theme.bg, color: filterSt===s ? 'white' : theme.textMuted }}>
              {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        {filtered.length === 0
          ? <EmptyState icon="ClipboardList" title="No demands" message="Create a demand to get started"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:theme.bg }}>
                    {['Item','Category','Qty','Priority','Department','Status','Created By','Date','Actions'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12,
                        fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}`,
                        whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const name = d.item_name || d.name || '—'
                    const qty  = d.quantity   || d.qty
                    const [pbg,pc] = (pColors[d.priority]||'#f3f4f6,#374151').split(',')
                    const createdBy = d.created_by_name || d.createdBy || '—'
                    const dateStr = d.created_at || d.createdAt
                    return (
                      <tr key={d.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{name}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{d.category||'—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>
                          {fmtNum(qty)} {d.unit}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11,
                            fontWeight:600, background:pbg, color:pc }}>{d.priority}</span>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{d.department||'—'}</td>
                        <td style={{ padding:'10px 14px' }}><StatusPill status={d.status}/></td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{createdBy}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                          {dateStr ? new Date(dateStr).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ display:'flex', gap:4 }}>
                            {canApprove && d.status === 'Pending' && (
                              <>
                                <button onClick={() => approveDemand(d.id)}
                                  style={{ padding:'4px 8px', background:'#dcfce7', color:'#166534',
                                    border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                                  Approve
                                </button>
                                <button onClick={() => rejectDemand(d.id)}
                                  style={{ padding:'4px 8px', background:'#fee2e2', color:'#991b1b',
                                    border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                                  Reject
                                </button>
                              </>
                            )}
                            {canApprove && (
                              <button onClick={() => handleDelete(d)}
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

      {/* Create Demand Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title="📋 New Demand">
        {/* Item search */}
        <div style={{ marginBottom:14, position:'relative' }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
            Item <span style={{ color:'#ef4444' }}>*</span>
          </label>
          <input value={searchItem}
            onChange={e => { setSearchItem(e.target.value); set('name', e.target.value); setShowDrop(true) }}
            onFocus={() => setShowDrop(true)}
            placeholder="Search inventory item…"
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.name?'#ef4444':theme.inputBorder}`,
              borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
          {errors.name && <div className="field-error">{errors.name}</div>}
          <SearchDropdown show={showDrop && itemSuggestions.length > 0} items={itemSuggestions}
            onSelect={item => {
              set('name', item.name); set('unit', item.unit); set('category', item.category)
              setSearchItem(item.name); setShowDrop(false)
            }}/>
        </div>

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
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
            Department <span style={{ color:'#ef4444' }}>*</span>
          </label>
          <select value={form.department} onChange={e => set('department', e.target.value)}
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.department?'#ef4444':theme.inputBorder}`,
              borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
            <option value="">Select department…</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          {errors.department && <div className="field-error">{errors.department}</div>}
        </div>

        <div style={{ marginBottom:18 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            placeholder="Optional…"
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`,
              borderRadius:8, fontSize:13, resize:'vertical', background:theme.inputBg, color:theme.text }}/>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Demand'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}