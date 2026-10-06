/**
 * computeInventory — pure function, transactions are the ONLY source of truth.
 *
 * Walks transactions chronologically and derives the current inventory.
 * Stock IN adds quantity.
 * Stock OUT, Wastage and Fulfillment deduct quantity.
 *
 * This function is pure and should not store anything in the database.
 */
export function computeInventory(transactions = [], templates = []) {
  const map = {}

  // Walk transactions in chronological order.
  const sorted = [...transactions].sort((a, b) => {
    const ta = new Date(a.created_at || a.date || 0).getTime()
    const tb = new Date(b.created_at || b.date || 0).getTime()

    if (Number.isNaN(ta) || Number.isNaN(tb)) {
      return 0
    }

    return ta - tb
  })

  for (const txn of sorted) {
    // Support both Supabase and legacy field names.
    const itemName = txn.item_name || txn.item || ''
    const name = String(itemName).trim()

    if (!name) continue

    const key = name.toLowerCase()

    if (!map[key]) {
      const tmpl = templates.find(
        (t) => String(t.name || '').trim().toLowerCase() === key
      )

      const threshold =
        Number(
          tmpl?.low_stock_threshold ??
          tmpl?.lowStockThreshold ??
          txn.min_threshold ??
          txn.min_stock ??
          txn.threshold ??
          0
        ) || 0

      map[key] = {
        id: tmpl?.id || key,
        name,
        category: String(
          tmpl?.category ||
          txn.category ||
          txn.source ||
          ''
        ),
        unit: String(txn.unit || tmpl?.unit || 'pcs'),
        minQty: Math.max(0, threshold),
        cost: 0,
        supplier: '',
        quantity: 0,
      }
    }

    const entry = map[key]

    const qty = Math.abs(
      Number(txn.quantity ?? txn.qty ?? 0) || 0
    )

    const type = String(txn.type || '').trim()

    if (type === 'Stock IN') {
      entry.quantity =
        Math.round((entry.quantity + qty) * 10000) / 10000

      // Most recent Stock IN provides current cost/supplier information.
      const price =
        Number(
          txn.price_per_unit ??
          txn.price ??
          txn.cost ??
          0
        ) || 0

      if (price > 0) {
        entry.cost = price
      }

      if (txn.source) {
        entry.supplier = String(txn.source)
      }

      if (txn.unit) {
        entry.unit = String(txn.unit)
      }

      if (txn.category) {
        entry.category = String(txn.category)
      }
    }

    if (
      type === 'Stock OUT' ||
      type === 'Wastage' ||
      type === 'Fulfillment'
    ) {
      entry.quantity =
        Math.max(
          0,
          Math.round((entry.quantity - qty) * 10000) / 10000
        )
    }

    // Derive inventory status.
    const minQty = entry.minQty

    if (entry.quantity <= 0) {
      entry.status = 'Critical'
    } else if (minQty > 0 && entry.quantity <= minQty * 0.5) {
      entry.status = 'Critical'
    } else if (minQty > 0 && entry.quantity <= minQty) {
      entry.status = 'Low'
    } else {
      entry.status = 'Good'
    }
  }

  return Object.values(map)
}