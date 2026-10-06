
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, StatusPill } from '../components/ui'
import { useConfirm } from '../components/ui'

export default function UserManagement() {
  const {
    users,
    createUser,
    updateUser,
    deleteUser,
    theme,
    user: currentUser,
    showToast,
  } = useApp()

  const { confirm } = useConfirm()

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
  })

  const [errors, setErrors] = useState({})

  const currentRole = currentUser?.role || ''

  const isDeveloper = currentRole === 'Developer'
  const isAdmin = currentRole === 'Admin'
  const isManager = currentRole === 'Manager'

  const set = (key, value) => {
    setForm(previous => ({
      ...previous,
      [key]: value,
    }))
  }

  /*
   * Roles available in User Management.
   *
   * Master is intentionally available ONLY to Developer.
   * Manager can never assign Admin.
   */
  const ROLES = isDeveloper
    ? [
        'Master',
        'Admin',
        'Manager',
        'Store Keeper',
        'Kitchen Staff',
        'Viewer',
      ]
    : isManager
      ? [
          'Manager',
          'Store Keeper',
          'Kitchen Staff',
          'Viewer',
        ]
      : isAdmin
        ? [
            'Manager',
            'Store Keeper',
            'Kitchen Staff',
            'Viewer',
          ]
        : [
            'Store Keeper',
            'Kitchen Staff',
            'Viewer',
          ]

  const getDefaultRole = () => {
    if (isDeveloper) return 'Master'
    if (isAdmin) return 'Manager'
    if (isManager) return 'Store Keeper'
    return 'Store Keeper'
  }

  const openCreate = () => {
    setEditing(null)

    setForm({
      name: '',
      email: '',
      password: '',
      role: getDefaultRole(),
      status: 'Active',
      phone: '',
    })

    setErrors({})
    setShowModal(true)
  }

  const openEdit = user => {
    setEditing(user)

    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'Store Keeper',
      status: user.status || 'Active',
      phone: user.phone || '',
    })

    setErrors({})
    setShowModal(true)
  }

  const handleSave = async () => {
    const errs = {}

    if (!form.name.trim()) {
      errs.name = 'Name required'
    }

    if (!form.email.trim()) {
      errs.email = 'Email required'
    }

    if (!editing && !form.password.trim()) {
      errs.password = 'Password required'
    }

    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    /*
     * Frontend protection.
     * Backend Edge Function also validates these rules.
     */
    if (form.role === 'Master' && !isDeveloper) {
      showToast(
        'error',
        'Permission Denied',
        'Only a Developer can assign the Master role'
      )
      return
    }

    if (form.role === 'Admin' && isManager) {
      showToast(
        'error',
        'Permission Denied',
        'Managers cannot assign the Admin role'
      )
      return
    }

    setLoading(true)

    try {
      const data = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        status: form.status,
        phone: form.phone.trim(),
      }

      if (form.password) {
        data.password = form.password
      }

      if (editing) {
        await updateUser(editing.id, data)

        showToast(
          'success',
          'User Updated',
          form.name
        )
      } else {
        await createUser(data)

        showToast(
          'success',
          'User Created',
          form.name
        )
      }

      setShowModal(false)
      setErrors({})
    } catch (error) {
      console.error('[UserManagement] save error:', error)

      showToast(
        'error',
        editing ? 'Update Failed' : 'Creation Failed',
        error?.message || 'Could not save user'
      )
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    if (loading) return

    setShowModal(false)
    setErrors({})
  }

  return (
    <div className="animate-fade-in">

      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          User Management
        </h2>

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

      {/* USER LIST */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill,minmax(280px,1fr))',
          gap: 12,
        }}
      >
        {users
          .filter(user => !user._hidden)
          .map(user => (
            <Card key={user.id}>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >

                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#2563eb',
                      flexShrink: 0,
                    }}
                  >
                    {(user.name || 'U')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: theme.text,
                      }}
                    >
                      {user.name}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: theme.textMuted,
                      }}
                    >
                      {user.email}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: '#7c3aed',
                        marginTop: 2,
                      }}
                    >
                      {user.role}
                    </div>

                  </div>

                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    alignItems: 'flex-end',
                  }}
                >

                  <StatusPill
                    status={user.status || 'Active'}
                  />

                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      marginTop: 4,
                    }}
                  >

                    <button
                      onClick={() => openEdit(user)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6b7280',
                      }}
                    >
                      <Ic
                        n="Edit"
                        size={14}
                      />
                    </button>

                    {user.id !== currentUser?.id && (
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete User',
                            message: `Delete "${user.name}"?`,
                            variant: 'danger',
                            confirmLabel: 'Delete',
                          })

                          if (ok) {
                            await deleteUser(user.id)

                            showToast(
                              'info',
                              'User Deleted',
                              user.name
                            )
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc2626',
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
          ))}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={
          editing
            ? 'Edit User'
            : 'Add User'
        }
      >

        {/* NAME + EMAIL */}
        {[
          ['Full Name *', 'name'],
          ['Email *', 'email'],
        ].map(([label, key]) => (
          <div
            key={key}
            style={{
              marginBottom: 14,
            }}
          >

            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5,
              }}
            >
              {label}
            </label>

            <input
              type={
                key === 'email'
                  ? 'email'
                  : 'text'
              }
              value={form[key]}
              onChange={event =>
                set(
                  key,
                  event.target.value
                )
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                border:
                  '1px solid ' +
                  (errors[key]
                    ? '#ef4444'
                    : theme.inputBorder),
                borderRadius: 8,
                fontSize: 14,
                background: theme.inputBg,
                color: theme.text,
              }}
            />

            {errors[key] && (
              <div className="field-error">
                {errors[key]}
              </div>
            )}

          </div>
        ))}

        {/* PASSWORD */}
        <div
          style={{
            marginBottom: 14,
          }}
        >

          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 5,
            }}
          >
            Password {editing
              ? '(leave blank to keep)'
              : '*'}
          </label>

          <input
            type="password"
            value={form.password}
            onChange={event =>
              set(
                'password',
                event.target.value
              )
            }
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${
                errors.password
                  ? '#ef4444'
                  : theme.inputBorder
              }`,
              borderRadius: 8,
              fontSize: 14,
              background: theme.inputBg,
              color: theme.text,
            }}
          />

          {errors.password && (
            <div className="field-error">
              {errors.password}
            </div>
          )}

        </div>

        {/* ROLE + STATUS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 1fr',
            gap: 12,
            marginBottom: 18,
          }}
        >

          {/* ROLE */}
          <div>

            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5,
              }}
            >
              Role
            </label>

            <select
              value={form.role}
              onChange={event =>
                set(
                  'role',
                  event.target.value
                )
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 13,
                background: theme.inputBg,
                color: theme.text,
              }}
            >
              {ROLES.map(role => (
                <option
                  key={role}
                  value={role}
                >
                  {role}
                </option>
              ))}
            </select>

          </div>

          {/* STATUS */}
          <div>

            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 5,
              }}
            >
              Status
            </label>

            <select
              value={form.status}
              onChange={event =>
                set(
                  'status',
                  event.target.value
                )
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 13,
                background: theme.inputBg,
                color: theme.text,
              }}
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

        {/* ACTIONS */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >

          <Btn
            variant="outline"
            onClick={closeModal}
            disabled={loading}
          >
            Cancel
          </Btn>

          <Btn
            variant="primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? 'Saving…'
              : editing
                ? 'Update'
                : 'Create'}
          </Btn>

        </div>

      </Modal>

    </div>
  )
}
