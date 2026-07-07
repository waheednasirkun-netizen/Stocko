import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn, Modal, Card, EmptyState } from '../components/ui'
import { useConfirm } from '../components/ui'
import { fmtNum, userCan } from '../lib/constants'

/* ─── Searchable Category Dropdown ─── */
function CategorySelect({ value, onChange, options, theme, error, disabled, onOpenAddCategory }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return options.filter(o => o.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const handleSelect = (cat) => {
    onChange(cat)
    setOpen(false)
    setQuery('')
  }

  const noCategories = options.length === 0

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && !noCategories && setOpen(p => !p)}
        disabled={disabled || noCategories}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: `1px solid ${error ? '#ef4444' : theme.inputBorder}`,
          borderRadius: 8,
          fontSize: 14,
          background: (disabled || noCategories) ? '#f3f4f6' : theme.inputBg,
          color: (disabled || noCategories) ? '#9ca3af' : (value ? theme.text : '#9ca3af'),
          textAlign: 'left',
          cursor: (disabled || noCategories) ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>{value || (noCategories ? 'No categories available' : 'Select a category…')}</span>
        <Ic n={open ? 'ChevronUp' : 'ChevronDown'} size={14} color="#9ca3af" />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: theme.inputBg || '#ffffff',
          border: `1px solid ${theme.inputBorder}`,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          zIndex: 50,
          maxHeight: 320,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${theme.inputBorder}` }}>
            <div style={{ position: 'relative' }}>
              <Ic n="Search" size={13} color="#9ca3af" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
                placeholder="Search categories…"
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 28px',
                  border: `1px solid ${theme.inputBorder}`,
                  borderRadius: 6,
                  fontSize: 13,
                  background: theme.inputBg,
                  color: theme.text,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 200 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                No matching categories
              </div>
            ) : (
              filtered.map(cat => (
                <div
                  key={cat}
                  onClick={() => handleSelect(cat)}
                  style={{
                    padding: '9px 12px',
                    fontSize: 14,
                    cursor: 'pointer',
                    color: theme.text,
                    background: value === cat ? (theme.primaryBg || '#eff6ff') : 'transparent',
                    fontWeight: value === cat ? 600 : 400,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={e => { if (value !== cat) e.currentTarget.style.background = '#f3f4f6' }}
                  onMouseLeave={e => { if (value !== cat) e.currentTarget.style.background = 'transparent' }}
                >
                  {cat}
                  {value === cat && <Ic n="Check" size={14} color={theme.primary || '#3b82f6'} />}
                </div>
              ))
            )}
          </div>

          {onOpenAddCategory && (
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${theme.inputBorder}`, background: '#fafafa' }}>
              <button
                type="button"
                onClick={() => { setOpen(false); setQuery(''); onOpenAddCategory() }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: 13,
                  color: theme.primary || '#3b82f6',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 6
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Ic n="Plus" size={14} /> Add New Category
              </button>
            </div>
          )}
        </div>
      )}

      {noCategories && onOpenAddCategory && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>No categories available.</span>
          <button
            type="button"
            onClick={onOpenAddCategory}
            style={{
              fontSize: 12,
              color: theme.primary || '#3b82f6',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Ic n="Plus" size={12} /> Create Category
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Inline Add Category Modal ─── */
function AddCategoryModal({ open, onClose, onSave, theme }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setName('')
      setError('')
      setSaving(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Category name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(trimmed)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }} onClick={onClose}>
      <div
        style={{
          background: theme.cardBg || '#ffffff',
          borderRadius: 12,
          padding: '24px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: 0 }}>Add New Category</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <Ic n="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Category Name *</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Beverages"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${error ? '#ef4444' : theme.inputBorder}`,
                borderRadius: 8,
                fontSize: 14,
                background: theme.inputBg,
                color: theme.text
              }}
            />
            {error && <div style={{ marginTop: 4, fontSize: 12, color: '#ef4444' }}>{error}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="outline" onClick={onClose} type="button">Cancel</Btn>
            <Btn variant="primary" disabled={saving} type="submit">
              {saving ? 'Creating…' : 'Create Category'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */
export default function ItemTemplates() {
  const app = useApp()

  const {
    templates = [],
    createTemplate,
    updateTemplate,
    deleteTemplate,
    theme = {},
    user,
    showToast,
    allUnits = [],
    categories,
    createCategory,
  } = app || {}

  const { confirm } = useConfirm()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', unit: 'pcs', lowStockThreshold: '' })
  const [errors, setErrors] = useState({})
  const [showAddCategory, setShowAddCategory] = useState(false)

  const canManage = userCan('createTemplate', user?.role)

  const categoryNames = useMemo(() => {
    if (!categories) return []
    return categories.map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean)
  }, [categories])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter(t => !q || t.name.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q))
  }, [templates, search])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', category: '', unit: 'pcs', lowStockThreshold: '' })
    setErrors({})
    setShowModal(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({
      name: t.name,
      category: t.category || '',
      unit: t.unit || 'pcs',
      lowStockThreshold: t.lowStockThreshold || t.low_stock_threshold || ''
    })
    setErrors({})
    setShowModal(true)
  }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name required'
    if (!form.category) errs.category = 'Please select a category.'
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setLoading(true)
    try {
      const data = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        low_stock_threshold: Math.max(0, Number(form.lowStockThreshold) || 0),
        enabled: true
      }
      if (editing) await updateTemplate(editing.id, data)
      else await createTemplate(data)
      showToast('success', editing ? 'Template Updated' : 'Template Created', form.name)
      setShowModal(false)
      setErrors({})
    } catch (err) {
      showToast('error', 'Save Failed', err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (t) => {
    const ok = await confirm({ title: 'Delete Template', message: `Delete "${t.name}"?`, variant: 'danger', confirmLabel: 'Delete' })
    if (!ok) return
    try {
      await deleteTemplate(t.id)
      showToast('info', 'Template Deleted', t.name)
    } catch (err) {
      showToast('error', 'Delete Failed', err.message || 'Unknown error')
    }
  }

  const handleAddCategory = async (categoryName) => {
    if (!createCategory) throw new Error('createCategory not available')
    await createCategory({ name: categoryName })
    showToast('success', 'Category Created', categoryName)
    set('category', categoryName)
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Item Templates</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage && (
            <Btn variant="outline" onClick={() => setShowAddCategory(true)}>
              <Ic n="Plus" size={14} /> Add Category
            </Btn>
          )}
          {canManage && (
            <Btn variant="primary" onClick={openCreate}>
              <Ic n="Plus" size={14} color="white" /> New Template
            </Btn>
          )}
        </div>
      </div>

      <Card style={{ marginBottom: 16, padding: '12px 14px' }}>
        <div style={{ position: 'relative' }}>
          <Ic n="Search" size={13} color="#9ca3af" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            style={{ width: '100%', padding: '8px 10px 8px 28px', border: `1px solid ${theme.inputBorder}`, borderRadius: 7, fontSize: 13, background: theme.inputBg, color: theme.text }}
          />
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="Box" title="No templates" message="Create templates to speed up stock entry" />
        ) : (
          filtered.map(t => (
            <Card key={t.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{t.category} · {t.unit}</div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><Ic n="Edit" size={14} /></button>
                    <button onClick={() => handleDelete(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><Ic n="Trash2" size={14} /></button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(t.lowStockThreshold || t.low_stock_threshold) > 0 && (
                  <span style={{ fontSize: 11, padding: '2px 8px', background: '#fef9c3', color: '#854d0e', borderRadius: 6, fontWeight: 500 }}>
                    Min: {fmtNum(t.lowStockThreshold || t.low_stock_threshold)}
                  </span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setErrors({}) }} title={editing ? 'Edit Template' : 'New Template'}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Item Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.name ? '#ef4444' : theme.inputBorder}`, borderRadius: 8, fontSize: 14, background: theme.inputBg, color: theme.text }}
          />
          {errors.name && <div style={{ marginTop: 4, fontSize: 12, color: '#ef4444' }}>{errors.name}</div>}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Category *</label>
          <CategorySelect
            value={form.category}
            onChange={v => set('category', v)}
            options={categoryNames}
            theme={theme}
            error={!!errors.category}
            disabled={!canManage}
            onOpenAddCategory={() => setShowAddCategory(true)}
          />
          {errors.category && <div style={{ marginTop: 4, fontSize: 12, color: '#ef4444' }}>{errors.category}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Unit</label>
            <select
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text }}
            >
              {allUnits.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Low Stock Minimum</label>
            <input
              type="number"
              value={form.lowStockThreshold}
              onChange={e => set('lowStockThreshold', e.target.value)}
              min="0"
              step="0.01"
              placeholder="0"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, fontSize: 13, background: theme.inputBg, color: theme.text }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : (editing ? 'Update' : 'Create')}
          </Btn>
        </div>
      </Modal>

      <AddCategoryModal
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSave={handleAddCategory}
        theme={theme}
      />
    </div>
  )
}