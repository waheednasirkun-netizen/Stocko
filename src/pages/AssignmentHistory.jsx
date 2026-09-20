import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Card, EmptyState } from '../components/ui'

function nameOf(person) {
  return person?.name || person?.full_name || person?.email || person?.id || 'Unknown'
}

function statusMeta(value) {
  const status = String(value || '').toLowerCase()
  if (status === 'completed') return { label: 'Completed', bg: '#ecfdf3', fg: '#027a48' }
  if (status === 'late' || status === 'completed_late') return { label: 'Completed late', bg: '#fff7ed', fg: '#c2410c' }
  if (status === 'missed' || status === 'overdue') return { label: 'Missed', bg: '#fef3f2', fg: '#b42318' }
  return { label: value || 'Pending', bg: '#f2f4f7', fg: '#475467' }
}

function dateLabel(value) {
  if (!value) return '—'
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function dateTimeLabel(value) {
  if (!value) return 'Not completed'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function AssignmentHistory() {
  const {
    assignmentCompletions = [],
    users = [],
    branches = [],
    theme,
    showToast,
    currentBranch,
    fetchAssignmentHistory,
  } = useApp()

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [manager, setManager] = useState('all')
  const [branch, setBranch] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const managers = useMemo(
    () => users.filter(user => String(user.role || user.role_name || user.user_role || '').toLowerCase().replace(/[-\s]+/g, '_') === 'manager'),
    [users]
  )

  const userMap = useMemo(() => new Map(users.map(x => [x.id, nameOf(x)])), [users])
  const branchMap = useMemo(() => new Map(branches.map(x => [x.id, x.name || x.id])), [branches])

  const load = useCallback(async () => {
    if (typeof fetchAssignmentHistory !== 'function') return
    setLoading(true)
    try {
      await fetchAssignmentHistory({
        branchId: branch !== 'all' ? branch : currentBranch?.id,
        assignedTo: manager !== 'all' ? manager : null,
        startDate: from || null,
        endDate: to || null,
      })
    } catch (error) {
      showToast?.('error', 'Assignment history', error?.message || 'Could not load history.')
    } finally {
      setLoading(false)
    }
  }, [branch, currentBranch?.id, fetchAssignmentHistory, from, manager, showToast, to])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return assignmentCompletions.filter(row => {
      const assignment = row.assignment || row.assignments || {}
      const title = row.title || row.assignment_title || assignment.title || 'Untitled Task'
      const managerName =
        userMap.get(row.assigned_to) ||
        row.manager_name ||
        row.assigned_to_name ||
        row.assigned_to ||
        'Unknown'
      const branchName =
        branchMap.get(row.branch_id) ||
        row.branch_name ||
        row.branch_id ||
        'Current branch'

      const rawStatus = String(row.status || '').toLowerCase()
      const matchesBranch = branch === 'all' || row.branch_id === branch

      const matchesStatus =
        status === 'all' ||
        (status === 'completed' && rawStatus === 'completed') ||
        (status === 'late' && (rawStatus === 'completed_late' || rawStatus === 'late')) ||
        (status === 'missed' && (rawStatus === 'missed' || rawStatus === 'overdue'))

      const haystack = `${title} ${managerName} ${branchName} ${row.note || ''}`.toLowerCase()
      return matchesBranch && matchesStatus && (!needle || haystack.includes(needle))
    }).map(row => {
      const assignment = row.assignment || row.assignments || {}
      return {
        ...row,
        title: row.title || row.assignment_title || assignment.title || 'Untitled Task',
        managerName: userMap.get(row.assigned_to) || row.manager_name || row.assigned_to_name || row.assigned_to || 'Unknown',
        branchName: branchMap.get(row.branch_id) || row.branch_name || row.branch_id || 'Current branch',
      }
    })
  }, [assignmentCompletions, branch, branchMap, search, status, userMap])

  const stats = useMemo(() => {
    const list = assignmentCompletions
    return {
      total: list.length,
      completed: list.filter(x => String(x.status || '').toLowerCase() === 'completed').length,
      late: list.filter(x => ['completed_late', 'late'].includes(String(x.status || '').toLowerCase())).length,
      missed: list.filter(x => ['missed', 'overdue'].includes(String(x.status || '').toLowerCase())).length,
    }
  }, [assignmentCompletions])

  const surface = theme?.cardBg || '#fff'
  const text = theme?.text || '#101828'
  const muted = theme?.textMuted || '#667085'
  const border = theme?.border || '#e4e7ec'

  return (
    <div style={{ minHeight: '100%', color: text, paddingBottom: 30 }}>
      <div style={{ maxWidth: 1380, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 17 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 43, height: 43, borderRadius: 12, background: '#eff8ff', color: '#175cd3', display: 'grid', placeItems: 'center' }}>
              <Ic n="History" size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Assignment History</h1>
              <p style={{ margin: '4px 0 0', color: muted, fontSize: 12.5 }}>
                Review completion, late work and missed assignments.
              </p>
            </div>
          </div>
          <Btn variant="outline" onClick={load} disabled={loading}>
            <Ic n="RefreshCw" size={15} /> Refresh
          </Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 14 }}>
          <Stat label="Records" value={stats.total} icon="History" />
          <Stat label="Completed" value={stats.completed} icon="CheckCircle" />
          <Stat label="Completed late" value={stats.late} icon="Activity" />
          <Stat label="Missed" value={stats.missed} icon="AlertTriangle" danger />
        </div>

        <Card style={{ padding: 12, marginBottom: 14, background: surface, border: `1px solid ${border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) repeat(4,minmax(120px,auto))', gap: 8, alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search task, manager or note…" style={{ ...input, background: surface, color: text, borderColor: border }} />
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...input, background: surface, color: text, borderColor: border }}>
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="late">Completed late</option>
              <option value="missed">Missed</option>
            </select>
            <select value={manager} onChange={e => setManager(e.target.value)} style={{ ...input, background: surface, color: text, borderColor: border }}>
              <option value="all">All managers</option>
              {managers.map(item => <option key={item.id} value={item.id}>{nameOf(item)}</option>)}
            </select>
            <select value={branch} onChange={e => setBranch(e.target.value)} style={{ ...input, background: surface, color: text, borderColor: border }}>
              <option value="all">All branches</option>
              {branches.map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...input, background: surface, color: text, borderColor: border }} title="From date" />
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...input, background: surface, color: text, borderColor: border }} title="To date" />
            </div>
          </div>
          {branch !== 'all' && (
            <div style={{ marginTop: 8, color: muted, fontSize: 11 }}>
              Branch filtering is applied to the records currently returned by your branch access.
            </div>
          )}
        </Card>

        {loading ? (
          <div style={{ height: 300, borderRadius: 14, background: '#f2f4f7' }} />
        ) : rows.length === 0 ? (
          <EmptyState icon="History" title="No history found" message="Try changing the date, manager or status filters." />
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden', background: surface, border: `1px solid ${border}` }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Task', 'Manager', 'Branch', 'Scheduled', 'Completed', 'Status', 'Note'].map(head => (
                      <th key={head} style={th}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const meta = statusMeta(row.status)
                    return (
                      <tr key={row.id || `${row.assignment_id}-${row.scheduled_date}`} style={{ borderTop: `1px solid ${border}` }}>
                        <td style={td}>
                          <div style={{ fontWeight: 750, color: text }}>{row.title}</div>
                          {row.description && <div style={{ marginTop: 3, fontSize: 11, color: muted }}>{row.description}</div>}
                        </td>
                        <td style={td}>{row.managerName}</td>
                        <td style={td}>{row.branchName}</td>
                        <td style={td}>{dateLabel(row.scheduled_date)}{row.scheduled_time ? ` · ${row.scheduled_time}` : ''}</td>
                        <td style={td}>{dateTimeLabel(row.completed_at)}</td>
                        <td style={td}><span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: meta.bg, color: meta.fg, fontSize: 10.5, fontWeight: 800 }}>{meta.label}</span></td>
                        <td style={{ ...td, maxWidth: 240, color: muted }}>{row.note || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, icon, danger }) {
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

const input = {
  width: '100%',
  minHeight: 40,
  boxSizing: 'border-box',
  border: '1px solid #dbe3ef',
  borderRadius: 9,
  padding: '8px 10px',
  fontSize: 12,
  outline: 'none',
}

const th = {
  padding: '11px 12px',
  textAlign: 'left',
  color: '#667085',
  fontSize: 10.5,
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const td = {
  padding: '12px',
  color: '#344054',
  fontSize: 12,
  verticalAlign: 'top',
}
