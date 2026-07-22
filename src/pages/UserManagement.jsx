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

  // Branch management state (Developer only)
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '', domain: '' })
  const [branchErrors, setBranchErrors] = useState({})
  const [branchLoading, setBranchLoading] = useState(false)

  // Determine if current user is a Developer
  const isDeveloper = currentUser?.role === 'Developer'
  const canManageUsers = ['Developer', 'Admin', 'Manager'].includes(currentUser?.role)

  // Filter users by branch - Developers see all, others see only their branch
  const visibleUsers = !canManageUsers
    ? []
    : isDeveloper
      ? users
      : users?.filter(u => u.branch_id === currentUser?.branch_id)

  // Fetch branches (needed for Developers and for branch management)
  useEffect(() => {
    if (isDeveloper) {
      fetchBranches()
    }
  }, [isDeveloper])

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, address, phone, domain')
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
      branch_id: isDeveloper ? '' : (currentUser?.branch_id || '')
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

  // ── Branch Management Functions (Developer Only) ───────────────────
  const openBranchModal = () => {
    setEditingBranch(null)
    setBranchForm({ name: '', address: '', phone: '', domain: '' })
    setBranchErrors({})
    setShowBranchModal(true)
  }

  const openEditBranch = (branch) => {
    setEditingBranch(branch)
    setBranchForm({
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      domain: branch.domain || ''
    })
    setBranchErrors({})
    setShowBranchModal(true)
  }

  const validateDomain = (domain) => {
    if (!domain) return true
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*(\.[a-zA-Z0-9][a-zA-Z0-9\-]*)+$/
    return domainRegex.test(domain.trim())
  }

  const handleSaveBranch = async () => {
    const errs = {}
    if (!branchForm.name.trim()) errs.name = 'Branch name required'
    if (branchForm.domain && !validateDomain(branchForm.domain)) {
      errs.domain = 'Invalid domain format (e.g. stockofsd.com)'
    }

    if (Object.keys(errs).length) {
      setBranchErrors(errs)
      return
    }

    setBranchLoading(true)
    setBranchErrors({})

    try {
      const payload = {
        name: branchForm.name.trim(),
        address: branchForm.address.trim() || null,
        phone: branchForm.phone.trim() || null,
        domain: branchForm.domain.trim().toLowerCase() || null,
      }

      if (editingBranch) {
        const { data, error } = await supabase
          .from('branches')
          .update(payload)
          .eq('id', editingBranch.id)
          .select()
          .single()
        if (error) throw error
        setBranches(prev => prev.map(b => b.id === editingBranch.id ? { ...b, ...data } : b))
        showToast('success', 'Branch Updated', branchForm.name)
      } else {
        const { data, error } = await supabase
          .from('branches')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        setBranches(prev => [...prev, data])
        showToast('success', 'Branch Created', branchForm.name)
      }

      setShowBranchModal(false)
      setEditingBranch(null)
      setBranchForm({ name: '', address: '', phone: '', domain: '' })
    } catch (error) {
      console.error('Branch save error:', error)
      showToast('error', 'Failed', error.message)
    } finally {
      setBranchLoading(false)
    }
  }

  const handleDeleteBranch = async (branch) => {
    const ok = await confirm({
      title: 'Delete Branch',
      message: `Delete "${branch.name}"? Users assigned to this branch will become unassigned.`,
      variant: 'danger',
      confirmLabel: 'Delete'
    })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branch.id)

      if (error) throw error

      setBranches(prev => prev.filter(b => b.id !== branch.id))
      setUsers(prev => prev.map(u => u.branch_id === branch.id ? { ...u, branch_id: null } : u))
      showToast('info', 'Branch Deleted', branch.name)
    } catch (error) {
      console.error('Delete branch error:', error)
      showToast('error', 'Delete Failed', error.message)
    }
  }

  const getFunctionError = async (error, fallback = 'Request failed') => {
    try {
      const body = await error?.context?.json?.()
      return body?.error || body?.message || error?.message || fallback
    } catch {
      return error?.message || fallback
    }
  }

  const getFreshSession = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) throw sessionError

    let session = sessionData.session
    const expiresSoon =
      !session?.expires_at ||
      session.expires_at <= Math.floor(Date.now() / 1000) + 60

    if (expiresSoon) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError || !refreshed.session) {
        await supabase.auth.signOut()
        throw new Error('Your session expired. Please sign in again.')
      }

      session = refreshed.session
    }

    return session
  }

  // ── Create User ──────────────────────────────────────────────────────────
  const createUser = async (userData) => {
    try {
      const session = await getFreshSession()

      const payload = {
        ...userData,
        branch_id: isDeveloper ? userData.branch_id : currentUser?.branch_id,
      }

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (error) throw new Error(await getFunctionError(error, 'Could not create user'))
      if (!data?.success) throw new Error(data?.error || 'Could not create user')

      setUsers(prev => [...prev, data.user])
      return data
    } catch (error) {
      console.error('Create user error:', error)
      return { success: false, error: error.message }
    }
  }

  // ── Update User ──────────────────────────────────────────────────────────
  const updateUser = async (id, userData) => {
    try {
      const session = await getFreshSession()

      const payload = {
        id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        phone: userData.phone?.trim() || '',
        branch_id: isDeveloper
          ? (userData.branch_id || null)
          : (currentUser?.branch_id || null),
      }

      const newPassword = typeof userData.password === 'string' ? userData.password : ''
      if (newPassword) payload.password = newPassword

      const { data, error } = await supabase.functions.invoke('update-user', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (error) {
        throw new Error(await getFunctionError(error, 'Could not update user'))
      }

      if (!data?.success) {
        throw new Error(data?.error || 'User update failed')
      }

      if (newPassword && (data.passwordUpdated !== true || data.passwordVerified !== true)) {
        throw new Error('Supabase Auth did not verify the new password')
      }

      if (!data.user) {
        throw new Error('User was updated, but the updated profile was not returned')
      }

      setUsers(prev => prev.map(user =>
        user.id === id ? { ...user, ...data.user } : user
      ))

      return data
    } catch (error) {
      console.error('Update user error:', error)
      return { success: false, error: error.message }
    }
  }
  // ── Delete User ──────────────────────────────────────────────────────────
  const deleteUser = async (id) => {
    try {
      // Delete from public.users first
      const { error: publicError } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (publicError) throw publicError

      // Then delete auth user via RPC (avoids Edge Function CORS)
      const { error: rpcError } = await supabase.rpc('delete_auth_user', {
        p_user_id: id
      })

      if (rpcError) {
        console.warn('Auth user deletion warning:', rpcError.message)
        // Don't throw - the public user is already deleted
      }

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
    if (!editing && form.password === '') errs.password = 'Password required'
    if (form.password !== '' && form.password.length < 6) errs.password = 'Password must be at least 6 characters'

    if (isDeveloper && !editing && !form.branch_id) {
      errs.branch_id = 'Please select a branch'
    }

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

      if (isDeveloper) {
        data.branch_id = form.branch_id || currentUser?.branch_id || ''
      } else {
        data.branch_id = currentUser?.branch_id || ''
      }

      if (form.password !== '') data.password = form.password

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

  if (!canManageUsers) {
    return (
      <Card style={{ padding: 32, textAlign: 'center' }}>
        <Ic n="Shield" size={32} color={theme.danger || '#dc2626'} />
        <h2 style={{ marginTop: 12, color: theme.text }}>Access Denied</h2>
        <p style={{ marginTop: 6, color: theme.textMuted }}>
          Only Developers, Admins, and Managers can manage users.
        </p>
      </Card>
    )
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
            {visibleUsers?.length || 0} users · Manage roles and permissions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isDeveloper && (
            <Btn variant="outline" onClick={openBranchModal}>
              <Ic n="Building2" size={14} /> Manage Branches
            </Btn>
          )}
          <Btn variant="primary" onClick={openCreate}>
            <Ic n="UserPlus" size={14} color="white" /> Add User
          </Btn>
        </div>
      </div>

      {/* ── User Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12
      }}>
        {visibleUsers && visibleUsers.length > 0 ? (
          visibleUsers.filter(u => !u._hidden).map(u => (
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

      {/* ── User Modal ── */}
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
          {isDeveloper && (
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
                  border: `1px solid ${errors.branch_id ? '#ef4444' : theme.inputBorder}`,
                  borderRadius: 8,
                  fontSize: 13,
                  background: theme.inputBg,
                  color: theme.text,
                  outline: 'none',
                }}
              >
                <option value="">Select a branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} {b.domain ? `(@${b.domain})` : ''}</option>
                ))}
              </select>
              {errors.branch_id && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                  {errors.branch_id}
                </div>
              )}
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

      {/* ── Branch Management Modal (Developer Only) ── */}
      <Modal
        open={showBranchModal}
        onClose={() => {
          setShowBranchModal(false)
          setBranchErrors({})
          setEditingBranch(null)
          setBranchForm({ name: '', address: '', phone: '', domain: '' })
        }}
        title="Manage Branches"
      >
        <div style={{ maxWidth: '100%' }}>
          {/* Branch List */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                Existing Branches ({branches.length})
              </h3>
              <Btn variant="primary" size="sm" onClick={() => {
                setEditingBranch(null)
                setBranchForm({ name: '', address: '', phone: '', domain: '' })
                setBranchErrors({})
              }}>
                <Ic n="Plus" size={12} color="white" /> New Branch
              </Btn>
            </div>

            {branches.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                {branches.map(branch => (
                  <div
                    key={branch.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: `1px solid ${theme.border}`,
                      background: theme.cardBg || theme.inputBg,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: theme.text,
                        marginBottom: 2
                      }}>
                        {branch.name}
                        {branch.domain && (
                          <span style={{
                            fontSize: 11,
                            color: '#2563eb',
                            fontWeight: 500,
                            marginLeft: 8,
                            background: '#eff6ff',
                            padding: '2px 8px',
                            borderRadius: 4
                          }}>
                            @{branch.domain}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: theme.textMuted,
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap'
                      }}>
                        {branch.address && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Ic n="MapPin" size={11} /> {branch.address}
                          </span>
                        )}
                        {branch.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Ic n="Phone" size={11} /> {branch.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                      <button
                        onClick={() => openEditBranch(branch)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#6b7280',
                          padding: '6px',
                          borderRadius: 6,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        title="Edit branch"
                      >
                        <Ic n="Edit" size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteBranch(branch)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc2626',
                          padding: '6px',
                          borderRadius: 6,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        title="Delete branch"
                      >
                        <Ic n="Trash2" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '24px',
                color: theme.textMuted,
                border: `1px dashed ${theme.border}`,
                borderRadius: 8
              }}>
                <Ic n="Building2" size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>No branches yet</p>
                <p style={{ fontSize: 12, opacity: 0.7 }}>Create your first branch below</p>
              </div>
            )}
          </div>

          {/* Branch Form */}
          <div style={{
            borderTop: `1px solid ${theme.border}`,
            paddingTop: 16
          }}>
            <h3 style={{
              fontSize: 14,
              fontWeight: 600,
              color: theme.text,
              marginBottom: 14
            }}>
              {editingBranch ? `Edit: ${editingBranch.name}` : 'Create New Branch'}
            </h3>

            {/* Branch Name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5
              }}>
                Branch Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={branchForm.name}
                onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Main Branch, Downtown, etc."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${branchErrors.name ? '#ef4444' : theme.inputBorder}`,
                  borderRadius: 8,
                  fontSize: 14,
                  background: theme.inputBg,
                  color: theme.text,
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                }}
                onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
                onBlur={e => { e.target.style.borderColor = branchErrors.name ? '#ef4444' : theme.inputBorder }}
              />
              {branchErrors.name && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                  {branchErrors.name}
                </div>
              )}
            </div>

            {/* Domain */}
            <div style={{ marginBottom: 12 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5
              }}>
                Domain <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>(optional, e.g. stockofsd.com)</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  padding: '10px 0 10px 12px',
                  fontSize: 14,
                  color: '#6b7280',
                  background: theme.inputBg,
                  border: `1px solid ${branchErrors.domain ? '#ef4444' : theme.inputBorder}`,
                  borderRight: 'none',
                  borderRadius: '8px 0 0 8px',
                  fontWeight: 500
                }}>@</span>
                <input
                  type="text"
                  value={branchForm.domain}
                  onChange={e => setBranchForm(p => ({ ...p, domain: e.target.value }))}
                  placeholder="stockofsd.com"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: `1px solid ${branchErrors.domain ? '#ef4444' : theme.inputBorder}`,
                    borderLeft: 'none',
                    borderRadius: '0 8px 8px 0',
                    fontSize: 14,
                    background: theme.inputBg,
                    color: theme.text,
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#3b82f6'
                    e.target.previousSibling.style.borderColor = '#3b82f6'
                  }}
                  onBlur={e => {
                    const color = branchErrors.domain ? '#ef4444' : theme.inputBorder
                    e.target.style.borderColor = color
                    e.target.previousSibling.style.borderColor = color
                  }}
                />
              </div>
              {branchErrors.domain && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                  {branchErrors.domain}
                </div>
              )}
            </div>

            {/* Branch Address */}
            <div style={{ marginBottom: 12 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5
              }}>
                Address <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={branchForm.address}
                onChange={e => setBranchForm(p => ({ ...p, address: e.target.value }))}
                placeholder="123 Main St, City"
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

            {/* Branch Phone */}
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
                value={branchForm.phone}
                onChange={e => setBranchForm(p => ({ ...p, phone: e.target.value }))}
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {editingBranch && (
                <Btn
                  variant="outline"
                  onClick={() => {
                    setEditingBranch(null)
                    setBranchForm({ name: '', address: '', phone: '', domain: '' })
                    setBranchErrors({})
                  }}
                >
                  Cancel Edit
                </Btn>
              )}
              <Btn
                variant="primary"
                onClick={handleSaveBranch}
                disabled={branchLoading}
                style={{ minWidth: 120 }}
              >
                {branchLoading ? (
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
                    {editingBranch ? 'Updating...' : 'Creating...'}
                  </span>
                ) : (
                  editingBranch ? 'Update Branch' : 'Create Branch'
                )}
              </Btn>
            </div>
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
