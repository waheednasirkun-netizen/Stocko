import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { fmtNum, userCan } from '../lib/constants'
import { inventoryApi } from '../lib/api'

const CATEGORIES = [
  'All', 'Frozen Food', 'Packaging', 'Vegetables', 'Drinks',
  'Cleaning', 'Meat', 'Dairy', 'Spices', 'Other',
]

const STOCK_COLORS = {
  ok:      { bg: '#dcfce7', color: '#166534' },
  near:    { bg: '#fef9c3', color: '#854d0e' },
  critical:{ bg: '#fee2e2', color: '#991b1b' },
}

export default function Inventory() {
  const { user, theme, showToast, withActionLock, transactions } = useApp()
  //                                              ^^^^^^^^^^^^^ ADDED: listen to transactions changes

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [form, setForm] = useState({
    name: '', category: '', unit: 'pcs', quantity: '',
    min_threshold: '', purchase_price: '', supplier: '', notes: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = userCan('deleteInventory', user?.role) || user?.role === 'Admin'

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
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [items, search, categoryFilter])

  const stats = useMemo(() => {
    const total = items.length
    const lowStock = items.filter(i => Number(i.quantity) <= Number(i.min_threshold) && Number(i.min_threshold) > 0)
    // INVENTORY VALUE CARD REMOVED
    const categories = new Set(items.map(i => i.category).filter(Boolean)).size
    return [
      { label: 'Total Items',    value: fmtNum(total),         icon: 'Package',      bg: '#eff6ff',  color: '#2563eb' },
      { label: 'Low Stock',      value: fmtNum(lowStock.length), icon: 'AlertTriangle', bg: '#fef9c3',  color: '#d97706' },
      // INVENTORY VALUE CARD REMOVED
      { label: 'Categories',     value: fmtNum(categories),    icon: 'Tag',          bg: '#f3e8ff',  color: '#7c3aed' },
    ]
  }, [items])

  /* ── Fetch ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (user?.branch_id) loadItems()
  }, [user?.branch_id])

  // AUTO-REFRESH when transactions change (fixes stock not updating after Stock IN)
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

  /* ── Edit helpers ───────────────────────────────────────────────────── */
  const openEditModal = useCallback((item) => {
    setEditingItem(item)
    setForm({
      name: item.name || '',
      category: item.category || '',
      unit: item.unit || 'pcs',
      quantity: item.quantity ?? '',
      min_threshold: item.min_threshold ?? '',
      purchase_price: item.purchase_price ?? '',
      supplier: item.supplier || '',
      notes: item.notes || '',
    })
    setFormErrors({})
    setModalOpen(true)
  }, [])

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Item name is required'
    if (!form.category) e.category = 'Category is required'
    if (form.quantity === '' || Number(form.quantity) < 0) e.quantity = 'Valid quantity required'
    if (form.min_threshold === '' || Number(form.min_threshold) < 0) e.min_threshold = 'Valid threshold required'
    if (form.purchase_price === '' || Number(form.purchase_price) < 0) e.purchase_price = 'Valid price required'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate() || submitting) return
    return withActionLock(async () => {
      setSubmitting(true)
      try {
        const payload = {
          name: form.name.trim(),
          category: form.category,
          unit: form.unit,
          quantity: Number(form.quantity),
          min_threshold: Number(form.min_threshold),
          purchase_price: Number(form.purchase_price),
          supplier: form.supplier.trim() || null,
          notes: form.notes.trim() || null,
        }

        const { data, error } = await inventoryApi.update({
          id: editingItem.id, updates: payload,
          branchId: user.branch_id, userId: user.id, userName: user.name,
        })
        if (error) { showToast('error', 'Update Failed', error.message); return }
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...data } : i))
        showToast('success', 'Updated', `${data.name} has been updated.`)
        setModalOpen(false)
      } finally {
        setSubmitting(false)
      }
    })
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    return withActionLock(async () => {
      const { error } = await inventoryApi.remove({
        id: deleteConfirm.id, branchId: user.branch_id,
        userId: user.id, userName: user.name, itemName: deleteConfirm.name,
      })
      if (error) { showToast('error', 'Delete Failed', error.message); return }
      setItems(prev => prev.filter(i => i.id !== deleteConfirm.id))
      showToast('success', 'Deleted', `${deleteConfirm.name} removed.`)
      setDeleteConfirm(null)
    })
  }

  /* ── Stock status ───────────────────────────────────────────────────── */
  const getStockStatus = (qty, min) => {
    const q = Number(qty) || 0
    const t = Number(min) || 0
    if (t === 0) return { ...STOCK_COLORS.ok, label: 'OK' }
    if (q === 0 || q <= t) return { ...STOCK_COLORS.critical, label: 'Critical' }
    if (q <= t * 1.5) return { ...STOCK_COLORS.near, label: 'Near' }
    return { ...STOCK_COLORS.ok, label: 'OK' }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Inventory</h2>
          <p style={{ fontSize: 12, color: theme.textMuted }}>Monitor stock levels and manage item details</p>
        </div>
      </div>

      {/* Stats Cards — Inventory Value REMOVED */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }} className="grid-mobile-2">
        {stats.map(s => (
          <Card key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ic n={s.icon} size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 16, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Ic n="Search" size={13} color="#9ca3af"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{ width: '100%', padding: '8px 10px 8px 28px', border: `1px solid ${theme.inputBorder}`,
                borderRadius: 7, fontSize: 13, background: theme.inputBg, color: theme.text }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ padding: '8px 10px', border: `1px solid ${theme.inputBorder}`,
              borderRadius: 7, fontSize: 13, background: theme.inputBg, color: theme.text }}
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      {/* Table — Actions Column REMOVED */}
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: theme.bg }}>
                  {['Item Name', 'Category', 'Stock', 'Unit', 'Threshold', 'Price', 'Supplier', 'Updated'].map(h => (
                    // ACTIONS HEADER REMOVED
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12,
                      fontWeight: 600, color: theme.textMuted, borderBottom: `1px solid ${theme.border}`,
                      whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const status = getStockStatus(item.quantity, item.min_threshold)
                  return (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{item.name}</div>
                        {item.notes && (
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, maxWidth: 180,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11,
                          fontWeight: 600, background: theme.bg, color: theme.textMuted,
                          border: `1px solid ${theme.border}`, whiteSpace: 'nowrap' }}>
                          {item.category || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11,
                          fontWeight: 600, background: status.bg, color: status.color, whiteSpace: 'nowrap' }}>
                          {item.quantity}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>{item.unit || 'pcs'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>{item.min_threshold}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>
                        PKR {fmtNum(item.purchase_price || 0)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textMuted }}>{item.supplier || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                        {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}
                      </td>
                      {/* ACTIONS COLUMN (Edit/Delete buttons) REMOVED */}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px', fontSize: 12, color: theme.textMuted, textAlign: 'right',
              borderTop: `1px solid ${theme.border}` }}>
              Showing {filteredItems.length} of {items.length} items
            </div>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setFormErrors({}) }}
        title="✏️ Edit Item"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
              Item Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="e.g., Chicken Breast"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${formErrors.name ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8, fontSize: 14, background: theme.inputBg, color: theme.text }}
            />
            {formErrors.name && <div className="field-error">{formErrors.name}</div>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
              Category <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${formErrors.category ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text }}
            >
              <option value="">Select…</option>
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {formErrors.category && <div className="field-error">{formErrors.category}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Unit</label>
            <input
              value={form.unit}
              onChange={e => setField('unit', e.target.value)}
              placeholder="e.g., kg, pcs, L"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`,
                borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
              Quantity <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              value={form.quantity}
              onChange={e => setField('quantity', e.target.value)}
              placeholder="0"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${formErrors.quantity ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8, fontSize: 14, background: theme.inputBg, color: theme.text }}
            />
            {formErrors.quantity && <div className="field-error">{formErrors.quantity}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
              Min Threshold <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              value={form.min_threshold}
              onChange={e => setField('min_threshold', e.target.value)}
              placeholder="0"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${formErrors.min_threshold ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8, fontSize: 14, background: theme.inputBg, color: theme.text }}
            />
            {formErrors.min_threshold && <div className="field-error">{formErrors.min_threshold}</div>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
              Purchase Price (PKR) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.purchase_price}
              onChange={e => setField('purchase_price', e.target.value)}
              placeholder="0.00"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${formErrors.purchase_price ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8, fontSize: 14, background: theme.inputBg, color: theme.text }}
            />
            {formErrors.purchase_price && <div className="field-error">{formErrors.purchase_price}</div>}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Supplier</label>
          <input
            value={form.supplier}
            onChange={e => setField('supplier', e.target.value)}
            placeholder="Supplier name"
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`,
              borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`,
              borderRadius: 8, fontSize: 13, resize: 'vertical', background: theme.inputBg, color: theme.text }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="outline" onClick={() => { setModalOpen(false); setFormErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Btn>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
      >
        <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={handleDelete}>Delete</Btn>
        </div>
      </Modal>
    </div>
  )
}