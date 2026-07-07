import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState, StatusPill } from '../components/ui'
import { useConfirm } from '../components/ui'
import { userCan } from '../lib/constants'

export default function Suppliers() {
  const { suppliers, createSupplier, updateSupplier, deleteSupplier, theme, user, showToast } = useApp()
  const { confirm } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ name:'', phone:'', address:'', status:'Active', notes:'' })
  const [errors, setErrors] = useState({})
  const canManage = userCan('manageSuppliers', user?.role)

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))
  const openCreate = () => { setEditing(null); setForm({ name:'', phone:'', address:'', status:'Active', notes:'' }); setShowModal(true) }
  const openEdit   = (s)  => { setEditing(s); setForm({ name:s.name, phone:s.phone||'', address:s.address||'', status:s.status||'Active', notes:s.notes||'' }); setShowModal(true) }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      if (editing) await updateSupplier(editing.id, form)
      else         await createSupplier(form)
      showToast('success', editing ? 'Supplier Updated' : 'Supplier Added', form.name)
      setShowModal(false); setErrors({})
    } finally { setLoading(false) }
  }

  const handleDelete = async (s) => {
    const ok = await confirm({ title:'Delete Supplier', message:`Delete "${s.name}"?`, variant:'danger', confirmLabel:'Delete' })
    if (!ok) return
    await deleteSupplier(s.id)
    showToast('info', 'Supplier Deleted', s.name)
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Suppliers</h2>
        {canManage && <Btn variant="primary" onClick={openCreate}><Ic n="Plus" size={14} color="white"/> Add Supplier</Btn>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
        {suppliers.length === 0
          ? <EmptyState icon="Truck" title="No suppliers" message="Add your first supplier"/>
          : suppliers.map(s => (
            <Card key={s.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:4 }}>{s.name}</div>
                  {s.phone   && <div style={{ fontSize:12, color:theme.textMuted }}>📞 {s.phone}</div>}
                  {s.address && <div style={{ fontSize:12, color:theme.textMuted }}>📍 {s.address}</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                  <StatusPill status={s.status||'Active'}/>
                  {canManage && (
                    <div style={{ display:'flex', gap:4, marginTop:4 }}>
                      <button onClick={() => openEdit(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><Ic n="Edit" size={14}/></button>
                      <button onClick={() => handleDelete(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626' }}><Ic n="Trash2" size={14}/></button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        }
      </div>
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        {[['Name *','name'],['Phone','phone'],['Address','address']].map(([label,key]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
            <input value={form[key]} onChange={e => set(key, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors[key]?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        ))}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
            <option>Active</option><option>Inactive</option>
          </select>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : (editing ? 'Update' : 'Add')}</Btn>
        </div>
      </Modal>
    </div>
  )
}
