import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Ic, Btn, Modal, Card, StatusPill } from '../components/ui'
import { useConfirm } from '../components/ui'

// Roles visible to ALL users (Developer hidden)
const ROLES = [
  'Admin',
  'Manager',
  'Store Keeper',
  'Kitchen Staff',
  'Viewer'
]

export default function UserManagement() {
  const { users, setUsers, theme, user: currentUser, showToast } = useApp()
  const { confirm } = useConfirm()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'Store Keeper', 
    status: 'Active', 
    phone: '',
    branch_id: ''
  })
  const [errors, setErrors] = useState({})

  // Determine if current user is a Developer
  const showBranchField = currentUser?.role === 'Developer'

  // Fetch branches (only needed for Developers)
  useEffect(() => {
    if (showBranchField) {
      fetchBranches()
    }
  }, [showBranchField])

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name')

      if (error) throw error
      setBranches(data || [])
    } catch (err) {
      console.error('Error fetching branches:', err)
      showToast('error', 'Error', 'Failed to load branches')
    }
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const openCreate = () => {
    setEditing(null)
    setForm({ 
      name: '', 
      email: '', 
      password: '', 
      role: 'Store Keeper', 
      status: 'Active', 
      phone: '',
      branch_id: showBranchField ? '' : (currentUser?.branch_id || '')
    })
    setShowModal(true)
    setErrors({})
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'Store Keeper',
      status: u.status || 'Active',
      phone: u.phone || '',
      branch_id: u.branch_id || ''
    })
    setShowModal(true)
    setErrors({})
  }

  // ── Create User Function ──────────────────────────────────────────────
  const createUser = async (userData) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: userData,
      })

      if (error) throw error

      setUsers(prev => [...prev, data.user])

      return {
        success: true,
        user: data.user,
      }
    } catch (err) {
      console.error(err)
      return {
        success: false,
        error: err.message,
      }
    }
  }

  // ── Update User Function ──────────────────────────────────────────────
  const updateUser = async (id, userData) => {
    try {
      const updatePayload = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        phone: userData.phone || '',
        updated_at: new Date().toISOString()
      }

      // Only include branch_id if the current user is a Developer
      if (showBranchField && userData.branch_id) {
        updatePayload.branch_id = userData.branch_id
      }

      const { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
      return { success: true, user: data }

    } catch (error) {
      console.error('Update user error:', error)
      return { success: false, error: error.message }
    }
  }

  // ── Delete User Function ──────────────────────────────────────────────
  const deleteUser = async (id) => {
    try {
      const { error: publicError } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (publicError) throw publicError

      await supabase.functions.invoke("delete-user", {
        body: { id },
      })

      setUsers(prev => prev.filter(u => u.id !== id))
      return { success: true }

    } catch (error) {
      console.error('Delete user error:', error)
      return { success: false, error: error.message }
    }
  }

  // ── Handle Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name required'
    if (!form.email.trim()) errs.email = 'Email required'
    if (!editing && !form.password.trim()) errs.password = 'Password required'
    if (!editing && form.password && form.password.length < 6) errs.password = 'Password must be at least 6 characters'

    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const data = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        status: form.status,
        phone: form.phone || '',
      }

      // For non-Developers, always use their own branch_id
      // For Developers, use the selected branch_id (or current user's branch as fallback)
      if (showBranchField) {
        data.branch_id = form.branch_id || currentUser?.branch_id
      } else {
        data.branch_id = currentUser?.branch_id
      }

      if (form.password) data.password = form.password

      let result
      if (editing) {
        result = await updateUser(editing.id, data)
      } else {
        result = await createUser(data)
      }

      if (result.success) {
        showToast('success', editing ? 'User Updated' : 'User Created', form.name)
        setShowModal(false)
        setErrors({})
      } else {
        showToast('error', 'Failed', result.error || 'Something went wrong')
      }

    } catch (error) {
      console.error('Save error:', error)
      showToast('error', 'Failed', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>
            User Management
          </h2>
          <p style={{ fontSize: 12, color: theme.textMuted }}>
            {users?.length || 0} users · Manage roles and permissions
          </p>
        </div>
        <Btn variant="primary" onClick={openCreate}>
          <Ic n="UserPlus" size={14} color="white" /> Add User
        </Btn>
      </div>

      {/* ── User Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12
      }}>
        {users && users.length > 0 ? (
          users.filter(u => !u._hidden).map(u => (
            <Card key={u.id} style={{
              padding: '16px 18px',
              transition: 'all 0.2s ease',
              border: `1px solid ${theme.border}`,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#2563eb',
                    flexShrink: 0,
                  }}>
                    {(u.name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>
                      {u.email}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: u.role === 'Admin' ? '#7c3aed' : '#6b7280',
                      marginTop: 2,
                      fontWeight: u.role === 'Admin' ? 600 : 400
                    }}>
                      {u.role}
                    </div>
                    {u.branch_id && (
                      <div style={{
                        fontSize: 10,
                        color: theme.textMuted,
                        marginTop: 2,
                        opacity: 0.8
                      }}>
                        Branch: {branches.find(b => b.id === u.branch_id)?.name || 'Unknown'}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <StatusPill status={u.status || 'Active'} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button
                      onClick={() => openEdit(u)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6b7280',
                        padding: '4px',
                        borderRadius: 4,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Ic n="Edit" size={14} />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete User',
                            message: `Are you sure you want to delete "${u.name}"? This action cannot be undone.`,
                            variant: 'danger',
                            confirmLabel: 'Delete'
                          })
                          if (ok) {
                            const result = await deleteUser(u.id)
                            if (result.success) {
                              showToast('info', 'User Deleted', u.name)
                            } else {
                              showToast('error', 'Delete Failed', result.error)
                            }
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc2626',
                          padding: '4px',
                          borderRadius: 4,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Ic n="Trash2" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '40px 20px',
            color: theme.textMuted,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <p style={{ fontSize: 14 }}>No users found</p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>Click "Add User" to create your first user</p>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setErrors({})
        }}
        title={editing ? 'Edit User' : 'Add User'}
      >
        <div style={{ maxWidth: '100%' }}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 5
            }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="John Doe"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${errors.name ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 14,
                background: theme.inputBg,
                color: theme.text,
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = errors.name ? '#ef4444' : theme.inputBorder }}
            />
            {errors.name && <div className="field-error" style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.name}</div>}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 5
            }}>
              Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="user@restaurant.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${errors.email ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 14,
                background: theme.inputBg,
                color: theme.text,
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = errors.email ? '#ef4444' : theme.inputBorder }}
            />
            {errors.email && <div className="field-error" style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.email}</div>}
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 5
            }}>
              Password {editing ? <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>(leave blank to keep current)</span> : <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={editing ? 'Enter new password to change' : 'Min 6 characters'}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${errors.password ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 14,
                background: theme.inputBg,
                color: theme.text,
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = errors.password ? '#ef4444' : theme.inputBorder }}
            />
            {errors.password && <div className="field-error" style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.password}</div>}
          </div>

          {/* Role & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5
              }}>
                Role
              </label>
              <select
                value={form.role}
                onChange={e => set('role', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${theme.inputBorder}`,
                  borderRadius: 8,
                  fontSize: 13,
                  background: theme.inputBg,
                  color: theme.text,
                  outline: 'none',
                }}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5
              }}>
                Status
              </label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${theme.inputBorder}`,
                  borderRadius: 8,
                  fontSize: 13,
                  background: theme.inputBg,
                  color: theme.text,
                  outline: 'none',
                }}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Branch Assignment (Developers Only) */}
          {showBranchField && (
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5
              }}>
                Branch <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={form.branch_id}
                onChange={e => set('branch_id', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${theme.inputBorder}`,
                  borderRadius: 8,
                  fontSize: 13,
                  background: theme.inputBg,
                  color: theme.text,
                  outline: 'none',
                }}
              >
                <option value="">Select a branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {branches.length === 0 && (
                <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                  Loading branches...
                </div>
              )}
            </div>
          )}

          {/* Phone (Optional) */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 5
            }}>
              Phone <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+92 300 1234567"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 14,
                background: theme.inputBg,
                color: theme.text,
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = theme.inputBorder }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn
              variant="outline"
              onClick={() => {
                setShowModal(false)
                setErrors({})
              }}
            >
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={handleSave}
              disabled={loading}
              style={{ minWidth: 100 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 16,
                    height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  {editing ? 'Updating...' : 'Creating...'}
                </span>
              ) : (
                editing ? 'Update User' : 'Create User'
              )}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}