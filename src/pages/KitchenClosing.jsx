import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Card, Ic } from '../components/ui'

const num = (v) => Math.max(0, Number(v) || 0)
const fmt = (v) => Number(num(v).toFixed(3)).toLocaleString()
const norm = (v) => String(v || '').trim().toLowerCase()
const dateKey = (v) => {
  if (!v) return ''
  const d = new Date(v)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function KitchenClosing() {
  const {
    theme, currentBranch, currentShift, templates = [],
    user, userRole, showToast,
  } = useApp()

  const branchId = currentBranch?.id || user?.branch_id || user?.branchId || null
  const isStoreKeeper = userRole === 'Store Keeper'
  const isKitchenStaff = userRole === 'Kitchen Staff'
  const canViewHistory = ['Developer', 'Master', 'Admin', 'Manager'].includes(userRole)
  const canEditCurrent = ['Developer', 'Master', 'Admin', 'Manager', 'Kitchen Staff'].includes(userRole)

  const [rows, setRows] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [addItem, setAddItem] = useState('')
  const [addOpening, setAddOpening] = useState('')
  const [adding, setAdding] = useState(false)
  const [shifts, setShifts] = useState([])
  const [selectedDate, setSelectedDate] = useState(() => dateKey(currentShift?.opened_at || new Date()))
  const [selectedShiftId, setSelectedShiftId] = useState(currentShift?.id || '')
  const [fulfilledByItem, setFulfilledByItem] = useState(new Map())

  useEffect(() => {
    if (!canViewHistory && currentShift?.id) setSelectedShiftId(currentShift.id)
  }, [canViewHistory, currentShift?.id])

  const selectedShift = useMemo(() => {
    if (!canViewHistory) return currentShift || null
    return shifts.find(s => String(s.id) === String(selectedShiftId)) ||
      (String(currentShift?.id || '') === String(selectedShiftId) ? currentShift : null)
  }, [canViewHistory, shifts, selectedShiftId, currentShift])

  const isCurrentShift = Boolean(currentShift?.id && selectedShift?.id && String(currentShift.id) === String(selectedShift.id))
  const canEdit = canEditCurrent && isCurrentShift && !isStoreKeeper

  const loadShifts = useCallback(async () => {
    if (!branchId || !canViewHistory) return
    try {
      const { data, error } = await supabase
        .from('business_shifts')
        .select('id,branch_id,opened_at,closed_at,status')
        .eq('branch_id', branchId)
        .order('opened_at', { ascending: false })
        .limit(250)
      if (error) throw error
      const list = data || []
      setShifts(list)
      setSelectedShiftId(prev => {
        if (prev && list.some(s => String(s.id) === String(prev))) return prev
        return currentShift?.id || list[0]?.id || ''
      })
    } catch (error) {
      console.error('[KitchenClosing] shifts:', error)
      showToast?.('error', 'Shift history error', error.message || 'Could not load shift history.')
    }
  }, [branchId, canViewHistory, currentShift?.id, showToast])

  useEffect(() => { loadShifts() }, [loadShifts])

  const shiftsForDate = useMemo(() => {
    if (!canViewHistory) return []
    return shifts.filter(s => dateKey(s.opened_at) === selectedDate)
  }, [shifts, selectedDate, canViewHistory])

  useEffect(() => {
    if (!canViewHistory || !selectedDate || !shifts.length) return
    const matches = shifts.filter(s => dateKey(s.opened_at) === selectedDate)
    if (!matches.length) {
      setSelectedShiftId('')
    } else if (!matches.some(s => String(s.id) === String(selectedShiftId))) {
      setSelectedShiftId(matches[0].id)
    }
  }, [canViewHistory, selectedDate, shifts, selectedShiftId])

  const load = useCallback(async () => {
    const shift = canViewHistory ? selectedShift : currentShift
    if (!branchId || !shift?.id) {
      setRows([])
      setFulfilledByItem(new Map())
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data: current, error: currentError } = await supabase
        .from('kitchen_closing_items')
        .select('*')
        .eq('branch_id', branchId)
        .eq('shift_id', shift.id)
        .order('item_name')
      if (currentError) throw currentError

      let all = current || []

      // Only the live shift is allowed to carry balances forward. Historical shifts are read-only snapshots.
      if (String(shift.id) === String(currentShift?.id) && canEditCurrent) {
        const { data: previous, error: previousError } = await supabase
          .from('kitchen_closing_items')
          .select('item_name,unit,remaining_qty,created_at,shift_id')
          .eq('branch_id', branchId)
          .neq('shift_id', shift.id)
          .not('remaining_qty', 'is', null)
          .order('created_at', { ascending: false })
        if (previousError) throw previousError

        const existing = new Set(all.map(r => norm(r.item_name)))
        const latest = new Map()
        for (const r of previous || []) {
          const key = norm(r.item_name)
          if (key && !latest.has(key)) latest.set(key, r)
        }
        const missing = [...latest.values()].filter(r => !existing.has(norm(r.item_name)))
        if (missing.length) {
          const payload = missing.map(r => ({
            branch_id: branchId,
            shift_id: shift.id,
            item_name: r.item_name,
            unit: r.unit || 'pcs',
            opening_balance: num(r.remaining_qty),
            waste_qty: 0,
            remaining_qty: null,
            created_by: user?.id || null,
            updated_by: user?.id || null,
          }))
          const { data: inserted, error: insertError } = await supabase
            .from('kitchen_closing_items')
            .upsert(payload, { onConflict: 'shift_id,item_name', ignoreDuplicates: true })
            .select()
          if (insertError) throw insertError
          all = [...all, ...(inserted || [])]
        }
      }

      const txEnd = shift.closed_at || new Date().toISOString()
      const { data: txRows, error: txError } = await supabase
        .from('transactions')
        .select('item_name,type,quantity,created_at,reversed_at')
        .eq('branch_id', branchId)
        .eq('type', 'Fulfillment')
        .gte('created_at', shift.opened_at)
        .lt('created_at', txEnd)
      if (txError) throw txError

      const fulfilled = new Map()
      for (const tx of txRows || []) {
        if (tx.reversed_at) continue
        const key = norm(tx.item_name)
        if (!key) continue
        fulfilled.set(key, (fulfilled.get(key) || 0) + num(tx.quantity))
      }

      all.sort((a, b) => String(a.item_name).localeCompare(String(b.item_name)))
      setRows(all)
      setFulfilledByItem(fulfilled)
      setDrafts(Object.fromEntries(all.map(r => [r.id, {
        waste: r.waste_qty ?? 0,
        remaining: r.remaining_qty ?? '',
      }])))
    } catch (error) {
      console.error('[KitchenClosing] load:', error)
      showToast?.('error', 'Closing page error', error.message || 'Could not load kitchen closing.')
    } finally {
      setLoading(false)
    }
  }, [branchId, canViewHistory, selectedShift, currentShift, canEditCurrent, user?.id, showToast])

  useEffect(() => { load() }, [load])

  const templateOptions = useMemo(() => {
    const active = new Set(rows.map(r => norm(r.item_name)))
    return (templates || [])
      .filter(t => t.enabled !== false && !active.has(norm(t.name)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [templates, rows])

  const addTrackedItem = async () => {
    if (!canEdit || !addItem || !branchId || !currentShift?.id) return
    const template = (templates || []).find(t => String(t.id) === String(addItem))
    if (!template) return
    setAdding(true)
    try {
      const { error } = await supabase.from('kitchen_closing_items').insert({
        branch_id: branchId,
        shift_id: currentShift.id,
        item_name: template.name,
        unit: template.unit || 'pcs',
        opening_balance: num(addOpening),
        waste_qty: 0,
        remaining_qty: null,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      })
      if (error) throw error
      setAddItem('')
      setAddOpening('')
      showToast?.('success', 'Opening balance added', `${template.name} is now tracked on Kitchen Closing.`)
      await load()
    } catch (error) {
      showToast?.('error', 'Could not add item', error.message)
    } finally {
      setAdding(false)
    }
  }

  const saveRow = async (row) => {
    if (!canEdit) return
    const draft = drafts[row.id] || {}
    if (draft.remaining === '') {
      showToast?.('error', 'Remaining stock required', `Enter remaining quantity for ${row.item_name}.`)
      return
    }
    const available = num(row.opening_balance) + num(fulfilledByItem.get(norm(row.item_name)))
    const waste = num(draft.waste)
    const remaining = num(draft.remaining)
    if (waste + remaining > available) {
      showToast?.('error', 'Invalid closing quantity', `Waste + remaining cannot be more than ${fmt(available)} ${row.unit}.`)
      return
    }
    setSavingId(row.id)
    try {
      const { error } = await supabase.from('kitchen_closing_items').update({
        waste_qty: waste,
        remaining_qty: remaining,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }).eq('id', row.id)
      if (error) throw error
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, waste_qty: waste, remaining_qty: remaining } : r))
      showToast?.('success', 'Closing saved', `${row.item_name} closing is saved.`)
    } catch (error) {
      showToast?.('error', 'Save failed', error.message)
    } finally {
      setSavingId(null)
    }
  }

  const totals = useMemo(() => rows.reduce((a, r) => {
    const d = drafts[r.id] || {}
    const opening = num(r.opening_balance)
    const added = num(fulfilledByItem.get(norm(r.item_name)))
    const waste = num(d.waste)
    const remaining = d.remaining === '' ? 0 : num(d.remaining)
    a.opening += opening; a.added += added; a.waste += waste; a.remaining += remaining
    a.used += Math.max(0, opening + added - waste - remaining)
    return a
  }, { opening: 0, added: 0, waste: 0, remaining: 0, used: 0 }), [rows, drafts, fulfilledByItem])

  const downloadClosingSheet = () => {
    const shift = selectedShift || currentShift
    if (!shift || !rows.length) {
      showToast?.('error', 'Nothing to download', 'There is no Kitchen Closing data for this shift.')
      return
    }
    const lines = [
      ['Kitchen Closing Sheet'],
      ['Branch', currentBranch?.name || ''],
      ['Shift Opened', new Date(shift.opened_at).toLocaleString()],
      ['Shift Closed', shift.closed_at ? new Date(shift.closed_at).toLocaleString() : 'Open'],
      [],
      ['Item', 'Unit', 'Opening Balance', 'Today Added', 'Waste', 'Now Remaining', 'Used'],
    ]
    for (const row of rows) {
      const d = drafts[row.id] || {}
      const opening = num(row.opening_balance)
      const added = num(fulfilledByItem.get(norm(row.item_name)))
      const waste = num(d.waste)
      const remaining = d.remaining === '' ? '' : num(d.remaining)
      const used = remaining === '' ? '' : Math.max(0, opening + added - waste - remaining)
      lines.push([row.item_name, row.unit || 'pcs', opening, added, waste, remaining, used])
    }
    lines.push([])
    lines.push(['TOTAL', '', totals.opening, totals.added, totals.waste, totals.remaining, totals.used])

    const csv = '\ufeff' + lines.map(line => line.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Kitchen-Closing-${currentBranch?.name || 'Branch'}-${dateKey(shift.opened_at)}.csv`.replace(/[^a-z0-9._-]+/gi, '-')
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast?.('success', 'Closing sheet downloaded', 'The Kitchen Closing sheet is ready to open in Excel.')
  }

  const inputStyle = {
    width: '100%', minWidth: 90, boxSizing: 'border-box', padding: '9px 10px',
    border: `1px solid ${theme.border || '#dbe3ee'}`, borderRadius: 8,
    background: theme.cardBg || '#fff', color: theme.text || '#111827', fontSize: 14,
  }

  const displayShift = selectedShift || currentShift

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: theme.text }}>Kitchen Closing</h1>
          <p style={{ margin: '6px 0 0', color: theme.textMuted, fontSize: 13 }}>
            Shift stock usage: Opening + Fulfillment − Waste − Remaining = Used
          </p>
          {isStoreKeeper && <div style={{ marginTop: 6, color: theme.textMuted, fontSize: 12 }}>View only — Store Keeper cannot change Kitchen Closing data.</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={downloadClosingSheet} disabled={!rows.length || loading} style={{ border: `1px solid ${theme.border || '#dbe3ee'}`, borderRadius: 9, padding: '9px 13px', background: theme.cardBg || '#fff', color: theme.text, fontWeight: 800, cursor: rows.length && !loading ? 'pointer' : 'not-allowed', opacity: rows.length && !loading ? 1 : .55 }}>
            Download Closing Sheet
          </button>
          <div style={{ padding: '8px 12px', borderRadius: 10, background: isCurrentShift ? '#eff6ff' : '#fef3c7', color: isCurrentShift ? '#1d4ed8' : '#92400e', fontWeight: 700, fontSize: 12 }}>
            {displayShift?.opened_at ? `${isCurrentShift ? 'Current' : 'Past'} shift: ${new Date(displayShift.opened_at).toLocaleString()}` : 'No shift selected'}
          </div>
        </div>
      </div>

      {canViewHistory && (
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: theme.textMuted, minWidth: 170 }}>
              Closing date
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
            </label>
            <label style={{ fontSize: 12, color: theme.textMuted, minWidth: 280 }}>
              Shift
              <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value)} style={{ ...inputStyle, marginTop: 5 }}>
                {shiftsForDate.length === 0 && <option value="">No shift on this date</option>}
                {shiftsForDate.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.opened_at).toLocaleString()} → {s.closed_at ? new Date(s.closed_at).toLocaleString() : 'Open'}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => { setSelectedDate(dateKey(currentShift?.opened_at || new Date())); setSelectedShiftId(currentShift?.id || '') }} style={{ border: 0, borderRadius: 9, padding: '10px 14px', background: '#0f172a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              Current Shift
            </button>
          </div>
          <div style={{ marginTop: 8, color: theme.textMuted, fontSize: 12 }}>Manager, Admin, Master and Developer can review and download previous closing sheets. Past shifts are read-only.</div>
        </Card>
      )}

      {canEdit && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontWeight: 800, color: theme.text, marginBottom: 10 }}>Add opening balance / start tracking an item</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) minmax(130px,1fr) auto', gap: 10, alignItems: 'end' }}>
            <label style={{ fontSize: 12, color: theme.textMuted }}>
              Inventory item
              <select value={addItem} onChange={e => setAddItem(e.target.value)} style={{ ...inputStyle, marginTop: 5 }}>
                <option value="">Select item…</option>
                {templateOptions.map(t => <option key={t.id} value={t.id}>{t.name} ({t.unit || 'pcs'})</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: theme.textMuted }}>
              Opening balance
              <input type="number" min="0" step="any" value={addOpening} onChange={e => setAddOpening(e.target.value)} placeholder="e.g. 50" style={{ ...inputStyle, marginTop: 5 }} />
            </label>
            <button onClick={addTrackedItem} disabled={!addItem || adding} style={{ border: 0, borderRadius: 9, padding: '10px 16px', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: !addItem || adding ? .55 : 1 }}>
              {adding ? 'Adding…' : 'Add Item'}
            </button>
          </div>
          <div style={{ marginTop: 9, color: theme.textMuted, fontSize: 12 }}>
            Only items added here appear in Kitchen Closing. From the next shift onward, opening balance is copied automatically from the previous shift's remaining quantity.
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(110px,1fr))', gap: 10 }}>
        {[
          ['Opening', totals.opening], ['Today Added', totals.added], ['Waste', totals.waste],
          ['Remaining', totals.remaining], ['Used', totals.used],
        ].map(([label, value]) => (
          <Card key={label} style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ marginTop: 5, fontSize: 20, color: theme.text, fontWeight: 900 }}>{fmt(value)}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: theme.textMuted }}>Loading kitchen closing…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted }}>
            <Ic n="Package" size={32} />
            <div style={{ marginTop: 10, fontWeight: 800, color: theme.text }}>No closing data for this shift</div>
            <div style={{ marginTop: 5, fontSize: 13 }}>{canEdit ? 'Add an item and its opening balance above. Untracked inventory will not appear here.' : 'There is no tracked Kitchen Closing data to show.'}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
              <thead>
                <tr style={{ background: theme.bg || '#f8fafc' }}>
                  {['Item', 'Opening Balance', 'Today Added', 'Waste', 'Now Remaining', 'Used', ...(canEdit ? [''] : [])].map(h => (
                    <th key={h || 'action'} style={{ textAlign: h === 'Item' ? 'left' : 'right', padding: '12px 14px', color: theme.textMuted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${theme.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const draft = drafts[row.id] || { waste: 0, remaining: '' }
                  const opening = num(row.opening_balance)
                  const added = num(fulfilledByItem.get(norm(row.item_name)))
                  const waste = num(draft.waste)
                  const remaining = draft.remaining === '' ? 0 : num(draft.remaining)
                  const used = Math.max(0, opening + added - waste - remaining)
                  return (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '13px 14px', color: theme.text, fontWeight: 800 }}>
                        {row.item_name}<div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500 }}>{row.unit || 'pcs'}</div>
                      </td>
                      <td style={{ padding: '13px 14px', textAlign: 'right', color: theme.text, fontWeight: 700 }}>{fmt(opening)}</td>
                      <td style={{ padding: '13px 14px', textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>+{fmt(added)}</td>
                      <td style={{ padding: canEdit ? '9px 10px' : '13px 14px', textAlign: 'right', color: theme.text, fontWeight: 700 }}>
                        {canEdit ? <input type="number" min="0" step="any" value={draft.waste} onChange={e => setDrafts(p => ({ ...p, [row.id]: { ...draft, waste: e.target.value } }))} style={{ ...inputStyle, textAlign: 'right' }} /> : fmt(waste)}
                      </td>
                      <td style={{ padding: canEdit ? '9px 10px' : '13px 14px', textAlign: 'right', color: theme.text, fontWeight: 700 }}>
                        {canEdit ? <input type="number" min="0" step="any" value={draft.remaining} onChange={e => setDrafts(p => ({ ...p, [row.id]: { ...draft, remaining: e.target.value } }))} placeholder="Count stock" style={{ ...inputStyle, textAlign: 'right' }} /> : (draft.remaining === '' ? '—' : fmt(remaining))}
                      </td>
                      <td style={{ padding: '13px 14px', textAlign: 'right', color: '#7c3aed', fontWeight: 900 }}>{draft.remaining === '' ? '—' : fmt(used)}</td>
                      {canEdit && <td style={{ padding: '9px 12px', textAlign: 'right' }}><button onClick={() => saveRow(row)} disabled={savingId === row.id} style={{ border: 0, borderRadius: 8, padding: '8px 12px', background: '#0f172a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{savingId === row.id ? 'Saving…' : 'Save'}</button></td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
