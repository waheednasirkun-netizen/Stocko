import { useState, useRef, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState, SearchDropdown } from '../components/ui'
import { fmtNum, fmtPKR, DEPARTMENTS, userCan } from '../lib/constants'
import { transactionsApi } from '../lib/api'

const TXN_TYPES = ['Stock IN', 'Stock OUT', 'Wastage']

export default function StockMovement() {
  const { transactions, setTransactions, inventory, templates, suppliers, theme,
    user, allUnits, showToast, withActionLock, addNotification } = useApp()

  const [showModal, setShowModal]   = useState(false)
  const [txnType,   setTxnType]     = useState('Stock IN')
  const [loading,   setLoading]     = useState(false)
  const [search,    setSearch]      = useState('')
  const [filterType,setFilterType]  = useState('All')
  const [searchItem, setSearchItem] = useState('')
  const [showDrop,   setShowDrop]   = useState(false)
  const processingRef = useRef(false)

  const [form, setForm] = useState({
    item:'', category:'', unit:'pcs', qty:'', price:'',
    source:'', notes:'', department:'',
  })
  const [errors, setErrors] = useState({})

  const itemSuggestions = useMemo(() => {
    if (!searchItem.trim()) return []
    const q = searchItem.toLowerCase()
    return inventory.filter(i => i.name.toLowerCase().includes(q)).slice(0, 6)
  }, [searchItem, inventory])

  const filtered = useMemo(() => {
    let list = [...transactions]
      .sort((a,b) => new Date(b.created_at||b.date) - new Date(a.created_at||a.date))
    if (search)           list = list.filter(t => (t.item_name||t.item||'').toLowerCase().includes(search.toLowerCase()))
    if (filterType !== 'All') list = list.filter(t => t.type === filterType)
    return list
  }, [transactions, search, filterType])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.item.trim())    e.item = 'Item name required'
    if (!form.qty || Number(form.qty) <= 0) e.qty = 'Quantity must be > 0'
    if (txnType === 'Stock IN' && (!form.price || Number(form.price) < 0)) e.price = 'Valid price required'
    if (txnType === 'Stock OUT' || txnType === 'Wastage') {
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
            type: txnType, notes: form.notes,
            branchId: user?.branch_id, userId: user?.id, userName: user?.name,
          })
        }
        if (result.error) { showToast('error', 'Failed', result.error.message); return }
        setTransactions(prev => [result.data, ...prev])
        showToast('success', `${txnType} Recorded`, `${form.item} — ${fmtNum(form.qty)} ${form.unit}`)
        addNotification({ title: txnType, msg: `${form.qty} ${form.unit} of ${form.item}`, type:'success' })
        setShowModal(false)
        setForm({ item:'', category:'', unit:'pcs', qty:'', price:'', source:'', notes:'', department:'' })
        setErrors({})
      } finally {
        setLoading(false)
        processingRef.current = false
      }
    })
  }

  const typeColor = (t) => ({
    'Stock IN':    { bg:'#dcfce7', color:'#166534' },
    'Stock OUT':   { bg:'#fee2e2', color:'#991b1b' },
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
              onClick={() => { setTxnType('Stock IN'); setShowModal(true) }}>
              <Ic n="Plus" size={14} color="white"/> Stock IN
            </Btn>
            <Btn variant="outline"
              onClick={() => { setTxnType('Stock OUT'); setShowModal(true) }}>
              <Ic n="Minus" size={14}/> Stock OUT
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
            {['All','Stock IN','Stock OUT','Wastage','Fulfillment'].map(t => <option key={t}>{t}</option>)}
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

      {/* Stock IN/OUT Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }}
        title={txnType === 'Stock IN' ? '📦 Record Stock IN' : '📤 Record Stock OUT / Wastage'}>

        {/* Type selector */}
        <div style={{ display:'flex', gap:8, marginBottom:18 }}>
          {TXN_TYPES.map(t => (
            <button key={t} onClick={() => setTxnType(t)}
              style={{ flex:1, padding:'7px 4px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer',
                border: txnType===t ? 'none' : '1px solid #e5e7eb',
                background: txnType===t ? (t==='Stock IN'?'#2563eb':t==='Wastage'?'#d97706':'#dc2626') : '#f9fafb',
                color: txnType===t ? 'white' : '#6b7280' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Item search */}
        <div style={{ marginBottom:14, position:'relative' }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
            Item Name <span style={{ color:'#ef4444' }}>*</span>
          </label>
          <input value={form.item}
            onChange={e => {
              const v = e.target.value
              if (txnType === 'Stock IN') { set('item', v) }
              else { setSearchItem(v); set('item', v); setShowDrop(true) }
            }}
            onFocus={() => txnType !== 'Stock IN' && setShowDrop(true)}
            placeholder={txnType==='Stock IN' ? 'Enter item name' : 'Search existing inventory…'}
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.item?'#ef4444':theme.inputBorder}`,
              borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
          {errors.item && <div className="field-error">{errors.item}</div>}
          {txnType !== 'Stock IN' && showDrop && (
            <SearchDropdown
              show={showDrop && itemSuggestions.length > 0}
              items={itemSuggestions}
              onSelect={item => {
                set('item', item.name); set('unit', item.unit); set('category', item.category)
                setSearchItem(item.name); setShowDrop(false)
              }}
            />
          )}
        </div>

        {/* Category + Unit row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Category</label>
            <input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Vegetables"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}/>
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

        {/* Source (Stock IN) */}
        {txnType === 'Stock IN' && (
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Supplier</label>
            <input value={form.source} onChange={e => set('source', e.target.value)} list="supplier-list"
              placeholder="Supplier name"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}/>
            <datalist id="supplier-list">
              {/* suppliers injected from context via useApp will be available */}
            </datalist>
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

        {/* Total preview */}
        {txnType === 'Stock IN' && form.qty && form.price && (
          <div style={{ padding:'10px 14px', background:'#f0f9ff', border:'1px solid #bae6fd',
            borderRadius:8, marginBottom:16, fontSize:13, color:'#0369a1' }}>
            Total Amount: <strong>{fmtPKR(Number(form.qty) * Number(form.price))}</strong>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn
            variant={txnType==='Stock IN' ? 'primary' : txnType==='Wastage' ? 'warning' : 'danger'}
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
