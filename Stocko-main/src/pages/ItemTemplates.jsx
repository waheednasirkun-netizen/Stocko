import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { useConfirm } from '../components/ui'
import { fmtNum, fmtPKR, userCan } from '../lib/constants'

export default function ItemTemplates() {
  const { templates, createTemplate, updateTemplate, deleteTemplate, theme, user, showToast, allUnits, setCustomUnits, customUnits } = useApp()
  const { confirm } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ name:'', category:'', unit:'pcs', defaultPrice:'', lowStockThreshold:'' })
  const [errors, setErrors] = useState({})
  const canManage = userCan('createTemplate', user?.role)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter(t => !q || t.name.toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q))
  }, [templates, search])

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))

  const openCreate = () => { setEditing(null); setForm({ name:'', category:'', unit:'pcs', defaultPrice:'', lowStockThreshold:'' }); setShowModal(true) }
  const openEdit   = (t)  => { setEditing(t); setForm({ name:t.name, category:t.category||'', unit:t.unit||'pcs', defaultPrice:t.defaultPrice||t.default_price||'', lowStockThreshold:t.lowStockThreshold||t.low_stock_threshold||'' }); setShowModal(true) }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name required'
    if (!form.category.trim()) errs.category = 'Category required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const data = { 
  name: form.name.trim(), 
  category: form.category.trim(), 
  unit: form.unit,

  default_price: Math.max(0, Number(form.defaultPrice) || 0),
  low_stock_threshold: Math.max(0, Number(form.lowStockThreshold) || 0),

  enabled: true 
}
      if (editing) await updateTemplate(editing.id, data)
      else         await createTemplate(data)
      showToast('success', editing ? 'Template Updated' : 'Template Created', form.name)
      setShowModal(false); setErrors({})
    } finally { setLoading(false) }
  }

  const handleDelete = async (t) => {
    const ok = await confirm({ title:'Delete Template', message:`Delete "${t.name}"?`, variant:'danger', confirmLabel:'Delete' })
    if (!ok) return
    await deleteTemplate(t.id)
    showToast('info', 'Template Deleted', t.name)
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Item Templates</h2>
        {canManage && <Btn variant="primary" onClick={openCreate}><Ic n="Plus" size={14} color="white"/> New Template</Btn>}
      </div>
      <Card style={{ marginBottom:16, padding:'12px 14px' }}>
        <div style={{ position:'relative' }}>
          <Ic n="Search" size={13} color="#9ca3af" style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            style={{ width:'100%', padding:'8px 10px 8px 28px', border:`1px solid ${theme.inputBorder}`, borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}/>
        </div>
      </Card>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
        {filtered.length === 0
          ? <EmptyState icon="Box" title="No templates" message="Create templates to speed up stock entry"/>
          : filtered.map(t => (
            <Card key={t.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:theme.text }}>{t.name}</div>
                  <div style={{ fontSize:12, color:theme.textMuted }}>{t.category} · {t.unit}</div>
                </div>
                {canManage && (
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => openEdit(t)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><Ic n="Edit" size={14}/></button>
                    <button onClick={() => handleDelete(t)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626' }}><Ic n="Trash2" size={14}/></button>
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {(t.defaultPrice||t.default_price) > 0 && (
                  <span style={{ fontSize:11, padding:'2px 8px', background:'#eff6ff', color:'#2563eb', borderRadius:6, fontWeight:500 }}>
                    {fmtPKR(t.defaultPrice||t.default_price)}
                  </span>
                )}
                {(t.lowStockThreshold||t.low_stock_threshold) > 0 && (
                  <span style={{ fontSize:11, padding:'2px 8px', background:'#fef9c3', color:'#854d0e', borderRadius:6, fontWeight:500 }}>
                    Min: {fmtNum(t.lowStockThreshold||t.low_stock_threshold)}
                  </span>
                )}
              </div>
            </Card>
          ))
        }
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title={editing ? 'Edit Template' : 'New Template'}>
        {[['Item Name *','name','text'],['Category *','category','text']].map(([label,key,type]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
            <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors[key]?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {allUnits.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Default Price</label>
            <input type="number" value={form.defaultPrice} onChange={e => set('defaultPrice', e.target.value)} min="0" step="0.01" placeholder="0"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Low Stock Min</label>
            <input type="number" value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} min="0" step="0.01" placeholder="0"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}/>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : (editing ? 'Update' : 'Create')}</Btn>
        </div>
      </Modal>
    </div>
  )
}
