import { useState, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum, userCan } from '../lib/constants'

export default function FulfillmentCenter() {
  const { demands, inventory, theme, user, handleFulfillDemand, showToast } = useApp()

  const [fulfillModal, setFulfillModal] = useState(null)
  const [fulfillQty,   setFulfillQty]   = useState('')
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const processingRef = useRef(false)

  const canFulfill = userCan('fulfillDemand', user?.role)

  const pending = useMemo(() =>
    demands
      .filter(d => d.status === 'Pending' || d.status === 'Approved')
      .filter(d => {
        const name = d.item_name || d.name || ''
        return !search || name.toLowerCase().includes(search.toLowerCase())
      })
      .sort((a,b) => {
        const pOrder = { Critical:0, High:1, Medium:2, Low:3 }
        return (pOrder[a.priority]||2) - (pOrder[b.priority]||2)
      }),
    [demands, search]
  )

  const getInvItem = (demand) => {
    const name = demand.item_name || demand.name || ''
    return inventory.find(i => i.name.toLowerCase() === name.toLowerCase())
  }

  const openFulfill = (demand) => {
    const inv = getInvItem(demand)
    setFulfillModal({ ...demand, _inv: inv })
    setFulfillQty(String(demand.quantity || demand.qty || ''))
  }

  const handleSubmit = async () => {
    if (processingRef.current) return
    const qty = Number(fulfillQty)
    const inv = fulfillModal?._inv
    if (!qty || qty <= 0) { showToast('error', 'Invalid Qty', 'Enter a positive quantity'); return }
    if (inv && qty > inv.quantity) { showToast('error', 'Insufficient Stock', `Only ${fmtNum(inv.quantity)} ${inv.unit} available`); return }

    processingRef.current = true
    setLoading(true)
    try {
      const ok = await handleFulfillDemand({
        demandId: fulfillModal.id,
        item:     fulfillModal.item_name || fulfillModal.name,
        qty,
        unit:     fulfillModal.unit,
      })
      if (ok) {
        setFulfillModal(null)
        setFulfillQty('')
      }
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }

  const pColors = {
    Critical:'#fee2e2,#991b1b', High:'#fef9c3,#854d0e',
    Medium:'#dbeafe,#1e40af',   Low:'#dcfce7,#166534',
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Fulfillment Center</h2>
          <p style={{ fontSize:12, color:theme.textMuted }}>
            {pending.length} demand{pending.length !== 1 ? 's' : ''} waiting for fulfillment
          </p>
        </div>
        <div style={{ position:'relative' }}>
          <Ic n="Search" size={14} color="#9ca3af"
            style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ padding:'8px 10px 8px 30px', border:`1px solid ${theme.inputBorder}`,
              borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text, width:200 }}/>
        </div>
      </div>

      {pending.length === 0
        ? <EmptyState icon="CheckCircle" title="All caught up!"
            message="No pending demands to fulfill. Great work! 🎉"/>
        : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
            {pending.map(d => {
              const inv  = getInvItem(d)
              const name = d.item_name || d.name || '—'
              const qty  = d.quantity  || d.qty
              const [pbg,pc] = (pColors[d.priority]||'#f3f4f6,#374151').split(',')
              const hasStock = inv && inv.quantity > 0
              const canDispatch = canFulfill && hasStock

              return (
                <Card key={d.id} style={{
                  border: d.priority==='Critical' ? '2px solid #ef4444' : `1px solid ${theme.border}`,
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, flex:1 }}>{name}</h3>
                    <span style={{ padding:'3px 9px', borderRadius:6, fontSize:11,
                      fontWeight:600, background:pbg, color:pc, marginLeft:8, flexShrink:0 }}>
                      {d.priority}
                    </span>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                    <div style={{ padding:'8px 10px', background:theme.bg, borderRadius:7 }}>
                      <div style={{ fontSize:10, color:theme.textMuted, marginBottom:2 }}>REQUESTED</div>
                      <div style={{ fontSize:14, fontWeight:700, color:theme.text }}>
                        {fmtNum(qty)} {d.unit}
                      </div>
                    </div>
                    <div style={{ padding:'8px 10px', borderRadius:7,
                      background: !inv ? '#fee2e2' : inv.quantity <= 0 ? '#fee2e2' : '#dcfce7' }}>
                      <div style={{ fontSize:10, color: hasStock ? '#166534' : '#991b1b', marginBottom:2 }}>AVAILABLE</div>
                      <div style={{ fontSize:14, fontWeight:700, color: hasStock ? '#16a34a' : '#dc2626' }}>
                        {inv ? `${fmtNum(inv.quantity)} ${inv.unit}` : 'Not in stock'}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize:12, color:theme.textMuted, marginBottom:10 }}>
                    {d.department && <span>📍 {d.department}</span>}
                    {d.notes && <span style={{ marginLeft:8 }}>· {d.notes}</span>}
                  </div>

                  {!hasStock && (
                    <div style={{ padding:'8px 10px', background:'#fee2e2', borderRadius:7,
                      fontSize:12, color:'#991b1b', marginBottom:10 }}>
                      ⚠️ No stock available. Do a Stock IN first.
                    </div>
                  )}

                  {canFulfill && (
                    <Btn variant={canDispatch ? 'success' : 'outline'}
                      disabled={!canDispatch}
                      onClick={() => openFulfill(d)}
                      style={{ width:'100%', justifyContent:'center' }}>
                      <Ic n="CheckCircle" size={14} color={canDispatch ? 'white' : undefined}/>
                      Dispatch & Fulfill
                    </Btn>
                  )}
                </Card>
              )
            })}
          </div>
        )
      }

      {/* Fulfill Modal */}
      {fulfillModal && (
        <Modal open onClose={() => { setFulfillModal(null); setFulfillQty('') }}
          title="✅ Dispatch & Fulfill">
          {(() => {
            const inv = fulfillModal._inv
            const qty = Number(fulfillQty)
            const overLimit = inv && qty > inv.quantity
            const canGo = qty > 0 && !overLimit
            const name = fulfillModal.item_name || fulfillModal.name

            return (
              <>
                <div style={{ padding:'12px 14px', background:theme.bg, borderRadius:8, marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:theme.text }}>{name}</div>
                  <div style={{ fontSize:12, color:theme.textMuted, marginTop:3 }}>
                    Requested: {fmtNum(fulfillModal.quantity || fulfillModal.qty)} {fulfillModal.unit}
                    {inv && ` · Available: ${fmtNum(inv.quantity)} ${inv.unit}`}
                  </div>
                </div>

                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6 }}>
                    Qty to Dispatch <span style={{ color:'#ef4444' }}>*</span>
                  </label>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input
                      autoFocus
                      type="number" value={fulfillQty}
                      onChange={e => setFulfillQty(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter' && canGo && !processingRef.current) handleSubmit() }}
                      min="0.01" step="0.01"
                      style={{ flex:1, padding:'11px 12px', fontSize:15, fontWeight:600,
                        border:`1px solid ${overLimit?'#ef4444':canGo?'#16a34a':theme.inputBorder}`,
                        borderRadius:8, background:theme.inputBg, color:theme.text }}/>
                    <span style={{ fontSize:14, color:theme.textMuted }}>{fulfillModal.unit}</span>
                  </div>
                  {overLimit && (
                    <p style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>
                      ⚠️ Exceeds stock ({fmtNum(inv?.quantity)} {inv?.unit})
                    </p>
                  )}
                  {canGo && (
                    <p style={{ fontSize:11, color:'#16a34a', marginTop:5 }}>
                      ✓ Ready to dispatch. Press Enter or click below.
                    </p>
                  )}
                </div>

                <p style={{ fontSize:12, color:theme.textMuted, marginBottom:16 }}>
                  This will deduct from inventory and log a Fulfillment transaction.
                </p>

                <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                  <Btn variant="outline" onClick={() => { setFulfillModal(null); setFulfillQty('') }}>Cancel</Btn>
                  <Btn variant="success" onClick={handleSubmit}
                    disabled={loading || processingRef.current || !canGo}>
                    {loading ? 'Dispatching…' : 'Dispatch & Deduct'}
                  </Btn>
                </div>
              </>
            )
          })()}
        </Modal>
      )}
    </div>
  )
}
