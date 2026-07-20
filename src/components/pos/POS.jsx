import { useApp } from '../../context/AppContext'
import { inventoryApi } from '../../lib/api'
import { supabase } from '../../lib/supabase'

/* ── Inline POS Helpers ── */
const _now = () => new Date().toISOString()

async function _logPosActivity({ branchId, userId, userName, action, details }) {
  if (!branchId) return
  try {
    await supabase.from('activity_logs').insert([{
      branch_id: branchId, user_id: userId, user_name: userName,
      action, details, created_at: _now(),
    }])
  } catch (err) { console.warn('[POS] activity log error:', err) }
}

async function _placeOrder({ sale, saleItems, inventoryUpdates, activityLog }) {
  // 1. Insert order
  const { data: orderData, error: orderError } = await supabase
    .from('orders').insert([{ ...sale, created_at: _now() }]).select().single()
  if (orderError) {
    console.error('[POS] _placeOrder order insert error:', orderError)
    return { data: null, error: orderError }
  }

  // 2. Insert order items (with name field for receipt)
  const lineItems = saleItems.map(item => ({
    order_id: orderData.id,
    inventory_id: item.inventory_id,
    quantity: item.quantity,
    default_price: item.default_price,
    subtotal: item.subtotal,
    name: item.name || 'Item',
    created_at: _now(),
  }))
  const { error: itemsError } = await supabase.from('order_items').insert(lineItems)
  if (itemsError) {
    console.error('[POS] _placeOrder items error:', itemsError)
  }

  // 3. Deduct inventory (one by one to avoid conflicts)
  for (const upd of inventoryUpdates || []) {
    if (!upd.inventoryId || !upd.quantity) continue
    try {
      const { data: inv } = await supabase.from('inventory').select('id, quantity').eq('id', upd.inventoryId).single()
      if (inv) {
        const { error: invErr } = await supabase.from('inventory').update({
          quantity: Math.max(0, (inv.quantity || 0) - upd.quantity), updated_at: _now()
        }).eq('id', upd.inventoryId)
        if (invErr) console.error('[POS] inventory update error:', invErr)
      }
    } catch (e) {
      console.error('[POS] inventory deduction error:', e)
    }
  }

  // 4. Log activity
  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Order Placed' })

  // Return order with items for receipt
  return { data: { ...orderData, order_items: lineItems }, error: null }
}

async function _completeOrder({ orderId, status, payment, paid_amount, due_amount, completed_by, completed_by_name, ledgerEntry, activityLog }) {
  const { data: orderData, error: orderError } = await supabase.from('orders').update({
    status, paid_amount, due_amount, completed_by, completed_by_name,
    completed_at: _now(), updated_at: _now(),
  }).eq('id', orderId).select().single()
  if (orderError) return { data: null, error: orderError }

  if (payment?.amount > 0) {
    const { error: paymentError } = await supabase
      .from('order_payments')
      .insert([{
        order_id: orderId,
        amount: payment.amount,
        method: payment.method,
        remarks: payment.remarks || null,
        created_at: _now(),
      }])
    if (paymentError) {
      console.warn('[POS] payment error:', paymentError)
    }
  }

  if (ledgerEntry) {
    const { error: ledgerErr } = await supabase
      .from('ledger_entries')
      .insert([{ ...ledgerEntry, created_at: _now() }])
    if (ledgerErr) {
      console.error('[POS] ledger insert error:', ledgerErr)
    }
  }

  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Order Completed' })
  return { data: orderData, error: null }
}

async function _cancelOrder({ orderId, cancelledBy, cancelledByName, reason, ledgerEntry, activityLog }) {
  const { data: orderData, error: orderError } = await supabase.from('orders').update({
    status: 'cancelled', cancelled_by: cancelledBy, cancelled_by_name: cancelledByName,
    cancellation_reason: reason, cancelled_at: _now(), updated_at: _now(),
  }).eq('id', orderId).select().single()
  if (orderError) return { data: null, error: orderError }

  const { data: items } = await supabase.from('order_items').select('inventory_id, quantity').eq('order_id', orderId)
  for (const item of items || []) {
    if (!item.inventory_id || !item.quantity) continue
    const { data: inv } = await supabase.from('inventory').select('id, quantity').eq('id', item.inventory_id).single()
    if (inv) {
      await supabase.from('inventory').update({
        quantity: (inv.quantity || 0) + item.quantity, updated_at: _now()
      }).eq('id', item.inventory_id)
    }
  }
  if (ledgerEntry) {
    const { error: ledgerErr } = await supabase.from('ledger_entries').insert([{ ...ledgerEntry, created_at: _now() }])
    if (ledgerErr) console.error('[POS] ledger insert error:', ledgerErr.message, ledgerErr.details)
  }
  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Order Cancelled' })
  return { data: orderData, error: null }
}

async function _processPayment({ orderId, payment, status, paid, due, ledgerEntry, activityLog }) {
  const { data: orderData, error: orderError } = await supabase.from('orders').update({
    status, paid_amount: paid, due_amount: due, updated_at: _now(),
  }).eq('id', orderId).select().single()
  if (orderError) return { data: null, error: orderError }

  if (payment?.amount > 0) {
    try {
      const { error } = await supabase
        .from('order_payments')
        .insert([{
          order_id: orderId,
          amount: payment.amount,
          method: payment.method,
          remarks: payment.remarks || null,
          created_at: _now(),
        }])
      if (error) throw error
    } catch (err) {
      console.warn('[POS] payment error:', err)
    }
  }
  if (ledgerEntry) {
    const { error: ledgerErr } = await supabase.from('ledger_entries').insert([{ ...ledgerEntry, created_at: _now() }])
    if (ledgerErr) console.error('[POS] ledger insert error:', ledgerErr.message, ledgerErr.details)
  }
  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Payment Processed' })
  return { data: orderData, error: null }
}

// NEW: edit an existing order (items / discount / tax), reconciling inventory diffs.
async function _editOrder({ orderId, updatedOrder, updatedItems, inventoryDiffs, activityLog }) {
  const { error: orderError } = await supabase.from('orders').update({
    ...updatedOrder, updated_at: _now(),
  }).eq('id', orderId)
  if (orderError) return { data: null, error: orderError }

  // Replace order items with the edited set
  const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', orderId)
  if (deleteError) console.error('[POS] _editOrder delete items error:', deleteError)

  const lineItems = (updatedItems || []).map(item => ({
    order_id: orderId,
    inventory_id: item.inventory_id,
    quantity: item.quantity,
    default_price: item.default_price,
    subtotal: item.subtotal,
    name: item.name || 'Item',
    created_at: _now(),
  }))
  if (lineItems.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(lineItems)
    if (itemsError) console.error('[POS] _editOrder insert items error:', itemsError)
  }

  // Reconcile inventory: diff > 0 means more stock was used (deduct), diff < 0 means stock is returned
  for (const d of inventoryDiffs || []) {
    if (!d.inventoryId || !d.diff) continue
    try {
      const { data: inv } = await supabase.from('inventory').select('id, quantity').eq('id', d.inventoryId).single()
      if (inv) {
        const newQty = Math.max(0, (inv.quantity || 0) - d.diff)
        const { error: invErr } = await supabase.from('inventory').update({ quantity: newQty, updated_at: _now() }).eq('id', d.inventoryId)
        if (invErr) console.error('[POS] _editOrder inventory adjust error:', invErr)
      }
    } catch (e) {
      console.error('[POS] _editOrder inventory adjust exception:', e)
    }
  }

  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Order Edited' })
  return { data: { id: orderId, ...updatedOrder, order_items: lineItems }, error: null }
}

const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  CREDIT: 'credit',
}

const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  CREDIT: 'credit',
  CANCELLED: 'cancelled',
  PARTIALLY_PAID: 'partially_paid',
  COMPLETED: 'completed',
}

/* ── Roles allowed to use the POS at all ── */
const STOREKEEPER_ROLES = ['storekeeper', 'staff', 'cashier', 'store boy', 'storeboy']
const ADMIN_ROLES = ['admin', 'manager', 'developer', 'store keeper', 'owner']
const BLOCKED_ROLES = ['chief', 'viewer']

/* ── Print Receipt ── */
const printReceipt = (order, items, user) => {
  const printWindow = window.open('', '_blank', 'width=320,height=600')
  if (!printWindow) { alert('Popup blocked - allow popups to print'); return }

  const date = new Date().toLocaleString()
  const invoice = order.invoice_no || order.id?.slice(0, 8)

  const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${invoice}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body { 
      font-family: 'Courier New', monospace; 
      font-size: 12px; 
      width: 76mm; 
      margin: 0 auto; 
      padding: 8px;
      line-height: 1.4;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    .right { text-align: right; }
    .total { font-size: 14px; font-weight: bold; }
    .footer { margin-top: 16px; font-size: 10px; text-align: center; }
    @media print {
      body { width: 76mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:14px;">STOCKO POS</div>
  <div class="center">${user?.branch_name || 'Branch'}</div>
  <div class="center" style="font-size:10px;">${date}</div>
  <div class="line"></div>
  <div>Invoice: #${invoice}</div>
  <div>Customer: ${order.customer_name || 'Walk-In'}</div>
  <div>Status: ${order.status?.toUpperCase()}</div>
  <div class="line"></div>
  <div style="display:flex; justify-content:space-between; font-weight:bold;">
    <span style="flex:1;">Item</span>
    <span style="width:30px; text-align:center;">Qty</span>
    <span style="width:60px; text-align:right;">Price</span>
    <span style="width:60px; text-align:right;">Total</span>
  </div>
  <div class="line"></div>
  ${items.map(item => `
    <div style="display:flex; justify-content:space-between;">
      <span style="flex:1;">${item.name}</span>
      <span style="width:30px; text-align:center;">${item.quantity}</span>
      <span style="width:60px; text-align:right;">${item.default_price?.toFixed(2)}</span>
      <span style="width:60px; text-align:right;">${(item.quantity * item.default_price)?.toFixed(2)}</span>
    </div>
  `).join('')}
  <div class="line"></div>
  <div class="right">Subtotal: Rs. ${order.subtotal?.toFixed(2)}</div>
  ${order.discount > 0 ? `<div class="right">Discount: Rs. ${order.discount?.toFixed(2)}</div>` : ''}
  ${order.tax > 0 ? `<div class="right">Tax: Rs. ${order.tax?.toFixed(2)}</div>` : ''}
  <div class="right total">TOTAL: Rs. ${order.total?.toFixed(2)}</div>
  <div class="line"></div>
  <div class="footer">Thank you for your business!</div>
  <div class="footer">Powered by Stocko</div>
  <div class="no-print" style="margin-top:20px; text-align:center;">
    <button onclick="window.print();window.close()" style="padding:10px 20px; font-size:14px; cursor:pointer;">🖨️ Print Receipt</button>
  </div>
</body>
</html>`

  printWindow.document.write(receiptHTML)
  printWindow.document.close()

  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 500)
}
