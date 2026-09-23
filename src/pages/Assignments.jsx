
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import AssignmentForm from '../components/assignments/AssignmentForm'
import AssignmentCard from '../components/assignments/AssignmentCard'

const FILTERS = [
  'all',
  'active',
  'completed',
  'overdue',
  'inactive',
]

function normalizeRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
}

function isManager(user) {
  const role = normalizeRole(
    user?.role ||
      user?.role_name ||
      user?.user_role
  )

  return role === 'manager'
}

function displayName(person) {
  return (
    person?.name ||
    person?.full_name ||
    person?.fullName ||
    person?.email ||
    person?.id ||
    'Unknown'
  )
}

/*
 * IMPORTANT:
 *
 * Supports all of these formats:
 *
 * assigned_to: "uuid"
 *
 * assigned_to: ["uuid1", "uuid2"]
 *
 * assigned_to: [
 *   { id: "uuid1" },
 *   { id: "uuid2" }
 * ]
 */
function getManagerIds(task) {
  const value =
    task?.assigned_to ??
    task?.assignedTo ??
    task?.manager_ids ??
    task?.managerIds

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (
          item &&
          typeof item === 'object'
        ) {
          return (
            item.id ||
            item.user_id ||
            item.manager_id ||
            ''
          )
        }

        return item
      })
      .map(String)
      .map(id => id.trim())
      .filter(Boolean)
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    const id =
      value.id ||
      value.user_id ||
      value.manager_id

    return id ? [String(id)] : []
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
  }

  return value
    ? [String(value)]
    : []
}

function getManagerNames(task, managerMap) {
  const ids = getManagerIds(task)

  return ids
    .map(id => managerMap.get(id))
    .filter(Boolean)
}

function formatDate(value) {
  if (!value) return 'No fixed date'

  const d = new Date(
    `${value}T00:00:00`
  )

  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(
        undefined,
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }
      )
}

function formatTime(value) {
  if (!value) return 'Any time'

  const [h, m = 0] = String(value)
    .split(':')
    .map(Number)

  if (Number.isNaN(h)) {
    return value
  }

  return `${h % 12 || 12}:${String(m).padStart(
    2,
    '0'
  )} ${h >= 12 ? 'PM' : 'AM'}`
}

function statusOf(task) {
  return String(
    task?.calculated_status ||
      task?.status ||
      'Pending'
  )
}

export default function Assignments() {
  const {
    assignments = [],
    users = [],
    branches = [],
    user,
    userRole,
    setTab,
    theme,
    showToast,
    fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
  } = useApp()

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [query, setQuery] =
    useState('')

  const [filter, setFilter] =
    useState('all')

  const [selected, setSelected] =
    useState(null)

  const [editing, setEditing] =
    useState(null)

  const [formOpen, setFormOpen] =
    useState(false)

  const [viewOpen, setViewOpen] =
    useState(false)

  const role =
    normalizeRole(userRole)

  const canManage = [
    'master',
    'developer',
    'admin',
    'owner',
  ].includes(role)

  const managers = useMemo(() => Array.isArray(users) ? users.filter(user => user?.active !== false) : [], [users])

  const managerMap = useMemo(
    () =>
      new Map(
        (Array.isArray(users)
          ? users
          : []
        ).map(item => [
          String(item.id),
          displayName(item),
        ])
      ),
    [users]
  )

  const branchMap = useMemo(
    () =>
      new Map(
        (Array.isArray(branches)
          ? branches
          : []
        ).map(item => [
          String(item.id),
          item.name || item.id,
        ])
      ),
    [branches]
  )

  const load = useCallback(
    async () => {
      if (
        typeof fetchAssignments !==
        'function'
      ) {
        return
      }

      setLoading(true)

      try {
        // Managers must see every assignment assigned to them, even when the
        // assignment's home branch belongs to another branch.
        if (role === 'manager') {
          await fetchAssignments(undefined, {
            assignedTo: user?.id || null,
          })
        } else {
          await fetchAssignments()
        }
      } catch (error) {
        showToast?.(
          'error',
          'Assignments',
          error?.message ||
            'Could not load assignments.'
        )
      } finally {
        setLoading(false)
      }
    },
    [
      fetchAssignments,
      role,
      user?.id,
      showToast,
    ]
  )

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const needle =
      query.trim().toLowerCase()

    return (
      Array.isArray(assignments)
        ? assignments
        : []
    ).filter(task => {
      const status =
        statusOf(task).toLowerCase()

      const title = String(
        task?.title ||
          task?.name ||
          ''
      ).toLowerCase()

      const description =
        String(
          task?.description || ''
        ).toLowerCase()

      const managerNames =
        getManagerNames(
          task,
          managerMap
        )

      const managerText =
        managerNames
          .join(' ')
          .toLowerCase()

      const matchesSearch =
        !needle ||
        title.includes(needle) ||
        description.includes(needle) ||
        managerText.includes(needle)

      if (!matchesSearch) {
        return false
      }

      if (filter === 'active') {
        return (
          task.active !== false &&
          ![
            'completed',
            'completed late',
            'overdue',
          ].includes(status)
        )
      }

      if (filter === 'completed') {
        return [
          'completed',
          'completed late',
        ].includes(status)
      }

      if (filter === 'overdue') {
        return status === 'overdue'
      }

      if (filter === 'inactive') {
        return task.active === false
      }

      return true
    })
  }, [
    assignments,
    filter,
    managerMap,
    query,
  ])

  const stats = useMemo(() => {
    const list =
      Array.isArray(assignments)
        ? assignments
        : []

    return {
      total: list.length,

      active: list.filter(task => {
        const status =
          statusOf(task).toLowerCase()

        return (
          task.active !== false &&
          ![
            'completed',
            'completed late',
            'overdue',
          ].includes(status)
        )
      }).length,

      completed: list.filter(task =>
        [
          'completed',
          'completed late',
        ].includes(
          statusOf(task).toLowerCase()
        )
      ).length,

      overdue: list.filter(
        task =>
          statusOf(task).toLowerCase() ===
          'overdue'
      ).length,
    }
  }, [assignments])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const save = async payload => {
    setSaving(true)

    try {
      /*
       * Make absolutely sure the manager
       * value leaving this page is an array.
       *
       * This protects against old form data
       * or an older assignment object.
       */
      const managerIds =
        Array.isArray(
          payload?.assigned_to
        )
          ? payload.assigned_to
              .map(String)
              .filter(Boolean)
          : getManagerIds(payload)

      const normalizedPayload = {
        ...payload,
        assigned_to:
          Array.from(
            new Set(managerIds)
          ),
      }

      const result = editing
        ? await updateAssignment(
            editing.id,
            normalizedPayload
          )
        : await createAssignment(
            normalizedPayload
          )

      if (result?.success) {
        setFormOpen(false)
        setEditing(null)
        await load()
      } else if (
        result?.error ||
        result?.message
      ) {
        showToast?.(
          'error',
          'Assignments',
          result.error ||
            result.message
        )
      }
    } catch (error) {
      showToast?.(
        'error',
        'Assignments',
        error?.message ||
          'Could not save assignment.'
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async task => {
    const title =
      task?.title ||
      task?.name ||
      'this assignment'

    if (
      !window.confirm(
        `Delete "${title}"? This will also remove its completion records if the database allows it.`
      )
    ) {
      return
    }

    setSaving(true)

    try {
      const result =
        await deleteAssignment(
          task.id
        )

      if (result?.success) {
        await load()
      } else if (
        result?.error ||
        result?.message
      ) {
        showToast?.(
          'error',
          'Assignments',
          result.error ||
            result.message
        )
      }
    } catch (error) {
      showToast?.(
        'error',
        'Assignments',
        error?.message ||
          'Could not delete assignment.'
      )
    } finally {
      setSaving(false)
    }
  }

  const openEdit = task => {
    setEditing(task)
    setFormOpen(true)
  }

  const openView = task => {
    setSelected(task)
    setViewOpen(true)
  }

  const surface =
    theme?.cardBg || '#fff'

  const pageBg =
    theme?.bg || 'transparent'

  const text =
    theme?.text || '#101828'

  const muted =
    theme?.textMuted || '#667085'

  const border =
    theme?.border || '#e4e7ec'

  return (
    <div
      style={{
        minHeight: '100%',
        background: pageBg,
        color: text,
        paddingBottom: 30,
      }}
    >
      <div
        style={{
          maxWidth: 1380,
          margin: '0 auto',
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            gap: 16,
            alignItems:
              'flex-start',
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 9,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background:
                    'rgba(79,70,229,.11)',
                  color: '#4f46e5',
                  display: 'grid',
                  placeItems:
                    'center',
                }}
              >
                <Ic
                  n="ClipboardList"
                  size={22}
                />
              </div>

              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 22,
                    lineHeight: 1.2,
                    fontWeight: 800,
                  }}
                >
                  Assignments
                </h1>

                <p
                  style={{
                    margin:
                      '4px 0 0',
                    color: muted,
                    fontSize: 12.5,
                  }}
                >
                  Assign, schedule and
                  monitor manager
                  responsibilities.
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {role === 'manager' && (
              <Btn
                variant="outline"
                onClick={() =>
                  setTab?.(
                    'my-assignments'
                  )
                }
              >
                <Ic
                  n="CheckCircle"
                  size={15}
                />
                My tasks
              </Btn>
            )}

            {canManage && (
              <Btn
                variant="outline"
                onClick={() =>
                  setTab?.(
                    'assignment-history'
                  )
                }
              >
                <Ic
                  n="History"
                  size={15}
                />
                History
              </Btn>
            )}

            {canManage && (
              <Btn
                onClick={openCreate}
              >
                <Ic
                  n="Plus"
                  size={16}
                />
                New assignment
              </Btn>
            )}
          </div>
        </div>

        {/* STATS */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 11,
            marginBottom: 16,
          }}
        >
          <Stat
            icon="ClipboardList"
            label="Total"
            value={stats.total}
          />

          <Stat
            icon="Activity"
            label="Active"
            value={stats.active}
          />

          <Stat
            icon="CheckCircle"
            label="Completed"
            value={stats.completed}
          />

          <Stat
            icon="AlertTriangle"
            label="Overdue"
            value={stats.overdue}
            danger
          />
        </div>

        {/* SEARCH / FILTERS */}

        <Card
          style={{
            padding: 12,
            marginBottom: 14,
            background: surface,
            border:
              `1px solid ${border}`,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(220px, 1fr) auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                position:
                  'relative',
              }}
            >
              <Ic
                n="Search"
                size={16}
                style={{
                  position:
                    'absolute',
                  left: 11,
                  top: 12,
                  color: muted,
                }}
              />

              <input
                value={query}
                onChange={e =>
                  setQuery(
                    e.target.value
                  )
                }
                placeholder="Search task, instructions or manager…"
                style={{
                  ...inputStyle,
                  paddingLeft: 34,
                  background:
                    surface,
                  color: text,
                  borderColor:
                    border,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap:
                  'wrap',
                justifyContent:
                  'flex-end',
              }}
            >
              {FILTERS.map(item => (
                <button
                  type="button"
                  key={item}
                  onClick={() =>
                    setFilter(item)
                  }
                  style={{
                    border:
                      `1px solid ${
                        filter === item
                          ? '#6366f1'
                          : border
                      }`,
                    background:
                      filter === item
                        ? '#eef2ff'
                        : surface,
                    color:
                      filter === item
                        ? '#4338ca'
                        : muted,
                    borderRadius: 9,
                    padding:
                      '8px 11px',
                    fontSize: 11.5,
                    fontWeight: 750,
                    cursor:
                      'pointer',
                    textTransform:
                      'capitalize',
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* LIST */}

        {loading ? (
          <LoadingList />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              query ||
              filter !== 'all'
                ? 'No assignments match your filters'
                : 'No assignments yet'
            }
            message={
              canManage
                ? 'Create the first assignment to start tracking manager work.'
                : 'Your assignment list is currently empty.'
            }
            icon="ClipboardList"
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 11,
            }}
          >
            {filtered.map(task => {
              const managerNames =
                getManagerNames(
                  task,
                  managerMap
                )

              return (
                <AssignmentCard
                  key={task.id}
                  assignment={task}
                  managerName={
                    managerNames.length
                      ? managerNames.join(
                          ', '
                        )
                      : 'Unknown manager'
                  }
                  branchName={
                    branchMap.get(
                      String(
                        task.branch_id
                      )
                    ) || ''
                  }
                  onView={openView}
                  onEdit={
                    canManage
                      ? openEdit
                      : null
                  }
                  onDelete={
                    canManage
                      ? remove
                      : null
                  }
                  showActions
                />
              )
            })}
          </div>
        )}

        {/* CREATE / EDIT */}

        {formOpen && (
          <Modal
            open
            onClose={() =>
              !saving &&
              setFormOpen(false)
            }
            title={
              editing
                ? 'Edit assignment'
                : 'New assignment'
            }
            width={720}
          >
            <AssignmentForm
              initialValue={editing}
              users={managers}
              branches={branches}
              user={user}
              userRole={userRole}
              loading={saving}
              submitLabel={
                editing
                  ? 'Save changes'
                  : 'Create assignment'
              }
              onSubmit={save}
              onCancel={() =>
                !saving &&
                setFormOpen(false)
              }
            />
          </Modal>
        )}

        {/* VIEW */}

        {viewOpen &&
          selected && (
            <Modal
              open
              onClose={() =>
                setViewOpen(false)
              }
              title="Assignment details"
              width={620}
            >
              <div
                style={{
                  display: 'grid',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    padding: 15,
                    borderRadius: 13,
                    background:
                      '#f8fafc',
                    border:
                      `1px solid ${border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: text,
                    }}
                  >
                    {selected.title ||
                      selected.name}
                  </div>

                  {selected.description && (
                    <div
                      style={{
                        marginTop: 6,
                        color: muted,
                        lineHeight:
                          1.55,
                        fontSize: 13,
                      }}
                    >
                      {
                        selected.description
                      }
                    </div>
                  )}
                </div>

                <DetailGrid
                  task={selected}
                  managers={getManagerNames(
                    selected,
                    managerMap
                  )}
                  branch={
                    branchMap.get(
                      String(
                        selected.branch_id
                      )
                    )
                  }
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'flex-end',
                    gap: 8,
                  }}
                >
                  {canManage && (
                    <Btn
                      variant="outline"
                      onClick={() => {
                        setViewOpen(
                          false
                        )
                        openEdit(
                          selected
                        )
                      }}
                    >
                      <Ic
                        n="Edit"
                        size={15}
                      />
                      Edit
                    </Btn>
                  )}

                  <Btn
                    onClick={() =>
                      setViewOpen(false)
                    }
                  >
                    Close
                  </Btn>
                </div>
              </div>
            </Modal>
          )}
      </div>
    </div>
  )
}

function DetailGrid({
  task,
  managers = [],
  branch,
}) {
  const rows = [
    [
      'Assigned Users',
      managers.length
        ? managers.join(', ')
        : 'Unknown',
      'Users',
    ],
    [
      'Branch',
      branch ||
        'Current branch',
      'MapPin',
    ],
    [
      'Frequency',
      String(
        task.recurrence ||
          'daily'
      ).replaceAll(
        '_',
        ' '
      ),
      'RefreshCw',
    ],
    [
      'Date',
      formatDate(
        task.scheduled_date
      ),
      'FileText',
    ],
    [
      'Start time',
      formatTime(
        task.scheduled_time
      ),
      'Activity',
    ],
    [
      'Time limit',
      `${Number(
        task.time_limit_minutes ||
          0
      )} minutes`,
      'Shield',
    ],
    [
      'Priority',
      task.priority ||
        'Medium',
      'AlertTriangle',
    ],
    [
      'Status',
      statusOf(task),
      'CheckCircle',
    ],
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit, minmax(180px,1fr))',
        gap: 9,
      }}
    >
      {rows.map(
        ([
          label,
          value,
          icon,
        ]) => (
          <div
            key={label}
            style={{
              padding: 11,
              borderRadius: 10,
              background:
                '#f8fafc',
              border:
                '1px solid #edf0f4',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems:
                  'center',
                color:
                  '#98a2b3',
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              <Ic
                n={icon}
                size={13}
              />
              {label}
            </div>

            <div
              style={{
                marginTop: 4,
                color:
                  '#344054',
                fontSize: 12.5,
                fontWeight: 750,
                textTransform:
                  label ===
                  'Frequency'
                    ? 'capitalize'
                    : 'none',
                wordBreak:
                  label ===
                  'Assigned Users'
                    ? 'break-word'
                    : 'normal',
              }}
            >
              {value}
            </div>
          </div>
        )
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  danger = false,
}) {
  return (
    <Card
      style={{
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems:
            'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'grid',
            placeItems:
              'center',
            background:
              danger
                ? '#fef3f2'
                : '#eef2ff',
            color:
              danger
                ? '#b42318'
                : '#4f46e5',
          }}
        >
          <Ic
            n={icon}
            size={18}
          />
        </div>

        <div>
          <div
            style={{
              color:
                '#667085',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {label}
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 19,
              lineHeight: 1,
              fontWeight: 800,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </Card>
  )
}

function LoadingList() {
  return (
    <div
      style={{
        display: 'grid',
        gap: 11,
      }}
    >
      {[1, 2, 3].map(
        item => (
          <div
            key={item}
            style={{
              height: 150,
              borderRadius: 14,
              background:
                '#f2f4f7',
              animation:
                'pulse 1.4s ease-in-out infinite',
            }}
          />
        )
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  minHeight: 40,
  boxSizing: 'border-box',
  border:
    '1px solid #dbe3ef',
  borderRadius: 10,
  padding:
    '9px 11px',
  fontSize: 13,
  outline: 'none',
}

