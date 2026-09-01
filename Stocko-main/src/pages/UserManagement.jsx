import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, StatusPill } from '../components/ui'
import { useConfirm } from '../components/ui'

export default function UserManagement() {
  const { users, createUser, updateUser, deleteUser, theme, user: currentUser, showToast } = useApp()
  const { confirm } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'Store Keeper', status:'Active', phone:'' })
  const [errors, setErrors] = useState({})

  const set = (k,v) => setForm(p => ({ ...p, [k]:v }))
  const openCreate = () => { setEditing(null); setForm({ name:'', email:'', password:'', role:'Store Keeper', status:'Active', phone:'' }); setShowModal(true) }
  const openEdit   = (u)  => { setEditing(u); setForm({ name:u.name, email:u.email, password:'', role:u.role, status:u.status||'Active', phone:u.phone||'' }); setShowModal(true) }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name required'
    if (!form.email.trim()) errs.email = 'Email required'
    if (!editing && !form.password.trim()) errs.password = 'Password required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const data = { name: form.name, email: form.email, role: form.role, status: form.status, phone: form.phone }
      if (form.password) data.password = form.password
      if (editing) await updateUser(editing.id, data)
      else         await createUser(data)
      showToast('success', editing ? 'User Updated' : 'User Created', form.name)
      setShowModal(false); setErrors({})
    } finally { setLoading(false) }
  }

  const ROLES = ['Admin','Manager','Store Keeper','Kitchen Staff','Viewer']

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>User Management</h2>
        <Btn variant="primary" onClick={openCreate}><Ic n="UserPlus" size={14} color="white"/> Add User</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
        {users.filter(u => !u._hidden).map(u => (
          <Card key={u.id}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'#eff6ff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:700, color:'#2563eb', flexShrink:0 }}>
                  {(u.name||'U').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:theme.text }}>{u.name}</div>
                  <div style={{ fontSize:12, color:theme.textMuted }}>{u.email}</div>
                  <div style={{ fontSize:11, color:'#7c3aed', marginTop:2 }}>{u.role}</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                <StatusPill status={u.status||'Active'}/>
                <div style={{ display:'flex', gap:4, marginTop:4 }}>
                  <button onClick={() => openEdit(u)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><Ic n="Edit" size={14}/></button>
                  {u.id !== currentUser?.id && (
                    <button onClick={async () => {
                      const ok = await confirm({ title:'Delete User', message:`Delete "${u.name}"?`, variant:'danger', confirmLabel:'Delete' })
                      if (ok) { await deleteUser(u.id); showToast('info','User Deleted',u.name) }
                    }} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626' }}><Ic n="Trash2" size={14}/></button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title={editing ? 'Edit User' : 'Add User'}>
        {[['Full Name *','name'],['Email *','email']].map(([label,key]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
            <input type={key==='email'?'email':'text'} value={form[key]} onChange={e => set(key, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors[key]?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>
            Password {editing ? '(leave blank to keep)' : '*'}
          </label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
            style={{ width:'100%', padding:'10px 12px', border:`1px solid ${errors.password?'#ef4444':theme.inputBorder}`, borderRadius:8, fontSize:14, background:theme.inputBg, color:theme.text }}/>
          {errors.password && <div className="field-error">{errors.password}</div>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:5 }}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}>
              <option>Active</option><option>Inactive</option>
            </select>
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
