import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum } from '../lib/constants'
import { inventoryApi } from '../lib/api'

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  'All', 'Frozen Food', 'Packaging', 'Vegetables', 'Drinks',
  'Cleaning', 'Meat', 'Dairy', 'Spices', 'Other',
]

const STATUS_OPTIONS = ['All', 'In Stock', 'Low Stock', 'Out of Stock']

const STOCK_STATUS = {
  ok:       { bg: '#dcfce7', color: '#166534', label: 'In Stock' },
  near:     { bg: '#fef9c3', color: '#854d0e', label: 'Low Stock' },
  critical: { bg: '#fee2e2', color: '#991b1b', label: 'Out of Stock' },
}

const SORTABLE_COLUMNS = ['name', 'stock', 'category', 'updated']

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const fmtAgo = (str) => {
  if (!str) return '—'
  const diff = Date.now() - new Date(str).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const fmtDateTime = (str) => {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const getStockStatus = (qty, minThreshold) => {
  const q = Number(qty) || 0
  const t = Number(minThreshold) || 0
  if (q === 0) return STOCK_STATUS.critical
  if (t > 0 && q <= t) return STOCK_STATUS.near
  return STOCK_STATUS.ok
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEMOIZED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const StatusBadge = memo(({ qty, minThreshold }) => {
  const status = getStockStatus(qty, minThreshold)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      background: status.bg,
      color: status.color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: status.color,
        display: 'inline-block',
      }} />
      {status.label}
    </span>
  )
})
StatusBadge.displayName = 'StatusBadge'

const StatCard = memo(({ label, value, icon, bg, color }) => (
  <Card style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
    <div style={{
      width: 44,
      height: 44,
      borderRadius: 10,
      background: bg,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Ic n={icon} size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
    </div>
  </Card>
))
StatCard.displayName = 'StatCard'

const SortIcon = memo(({ column, sortConfig, theme }) => {
  if (sortConfig.key !== column) {
    return <Ic n="ArrowUpDown" size={12} color={theme.textMuted} />
  }
  return <Ic n={sortConfig.direction === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={12} color={theme.text} />
})
SortIcon.displayName = 'SortIcon'

const HistoryRow = memo(({ tx, isLast, theme, itemUnit }) => {
  const isStockIn = tx.type === 'Stock IN'
  const badgeColor = isStockIn ? '#16a34a' : '#3b82f6'
  const badgeBg = isStockIn ? '#dcfce7' : '#dbeafe'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '12px 0',
      borderBottom: !isLast ? `1px solid ${theme.border}` : 'none',
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: badgeBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
      }}>
        <Ic n={isStockIn ? 'ArrowDown' : 'ArrowUp'} size={16} color={badgeColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            background: badgeBg,
            color: badgeColor,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {tx.type || '—'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
            {fmtNum(Math.abs(Number(tx.quantity || tx.qty || 0)))} {tx.unit || itemUnit || 'pcs'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
          {tx.department && <span>Department: {tx.department} • </span>}
          <span>By: {tx.recorded_by_name || tx.created_by_name || '—'}</span>
        </div>
        {tx.notes && (
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, fontStyle: 'italic' }}>
            Note: {tx.notes}
          </div>
        )}
        {tx.reference && (
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
            Ref: {tx.reference}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 11,
        color: theme.textMuted,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        textAlign: 'right',
      }}>
        <div>{fmtDateTime(tx.created_at || tx.date)}</div>
        <div style={{ marginTop: 2 }}>{fmtAgo(tx.created_at || tx.date)}</div>
      </div>
    </div>
  )
})
HistoryRow.displayName = 'HistoryRow'

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN INVENTORY COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Inventory() {
  const { user, theme, showToast, transactions } = useApp()

  // ── Local State ─────────────────────────────────────────────────────────
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
  const [historyItem, setHistoryItem] = useState(null)

  // ── Data Fetching ───────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    if (!user?.branch_id) return
    setLoading(true)
    try {
      const { data, error } = await inventoryApi.getAll(user.branch_id)
      if (error) {
        showToast('error', 'Load Failed', error.message)
      } else {
        setItems(data || [])
      }
    } catch (err) {
      showToast('error', 'Load Failed', err.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [user?.branch_id, showToast])

  // Single effect for initial load — transactions change triggers via parent context
  useEffect(() => {
    loadItems()
  }, [loadItems])

  // ── Pre-computed Transaction Lookups (O(m) once, not O(n*m)) ────────────
  const transactionMap = useMemo(() => {
    const map = new Map()
    const safeTxns = transactions || []

    for (const tx of safeTxns) {
      const name = tx.item_name || tx.item
      if (!name) continue
      const key = name.toLowerCase()

      if (!map.has(key)) {
        map.set(key, { lastIn: null, lastOut: null, history: [] })
      }
      const entry = map.get(key)
      entry.history.push(tx)

      const date = tx.created_at || tx.date
      if (tx.type === 'Stock IN') {
        if (!entry.lastIn || new Date(date) > new Date(entry.lastIn)) {
          entry.lastIn = date
        }
      } else if (tx.type === 'Stock OUT' || tx.type === 'Wastage' || tx.type === 'Fulfillment') {
        if (!entry.lastOut || new Date(date) > new Date(entry.lastOut)) {
          entry.lastOut = date
        }
      }
    }

    // Sort history for each item
    for (const entry of map.values()) {
      entry.history.sort((a, b) =>
        new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0)
      )
    }

    return map
  }, [transactions])

  // ── Sorting ───────────────────────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    if (!SORTABLE_COLUMNS.includes(key)) return
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  // ── Derived Data ────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let list = [...items]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q)
      )
    }

    if (categoryFilter !== 'All') {
      list = list.filter(i => i.category === categoryFilter)
    }

    if (statusFilter !== 'All') {
      list = list.filter(i => getStockStatus(i.quantity, i.min_threshold).label === statusFilter)
    }

    list.sort((a, b) => {
      let aVal, bVal
      switch (sortConfig.key) {
        case 'name':
          aVal = (a.name || '').toLowerCase()
          bVal = (b.name || '').toLowerCase()
          break
        case 'stock':
          aVal = Number(a.quantity) || 0
          bVal = Number(b.quantity) || 0
          break
        case 'category':
          aVal = (a.category || '').toLowerCase()
          bVal = (b.category || '').toLowerCase()
          break
        case 'updated':
          aVal = new Date(a.updated_at || 0).getTime()
          bVal = new Date(b.updated_at || 0).getTime()
          break
        default:
          aVal = (a.name || '').toLowerCase()
          bVal = (b.name || '').toLowerCase()
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [items, search, categoryFilter, statusFilter, sortConfig])

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = items.length
    const inStock = items.filter(i => {
      const q = Number(i.quantity) || 0
      return q > 0
    }).length
    const lowStock = items.filter(i => {
      const q = Number(i.quantity) || 0
      const t = Number(i.min_threshold) || 0
      return q > 0 && t > 0 && q <= t
    }).length
    const outOfStock = items.filter(i => (Number(i.quantity) || 0) === 0).length
    const categories = new Set(items.map(i => i.category).filter(Boolean)).size

    return [
      { label: 'Total Items',  value: fmtNum(total),      icon: 'Package',       bg: '#eff6ff', color: '#2563eb' },
      { label: 'In Stock',     value: fmtNum(inStock),    icon: 'CheckCircle',   bg: '#dcfce7', color: '#16a34a' },
      { label: 'Low Stock',    value: fmtNum(lowStock),   icon: 'AlertTriangle', bg: '#fef9c3', color: '#d97706' },
      { label: 'Out of Stock', value: fmtNum(outOfStock), icon: 'XCircle',       bg: '#fee2e2', color: '#dc2626' },
      { label: 'Categories',   value: fmtNum(categories), icon: 'Tag',           bg: '#f3e8ff', color: '#7c3aed' },
    ]
  }, [items])

  // ── History Data ────────────────────────────────────────────────────────
  const historyData = useMemo(() => {
    if (!historyItem) return []
    const key = historyItem.name?.toLowerCase()
    return transactionMap.get(key)?.history || []
  }, [historyItem, transactionMap])

  // ── Render Helpers ──────────────────────────────────────────────────────
  const getLastIn = useCallback((itemName) => {
    return transactionMap.get(itemName?.toLowerCase())?.lastIn || null
  }, [transactionMap])

  const getLastOut = useCallback((itemName) => {
    return transactionMap.get(itemName?.toLowerCase())?.lastOut || null
  }, [transactionMap])

  const hasActiveFilters = search || categoryFilter !== 'All' || statusFilter !== 'All'

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: 0 }}>
            Inventory
          </h2>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: '4px 0 0 0' }}>
            Monitor stock levels and manage item details
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 16, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Ic
              n="Search"
              size={13}
              color="#9ca3af"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items by name, category, or supplier…"
              style={{
                width: '100%',
                padding: '9px 10px 9px 32px',
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 13,
                background: theme.inputBg,
                color: theme.text,
                outline: 'none',
              }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 8,
              fontSize: 13,
              background: theme.inputBg,
              color: theme.text,
              cursor: 'pointer',
              minWidth: 140,
            }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 8,
              fontSize: 13,
              background: theme.inputBg,
              color: theme.text,
              cursor: 'pointer',
              minWidth: 140,
            }}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setCategoryFilter('All'); setStatusFilter('All') }}
              style={{
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#2563eb',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{
            padding: 60,
            textAlign: 'center',
            color: theme.textMuted,
            fontSize: 14,
          }}>
            <Ic n="Loader2" size={24} color={theme.textMuted} className="spin" style={{ marginBottom: 12 }} />
            <div>Loading inventory…</div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="Package"
            title="No Inventory Available"
            message="No stock has been received yet. Use Stock IN after creating an Item Template to add inventory."
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon="Search"
            title="No Items Match"
            message="Try adjusting your search or filter criteria."
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: theme.bg }}>
                    {[
                      { key: 'name', label: 'Item Name' },
                      { key: 'category', label: 'Category' },
                      { key: 'stock', label: 'Stock' },
                      { key: 'unit', label: 'Unit' },
                      { key: 'threshold', label: 'Threshold' },
                      { key: 'lastIn', label: 'Last Stock In' },
                      { key: 'lastOut', label: 'Last Stock Out' },
                      { key: 'status', label: 'Status' },
                      { key: 'updated', label: 'Updated' },
                      { key: 'actions', label: 'Actions' },
                    ].map(h => (
                      <th
                        key={h.key}
                        onClick={SORTABLE_COLUMNS.includes(h.key) ? () => handleSort(h.key) : undefined}
                        style={{
                          padding: '12px 14px',
                          textAlign: 'left',
                          fontSize: 12,
                          fontWeight: 600,
                          color: theme.textMuted,
                          borderBottom: `1px solid ${theme.border}`,
                          whiteSpace: 'nowrap',
                          cursor: SORTABLE_COLUMNS.includes(h.key) ? 'pointer' : 'default',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {h.label}
                          {SORTABLE_COLUMNS.includes(h.key) && (
                            <SortIcon column={h.key} sortConfig={sortConfig} theme={theme} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const status = getStockStatus(item.quantity, item.min_threshold)
                    const lastIn = getLastIn(item.name)
                    const lastOut = getLastOut(item.name)
                    return (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                            {item.name}
                          </div>
                          {item.notes && (
                            <div style={{
                              fontSize: 11,
                              color: theme.textMuted,
                              marginTop: 2,
                              maxWidth: 180,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background: theme.bg,
                            color: theme.textMuted,
                            border: `1px solid ${theme.border}`,
                            whiteSpace: 'nowrap',
                          }}>
                            {item.category || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: status.color,
                            whiteSpace: 'nowrap',
                          }}>
                            {fmtNum(item.quantity || 0)} {item.unit || 'pcs'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>
                          {item.unit || 'pcs'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>
                          {item.min_threshold ?? '—'}
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          fontSize: 12,
                          color: theme.textMuted,
                          whiteSpace: 'nowrap',
                        }}>
                          {lastIn ? fmtAgo(lastIn) : '—'}
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          fontSize: 12,
                          color: theme.textMuted,
                          whiteSpace: 'nowrap',
                        }}>
                          {lastOut ? fmtAgo(lastOut) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <StatusBadge qty={item.quantity} minThreshold={item.min_threshold} />
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          fontSize: 12,
                          color: theme.textMuted,
                          whiteSpace: 'nowrap',
                        }}>
                          <span title={fmtDateTime(item.updated_at)}>
                            {fmtAgo(item.updated_at)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <Btn
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryItem(item)}
                          >
                            <Ic n="History" size={14} color={theme.textMuted} />
                            History
                          </Btn>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 14px',
              fontSize: 12,
              color: theme.textMuted,
              textAlign: 'right',
              borderTop: `1px solid ${theme.border}`,
            }}>
              Showing {filteredItems.length} of {items.length} items
            </div>
          </>
        )}
      </Card>

      {/* History Modal */}
      <Modal
        open={!!historyItem}
        onClose={() => setHistoryItem(null)}
        title="🕒 Inventory History"
      >
        {historyItem && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: `1px solid ${theme.border}`,
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>
                  {historyItem.name}
                </div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  Current Stock: {fmtNum(historyItem.quantity || 0)} {historyItem.unit || 'pcs'}
                </div>
              </div>
              <StatusBadge qty={historyItem.quantity} minThreshold={historyItem.min_threshold} />
            </div>

            {historyData.length === 0 ? (
              <EmptyState
                icon="History"
                title="No History Available"
                message="No transactions have been recorded for this item yet."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {historyData.map((tx, idx) => (
                  <HistoryRow
                    key={idx}
                    tx={tx}
                    isLast={idx === historyData.length - 1}
                    theme={theme}
                    itemUnit={historyItem.unit}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}