
import { useState, useEffect } from 'react'

import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Ic, Btn, Modal, Card, StatusPill } from '../components/ui'
import { useConfirm } from '../components/ui'

/*
 * ============================================================
 * USER MANAGEMENT
 * ============================================================
 *
 * Role hierarchy:
 *
 * Developer
 *   └── Master
 *       └── Admin
 *           └── Manager
 *               └── Store Keeper
 *               └── Kitchen Staff
 *               └── Viewer
 *
 * Developer is hidden from the normal role selector.
 * Master can only be assigned by Developer.
 * Admin can be assigned by Developer.
 * Manager cannot assign Admin/Master/Developer.
 * ============================================================
 */

/* Roles available to normal users */
const BASE_ROLES = [
  'Store Keeper',
  'Kitchen Staff',
  'Viewer',
]

/* Roles displayed when Developer is creating/editing */
const DEVELOPER_ROLES = [
  'Master',
  'Admin',
  'Manager',
  'Store Keeper',
  'Kitchen Staff',
  'Viewer',
]

/* Roles displayed when Admin is creating/editing */
const ADMIN_ROLES = [
  'Manager',
  'Store Keeper',
  'Kitchen Staff',
  'Viewer',
]

/* Roles displayed when Manager is creating/editing */
const MANAGER_ROLES = [
  'Store Keeper',
  'Kitchen Staff',
  'Viewer',
]

/* Roles that should never be directly selectable */
const HIDDEN_ROLES = [
  'Developer',
]

export default function UserManagement() {
  const {
    users,
    setUsers,
    theme,
    user: currentUser,
    showToast,
  } = useApp()

  const { confirm } = useConfirm()

  /* ============================================================
   * USER STATE
   * ============================================================ */

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Store Keeper',
    status: 'Active',
    phone: '',
    branch_id: '',
  })

  const [errors, setErrors] = useState({})
  const [userStatusFilter, setUserStatusFilter] = useState('All')

  /* ============================================================
   * BRANCH STATE
   * ============================================================ */

  const [branches, setBranches] = useState([])

  const [showBranchModal, setShowBranchModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)

  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    phone: '',
    domain: '',
  })

  const [branchErrors, setBranchErrors] = useState({})
  const [branchLoading, setBranchLoading] = useState(false)

  /* ============================================================
   * CURRENT USER PERMISSIONS
   * ============================================================ */

  const currentRole = currentUser?.role || ''

  const isDeveloper = currentRole === 'Developer'
  const isMaster = currentRole === 'Master'
  const isAdmin = currentRole === 'Admin'
  const isManager = currentRole === 'Manager'

  const canManageUsers = [
    'Developer',
    'Master',
    'Admin',
    'Manager',
  ].includes(currentRole)

  /*
   * Master behaves like an elevated administrator.
   *
   * If your application does NOT use Master anymore,
   * simply remove "Master" from this list.
   */
  const canManageBranches = isDeveloper

  /* ============================================================
   * AVAILABLE ROLE OPTIONS
   * ============================================================ */

  const getAvailableRoles = () => {
    if (isDeveloper) {
      return DEVELOPER_ROLES
    }

    if (isMaster) {
      return [
        'Admin',
        'Manager',
        'Store Keeper',
        'Kitchen Staff',
        'Viewer',
      ]
    }

    if (isAdmin) {
      return ADMIN_ROLES
    }

    if (isManager) {
      return MANAGER_ROLES
    }

    return BASE_ROLES
  }

  const availableRoles = getAvailableRoles()

  /*
   * While editing an existing user, preserve their current role
   * even if that role is no longer available for assignment.
   *
   * This prevents the select from becoming blank.
   */
  const roleOptions = (() => {
    const currentRoleValue = form.role

    if (
      currentRoleValue &&
      !availableRoles.includes(currentRoleValue) &&
      !HIDDEN_ROLES.includes(currentRoleValue)
    ) {
      return [currentRoleValue, ...availableRoles]
    }

    return availableRoles
  })()

  /* ============================================================
   * USER VISIBILITY
   * ============================================================ */

  /*
   * Developers can see every user.
   *
   * Master/Admin/Manager can only see users belonging
   * to their branch.
   */
  const visibleUsers = !canManageUsers
    ? []
    : isDeveloper
      ? (users || [])
      : (users || []).filter(
          user => user.branch_id === currentUser?.branch_id
        )

  const filteredUsers = visibleUsers.filter(user => {
    if (user._hidden) return false

    if (userStatusFilter === 'All') {
      return true
    }

    return (
      String(user.status || 'Active').toLowerCase() ===
      userStatusFilter.toLowerCase()
    )
  })

  /* ============================================================
   * FETCH BRANCHES
   * ============================================================ */

  useEffect(() => {
    if (canManageBranches) {
      fetchBranches()
    }
  }, [canManageBranches])

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, address, phone, domain')
        .order('name')

      if (error) {
        throw error
      }

      setBranches(data || [])
    } catch (error) {
      console.error('Error fetching branches:', error)

      showToast(
        'error',
        'Error',
        'Failed to load branches'
      )
    }
  }

  /* ============================================================
   * FORM HELPERS
   * ============================================================ */

  const set = (key, value) => {
    setForm(previous => ({
      ...previous,
      [key]: value,
    }))

    /*
     * Clear field error when user starts correcting it.
     */
    if (errors[key]) {
      setErrors(previous => ({
        ...previous,
        [key]: '',
      }))
    }
  }

  /* ============================================================
   * CREATE USER
   * ============================================================ */

  const openCreate = () => {
    setEditing(null)

    const defaultRole =
      availableRoles.includes('Store Keeper')
        ? 'Store Keeper'
        : availableRoles[0] || 'Store Keeper'

    setForm({
      name: '',
      email: '',
      password: '',
      role: defaultRole,
      status: 'Active',
      phone: '',
      branch_id: isDeveloper
        ? ''
        : (currentUser?.branch_id || ''),
    })

    setErrors({})
    setShowModal(true)
  }

  /* ============================================================
   * EDIT USER
   * ============================================================ */

  const openEdit = user => {
    /*
     * Manager restrictions.
     */
    if (
      isManager &&
      ['Admin', 'Master', 'Developer'].includes(user.role)
    ) {
      showToast(
        'error',
        'Access denied',
        'Managers cannot edit Admin, Master, or Developer accounts'
      )
      return
    }

    /*
     * Admin restrictions.
     */
    if (
      isAdmin &&
      ['Master', 'Developer'].includes(user.role)
    ) {
      showToast(
        'error',
        'Access denied',
        'Admins cannot edit Master or Developer accounts'
      )
      return
    }

    /*
     * Master restrictions.
     */
    if (
      isMaster &&
      ['Developer'].includes(user.role)
    ) {
      showToast(
        'error',
        'Access denied',
        'Masters cannot edit Developer accounts'
      )
      return
    }

    setEditing(user)

    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'Store Keeper',
      status: user.status || 'Active',
      phone: user.phone || '',
      branch_id: user.branch_id || '',
    })

    setErrors({})
    setShowModal(true)
  }

  /* ============================================================
   * BRANCH MODAL
   * ============================================================ */

  const openBranchModal = () => {
    if (!isDeveloper) {
      showToast(
        'error',
        'Access denied',
        'Only Developers can manage branches'
      )
      return
    }

    setEditingBranch(null)

    setBranchForm({
      name: '',
      address: '',
      phone: '',
      domain: '',
    })

    setBranchErrors({})
    setShowBranchModal(true)
  }

  const openEditBranch = branch => {
    setEditingBranch(branch)

    setBranchForm({
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      domain: branch.domain || '',
    })

    setBranchErrors({})
    setShowBranchModal(true)
  }

  /* ============================================================
   * DOMAIN VALIDATION
   * ============================================================ */

  const validateDomain = domain => {
    if (!domain) return true

    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/

    return domainRegex.test(domain.trim())
  }

  /* ============================================================
   * SAVE BRANCH
   * ============================================================ */

  const handleSaveBranch = async () => {
    const branchValidationErrors = {}

    if (!branchForm.name.trim()) {
      branchValidationErrors.name = 'Branch name required'
    }

    if (
      branchForm.domain &&
      !validateDomain(branchForm.domain)
    ) {
      branchValidationErrors.domain =
        'Invalid domain format (e.g. stockofsd.com)'
    }

    if (Object.keys(branchValidationErrors).length) {
      setBranchErrors(branchValidationErrors)
      return
    }

    setBranchLoading(true)
    setBranchErrors({})

    try {
      const payload = {
        name: branchForm.name.trim(),
        address: branchForm.address.trim() || null,
        phone: branchForm.phone.trim() || null,
        domain:
          branchForm.domain.trim().toLowerCase() || null,
      }

      if (editingBranch) {
        const { data, error } = await supabase
          .from('branches')
          .update(payload)
          .eq('id', editingBranch.id)
          .select()
          .single()

        if (error) throw error

        setBranches(previous =>
          previous.map(branch =>
            branch.id === editingBranch.id
              ? { ...branch, ...data }
              : branch
          )
        )

        showToast(
          'success',
          'Branch Updated',
          branchForm.name
        )
      } else {
        const { data, error } = await supabase
          .from('branches')
          .insert(payload)
          .select()
          .single()

        if (error) throw error

        setBranches(previous => [
          ...previous,
          data,
        ])

        showToast(
          'success',
          'Branch Created',
          branchForm.name
        )
      }

      setShowBranchModal(false)
      setEditingBranch(null)

      setBranchForm({
        name: '',
        address: '',
        phone: '',
        domain: '',
      })

      setBranchErrors({})
    } catch (error) {
      console.error('Branch save error:', error)

      showToast(
        'error',
        'Failed',
        error.message || 'Failed to save branch'
      )
    } finally {
      setBranchLoading(false)
    }
  }

  /* ============================================================
   * DELETE BRANCH
   * ============================================================ */

  const handleDeleteBranch = async branch => {
    const ok = await confirm({
      title: 'Delete Branch',
      message:
        `Delete "${branch.name}"? Users assigned to this branch ` +
        'will become unassigned.',
      variant: 'danger',
      confirmLabel: 'Delete',
    })

    if (!ok) return

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branch.id)

      if (error) throw error

      setBranches(previous =>
        previous.filter(
          item => item.id !== branch.id
        )
      )

      setUsers(previous =>
        previous.map(user =>
          user.branch_id === branch.id
            ? { ...user, branch_id: null }
            : user
        )
      )

      showToast(
        'info',
        'Branch Deleted',
        branch.name
      )
    } catch (error) {
      console.error(
        'Delete branch error:',
        error
      )

      showToast(
        'error',
        'Delete Failed',
        error.message || 'Failed to delete branch'
      )
    }
  }

  /* ============================================================
   * EDGE FUNCTION ERROR HELPER
   * ============================================================ */

  const getFunctionError = async (
    error,
    fallback = 'Request failed'
  ) => {
    try {
      const body =
        await error?.context?.json?.()

      return (
        body?.error ||
        body?.message ||
        error?.message ||
        fallback
      )
    } catch {
      return error?.message || fallback
    }
  }

  /* ============================================================
   * GET FRESH SUPABASE SESSION
   * ============================================================ */

  const getFreshSession = async () => {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    let session = sessionData.session

    const expiresSoon =
      !session?.expires_at ||
      session.expires_at <=
        Math.floor(Date.now() / 1000) + 60

    if (expiresSoon) {
      const {
        data: refreshed,
        error: refreshError,
      } = await supabase.auth.refreshSession()

      if (
        refreshError ||
        !refreshed.session
      ) {
        await supabase.auth.signOut()

        throw new Error(
          'Your session expired. Please sign in again.'
        )
      }

      session = refreshed.session
    }

    return session
  }

  /* ============================================================
   * CREATE USER
   * ============================================================ */

  const createUser = async userData => {
    try {
      const session =
        await getFreshSession()

      const payload = {
        ...userData,

        branch_id: isDeveloper
          ? userData.branch_id
          : currentUser?.branch_id,
      }

      const {
        data,
        error,
      } = await supabase.functions.invoke(
        'create-user',
        {
          body: payload,

          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      )

      if (error) {
        throw new Error(
          await getFunctionError(
            error,
            'Could not create user'
          )
        )
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
          'Could not create user'
        )
      }

      if (data.user) {
        setUsers(previous => [
          ...previous,
          data.user,
        ])
      }

      return data
    } catch (error) {
      console.error(
        'Create user error:',
        error
      )

      return {
        success: false,
        error:
          error.message ||
          'Could not create user',
      }
    }
  }

  /* ============================================================
   * UPDATE USER
   * ============================================================ */

  const updateUser = async (
    id,
    userData
  ) => {
    try {
      const session =
        await getFreshSession()

      const payload = {
        id,

        name: userData.name,

        email: userData.email,

        role: userData.role,

        status: userData.status,

        phone:
          userData.phone?.trim() || '',

        branch_id: isDeveloper
          ? (userData.branch_id || null)
          : (currentUser?.branch_id || null),
      }

      const newPassword =
        typeof userData.password === 'string'
          ? userData.password
          : ''

      if (newPassword) {
        payload.password = newPassword
      }

      const {
        data,
        error,
      } = await supabase.functions.invoke(
        'update-user',
        {
          body: payload,

          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      )

      if (error) {
        throw new Error(
          await getFunctionError(
            error,
            'Could not update user'
          )
        )
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
          'User update failed'
        )
      }

      if (
        newPassword &&
        (
          data.passwordUpdated !== true ||
          data.passwordVerified !== true
        )
      ) {
        throw new Error(
          'Supabase Auth did not verify the new password'
        )
      }

      if (!data.user) {
        throw new Error(
          'User was updated, but the updated profile was not returned'
        )
      }

      setUsers(previous =>
        previous.map(user =>
          user.id === id
            ? {
                ...user,
                ...data.user,
              }
            : user
        )
      )

      return data
    } catch (error) {
      console.error(
        'Update user error:',
        error
      )

      return {
        success: false,
        error:
          error.message ||
          'Could not update user',
      }
    }
  }

  /* ============================================================
   * DELETE USER
   * ============================================================ */

  const deleteUser = async id => {
    try {
      /*
       * Delete public user first.
       */
      const {
        error: publicError,
      } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (publicError) {
        throw publicError
      }

      /*
       * Delete auth user through RPC.
       */
      const {
        error: rpcError,
      } = await supabase.rpc(
        'delete_auth_user',
        {
          p_user_id: id,
        }
      )

      if (rpcError) {
        /*
         * Do not fail the whole operation because
         * public user was already deleted.
         */
        console.warn(
          'Auth user deletion warning:',
          rpcError.message
        )
      }

      setUsers(previous =>
        previous.filter(
          user => user.id !== id
        )
      )

      return {
        success: true,
      }
    } catch (error) {
      console.error(
        'Delete user error:',
        error
      )

      return {
        success: false,
        error:
          error.message ||
          'Could not delete user',
      }
    }
  }

  /* ============================================================
   * SAVE USER
   * ============================================================ */

  const handleSave = async () => {
    const validationErrors = {}

    if (!form.name.trim()) {
      validationErrors.name =
        'Name required'
    }

    if (!form.email.trim()) {
      validationErrors.email =
        'Email required'
    }

    if (!editing && form.password === '') {
      validationErrors.password =
        'Password required'
    }

    if (
      form.password !== '' &&
      form.password.length < 6
    ) {
      validationErrors.password =
        'Password must be at least 6 characters'
    }

    if (
      isDeveloper &&
      !editing &&
      !form.branch_id
    ) {
      validationErrors.branch_id =
        'Please select a branch'
    }

    if (!form.role) {
      validationErrors.role =
        'Please select a role'
    }

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const data = {
        name: form.name.trim(),

        email:
          form.email.trim().toLowerCase(),

        role: form.role,

        status: form.status,

        phone:
          form.phone?.trim() || '',

        branch_id: isDeveloper
          ? (form.branch_id ||
              currentUser?.branch_id ||
              '')
          : (currentUser?.branch_id || ''),
      }

      if (form.password !== '') {
        data.password = form.password
      }

      let result

      if (editing) {
        result = await updateUser(
          editing.id,
          data
        )
      } else {
        result = await createUser(data)
      }

      if (result.success) {
        showToast(
          'success',
          editing
            ? 'User Updated'
            : 'User Created',
          form.name
        )

        setShowModal(false)
        setErrors({})
        setEditing(null)
      } else {
        showToast(
          'error',
          'Failed',
          result.error ||
            'Something went wrong'
        )
      }
    } catch (error) {
      console.error(
        'Save error:',
        error
      )

      showToast(
        'error',
        'Failed',
        error.message ||
          'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  /* ============================================================
   * ACCESS DENIED
   * ============================================================ */

  if (!canManageUsers) {
    return (
      <Card
        style={{
          padding: 32,
          textAlign: 'center',
        }}
      >
        <Ic
          n="Shield"
          size={32}
          color={
            theme.danger || '#dc2626'
          }
        />

        <h2
          style={{
            marginTop: 12,
            color: theme.text,
          }}
        >
          Access Denied
        </h2>

        <p
          style={{
            marginTop: 6,
            color: theme.textMuted,
          }}
        >
          Only Developers, Masters, Admins,
          and Managers can manage users.
        </p>
      </Card>
    )
  }

  /* ============================================================
   * MAIN PAGE
   * ============================================================ */

  return (
    <div
      className="animate-fade-in responsive-page users-page"
    >
      {/* ========================================================
          HEADER
      ======================================================== */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            User Management
          </h2>

          <p
            style={{
              fontSize: 12,
              color: theme.textMuted,
            }}
          >
            {filteredUsers.length} users ·
            Manage roles and permissions
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {isDeveloper && (
            <Btn
              variant="outline"
              onClick={openBranchModal}
            >
              <Ic
                n="Building2"
                size={14}
              />
              Manage Branches
            </Btn>
          )}

          <Btn
            variant="primary"
            onClick={openCreate}
          >
            <Ic
              n="UserPlus"
              size={14}
              color="white"
            />
            Add User
          </Btn>
        </div>
      </div>

      {/* ========================================================
          STATUS FILTER
      ======================================================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          Status:
        </span>

        {[
          'All',
          'Active',
          'Inactive',
        ].map(status => (
          <Btn
            key={status}
            variant={
              userStatusFilter === status
                ? 'primary'
                : 'outline'
            }
            onClick={() =>
              setUserStatusFilter(status)
            }
            style={{
              padding: '7px 12px',
              fontSize: 11,
            }}
          >
            {status}
          </Btn>
        ))}
      </div>

      {/* ========================================================
          USER CARDS
      ======================================================== */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        {filteredUsers.length > 0 ? (
          filteredUsers.map(user => (
            <Card
              key={user.id}
              style={{
                padding: '16px 18px',
                transition:
                  'all 0.2s ease',
                border:
                  `1px solid ${theme.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'flex-start',
                }}
              >
                {/* USER INFO */}

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems:
                      'center',
                    minWidth: 0,
                  }}
                >
                  {/* AVATAR */}

                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background:
                        '#eff6ff',
                      display: 'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#2563eb',
                      flexShrink: 0,
                    }}
                  >
                    {(user.name || 'U')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  {/* DETAILS */}

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: theme.text,
                        overflow:
                          'hidden',
                        textOverflow:
                          'ellipsis',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {user.name ||
                        'Unnamed User'}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color:
                          theme.textMuted,
                        overflow:
                          'hidden',
                        textOverflow:
                          'ellipsis',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {user.email}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color:
                          user.role ===
                          'Admin'
                            ? '#7c3aed'
                            : user.role ===
                              'Master'
                              ? '#b45309'
                              : '#6b7280',
                        marginTop: 2,
                        fontWeight:
                          [
                            'Admin',
                            'Master',
                          ].includes(
                            user.role
                          )
                            ? 600
                            : 400,
                      }}
                    >
                      {user.role ||
                        'No Role'}
                    </div>

                    {user.branch_id && (
                      <div
                        style={{
                          fontSize: 10,
                          color:
                            theme.textMuted,
                          marginTop: 2,
                          opacity: 0.8,
                        }}
                      >
                        Branch:{' '}
                        {branches.find(
                          branch =>
                            branch.id ===
                            user.branch_id
                        )?.name ||
                          'Unknown'}
                      </div>
                    )}
                  </div>
                </div>

                {/* ACTIONS */}

                <div
                  style={{
                    display: 'flex',
                    flexDirection:
                      'column',
                    gap: 4,
                    alignItems:
                      'flex-end',
                  }}
                >
                  <StatusPill
                    status={
                      user.status ||
                      'Active'
                    }
                  />

                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      marginTop: 4,
                    }}
                  >
                    {/* EDIT */}

                    <button
                      onClick={() =>
                        openEdit(user)
                      }
                      style={{
                        background:
                          'none',
                        border:
                          'none',
                        cursor:
                          'pointer',
                        color:
                          '#6b7280',
                        padding: 4,
                        borderRadius: 4,
                        transition:
                          'all 0.15s ease',
                      }}
                      title="Edit user"
                      onMouseEnter={e => {
                        e.currentTarget.style.background =
                          '#f3f4f6'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background =
                          'transparent'
                      }}
                    >
                      <Ic
                        n="Edit"
                        size={14}
                      />
                    </button>

                    {/* DELETE */}

                    {user.id !==
                      currentUser?.id && (
                      <button
                        onClick={async () => {
                          const ok =
                            await confirm(
                              {
                                title:
                                  'Delete User',

                                message:
                                  `Are you sure you want to delete "${user.name}"? This action cannot be undone.`,

                                variant:
                                  'danger',

                                confirmLabel:
                                  'Delete',
                              }
                            )

                          if (!ok) return

                          const result =
                            await deleteUser(
                              user.id
                            )

                          if (
                            result.success
                          ) {
                            showToast(
                              'info',
                              'User Deleted',
                              user.name
                            )
                          } else {
                            showToast(
                              'error',
                              'Delete Failed',
                              result.error
                            )
                          }
                        }}
                        style={{
                          background:
                            'none',
                          border:
                            'none',
                          cursor:
                            'pointer',
                          color:
                            '#dc2626',
                          padding: 4,
                          borderRadius: 4,
                          transition:
                            'all 0.15s ease',
                        }}
                        title="Delete user"
                        onMouseEnter={e => {
                          e.currentTarget.style.background =
                            '#fee2e2'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background =
                            'transparent'
                        }}
                      >
                        <Ic
                          n="Trash2"
                          size={14}
                        />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div
            style={{
              gridColumn:
                '1 / -1',
              textAlign:
                'center',
              padding:
                '40px 20px',
              color:
                theme.textMuted,
            }}
          >
            <div
              style={{
                fontSize: 40,
                marginBottom: 12,
              }}
            >
              👤
            </div>

            <p
              style={{
                fontSize: 14,
              }}
            >
              No users found
            </p>

            <p
              style={{
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              Click "Add User" to
              create your first user
            </p>
          </div>
        )}
      </div>

      {/* ========================================================
          USER MODAL
      ======================================================== */}

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setErrors({})
          setEditing(null)
        }}
        title={
          editing
            ? 'Edit User'
            : 'Add User'
        }
      >
        <div
          style={{
            maxWidth: '100%',
          }}
        >
          {/* NAME */}

          <div
            style={{
              marginBottom: 14,
            }}
          >
            <label
              style={labelStyle}
            >
              Full Name{' '}
              <span
                style={{
                  color:
                    '#ef4444',
                }}
              >
                *
              </span>
            </label>

            <input
              type="text"
              value={form.name}
              onChange={e =>
                set(
                  'name',
                  e.target.value
                )
              }
              placeholder="John Doe"
              style={inputStyle(
                theme,
                errors.name
              )}
            />

            {errors.name && (
              <FieldError>
                {errors.name}
              </FieldError>
            )}
          </div>

          {/* EMAIL */}

          <div
            style={{
              marginBottom: 14,
            }}
          >
            <label
              style={labelStyle}
            >
              Email Address{' '}
              <span
                style={{
                  color:
                    '#ef4444',
                }}
              >
                *
              </span>
            </label>

            <input
              type="email"
              value={form.email}
              onChange={e =>
                set(
                  'email',
                  e.target.value
                )
              }
              placeholder="user@restaurant.com"
              style={inputStyle(
                theme,
                errors.email
              )}
            />

            {errors.email && (
              <FieldError>
                {errors.email}
              </FieldError>
            )}
          </div>

          {/* PASSWORD */}

          <div
            style={{
              marginBottom: 14,
            }}
          >
            <label
              style={labelStyle}
            >
              Password{' '}
              {editing ? (
                <span
                  style={{
                    fontSize: 11,
                    color:
                      '#6b7280',
                    fontWeight: 400,
                  }}
                >
                  (leave blank to keep
                  current)
                </span>
              ) : (
                <span
                  style={{
                    color:
                      '#ef4444',
                  }}
                >
                  *
                </span>
              )}
            </label>

            <input
              type="password"
              value={form.password}
              onChange={e =>
                set(
                  'password',
                  e.target.value
                )
              }
              placeholder={
                editing
                  ? 'Enter new password to change'
                  : 'Min 6 characters'
              }
              style={inputStyle(
                theme,
                errors.password
              )}
            />

            {errors.password && (
              <FieldError>
                {errors.password}
              </FieldError>
            )}
          </div>

          {/* ROLE + STATUS */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 12,
              marginBottom: 14,
            }}
          >
            {/* ROLE */}

            <div>
              <label
                style={labelStyle}
              >
                Role
              </label>

              <select
                value={form.role}
                onChange={e =>
                  set(
                    'role',
                    e.target.value
                  )
                }
                style={selectStyle(theme)}
              >
                {roleOptions.map(
                  role => (
                    <option
                      key={role}
                      value={role}
                    >
                      {role}
                    </option>
                  )
                )}
              </select>

              {errors.role && (
                <FieldError>
                  {errors.role}
                </FieldError>
              )}
            </div>

            {/* STATUS */}

            <div>
              <label
                style={labelStyle}
              >
                Status
              </label>

              <select
                value={form.status}
                onChange={e =>
                  set(
                    'status',
                    e.target.value
                  )
                }
                style={selectStyle(theme)}
              >
                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>
            </div>
          </div>

          {/* BRANCH */}

          {isDeveloper && (
            <div
              style={{
                marginBottom: 14,
              }}
            >
              <label
                style={labelStyle}
              >
                Branch{' '}
                <span
                  style={{
                    color:
                      '#ef4444',
                  }}
                >
                  *
                </span>
              </label>

              <select
                value={form.branch_id}
                onChange={e =>
                  set(
                    'branch_id',
                    e.target.value
                  )
                }
                style={inputStyle(
                  theme,
                  errors.branch_id
                )}
              >
                <option value="">
                  Select a branch
                </option>

                {branches.map(
                  branch => (
                    <option
                      key={branch.id}
                      value={branch.id}
                    >
                      {branch.name}
                      {branch.domain
                        ? ` (@${branch.domain})`
                        : ''}
                    </option>
                  )
                )}
              </select>

              {errors.branch_id && (
                <FieldError>
                  {errors.branch_id}
                </FieldError>
              )}

              {branches.length ===
                0 && (
                <div
                  style={{
                    color:
                      '#6b7280',
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  No branches found.
                  Create a branch first.
                </div>
              )}
            </div>
          )}

          {/* PHONE */}

          <div
            style={{
              marginBottom: 18,
            }}
          >
            <label
              style={labelStyle}
            >
              Phone{' '}
              <span
                style={{
                  fontSize: 11,
                  color:
                    '#6b7280',
                  fontWeight: 400,
                }}
              >
                (optional)
              </span>
            </label>

            <input
              type="tel"
              value={form.phone}
              onChange={e =>
                set(
                  'phone',
                  e.target.value
                )
              }
              placeholder="+92 300 1234567"
              style={inputStyle(theme)}
            />
          </div>

          {/* BUTTONS */}

          <div
            style={{
              display: 'flex',
              justifyContent:
                'flex-end',
              gap: 8,
              marginTop: 8,
            }}
          >
            <Btn
              variant="outline"
              onClick={() => {
                setShowModal(false)
                setErrors({})
                setEditing(null)
              }}
            >
              Cancel
            </Btn>

            <Btn
              variant="primary"
              onClick={handleSave}
              disabled={loading}
              style={{
                minWidth: 110,
              }}
            >
              {loading ? (
                <span
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border:
                        '2px solid rgba(255,255,255,0.3)',
                      borderTop:
                        '2px solid white',
                      borderRadius:
                        '50%',
                      display:
                        'inline-block',
                      animation:
                        'spin 0.8s linear infinite',
                    }}
                  />

                  {editing
                    ? 'Updating...'
                    : 'Creating...'}
                </span>
              ) : editing ? (
                'Update User'
              ) : (
                'Create User'
              )}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ========================================================
          BRANCH MANAGEMENT MODAL
      ======================================================== */}

      {isDeveloper && (
        <Modal
          open={showBranchModal}
          onClose={() => {
            setShowBranchModal(false)
            setBranchErrors({})
            setEditingBranch(null)

            setBranchForm({
              name: '',
              address: '',
              phone: '',
              domain: '',
            })
          }}
          title="Manage Branches"
        >
          <div
            style={{
              maxWidth: '100%',
            }}
          >
            {/* BRANCH LIST */}

            <div
              style={{
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  marginBottom: 12,
                }}
              >
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color:
                      theme.text,
                  }}
                >
                  Existing Branches (
                  {branches.length}
                  )
                </h3>

                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingBranch(
                      null
                    )

                    setBranchForm({
                      name: '',
                      address: '',
                      phone: '',
                      domain: '',
                    })

                    setBranchErrors({})
                  }}
                >
                  <Ic
                    n="Plus"
                    size={12}
                    color="white"
                  />

                  New Branch
                </Btn>
              </div>

              {branches.length >
              0 ? (
                <div
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap: 8,
                  }}
                >
                  {branches.map(
                    branch => (
                      <div
                        key={
                          branch.id
                        }
                        style={{
                          display:
                            'flex',
                          justifyContent:
                            'space-between',
                          alignItems:
                            'center',
                          padding:
                            '12px 14px',
                          borderRadius:
                            8,
                          border:
                            `1px solid ${theme.border}`,
                          background:
                            theme.cardBg ||
                            theme.inputBg,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color:
                                theme.text,
                              marginBottom:
                                2,
                            }}
                          >
                            {
                              branch.name
                            }

                            {branch.domain && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color:
                                    '#2563eb',
                                  fontWeight: 500,
                                  marginLeft: 8,
                                  background:
                                    '#eff6ff',
                                  padding:
                                    '2px 8px',
                                  borderRadius:
                                    4,
                                }}
                              >
                                @
                                {
                                  branch.domain
                                }
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color:
                                theme.textMuted,
                              display:
                                'flex',
                              gap: 12,
                              flexWrap:
                                'wrap',
                            }}
                          >
                            {branch.address && (
                              <span>
                                <Ic
                                  n="MapPin"
                                  size={
                                    11
                                  }
                                />{' '}
                                {
                                  branch.address
                                }
                              </span>
                            )}

                            {branch.phone && (
                              <span>
                                <Ic
                                  n="Phone"
                                  size={
                                    11
                                  }
                                />{' '}
                                {
                                  branch.phone
                                }
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              'flex',
                            gap: 4,
                            marginLeft: 8,
                          }}
                        >
                          <button
                            onClick={() =>
                              openEditBranch(
                                branch
                              )
                            }
                            style={{
                              background:
                                'none',
                              border:
                                'none',
                              cursor:
                                'pointer',
                              color:
                                '#6b7280',
                              padding: 6,
                              borderRadius:
                                6,
                            }}
                            title="Edit branch"
                          >
                            <Ic
                              n="Edit"
                              size={
                                14
                              }
                            />
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteBranch(
                                branch
                              )
                            }
                            style={{
                              background:
                                'none',
                              border:
                                'none',
                              cursor:
                                'pointer',
                              color:
                                '#dc2626',
                              padding: 6,
                              borderRadius:
                                6,
                            }}
                            title="Delete branch"
                          >
                            <Ic
                              n="Trash2"
                              size={
                                14
                              }
                            />
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div
                  style={{
                    textAlign:
                      'center',
                    padding: 24,
                    color:
                      theme.textMuted,
                    border:
                      `1px dashed ${theme.border}`,
                    borderRadius: 8,
                  }}
                >
                  <Ic
                    n="Building2"
                    size={24}
                    style={{
                      opacity: 0.4,
                      marginBottom: 8,
                    }}
                  />

                  <p
                    style={{
                      fontSize: 13,
                    }}
                  >
                    No branches yet
                  </p>

                  <p
                    style={{
                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >
                    Create your first
                    branch below
                  </p>
                </div>
              )}
            </div>

            {/* BRANCH FORM */}

            <div
              style={{
                borderTop:
                  `1px solid ${theme.border}`,
                paddingTop: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.text,
                  marginBottom: 14,
                }}
              >
                {editingBranch
                  ? `Edit: ${editingBranch.name}`
                  : 'Create New Branch'}
              </h3>

              {/* NAME */}

              <div
                style={{
                  marginBottom: 12,
                }}
              >
                <label
                  style={labelStyle}
                >
                  Branch Name{' '}
                  <span
                    style={{
                      color:
                        '#ef4444',
                    }}
                  >
                    *
                  </span>
                </label>

                <input
                  type="text"
                  value={
                    branchForm.name
                  }
                  onChange={e =>
                    setBranchForm(
                      previous => ({
                        ...previous,
                        name: e.target.value,
                      })
                    )
                  }
                  placeholder="Main Branch, Downtown, etc."
                  style={inputStyle(
                    theme,
                    branchErrors.name
                  )}
                />

                {branchErrors.name && (
                  <FieldError>
                    {branchErrors.name}
                  </FieldError>
                )}
              </div>

              {/* DOMAIN */}

              <div
                style={{
                  marginBottom: 12,
                }}
              >
                <label
                  style={labelStyle}
                >
                  Domain{' '}
                  <span
                    style={{
                      fontSize: 11,
                      color:
                        '#6b7280',
                      fontWeight: 400,
                    }}
                  >
                    (optional, e.g.
                    stockofsd.com)
                  </span>
                </label>

                <div
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'center',
                  }}
                >
                  <span
                    style={{
                      padding:
                        '10px 0 10px 12px',
                      fontSize: 14,
                      color:
                        '#6b7280',
                      background:
                        theme.inputBg,
                      border:
                        `1px solid ${branchErrors.domain ? '#ef4444' : theme.inputBorder}`,
                      borderRight:
                        'none',
                      borderRadius:
                        '8px 0 0 8px',
                      fontWeight: 500,
                    }}
                  >
                    @
                  </span>

                  <input
                    type="text"
                    value={
                      branchForm.domain
                    }
                    onChange={e =>
                      setBranchForm(
                        previous => ({
                          ...previous,
                          domain:
                            e.target.value,
                        })
                      )
                    }
                    placeholder="stockofsd.com"
                    style={{
                      flex: 1,
                      padding:
                        '10px 12px',
                      border:
                        `1px solid ${branchErrors.domain ? '#ef4444' : theme.inputBorder}`,
                      borderLeft:
                        'none',
                      borderRadius:
                        '0 8px 8px 0',
                      fontSize: 14,
                      background:
                        theme.inputBg,
                      color:
                        theme.text,
                      outline:
                        'none',
                    }}
                  />
                </div>

                {branchErrors.domain && (
                  <FieldError>
                    {
                      branchErrors.domain
                    }
                  </FieldError>
                )}
              </div>

              {/* ADDRESS */}

              <div
                style={{
                  marginBottom: 12,
                }}
              >
                <label
                  style={labelStyle}
                >
                  Address{' '}
                  <span
                    style={{
                      fontSize: 11,
                      color:
                        '#6b7280',
                      fontWeight: 400,
                    }}
                  >
                    (optional)
                  </span>
                </label>

                <input
                  type="text"
                  value={
                    branchForm.address
                  }
                  onChange={e =>
                    setBranchForm(
                      previous => ({
                        ...previous,
                        address:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="123 Main St, City"
                  style={inputStyle(theme)}
                />
              </div>

              {/* PHONE */}

              <div
                style={{
                  marginBottom: 18,
                }}
              >
                <label
                  style={labelStyle}
                >
                  Phone{' '}
                  <span
                    style={{
                      fontSize: 11,
                      color:
                        '#6b7280',
                      fontWeight: 400,
                    }}
                  >
                    (optional)
                  </span>
                </label>

                <input
                  type="tel"
                  value={
                    branchForm.phone
                  }
                  onChange={e =>
                    setBranchForm(
                      previous => ({
                        ...previous,
                        phone:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="+92 300 1234567"
                  style={inputStyle(theme)}
                />
              </div>

              {/* BUTTONS */}

              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'flex-end',
                  gap: 8,
                }}
              >
                {editingBranch && (
                  <Btn
                    variant="outline"
                    onClick={() => {
                      setEditingBranch(
                        null
                      )

                      setBranchForm({
                        name: '',
                        address: '',
                        phone: '',
                        domain: '',
                      })

                      setBranchErrors({})
                    }}
                  >
                    Cancel Edit
                  </Btn>
                )}

                <Btn
                  variant="primary"
                  onClick={
                    handleSaveBranch
                  }
                  disabled={
                    branchLoading
                  }
                  style={{
                    minWidth: 120,
                  }}
                >
                  {branchLoading
                    ? editingBranch
                      ? 'Updating...'
                      : 'Creating...'
                    : editingBranch
                      ? 'Update Branch'
                      : 'Create Branch'}
                </Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================
          ANIMATION
      ======================================================== */}

      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 640px) {
            .users-page {
              padding: 12px;
            }
          }
        `}
      </style>
    </div>
  )
}

/* ================================================================
 * SHARED STYLES
 * ================================================================ */

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 5,
}

const inputStyle = (
  theme,
  hasError = false
) => ({
  width: '100%',
  padding: '10px 12px',
  border:
    `1px solid ${
      hasError
        ? '#ef4444'
        : theme.inputBorder
    }`,
  borderRadius: 8,
  fontSize: 14,
  background: theme.inputBg,
  color: theme.text,
  outline: 'none',
  transition:
    'border-color 0.2s ease',
})

const selectStyle = theme => ({
  width: '100%',
  padding: '10px 12px',
  border:
    `1px solid ${theme.inputBorder}`,
  borderRadius: 8,
  fontSize: 13,
  background: theme.inputBg,
  color: theme.text,
  outline: 'none',
})

function FieldError({ children }) {
  return (
    <div
      style={{
        color: '#ef4444',
        fontSize: 12,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  )
}

