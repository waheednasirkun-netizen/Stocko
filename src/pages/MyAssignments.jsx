import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import AssignmentCard from '../components/assignments/AssignmentCard'
import CompletionModal from '../components/assignments/CompletionModal'

function statusGroup(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'completed' || value === 'completed late') return 'completed'
  if (value === 'overdue') return 'overdue'
  if (value === 'due soon') return 'due'
  return 'upcoming'
}

function formatDate(value) {
  if (!value) return 'Today'
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short' })
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MyAssignments() {
  const {
    assignments = [],
    user,
    theme,
    showToast,
    fetchAssignments,
    completeAssignment,
    getAssignmentStatus,
    isAssignmentScheduledForDate,
  } = useApp()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [now, setNow] = useState(Date.now())

  const today = todayKey()

  const load = useCallback(async () => {
    if (typeof fetchAssignments !== 'function') return
    setLoading(true)
    try {
      // Ask the context for today's occurrence explicitly. The assignment is
      // a recurring template; completion is stored separately for each date.
      await fetchAssignments(undefined, {
        activeOnly: true,
        assignedTo: user?.id || null,
        forDate: todayKey(),
      })
    } catch (error) {
      showToast?.('error', 'My assignments', error?.message || 'Could not load assignments.')
    } finally {
      setLoading(false)
    }
  }, [fetchAssignments, showToast, user?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const todayTasks = useMemo(() => {
    return assignments
      .filter(task => {
        if (task.active === false) return false
        if (typeof isAssignmentScheduledForDate === 'function') {
          return isAssignmentScheduledForDate(task, new Date(today + 'T12:00:00'))
        }
        return true
      })
      .map(task => ({
        ...task,
        calculated_status:
          typeof getAssignmentStatus === 'function'
            ? getAssignmentStatus(task, task.completion, new Date(now))
            : task.calculated_status || 'Pending',
      }))
  }, [assignments, getAssignmentStatus, isAssignmentScheduledForDate, today, now])

  const filtered = useMemo(() => {
    if (filter === 'all') return todayTasks
    return todayTasks.filter(task => statusGroup(task.calculated_status) === filter)
  }, [filter, todayTasks])

  const stats = useMemo(() => {
    const groups = todayTasks.reduce((acc, task) => {
      const group = statusGroup(task.calculated_status)
      acc[group] = (acc[group] || 0) + 1
      return acc
    }, {})
    return {
      total: todayTasks.length,
      completed: groups.completed || 0,
      due: groups.due || 0,
      overdue: groups.overdue || 0,
    }
  }, [todayTasks])

  const openComplete = task => {
    setSelected(task)
    setCompletionOpen(true)
  }

  const complete = async (task, payload) => {
    if (typeof completeAssignment !== 'function') return
    setSaving(true)
    try {
      const result = await completeAssignment(task, payload)
      if (result?.success) {
        setCompletionOpen(false)
        setSelected(null)
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  const openDetails = task => {
    setSelected(task)
    setDetailsOpen(true)
  }

  const surface = theme?.cardBg || '#fff'
  const text = theme?.text || '#101828'
  const muted = theme?.textMuted || '#667085'
  const border = theme?.border || '#e4e7ec'

  return (
    <div style={{ minHeight: '100%', color: text, paddingBottom: 30 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 17 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 43, height: 43, borderRadius: 12, background: '#ecfdf3', color: '#027a48', display: 'grid', placeItems: 'center' }}>
              <Ic n="CheckCircle" size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>My Assignments</h1>
              <p style={{ margin: '4px 0 0', color: muted, fontSize: 12.5 }}>
                Your work for {formatDate(today)}.
              </p>
            </div>
          </div>
          <Btn variant="outline" onClick={load} disabled={loading}>
            <Ic n="RefreshCw" size={15} /> Refresh
          </Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 15 }}>
          <Stat label="Today" value={stats.total} icon="ClipboardList" />
          <Stat label="Checked" value={stats.completed} icon="CheckCircle" />
          <Stat label="Due now" value={stats.due} icon="Activity" />
          <Stat label="Overdue" value={stats.overdue} icon="AlertTriangle" danger />
        </div>

        <Card style={{ padding: 10, marginBottom: 14, background: surface, border: `1px solid ${border}` }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {[
              ['all', 'All'],
              ['upcoming', 'Upcoming'],
              ['due', 'Due now'],
              ['completed', 'Checked'],
              ['overdue', 'Overdue'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  border: `1px solid ${filter === key ? '#6366f1' : border}`,
                  background: filter === key ? '#eef2ff' : surface,
                  color: filter === key ? '#4338ca' : muted,
                  borderRadius: 9,
                  padding: '8px 12px',
                  fontSize: 11.5,
                  fontWeight: 750,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        {loading ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {[1, 2, 3].map(x => <div key={x} style={{ height: 150, borderRadius: 14, background: '#f2f4f7' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={filter === 'overdue' ? 'CheckCircle' : 'ClipboardList'}
            title={filter === 'all' ? 'No assignments for today' : 'Nothing in this view'}
            message={filter === 'all' ? 'You are clear for today.' : 'Try another filter to see your assignments.'}
          />
        ) : (
          <div style={{ display: 'grid', gap: 11 }}>
            {filtered.map(task => (
              <AssignmentCard
                key={task.id}
                assignment={task}
                theme={theme}
                onView={openDetails}
                onComplete={openComplete}
                showActions
              />
            ))}
          </div>
        )}

        {detailsOpen && selected && (
          <Modal open onClose={() => setDetailsOpen(false)} title="Assignment details" width={600}>
            <div style={{ display: 'grid', gap: 13 }}>
              <div style={{ padding: 15, borderRadius: 12, background: '#f8fafc', border: `1px solid ${border}` }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{selected.title || selected.name}</div>
                {selected.description && <p style={{ margin: '6px 0 0', color: muted, fontSize: 13, lineHeight: 1.55 }}>{selected.description}</p>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 9 }}>
                <Detail label="Priority" value={selected.priority || 'Medium'} />
                <Detail label="Frequency" value={String(selected.recurrence || 'daily').replaceAll('_', ' ')} />
                <Detail label="Start time" value={selected.scheduled_time || 'Any time'} />
                <Detail label="Time limit" value={`${Number(selected.time_limit_minutes || 0)} minutes`} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Btn onClick={() => setDetailsOpen(false)}>Close</Btn>
              </div>
            </div>
          </Modal>
        )}

        <CompletionModal
          open={completionOpen}
          assignment={selected}
          loading={saving}
          onClose={() => !saving && setCompletionOpen(false)}
          onComplete={complete}
        />
      </div>
    </div>
  )
}

function Stat({ icon, label, value, danger }) {
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: danger ? '#fef3f2' : '#eef2ff', color: danger ? '#b42318' : '#4f46e5' }}>
          <Ic n={icon} size={18} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#667085', fontWeight: 700 }}>{label}</div>
          <div style={{ marginTop: 2, fontSize: 19, fontWeight: 800 }}>{value}</div>
        </div>
      </div>
    </Card>
  )
}

function Detail({ label, value }) {
  return (
    <div style={{ padding: 11, borderRadius: 10, background: '#f8fafc', border: '1px solid #edf0f4' }}>
      <div style={{ fontSize: 10.5, color: '#98a2b3', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 12.5, color: '#344054', fontWeight: 750, textTransform: label === 'Frequency' ? 'capitalize' : 'none' }}>{value}</div>
    </div>
  )
}
