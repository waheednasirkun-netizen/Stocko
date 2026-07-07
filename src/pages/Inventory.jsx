import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum, userCan } from '../lib/constants'
import { inventoryApi } from '../lib/api'

const CATEGORIES = [
  'All', 'Frozen Food', 'Packaging', 'Vegetables', 'Drinks',
  'Cleaning', 'Meat', 'Dairy', 'Spices', 'Other',
]

const STATUS_OPTIONS = ['All', 'In Stock', 'Low Stock', 'Out of Stock']

const STOCK_COLORS = {
  ok:      { bg: '#dcfce7', color: '#166534', label: 'In Stock' },
  near:    { bg: '#fef9c3', color: '#854d0e', label: 'Low Stock' },
  critical:{ bg: '#fee2e2', color: '#991b1b', label: 'Out of Stock' },
}

/* ── Helpers ──────────────────────────────────────────────────────────── */
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
    hour: '2-digit', minute: '2-digit'
  })
}

export default function Inventory() {
  const { user, theme, showToast, withActionLock, transactions } = useApp()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
  const [historyItem, setHistoryItem] = useState(null)

  /* ── Fetch ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (user?.branch_id) loadItems()
  }, [user?.branch_id])

  useEffect(() => {
    if (user?.branch_id && transactions) {
      loadItems()
    }
  }, [transactions?.length, user?.branch_id])

  async function loadItems() {
    setLoading(true)
    const { data, error } = await inventoryApi.getAll(user.branch_id)
    if (error) showToast('error', 'Load Failed', error.message)
    else setItems(data || [])
    setLoading(false)
  }

  /* ── Stock status helpers ─────────────────────────────────────────────── */
  const getStockStatus = (qty, min) => {
    const q = Number(qty) || 0
    const t = Number(min) || 0
    if (q === 0) return { ...STOCK_COLORS.critical }
    if (t > 0 && q <= t) return { ...STOCK_COLORS.near }
    return { ...STOCK_COLORS.ok }
  }

  const getStockStatusLabel = (qty, min) => {
    const q = Number(qty) || 0
    const t = Number(min) || 0
    if (q === 0) return 'Out of Stock'
    if (t > 0 && q <= t) return 'Low Stock'
    return 'In Stock'
  }

  /* ── Sorting ──────────────────────────────────────────────────────────── */
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <Ic n="ArrowUpDown" size={12} color={theme.textMuted} />
    return <Ic n={sortConfig.direction === 'asc' ? "ArrowUp" : "ArrowDown"} size={12} color={theme.text} />
  }

  /* ── Derived data ─────────────────────────────────────────────────────── */
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
      list = list.filter(i => {
        const status = getStockStatusLabel(i.quantity, i.min_threshold)
        return status === statusFilter
      })
    }
    // Sort
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

  /* ── Stats ────────────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = items.length
    const inStock = items.filter(i => {
      const q = Number(i.quantity) || 0
      const t = Number(i.min_threshold) || 0
      return q > t && t > 0
    }).length
    const lowStock = items.filter(i => {
      const q = Number(i.quantity) || 0
      const t = Number(i.min_threshold) || 0
      return q > 0 && q <= t && t > 0
    }).length
    const outOfStock = items.filter(i => (Number(i.quantity) || 0) === 0).length
    const categories = new Set(items.map(i => i.category).filter(Boolean)).size
    return [
      { label: 'Total Items',    value: fmtNum(total),      icon: 'Package',       bg: '#eff6ff',  color: '#2563eb' },
      { label: 'In Stock',       value: fmtNum(inStock),     icon: 'CheckCircle',   bg: '#dcfce7',  color: '#16a34a' },
      { label: 'Low Stock',      value: fmtNum(lowStock),    icon: 'AlertTriangle', bg: '#fef9c3',  color: '#d97706' },
      { label: 'Out of Stock',   value: fmtNum(outOfStock),  icon: 'XCircle',       bg: '#fee2e2',  color: '#dc2626' },
      { label: 'Categories',     value: fmtNum(categories),  icon: 'Tag',           bg: '#f3e8ff',  color: '#7c3aed' },
    ]
  }, [items])

  /* ── Last transaction dates ───────────────────────────────────────────── */
  const getLastStockIn = (itemId) => {
    const tx = (transactions || [])
      .filter(t => (t.item_id === itemId || t.item_name === items.find(i => i.id === itemId)?.name) && t.type === 'Stock IN')
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    return tx[0]?.created_at || tx[0]?.date || null
  }

  const getLastStockOut = (itemId) => {
    const tx = (transactions || [])
      .filter(t => (t.item_id === itemId || t.item_name === items.find(i => i.id === itemId)?.name) && (t.type === 'Stock OUT' || t.type === 'Wastage'))
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    return tx[0]?.created_at || tx[0]?.date || null
  }

  /* ── Item history ─────────────────────────────────────────────────────── */
  const getItemHistory = (itemId) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return []
    return (transactions || [])
      .filter(t => t.item_id === itemId || t.item_name === item.name)
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
  }

  /* ── Status badge component ───────────────────────────────────────────── */
  const StatusBadge = ({ qty, min }) => {
    const status = getStockStatus(qty, min)
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
  }

  return (
    <div className="animate-fade-in">
      {/* ═══════════════════════════════════════
            HEADER
      ═══════════════════════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Inventory</h2>
          <p style={{ fontSize: 12, color: theme.textMuted }}>Monitor stock levels and manage item details</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════
            STATS CARDS
      ═══════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 14,
        marginBottom: 24
      }}>
        {stats.map(s => (
          <Card key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: s.bg,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Ic n={s.icon} size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* ═══════════════════════════════════════
            FILTERS
      ═══════════════════════════════════════ */}
      <Card style={{ marginBottom: 16, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Ic n="Search" size={13} color="#9ca3af"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{
                width: '100%',
                padding: '8px 10px 8px 28px',
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: 7,
                fontSize: 13,
                background: theme.inputBg,
                color: theme.text
              }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              padding: '8px 10px',
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 7,
              fontSize: 13,
              background: theme.inputBg,
              color: theme.text
            }}
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 10px',
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 7,
              fontSize: 13,
              background: theme.inputBg,
              color: theme.text
            }}
          >
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          {(search || categoryFilter !== 'All' || statusFilter !== 'All') && (
            <button
              onClick={() => { setSearch(''); setCategoryFilter('All'); setStatusFilter('All') }}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#2563eb',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* ═══════════════════════════════════════
            TABLE
      ═══════════════════════════════════════ */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted, fontSize: 14 }}>
            Loading inventory…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="Package"
            title="No Inventory Available"
            message="No stock has been received yet. Use Stock IN after creating an Item Template to add inventory."
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div style={{ overflowX: 'auto' }} className="inventory-desktop-table">
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
                        onClick={h.key !== 'actions' && h.key !== 'lastIn' && h.key !== 'lastOut' && h.key !== 'status' ? () => handleSort(h.key) : undefined}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          fontSize: 12,
                          fontWeight: 600,
                          color: theme.textMuted,
                          borderBottom: `1px solid ${theme.border}`,
                          whiteSpace: 'nowrap',
                          cursor: h.key !== 'actions' && h.key !== 'lastIn' && h.key !== 'lastOut' && h.key !== 'status' ? 'pointer' : 'default',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {h.label}
                          {h.key !== 'actions' && h.key !== 'lastIn' && h.key !== 'lastOut' && h.key !== 'status' && <SortIcon column={h.key} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const status = getStockStatus(item.quantity, item.min_threshold)
                    const lastIn = getLastStockIn(item.id)
                    const lastOut = getLastStockOut(item.id)
                    return (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{item.name}</div>
                          {item.notes && (
                            <div style={{
                              fontSize: 11,
                              color: theme.textMuted,
                              marginTop: 2,
                              maxWidth: 180,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
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
                            whiteSpace: 'nowrap'
                          }}>
                            {item.category || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: status.color,
                            whiteSpace: 'nowrap'
                          }}>
                            {fmtNum(item.quantity || 0)} {item.unit || 'pcs'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>{item.unit || 'pcs'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>{item.min_threshold}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                          {lastIn ? fmtAgo(lastIn) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                          {lastOut ? fmtAgo(lastOut) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <StatusBadge qty={item.quantity} min={item.min_threshold} />
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                          <span title={fmtDateTime(item.updated_at)}>
                            {fmtAgo(item.updated_at)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <button
                            onClick={() => setHistoryItem(item)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              border: `1px solid ${theme.border}`,
                              background: theme.bg,
                              color: theme.text,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = theme.inputBg }}
                            onMouseLeave={e => { e.currentTarget.style.background = theme.bg }}
                          >
                            <Ic n="History" size={14} color={theme.textMuted} />
                            History
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="inventory-mobile-cards" style={{ display: 'none' }}>
              {filteredItems.map(item => {
                const status = getStockStatus(item.quantity, item.min_threshold)
                const lastIn = getLastStockIn(item.id)
                const lastOut = getLastStockOut(item.id)
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${theme.border}`,
                      background: 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{item.category || '—'}</div>
                      </div>
                      <StatusBadge qty={item.quantity} min={item.min_threshold} />
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: theme.textMuted }}>Stock</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: status.color }}>
                          {fmtNum(item.quantity || 0)} {item.unit}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: theme.textMuted }}>Threshold</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{item.min_threshold}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: theme.textMuted }}>Last In</div>
                        <div style={{ fontSize: 12, color: theme.text }}>{lastIn ? fmtAgo(lastIn) : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: theme.textMuted }}>Last Out</div>
                        <div style={{ fontSize: 12, color: theme.text }}>{lastOut ? fmtAgo(lastOut) : '—'}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setHistoryItem(item)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        border: `1px solid ${theme.border}`,
                        background: theme.bg,
                        color: theme.text,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Ic n="History" size={14} color={theme.textMuted} />
                      View History
                    </button>
                  </div>
                )
              })}
            </div>

            <div style={{
              padding: '10px 14px',
              fontSize: 12,
              color: theme.textMuted,
              textAlign: 'right',
              borderTop: `1px solid ${theme.border}`
            }}>
              Showing {filteredItems.length} of {items.length} items
            </div>
          </>
        )}
      </Card>

      {/* ═══════════════════════════════════════
            HISTORY MODAL
      ═══════════════════════════════════════ */}
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
              borderBottom: `1px solid ${theme.border}`
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{historyItem.name}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  Current Stock: {fmtNum(historyItem.quantity || 0)} {historyItem.unit || 'pcs'}
                </div>
              </div>
              <StatusBadge qty={historyItem.quantity} min={historyItem.min_threshold} />
            </div>

            {getItemHistory(historyItem.id).length === 0 ? (
              <EmptyState
                icon="History"
                title="No History Available"
                message="No inventory history available."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {getItemHistory(historyItem.id).map((tx, idx) => {
                  const isStockIn = tx.type === 'Stock IN'
                  const badgeColor = isStockIn ? '#16a34a' : '#3b82f6'
                  const badgeBg = isStockIn ? '#dcfce7' : '#dbeafe'
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '12px 0',
                        borderBottom: idx < getItemHistory(historyItem.id).length - 1 ? `1px solid ${theme.border}` : 'none'
                      }}
                    >
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: badgeBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2
                      }}>
                        <Ic
                          n={isStockIn ? 'ArrowDown' : 'ArrowUp'}
                          size={16}
                          color={badgeColor}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: badgeBg,
                            color: badgeColor,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5
                          }}>
                            {tx.type || '—'}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                            {fmtNum(Math.abs(Number(tx.quantity || tx.qty || 0)))} {tx.unit || historyItem.unit || 'pcs'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
                          {tx.department && (
                            <span>Department: {tx.department} • </span>
                          )}
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
                      <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'right' }}>
                        <div>{fmtDateTime(tx.created_at || tx.date)}</div>
                        <div style={{ marginTop: 2 }}>{fmtAgo(tx.created_at || tx.date)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}