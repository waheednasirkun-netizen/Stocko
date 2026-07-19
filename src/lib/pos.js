console.log('[Stocko] pos.js loaded')

/**
 * Stocko — src/lib/pos.js
 * POS (Point of Sale) API layer — wraps inventory/sales operations
 */

import { supabase } from './supabase'
import { inventoryApi } from './api'

const now = () => new Date().toISOString()

function wrap(data, error) {
  if (error) {
    return {
      data: null,
      error: {
        message: error.message ?? String(error),
        code: error.code ?? null,
        details: error.details ?? null,
      },
    }
  }
  return { data, error: null }
}

async function logActivity({ branchId, userId, userName, action, details }) {
  if (!branchId) return
  try {
    await supabase.from('activity_logs').insert([{
      branch_id: branchId,
      user_id: userId,
      user_name: userName,
      action,
      details,
      created_at: now(),
    }])
  } catch (err) {
    console.warn('[pos] activity log exception:', err)
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   POS API
   ═══════════════════════════════════════════════════════════════════════════ */

export const posApi = {
  // Expose supabase for fallback direct queries in POS.jsx
  supabase,

  /* ── Inventory ─────────────────────────────────────────────────────────── */

  async getInventory(branchId) {
    return inventoryApi.getAll(branchId)
  },

  /* ── Branches ──────────────────────────────────────────────────────────── */

  async getBranches() {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, address, is_active')
      .eq('is_active', true)
      .order('name')
    return wrap(data, error)
  },

  // Aliases for POS.jsx fallback chain
  get branches() { return this.getBranches },
  get listBranches() { return this.getBranches },

  /* ── Customers ──────────────────────────────────────────────────────────── */

  async getCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name')
    return wrap(data, error)
  },

  async createCustomer(payload) {
    const { data, error } = await supabase
      .from('customers')
      .insert([{ ...payload, is_active: true, created_at: now() }])
      .select()
    return wrap(data?.[0] ?? data, error)
  },

  // Aliases for POS.jsx fallback chain
  get customers() { return this.getCustomers },
  get listCustomers() { return this.getCustomers },
  get addCustomer() { return this.createCustomer },

  /* ── Orders ─────────────────────────────────────────────────────────────── */

  async getOrders(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async placeOrder({ sale, saleItems, inventoryUpdates, activityLog }) {
    // 1. Insert order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ ...sale, created_at: now() }])
      .select()
      .single()

    if (orderError) {
      console.error('[pos] placeOrder insert error:', orderError)
      return wrap(null, orderError)
    }

    // 2. Insert order items
    const lineItems = saleItems.map(item => ({
      ...item,
      order_id: orderData.id,
      created_at: now(),
    }))
    const { error: itemsError } = await supabase.from('order_items').insert(lineItems)
    if (itemsError) {
      console.error('[pos] placeOrder items error:', itemsError)
      return wrap(null, itemsError)
    }

    // 3. Deduct inventory
    for (const upd of inventoryUpdates || []) {
      if (!upd.inventoryId || !upd.quantity) continue
      const { data: inv } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('id', upd.inventoryId)
        .single()

      if (inv) {
        const newQty = Math.max(0, (inv.quantity || 0) - upd.quantity)
        await supabase
          .from('inventory')
          .update({ quantity: newQty, updated_at: now() })
          .eq('id', upd.inventoryId)
      }
    }

    // 4. Log activity
    if (activityLog) {
      await logActivity({
        branchId: activityLog.branchId,
        userId: activityLog.userId,
        userName: activityLog.userName,
        action: 'Order Placed',
        details: activityLog.description,
      })
    }

    return wrap(orderData, null)
  },

  async completeOrder({ orderId, status, payment, paid_amount, due_amount, completed_by, completed_by_name, ledgerEntry, activityLog }) {
    // 1. Update order status
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .update({
        status,
        paid_amount,
        due_amount,
        completed_by,
        completed_by_name,
        completed_at: now(),
        updated_at: now(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (orderError) return wrap(null, orderError)

    // 2. Insert payment record
    if (payment && payment.amount > 0) {
      const { error: payError } = await supabase.from('order_payments').insert([{
        order_id: orderId,
        amount: payment.amount,
        method: payment.method,
        remarks: payment.remarks || null,
        created_at: now(),
      }])
      if (payError) console.warn('[pos] payment record error:', payError)
    }

    // 3. Insert ledger entry if provided
    if (ledgerEntry) {
      const { error: ledgerError } = await supabase.from('ledger').insert([{
        ...ledgerEntry,
        created_at: now(),
      }])
      if (ledgerError) console.warn('[pos] ledger error:', ledgerError)
    }

    // 4. Log activity
    if (activityLog) {
      await logActivity({
        branchId: activityLog.branchId,
        userId: activityLog.userId,
        userName: activityLog.userName,
        action: 'Order Completed',
        details: activityLog.description,
      })
    }

    return wrap(orderData, null)
  },

  async cancelOrder({ orderId, cancelledBy, cancelledByName, reason, ledgerEntry, activityLog }) {
    // 1. Update order status
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_by: cancelledBy,
        cancelled_by_name: cancelledByName,
        cancellation_reason: reason,
        cancelled_at: now(),
        updated_at: now(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (orderError) return wrap(null, orderError)

    // 2. Restore inventory
    const { data: items } = await supabase
      .from('order_items')
      .select('inventory_id, quantity')
      .eq('order_id', orderId)

    for (const item of items || []) {
      if (!item.inventory_id || !item.quantity) continue
      const { data: inv } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('id', item.inventory_id)
        .single()

      if (inv) {
        await supabase
          .from('inventory')
          .update({ quantity: (inv.quantity || 0) + item.quantity, updated_at: now() })
          .eq('id', item.inventory_id)
      }
    }

    // 3. Insert ledger entry if provided (refund)
    if (ledgerEntry) {
      const { error: ledgerError } = await supabase.from('ledger').insert([{
        ...ledgerEntry,
        created_at: now(),
      }])
      if (ledgerError) console.warn('[pos] ledger error:', ledgerError)
    }

    // 4. Log activity
    if (activityLog) {
      await logActivity({
        branchId: activityLog.branchId,
        userId: activityLog.userId,
        userName: activityLog.userName,
        action: 'Order Cancelled',
        details: activityLog.description,
      })
    }

    return wrap(orderData, null)
  },

  async processPayment({ orderId, payment, status, paid, due, ledgerEntry, activityLog }) {
    // 1. Update order payment status
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .update({
        status,
        paid_amount: paid,
        due_amount: due,
        updated_at: now(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (orderError) return wrap(null, orderError)

    // 2. Insert payment record
    const { error: paymentError } = await supabase
  .from('order_payments')
  .insert([{
    order_id: orderId,
    amount: payment.amount,
    method: payment.method,
    remarks: payment.remarks || null,
    created_at: _now(),
  }]);

if (paymentError) {
  console.warn('[POS] payment error:', paymentError);
}

    // 3. Insert ledger entry if provided
    if (ledgerEntry) {
      const { error: ledgerError } = await supabase.from('ledger').insert([{
        ...ledgerEntry,
        created_at: now(),
      }])
      if (ledgerError) console.warn('[pos] ledger error:', ledgerError)
    }

    // 4. Log activity
    if (activityLog) {
      await logActivity({
        branchId: activityLog.branchId,
        userId: activityLog.userId,
        userName: activityLog.userName,
        action: 'Payment Processed',
        details: activityLog.description,
      })
    }

    return wrap(orderData, null)
  },

  /* ── Password Verification ─────────────────────────────────────────────── */

  async verifyPassword({ userId, password }) {
    if (!userId || !password) {
      return wrap(null, { message: 'User ID and password are required' })
    }

    try {
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()

      if (userError || !userRow?.email) {
        return wrap(null, { message: 'User not found' })
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userRow.email,
        password,
      })

      if (authError) {
        return wrap(null, { message: 'Invalid password' })
      }

      return wrap({ verified: true }, null)
    } catch (err) {
      return wrap(null, { message: err.message || 'Verification failed' })
    }
  },
}