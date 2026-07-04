import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState, StatusPill } from '../components/ui'
import { useConfirm } from '../components/ui'
import { fmtNum, DEFAULT_UNITS, userCan } from '../lib/constants'

export default function ProcurementRequests() {
  const { procurements, createProcurement, updateProcurementStatus, deleteProcurement, templates, theme, user, showToast } = useApp()
  const { confirm } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ item_name:'', quantity:'', unit:'pcs', priority:'Medium', notes:'' })
  const [errors, setErrors] = useState({})

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))

  const handleCreate = async () => {
    const errs = {}
    if (!form.item_name.trim()) errs.item_name = 'Item required'
    if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = 'Qty required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await createProcurement({ ...form, quantity: Number(form.quantity) })
      showToast('success', 'Procurement Request Created', form.item_name)
      setShowModal(false); setErrors({})
      setForm({ item_name:'', quantity:'', unit:'pcs', priority:'Medium', notes:'' })
    } finally { setLoading(false) }
  }

  const sorted = useMemo(() =>
    [...procurements].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)),
    [procurements]
  )

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Procurement Requests</h2>
        <Btn variant="primary" onClick={() => setShowModal(true)}><Ic n="Plus" size={14} color="white"/> New Request</Btn>
      </div>
      <Card style={{ padding:0, overflow:'hidden' }}>
        {sorted.length === 0
          ? <EmptyState icon="ShoppingCart" title="No procurement requests"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:theme.bg }}>
                  {['Item','Qty','Priority','Status','Notes','Date','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}`, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sorted.map(p => (
                    <tr key={p.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                      <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{p.item_name||p.name||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{fmtNum(p.quantity||p.qty)} {p.unit}</td>
                      <td style={{ padding:'10px 14px' }}><StatusPill status={p.priority||'Medium'}/></td>
                      <td style={{ padding:'10px 14px' }}><StatusPill status={p.status||'Open'}/></td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{p.notes||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          {p.status === 'Open' && userCan('closeProcurement', user?.role) && (
                            <button onClick={() => updateProcurementStatus(p.id, 'Closed')}
                              style={{ padding:'3px 8px', background:'#dcfce7', color:'#166534', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                              Close
                            </button>
                          )}
                          <button onClick={async () => {
                            const ok = await confirm({ title:'Delete', message:`Delete "${p.item_name||p.name}"?`, variant:'danger', confirmLabel:'Delete' })
                            if (ok) { await deleteProcurement(p.id); showToast('info','Deleted','') }
                          }} style={{ padding:'3px 6px', background:'transparent', color:'#9ca3af', border:'none', borderRadius:6, cursor:'pointer' }}>
                            <Ic n="Trash2" size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title="New Procurement Request">
        {[['Item Name *','item_name'],['Notes','notes']].map(([label,key]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
            <input value={form[key]} onChange={e => set(key, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors[key]?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Qty *</label>
            <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} min="0.01" step="0.01"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.quantity?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors.quantity && <div className="field-error">{errors.quantity}</div>}
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {DEFAULT_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {['Critical','High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreate} disabled={loading}>{loading ? 'Submitting…' : 'Submit Request'}</Btn>
        </div>
      </Modal>
    </div>
  )
}
