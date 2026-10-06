/**
 * computeInventory — pure function, transactions are the ONLY source of truth.
 *
 * Mirrors the original HTML app exactly: walks transactions chronologically,
 * accumulates Stock IN and deducts Stock OUT / Wastage / Fulfillment.
 * Returns an array of inventory items with derived status.
 *
 * This function is called inside useMemo() in AppContext — never stored in DB.
 */
export function computeInventory(transactions = [], templates = []) {
  const map = {}

  // Walk transactions in chronological order (oldest first)
  const sorted = [...transactions].sort((a, b) => {
    const ta = new Date(a.created_at || a.date).getTime()
    const tb = new Date(b.created_at || b.date).getTime()
    return isNaN(ta) || isNaN(tb) ? 0 : ta - tb
  })

  for (const txn of sorted) {
    // Support both Supabase column names and legacy HTML app field names
    const itemName = txn.item_name || txn.item || ''
    const key = String(itemName).trim().toLowerCase()
    if (!key) continue

    if (!map[key]) {
      const tmpl = templates.find(t => String(t.name || '').toLowerCase() === key)
      map[key] = {
        id:       tmpl?.id || key,
        name:     String(itemName).trim(),
        category: tmpl?.category || txn.category || txn.source || '',
        unit:     String(txn.unit || 'pcs'),
        minQty:   Math.max(0, Number(tmpl?.low_stock_threshold || tmpl?.lowStockThreshold) || 0),
        cost:     0,
        supplier: '',
        quantity: 0,
      }
    }

    const entry = map[key]
    const qty   = Number(txn.quantity || txn.qty) || 0
    const type  = txn.type

    if (type === 'Stock IN') {
      entry.quantity = Math.round((entry.quantity + Math.abs(qty)) * 10000) / 10000
      // Most recent Stock IN wins for cost and supplier
      const price = Number(txn.price_per_unit || txn.price) || 0
      if (price > 0)       entry.cost     = price
      if (txn.source)      entry.supplier = String(txn.source)
      if (txn.unit)        entry.unit     = String(txn.unit)
      if (txn.category)    entry.category = String(txn.category)
    } else if (
      type === 'Stock OUT' ||
      type === 'Wastage'   ||
      type === 'Fulfillment'
    ) {
      entry.quantity = Math.max(0, Math.round((entry.quantity - Math.abs(qty)) * 10000) / 10000)
    }

    // Derive status
    const mq = entry.minQty
    entry.status =
      entry.quantity <= 0         ? 'Critical'
      : mq > 0 && entry.quantity <= mq * 0.5 ? 'Critical'
      : mq > 0 && entry.quantity <= mq       ? 'Low'
      : 'Good'
  }

  return Object.values(map)
}
