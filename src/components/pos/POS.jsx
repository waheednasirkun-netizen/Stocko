import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { inventoryApi } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { Ic, Btn, Modal, Input, Select, useConfirm, EmptyState } from '../ui'

/* ═══════════════════════════════════════════════════════════════════════════
   BACKEND HELPERS — talk to the real schema (orders / order_items /
   order_payments / ledger_entries / activity_logs). Kept intact because this
   logic already works correctly against the live database.
   ═══════════════════════════════════════════════════════════════════════════ */

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
  const { data: orderData, error: orderError } = await supabase
    .from('orders').insert([{ ...sale, created_at: _now() }]).select().single()
  if (orderError) return { data: null, error: orderError }

  const lineItems = saleItems.map(item => ({
    order_id: orderData.id,
    inventory_id: item.inventory_id,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
    name: item.name || 'Item',
    created_at: _now(),
  }))
  const { error: itemsError } = await supabase.from('order_items').insert(lineItems)
  if (itemsError) console.error('[POS] _placeOrder items error:', itemsError)

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
    } catch (e) { console.error('[POS] inventory deduction error:', e) }
  }

  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Order Placed' })
  return { data: { ...orderData, order_items: lineItems }, error: null }
}

async function _completeOrder({ orderId, status, payment, paid_amount, due_amount, completed_by, completed_by_name, ledgerEntry, activityLog }) {
  const { data: orderData, error: orderError } = await supabase.from('orders').update({
    status, paid_amount, due_amount, completed_by, completed_by_name,
    completed_at: _now(), updated_at: _now(),
  }).eq('id', orderId).select().single()
  if (orderError) return { data: null, error: orderError }

  if (payment?.amount > 0) {
    const { error: paymentError } = await supabase.from('order_payments').insert([{
      order_id: orderId, amount: payment.amount, method: payment.method,
      remarks: payment.remarks || null, created_at: _now(),
    }])
    if (paymentError) console.warn('[POS] payment error:', paymentError)
  }

  if (ledgerEntry) {
    const { error: ledgerErr } = await supabase.from('ledger_entries').insert([{ ...ledgerEntry, created_at: _now() }])
    if (ledgerErr) console.error('[POS] ledger insert error:', ledgerErr)
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
      const { error } = await supabase.from('order_payments').insert([{
        order_id: orderId, amount: payment.amount, method: payment.method,
        remarks: payment.remarks || null, created_at: _now(),
      }])
      if (error) throw error
    } catch (err) { console.warn('[POS] payment error:', err) }
  }
  if (ledgerEntry) {
    const { error: ledgerErr } = await supabase.from('ledger_entries').insert([{ ...ledgerEntry, created_at: _now() }])
    if (ledgerErr) console.error('[POS] ledger insert error:', ledgerErr.message, ledgerErr.details)
  }
  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Payment Processed' })
  return { data: orderData, error: null }
}

async function _editOrder({ orderId, updatedOrder, updatedItems, inventoryDiffs, activityLog }) {
  const { error: orderError } = await supabase.from('orders').update({
    ...updatedOrder, updated_at: _now(),
  }).eq('id', orderId)
  if (orderError) return { data: null, error: orderError }

  const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', orderId)
  if (deleteError) console.error('[POS] _editOrder delete items error:', deleteError)

  const lineItems = (updatedItems || []).map(item => ({
    order_id: orderId, inventory_id: item.inventory_id, quantity: item.quantity,
    price: item.price, subtotal: item.subtotal, name: item.name || 'Item', created_at: _now(),
  }))
  if (lineItems.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(lineItems)
    if (itemsError) console.error('[POS] _editOrder insert items error:', itemsError)
  }

  for (const d of inventoryDiffs || []) {
    if (!d.inventoryId || !d.diff) continue
    try {
      const { data: inv } = await supabase.from('inventory').select('id, quantity').eq('id', d.inventoryId).single()
      if (inv) {
        const newQty = Math.max(0, (inv.quantity || 0) - d.diff)
        const { error: invErr } = await supabase.from('inventory').update({ quantity: newQty, updated_at: _now() }).eq('id', d.inventoryId)
        if (invErr) console.error('[POS] _editOrder inventory adjust error:', invErr)
      }
    } catch (e) { console.error('[POS] _editOrder inventory adjust exception:', e) }
  }

  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Order Edited' })
  return { data: { id: orderId, ...updatedOrder, order_items: lineItems }, error: null }
}

const PAYMENT_METHODS = { CASH: 'cash', CARD: 'card', BANK_TRANSFER: 'bank_transfer', CREDIT: 'credit' }

const ORDER_STATUS = {
  PENDING: 'pending', PAID: 'paid', CREDIT: 'credit', CANCELLED: 'cancelled',
  PARTIALLY_PAID: 'partially_paid', COMPLETED: 'completed',
}

const STOREKEEPER_ROLES = ['storekeeper', 'store keeper', 'staff', 'cashier', 'store boy', 'storeboy']
const ADMIN_ROLES = ['admin', 'manager', 'developer', 'superadmin', 'owner']
const BLOCKED_ROLES = ['chief', 'viewer']

/* ── Printable 80mm receipt ── */
const printReceipt = (order, items, user, branchName) => {
  const printWindow = window.open('', '_blank', 'width=320,height=600')
  if (!printWindow) { alert('Popup blocked — please allow popups to print receipts.'); return }

  const date = new Date().toLocaleString()
  const invoice = order.invoice_no || order.id?.slice(0, 8)

  const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"><title>Receipt #${invoice}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 76mm; margin: 0 auto; padding: 8px; line-height: 1.4; }
  .center { text-align: center; } .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 8px 0; } .right { text-align: right; }
  .total { font-size: 14px; font-weight: bold; } .footer { margin-top: 16px; font-size: 10px; text-align: center; }
  @media print { body { width: 76mm; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="center bold" style="font-size:14px;">STOCKO POS</div>
  <div class="center">${branchName || user?.branch_name || 'Branch'}</div>
  <div class="center" style="font-size:10px;">${date}</div>
  <div class="line"></div>
  <div>Invoice: #${invoice}</div>
  <div>Customer: ${order.customer_name || 'Walk-In'}</div>
  <div>Status: ${order.status?.toUpperCase()}</div>
  <div class="line"></div>
  <div style="display:flex; justify-content:space-between; font-weight:bold;">
    <span style="flex:1;">Item</span><span style="width:30px; text-align:center;">Qty</span>
    <span style="width:60px; text-align:right;">Price</span><span style="width:60px; text-align:right;">Total</span>
  </div>
  <div class="line"></div>
  ${items.map(item => `
    <div style="display:flex; justify-content:space-between;">
      <span style="flex:1;">${item.name}</span>
      <span style="width:30px; text-align:center;">${item.quantity}</span>
      <span style="width:60px; text-align:right;">${item.price?.toFixed(2)}</span>
      <span style="width:60px; text-align:right;">${(item.quantity * item.price)?.toFixed(2)}</span>
    </div>`).join('')}
  <div class="line"></div>
  <div class="right">Subtotal: Rs. ${order.subtotal?.toFixed(2)}</div>
  ${order.discount > 0 ? `<div class="right">Discount: Rs. ${order.discount?.toFixed(2)}</div>` : ''}
  ${order.tax > 0 ? `<div class="right">Tax: Rs. ${order.tax?.toFixed(2)}</div>` : ''}
  <div class="right total">TOTAL: Rs. ${order.total?.toFixed(2)}</div>
  <div class="line"></div>
  <div class="footer">Thank you for your business!</div>
  <div class="footer">Powered by Stocko</div>
  <div class="no-print" style="margin-top:20px; text-align:center;">
    <button onclick="window.print();window.close()" style="padding:10px 20px; font-size:14px; cursor:pointer;">Print Receipt</button>
  </div>
</body>
</html>`
  printWindow.document.write(receiptHTML)
  printWindow.document.close()
  setTimeout(() => { printWindow.focus(); printWindow.print() }, 500)
}

/* ── Printable multi-order report ── */
const printOrdersReport = (rows, meta) => {
  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) { alert('Popup blocked — please allow popups to print.'); return }
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>POS Report</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; } p.meta { color: #555; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; } th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
  th { background: #f3f4f6; text-transform: uppercase; font-size: 10px; }
  td.num, th.num { text-align: right; }
  tfoot td { font-weight: bold; border-top: 2px solid #333; }
</style></head>
<body>
  <h1>STOCKO POS — Orders Report</h1>
  <p class="meta">${meta}</p>
  <table>
    <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Payment</th><th class="num">Total</th><th>Status</th></tr></thead>
    <tbody>
      ${rows.map(o => `<tr>
        <td>#${o.invoice_no || o.id?.slice(0, 8)}</td>
        <td>${new Date(o.created_at).toLocaleString()}</td>
        <td>${o.customer_name || 'Walk-In'}</td>
        <td>${(o.payment_type || o.status || '').replace('_', ' ')}</td>
        <td class="num">Rs. ${(o.total || 0).toFixed(2)}</td>
        <td>${(o.status || '').replace('_', ' ').toUpperCase()}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="4">Total</td><td class="num">Rs. ${rows.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)}</td><td></td></tr></tfoot>
  </table>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`
  printWindow.document.write(html)
  printWindow.document.close()
}

/* ── CSV export ── */
function downloadCSV(filename, rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h] ?? ''
      const s = String(val).replace(/"/g, '""')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
    }).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ── Tab config (rendered as one slim strip — no second page header) ── */
const TABS = [
  { key: 'new_order', label: 'New Order', icon: 'ShoppingCart' },
  { key: 'pending', label: 'Pending Orders', icon: 'ClipboardList' },
  { key: 'cancelled', label: 'Cancelled Orders', icon: 'AlertTriangle' },
  { key: 'reports', label: 'Reports', icon: 'BarChart2', adminOnly: true },
]

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function POS() {
  const { user, currentBranch, theme, showToast } = useApp()
  const { confirm } = useConfirm()

  // Respect the branch switcher used by the rest of Stocko. A user's assigned
  // branch remains the fallback for accounts that cannot switch branches.
  const activeBranchId = currentBranch?.id || user?.branch_id || null

  const userRole = (user?.role || user?.user_role || user?.type || 'storekeeper').toLowerCase()
  const isStorekeeper = STOREKEEPER_ROLES.includes(userRole)
  const isAdmin = ADMIN_ROLES.includes(userRole)
  const isBlockedRole = BLOCKED_ROLES.includes(userRole)
  const hasAccess = !isBlockedRole && (isAdmin || isStorekeeper)
  const hasReportAccess = isAdmin

  const [activeTab, setActiveTab] = useState('new_order')

  // Cart / new order
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [inventory, setInventory] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [branches, setBranches] = useState([])
  const [customers, setCustomers] = useState([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(false)

  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerAddress, setNewCustomerAddress] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  // Orders (backs Pending + Cancelled + Reports tabs)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [listSearch, setListSearch] = useState('')

  const [selectedOrder, setSelectedOrder] = useState(null)

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [pendingActionData, setPendingActionData] = useState(null)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CASH)
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentRemarks, setPaymentRemarks] = useState('')

  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeOrderData, setCompleteOrderData] = useState(null)
  const [completePaymentMethod, setCompletePaymentMethod] = useState(PAYMENT_METHODS.CASH)
  const [completePaidAmount, setCompletePaidAmount] = useState(0)
  const [completeRemarks, setCompleteRemarks] = useState('')

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelOrderId, setCancelOrderId] = useState(null)

  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false)
  const [customerLedger, setCustomerLedger] = useState([])
  const [orderDetails, setOrderDetails] = useState(null)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editOrderData, setEditOrderData] = useState(null)
  const [editItems, setEditItems] = useState([])
  const [editDiscount, setEditDiscount] = useState(0)
  const [editTax, setEditTax] = useState(0)

  // Reports filters
  const todayStr = () => new Date().toISOString().split('T')[0]
  const [reportStart, setReportStart] = useState(todayStr())
  const [reportEnd, setReportEnd] = useState(todayStr())
  const [reportCustomer, setReportCustomer] = useState('')
  const [reportStatus, setReportStatus] = useState('all')
  const [reportPaymentType, setReportPaymentType] = useState('all')

  /* ── Status badge, theme-driven ── */
  const statusMeta = useCallback((status) => {
    const map = {
      pending:         { bg: theme.pending,   color: theme.pendingText,   label: 'Pending' },
      partially_paid:  { bg: theme.warning,   color: theme.warningText,   label: 'Partially Paid' },
      paid:            { bg: theme.completed, color: theme.completedText, label: 'Paid' },
      credit:          { bg: theme.approved,  color: theme.approvedText,  label: 'Credit' },
      completed:       { bg: theme.completed, color: theme.completedText, label: 'Completed' },
      cancelled:       { bg: theme.rejected,  color: theme.rejectedText,  label: 'Cancelled' },
    }
    return map[status] || { bg: theme.cardHover, color: theme.textMuted, label: status || 'Unknown' }
  }, [theme])

  const StatusBadge = ({ status }) => {
    const m = statusMeta(status)
    return (
      <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: m.bg, color: m.color }}>
        {m.label}
      </span>
    )
  }

  /* ── Derived catalog data ── */
  const categories = useMemo(() => {
    const cats = new Set(inventory.map(p => p.category).filter(Boolean))
    return ['all', ...Array.from(cats)]
  }, [inventory])

  const filteredInventory = useMemo(() => {
    let result = inventory
    if (selectedCategory !== 'all') result = result.filter(p => p.category === selectedCategory)
    if (productSearch.trim()) {
      const s = productSearch.toLowerCase()
      result = result.filter(p => p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.barcode?.toLowerCase().includes(s))
    }
    return result
  }, [inventory, selectedCategory, productSearch])

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.price, 0), [cart])
  const tax = useMemo(() => Math.max(0, (subtotal - discount) * (taxRate / 100)), [subtotal, discount, taxRate])
  const total = useMemo(() => Math.max(0, subtotal - discount + tax), [subtotal, discount, tax])

  /* ── Data loading ── */
  const loadInventory = useCallback(async () => {
    if (!hasAccess || !activeBranchId) return
    const { data, error } = await inventoryApi.getAll(activeBranchId)
    if (error) showToast('error', 'Inventory Load Failed', error.message)
    else setInventory(data || [])
  }, [activeBranchId, hasAccess, showToast])

  useEffect(() => { loadInventory() }, [loadInventory])

  useEffect(() => {
    if (!hasAccess) return
    const loadBranches = async () => {
      setBranchesLoading(true)
      try {
        const { data, error } = await supabase.from('branches').select('id, name, address').neq('id', activeBranchId || '')
        if (error) console.error('[POS] branches error:', error.message)
        else setBranches(data || [])
      } catch (err) { console.error('[POS] branches load failed:', err) }
      finally { setBranchesLoading(false) }
    }
    loadBranches()
  }, [hasAccess, activeBranchId])

  useEffect(() => {
    if (!hasAccess) return
    const loadCustomers = async () => {
      if (!activeBranchId) return
      setCustomersLoading(true)
      try {
        const { data, error } = await supabase.from('customers').select('*').eq('branch_id', activeBranchId).order('name')
        if (error) console.error('[POS] customers error:', error.message)
        else setCustomers(data || [])
      } catch (err) { console.error('[POS] customers load failed:', err) }
      finally { setCustomersLoading(false) }
    }
    loadCustomers()
  }, [hasAccess, activeBranchId])

  const loadOrders = useCallback(async () => {
    if (!activeBranchId) return
    setOrdersLoading(true)
    try {
      const { data, error } = await supabase.from('orders').select('*, order_items(*), order_payments(*)').eq('branch_id', activeBranchId).order('created_at', { ascending: false })
      if (error) showToast('error', 'Orders Load Failed', error.message)
      else setOrders(data || [])
    } catch (err) { showToast('error', 'Orders Load Failed', err.message) }
    finally { setOrdersLoading(false) }
  }, [activeBranchId, showToast])

  // Orders now live in persistent tabs, not a modal — load once access is ready,
  // and whenever the Pending / Cancelled / Reports tabs are opened.
  useEffect(() => { if (hasAccess) loadOrders() }, [hasAccess, loadOrders])
  useEffect(() => {
    if (hasAccess && ['pending', 'cancelled', 'reports'].includes(activeTab)) loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) { showToast('error', 'Required', 'Customer name is required'); return }
    setCreatingCustomer(true)
    try {
      const payload = {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
        email: newCustomerEmail.trim() || null,
        address: newCustomerAddress.trim() || null,
        branch_id: activeBranchId,
      }
      const { data: newCust, error } = await supabase.from('customers').insert([payload]).select().single()
      if (error) { showToast('error', 'Create Failed', error.message); return }
      if (newCust) {
        setCustomers(prev => [...prev, newCust].sort((a, b) => a.name?.localeCompare(b.name)))
        setSelectedCustomer({ ...newCust, _partyType: 'customer' })
      }
      setShowCreateCustomerModal(false)
      setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail(''); setNewCustomerAddress('')
      showToast('success', 'Customer Created', newCust?.name || '')
    } catch (err) {
      showToast('error', 'Create Failed', err.message || 'Unknown error')
    }
    finally { setCreatingCustomer(false) }
  }

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey)
    setListSearch('')
  }

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(x => x.id === product.id)
      const maxStock = product.quantity || 0
      if (existing) {
        if (existing.qty >= maxStock) { showToast('error', 'Stock Limit', `Only ${maxStock} in stock for "${product.name}"`); return prev }
        return prev.map(x => x.id === product.id ? { ...x, qty: Math.min(x.qty + 1, maxStock) } : x)
      }
      if (maxStock <= 0) { showToast('error', 'Out of Stock', `"${product.name}" is out of stock`); return prev }
      return [...prev, { id: product.id, name: product.name, qty: 1, price: product.selling_price || 0, unit: product.unit || 'unit', inventory_id: product.id, sku: product.sku || '', category: product.category || '' }]
    })
  }, [showToast])

  const updateQty = useCallback((id, qty) => {
    if (qty < 1) return
    const product = inventory.find(p => p.id === id)
    const maxStock = product ? product.quantity || 0 : Infinity
    if (qty > maxStock) { showToast('error', 'Stock Limit', `Only ${maxStock} units available`); return }
    setCart(prev => prev.map(x => x.id === id ? { ...x, qty } : x))
  }, [inventory, showToast])

  const removeItem = useCallback((id) => setCart(prev => prev.filter(x => x.id !== id)), [])
  const clearCart = useCallback(() => { setCart([]); setSelectedCustomer(null); setDiscount(0); setTaxRate(0) }, [])

  // Never carry cart items or a customer across branches.
  useEffect(() => {
    clearCart()
    setProductSearch('')
    setSelectedCategory('all')
  }, [activeBranchId, clearCart])

  /* ── Manager password verification (real Supabase auth check) ── */
  const verifyPasswordAndExecute = async () => {
    setPasswordError(''); setProcessing(true)
    try {
      const { data: userRow } = await supabase.from('users').select('email').eq('id', user?.id).single()
      if (!userRow?.email) { setPasswordError('User not found'); setProcessing(false); return }
      const { error: authError } = await supabase.auth.signInWithPassword({ email: userRow.email, password: passwordInput })
      if (authError) { setPasswordError('Invalid password'); setProcessing(false); return }
      await executePendingAction()
    } catch (err) { setPasswordError('Authentication failed'); setProcessing(false) }
  }

  const executePendingAction = async () => {
    try {
      switch (pendingAction) {
        case 'cancel': await doCancelOrder(pendingActionData); break
        case 'payment': await doProcessPayment(pendingActionData); break
        case 'complete': await doCompleteOrder(pendingActionData); break
        case 'edit': openEditModal(pendingActionData); break
      }
      setShowPasswordModal(false); setPasswordInput(''); setPendingAction(null); setPendingActionData(null)
    } catch (err) { showToast('error', 'Action Failed', err.message) }
    finally { setProcessing(false) }
  }

  const requirePassword = (action, data) => {
    if (!isAdmin) { showToast('error', 'Not Allowed', 'Only managers can perform this action'); return }
    setPendingAction(action); setPendingActionData(data); setShowPasswordModal(true)
  }

  /* ── Order workflow ── */
  const placeOrder = async () => {
    if (cart.length === 0) { showToast('error', 'Empty Cart', 'Add items to place an order'); return }
    const ok = await confirm({
      title: 'Place Order',
      message: `Place order for ${selectedCustomer?.name || 'Walk-In'}?\nTotal: Rs. ${total.toFixed(2)} · ${cart.length} item(s) in cart.`,
      variant: 'primary',
      confirmLabel: 'Place Order',
    })
    if (!ok) return

    setProcessing(true)
    try {
      const saleData = {
        branch_id: activeBranchId,
        // A branch may be selected as the order destination, but a branch id
        // must never be written into the customers foreign-key column.
        customer_id: selectedCustomer?._partyType === 'branch' ? null : (selectedCustomer?.id || null),
        customer_name: selectedCustomer?.name || 'Walk-In',
        subtotal, tax, discount, total,
        status: ORDER_STATUS.PENDING,
        created_by: user?.id,
        created_by_name: user?.name,
      }
      const saleItems = cart.map(item => ({
        inventory_id: item.inventory_id, quantity: item.qty, price: item.price,
        subtotal: item.qty * item.price, name: item.name,
      }))
      const inventoryUpdates = cart.map(item => ({ inventoryId: item.inventory_id, quantity: item.qty }))

      const { data, error } = await _placeOrder({
        sale: saleData, saleItems, inventoryUpdates,
        activityLog: {
          branchId: activeBranchId, userId: user?.id, userName: user?.name,
          description: `Order placed: ${cart.length} items, Total: ${total}`,
        },
      })
      if (error) { showToast('error', 'Order Failed', error.message || error.details || 'Unknown error'); return }
      showToast('success', 'Order Placed', `Total Rs. ${total.toFixed(2)}`)
      clearCart()
      await Promise.all([loadOrders(), loadInventory()])
      if (data) printReceipt(data, saleItems, user, currentBranch?.name)
    } catch (err) {
      showToast('error', 'Order Failed', err.message || 'Unknown error')
    }
    finally { setProcessing(false) }
  }

  const initiateCompleteOrder = (order) => {
    if (!isAdmin) { showToast('error', 'Not Allowed', 'Only managers can complete orders'); return }
    setCompleteOrderData(order)
    setCompletePaidAmount(order.total || 0)
    setCompletePaymentMethod(PAYMENT_METHODS.CASH)
    setCompleteRemarks('')
    setShowCompleteModal(true)
  }

  const confirmCompleteOrder = () => {
    const totalDue = completeOrderData?.due_amount ?? completeOrderData?.total ?? 0
    if (completePaymentMethod !== PAYMENT_METHODS.CREDIT && completePaidAmount <= 0) {
      showToast('error', 'Invalid Amount', 'Enter a valid paid amount')
      return
    }
    if (completePaymentMethod !== PAYMENT_METHODS.CREDIT && completePaidAmount > totalDue) {
      showToast('error', 'Amount Too High', `Maximum payable amount is Rs. ${totalDue.toFixed(2)}`)
      return
    }
    setShowCompleteModal(false)
    requirePassword('complete', completeOrderData.id)
  }

  const doCompleteOrder = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) { showToast('error', 'Not Found', 'Order not found'); return }
      const totalDue = order.due_amount ?? order.total ?? 0
      const isCreditSale = completePaymentMethod === PAYMENT_METHODS.CREDIT
      const paid = isCreditSale ? 0 : Math.min(Number(completePaidAmount) || 0, totalDue)
      const newDue = Math.max(0, totalDue - paid)
      const finalStatus = isCreditSale ? ORDER_STATUS.CREDIT
        : (newDue > 0 ? ORDER_STATUS.PARTIALLY_PAID : ORDER_STATUS.PAID)

      const ledgerEntry = order.customer_id && paid > 0 ? {
        customer_id: order.customer_id, branch_id: activeBranchId, amount: paid, type: 'payment',
        description: `Payment received - ${completePaymentMethod} - Order #${order.invoice_no || order.id}`,
        order_id: order.id, balance_after: newDue,
      } : null
      const { error } = await _completeOrder({
        orderId, status: finalStatus,
        payment: { amount: paid, method: completePaymentMethod, remarks: completeRemarks },
        paid_amount: paid, due_amount: newDue, completed_by: user?.id, completed_by_name: user?.name,
        ledgerEntry,
        activityLog: {
          branchId: activeBranchId, userId: user?.id, userName: user?.name,
          description: `Order completed: #${order.invoice_no || order.id} - Paid: ${paid} via ${completePaymentMethod}`,
        },
      })
      if (error) { showToast('error', 'Completion Failed', error.message); return }
      showToast('success', 'Order Completed', `#${order.invoice_no || order.id?.slice(0, 8)}`)
      setCompleteOrderData(null)
      await loadOrders()
    } catch (err) { showToast('error', 'Completion Failed', err.message) }
  }

  const initiateCancel = (orderId) => {
    if (!isAdmin) { showToast('error', 'Not Allowed', 'Only managers can cancel orders'); return }
    setCancelOrderId(orderId); setCancelReason(''); setShowCancelModal(true)
  }

  const confirmCancel = () => {
    if (!cancelReason.trim()) { showToast('error', 'Reason Required', 'Please provide a cancellation reason'); return }
    setShowCancelModal(false)
    requirePassword('cancel', cancelOrderId)
  }

  const doCancelOrder = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) { showToast('error', 'Not Found', 'Order not found'); return }
      const ledgerEntry = order.customer_id && (order.paid_amount || 0) > 0 ? {
        customer_id: order.customer_id, branch_id: activeBranchId, amount: -(order.paid_amount || 0),
        type: 'refund', description: `Refund for cancelled order #${order.invoice_no || order.id} - Reason: ${cancelReason}`,
        order_id: order.id,
      } : null

      const { error } = await _cancelOrder({
        orderId, cancelledBy: user?.id, cancelledByName: user?.name, reason: cancelReason, ledgerEntry,
        activityLog: {
          branchId: activeBranchId, userId: user?.id, userName: user?.name,
          description: `Order cancelled: #${order.invoice_no || order.id} - Reason: ${cancelReason}`,
        },
      })
      if (error) { showToast('error', 'Cancel Failed', error.message); return }
      showToast('success', 'Order Cancelled', 'Inventory has been restored')
      await Promise.all([loadOrders(), loadInventory()])
    } catch (err) { showToast('error', 'Cancel Failed', err.message) }
  }

  const initiatePayment = (order) => {
    if (!isAdmin) { showToast('error', 'Not Allowed', 'Only managers can process payments'); return }
    setSelectedOrder(order)
    setPaidAmount(order.due_amount ?? order.total ?? 0)
    setPaymentMethod(PAYMENT_METHODS.CASH)
    setPaymentRemarks('')
    setShowPaymentModal(true)
  }

  const confirmPayment = () => {
    if (!paidAmount || paidAmount <= 0) { showToast('error', 'Invalid Amount', 'Enter a valid paid amount'); return }
    const due = selectedOrder?.due_amount ?? selectedOrder?.total ?? 0
    if (paidAmount > due) { showToast('error', 'Amount Too High', `Maximum payable amount is Rs. ${due.toFixed(2)}`); return }
    setShowPaymentModal(false)
    requirePassword('payment', selectedOrder.id)
  }

  const doProcessPayment = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) { showToast('error', 'Not Found', 'Order not found'); return }
      const totalDue = order.due_amount ?? order.total ?? 0
      const newPaid = (order.paid_amount || 0) + paidAmount
      const newDue = Math.max(0, totalDue - paidAmount)
      const finalStatus = newDue > 0 ? ORDER_STATUS.PARTIALLY_PAID : ORDER_STATUS.PAID

      const ledgerEntry = order.customer_id ? {
        customer_id: order.customer_id, branch_id: activeBranchId, amount: paidAmount, type: 'payment',
        description: `Payment received - ${paymentMethod} - Order #${order.invoice_no || order.id}`,
        order_id: order.id, balance_after: newDue,
      } : null
      const { error } = await _processPayment({
        orderId, payment: { amount: paidAmount, method: paymentMethod, remarks: paymentRemarks },
        status: finalStatus, paid: newPaid, due: newDue, ledgerEntry,
        activityLog: {
          branchId: activeBranchId, userId: user?.id, userName: user?.name,
          description: `Payment processed: ${paidAmount} via ${paymentMethod} for Order #${order.invoice_no || order.id}`,
        },
      })
      if (error) { showToast('error', 'Payment Failed', error.message); return }
      showToast('success', 'Payment Processed', `Rs. ${paidAmount.toFixed(2)}`)
      setPaidAmount(0); setPaymentRemarks(''); setPaymentMethod(PAYMENT_METHODS.CASH)
      await loadOrders()
    } catch (err) { showToast('error', 'Payment Failed', err.message) }
  }

  const initiateEditOrder = (order) => {
    if (!isAdmin) { showToast('error', 'Not Allowed', 'Only managers can edit orders'); return }
    if (order.status !== ORDER_STATUS.PENDING) { showToast('error', 'Edit Locked', 'Only unpaid pending orders can be edited'); return }
    requirePassword('edit', order)
  }

  const openEditModal = (order) => {
    setEditOrderData(order)
    setEditItems((order.order_items || []).map(it => ({ ...it, originalQuantity: it.quantity })))
    setEditDiscount(order.discount || 0)
    setEditTax(order.tax || 0)
    setShowEditModal(true)
  }

  const editSubtotal = useMemo(() => editItems.reduce((s, i) => s + (i.quantity * i.price), 0), [editItems])
  const editTotal = useMemo(() => Math.max(0, editSubtotal - editDiscount + editTax), [editSubtotal, editDiscount, editTax])

  const updateEditQty = (idx, qty) => {
    if (qty < 1) return
    setEditItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const invItem = inventory.find(p => p.id === it.inventory_id)
      const maxAvailable = (invItem?.quantity || 0) + (it.originalQuantity || 0)
      if (qty > maxAvailable) { showToast('error', 'Stock Limit', `Only ${maxAvailable} units available for "${it.name}"`); return it }
      return { ...it, quantity: qty }
    }))
  }

  const removeEditItem = (idx) => setEditItems(prev => prev.filter((_, i) => i !== idx))

  const saveEditOrder = async () => {
    if (!editOrderData) return
    if (editItems.length === 0) { showToast('error', 'Empty Order', 'Order must have at least one item'); return }
    setProcessing(true)
    try {
      const editIds = editItems.map(i => i.inventory_id)
      const inventoryDiffs = editItems.map(item => ({ inventoryId: item.inventory_id, diff: item.quantity - (item.originalQuantity || 0) }))
      const removedDiffs = (editOrderData.order_items || [])
        .filter(i => !editIds.includes(i.inventory_id))
        .map(i => ({ inventoryId: i.inventory_id, diff: -i.quantity }))

      const { error } = await _editOrder({
        orderId: editOrderData.id,
        updatedOrder: { subtotal: editSubtotal, discount: editDiscount, tax: editTax, total: editTotal },
        updatedItems: editItems.map(i => ({ ...i, subtotal: i.quantity * i.price })),
        inventoryDiffs: [...inventoryDiffs, ...removedDiffs],
        activityLog: {
          branchId: activeBranchId, userId: user?.id, userName: user?.name,
          description: `Order edited: #${editOrderData.invoice_no || editOrderData.id}`,
        },
      })
      if (error) { showToast('error', 'Edit Failed', error.message); return }
      showToast('success', 'Order Updated', `#${editOrderData.invoice_no || editOrderData.id?.slice(0, 8)}`)
      setShowEditModal(false); setEditOrderData(null)
      await Promise.all([loadOrders(), loadInventory()])
    } catch (err) { showToast('error', 'Edit Failed', err.message) }
    finally { setProcessing(false) }
  }

  const printOrderRow = (order) => printReceipt(order, order.order_items || [], user, currentBranch?.name)

  const viewOrderDetails = async (order) => {
    setOrderDetails(order)
    setShowOrderDetailsModal(true)
    if (order?.customer_id) {
      const { data: ledgerData } = await supabase.from('ledger_entries').select('*')
        .eq('customer_id', order.customer_id).eq('branch_id', activeBranchId)
        .order('created_at', { ascending: false })
      setCustomerLedger(ledgerData || [])
    } else setCustomerLedger([])
  }

  const canModifyOrder = (order) => isAdmin && [ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID, ORDER_STATUS.CREDIT].includes(order.status)
  const canEditOrder = (order) => isAdmin && order.status === ORDER_STATUS.PENDING

  /* ── Tab datasets ── */
  const pendingOrders = useMemo(() => {
    let list = orders.filter(o => [ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID, ORDER_STATUS.CREDIT].includes(o.status))
    if (listSearch.trim()) {
      const s = listSearch.toLowerCase()
      list = list.filter(o => o.invoice_no?.toLowerCase().includes(s) || o.customer_name?.toLowerCase().includes(s) || o.id?.toLowerCase().includes(s))
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [orders, listSearch])

  const cancelledOrders = useMemo(() => {
    let list = orders.filter(o => o.status === ORDER_STATUS.CANCELLED)
    if (listSearch.trim()) {
      const s = listSearch.toLowerCase()
      list = list.filter(o => o.invoice_no?.toLowerCase().includes(s) || o.customer_name?.toLowerCase().includes(s) || o.id?.toLowerCase().includes(s))
    }
    return list.sort((a, b) => new Date(b.cancelled_at || b.created_at) - new Date(a.cancelled_at || a.created_at))
  }, [orders, listSearch])

  const reportRows = useMemo(() => {
    let list = orders
    if (reportStart) list = list.filter(o => new Date(o.created_at) >= new Date(reportStart + 'T00:00:00'))
    if (reportEnd) list = list.filter(o => new Date(o.created_at) <= new Date(reportEnd + 'T23:59:59'))
    if (reportCustomer) list = list.filter(o => o.customer_id === reportCustomer)
    if (reportStatus !== 'all') list = list.filter(o => o.status === reportStatus)
    if (reportPaymentType !== 'all') list = list.filter(o =>
      o.payment_type === reportPaymentType ||
      (o.order_payments || []).some(p => p.method === reportPaymentType) ||
      (reportPaymentType === PAYMENT_METHODS.CREDIT && o.status === ORDER_STATUS.CREDIT)
    )
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [orders, reportStart, reportEnd, reportCustomer, reportStatus, reportPaymentType])

  const resetReportFilters = () => {
    setReportStart(todayStr()); setReportEnd(todayStr())
    setReportCustomer(''); setReportStatus('all'); setReportPaymentType('all')
  }

  const exportReportCSV = () => {
    if (reportRows.length === 0) { showToast('info', 'Nothing to Export', 'No orders match the current filters'); return }
    const rows = reportRows.map(o => ({
      Invoice: o.invoice_no || o.id?.slice(0, 8),
      Date: new Date(o.created_at).toLocaleString(),
      Customer: o.customer_name || 'Walk-In',
      Subtotal: (o.subtotal || 0).toFixed(2),
      Discount: (o.discount || 0).toFixed(2),
      Tax: (o.tax || 0).toFixed(2),
      Total: (o.total || 0).toFixed(2),
      Status: o.status,
    }))
    downloadCSV(`pos-report-${reportStart}_to_${reportEnd}.csv`, rows)
    showToast('success', 'Exported', `${rows.length} order(s) exported to CSV`)
  }

  const printReport = () => {
    if (reportRows.length === 0) { showToast('info', 'Nothing to Print', 'No orders match the current filters'); return }
    printOrdersReport(reportRows, `${reportStart} to ${reportEnd} · ${reportRows.length} order(s) · ${currentBranch?.name || ''}`)
  }

  /* ══════════════════════════════════════════════════════════════════════
     ACCESS GATE
     ══════════════════════════════════════════════════════════════════════ */
  if (!hasAccess) {
    return (
      <EmptyState
        icon="Shield"
        title="Access Restricted"
        message={`Your role (${user?.role || 'unknown'}) does not have access to the Point of Sale module. Only Admins, Developers, Managers, and Storekeepers can use POS.`}
      />
    )
  }

  const visibleTabs = TABS.filter(t => !t.adminOnly || hasReportAccess)

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Single tab strip (page title already lives in the global Header) ── */}
      <div className="pos-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="pos-tabs" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {visibleTabs.map(t => {
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                style={{
                  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: active ? theme.primary : theme.cardBg,
                  color: active ? theme.primaryText : theme.textMuted,
                  boxShadow: active ? `0 4px 12px ${theme.primary}40` : theme.shadow,
                  border: `1px solid ${active ? theme.primary : theme.border}`,
                  transition: 'all 0.15s',
                }}>
                <Ic n={t.icon} size={15} color={active ? theme.primaryText : theme.textMuted} />
                {t.label}
                {t.key === 'pending' && pendingOrders.length > 0 && (
                  <span style={{ background: active ? 'rgba(255,255,255,0.25)' : theme.navActive, color: active ? '#fff' : theme.primary, borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                    {pendingOrders.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="pos-user-summary" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: theme.textMuted }}>{currentBranch?.name || user?.branch_name || ''}</span>
          <span style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: isAdmin ? theme.primary : theme.success, color: '#fff',
          }}>
            {user?.name || 'User'} — {isAdmin ? 'Manager' : 'Storekeeper'}
          </span>
        </div>
      </div>

      {/* ═══════════════════════ NEW ORDER TAB ═══════════════════════ */}
      {activeTab === 'new_order' && (
        <div className="pos-order-layout" style={{ display: 'flex', height: 'calc(100vh - 160px)', minHeight: 480, background: theme.bg, borderRadius: 12, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
          {/* Products */}
          <div className="pos-products-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: theme.bg, borderRight: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            <div className="pos-product-filters" style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', gap: 10, alignItems: 'center', background: theme.cardBg }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                <input type="text" placeholder="Search products by name, SKU, or barcode..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px 10px 36px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, background: theme.inputBg, color: theme.text, fontSize: 14, outline: 'none' }} />
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }}>
                  <Ic n="Search" size={14} />
                </span>
              </div>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ padding: '10px 14px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, background: theme.inputBg, color: theme.text, fontSize: 14, cursor: 'pointer', minWidth: 150 }}>
                {categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>)}
              </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {filteredInventory.length === 0 ? (
                <EmptyState icon="Package" title="No products found" message="Try adjusting your search or category filter" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {filteredInventory.map(product => {
                    const inCart = cart.find(c => c.id === product.id)
                    const stock = product.quantity || 0
                    const lowStock = stock > 0 && stock <= 5
                    const badge = stock === 0
                      ? { bg: theme.rejected, color: theme.rejectedText, label: 'Out of Stock' }
                      : lowStock ? { bg: theme.pending, color: theme.pendingText, label: `Low: ${stock}` }
                        : { bg: theme.completed, color: theme.completedText, label: `Stock: ${stock}` }
                    return (
                      <div key={product.id} onClick={() => stock > 0 && addToCart(product)} className="card-hover"
                        style={{
                          background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14,
                          cursor: stock > 0 ? 'pointer' : 'not-allowed', opacity: stock > 0 ? 1 : 0.55,
                          position: 'relative', boxShadow: theme.shadow, transition: 'all 0.15s',
                        }}>
                        <div style={{ position: 'absolute', top: 10, right: 10, padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 4, lineHeight: 1.3, paddingRight: 70 }}>{product.name}</div>
                          {product.sku && <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>SKU: {product.sku}</div>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: theme.primary }}>Rs. {product.selling_price?.toFixed(2) || '0.00'}</span>
                            {inCart && <span style={{ background: theme.primary, color: theme.primaryText, padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>In Cart: {inCart.qty}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="pos-cart-pane" style={{ width: 400, display: 'flex', flexDirection: 'column', background: theme.cardBg }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ic n="ShoppingCart" size={16} /> Cart ({cart.length})
              </h2>
              {cart.length > 0 && <Btn variant="danger" onClick={clearCart} style={{ padding: '6px 12px', fontSize: 12 }}>Clear All</Btn>}
            </div>

            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer / Branch</label>
                <Btn variant="success" onClick={() => setShowCreateCustomerModal(true)} style={{ padding: '4px 10px', fontSize: 11 }}>+ New</Btn>
              </div>
              <select value={selectedCustomer ? `${selectedCustomer._partyType || 'customer'}:${selectedCustomer.id}` : 'walkin'} onChange={(e) => {
                const val = e.target.value
                if (val === 'walkin' || val === '') setSelectedCustomer(null)
                else {
                  const [partyType, partyId] = val.split(':')
                  const found = partyType === 'branch' ? branches.find(b => b.id === partyId) : customers.find(c => c.id === partyId)
                  setSelectedCustomer(found ? { ...found, _partyType: partyType } : null)
                }
              }} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, background: theme.inputBg, color: theme.text, fontSize: 14, cursor: 'pointer' }}>
                <option value="walkin">Walk-In Customer</option>
                {customers.length > 0 && (
                  <optgroup label="Customers">
                    {customers.map(c => <option key={c.id} value={`customer:${c.id}`}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                  </optgroup>
                )}
                {branches.length > 0 && (
                  <optgroup label="Branches">
                    {branches.map(b => <option key={b.id} value={`branch:${b.id}`}>{b.name} {b.address ? `- ${b.address}` : ''}</option>)}
                  </optgroup>
                )}
              </select>
              {customersLoading && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Loading customers...</div>}
              {branchesLoading && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Loading branches...</div>}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', background: theme.bg }}>
              {cart.length === 0 ? (
                <EmptyState icon="ShoppingCart" title="Your cart is empty" message="Click products on the left to add them" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ background: theme.cardBg, padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, lineHeight: 1.3 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>Rs. {item.price?.toFixed(2)} / {item.unit}</div>
                        </div>
                        <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', color: theme.danger, border: 'none', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 28, height: 28, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 16, color: theme.text }}>−</button>
                        <input type="number" min="1" value={item.qty} onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                          style={{ width: 50, textAlign: 'center', padding: 6, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, background: theme.inputBg, color: theme.text, fontSize: 14, fontWeight: 600 }} />
                        <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 28, height: 28, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 16, color: theme.text }}>+</button>
                        <div style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: 700, color: theme.primary }}>Rs. {(item.qty * item.price).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ padding: '14px 20px', borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, background: theme.cardBg }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Discount (Rs)</label>
                    <input type="number" min="0" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, background: theme.inputBg, color: theme.text, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Tax Rate (%)</label>
                    <input type="number" min="0" max="100" value={taxRate || ''} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, background: theme.inputBg, color: theme.text, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
            )}

            {cart.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, background: theme.cardBg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: theme.textMuted }}>Subtotal:</span><span style={{ fontWeight: 600, color: theme.text }}>Rs. {subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span style={{ color: theme.textMuted }}>Discount:</span><span style={{ fontWeight: 600, color: theme.success }}>−Rs. {discount.toFixed(2)}</span></div>}
                {tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span style={{ color: theme.textMuted }}>Tax:</span><span style={{ fontWeight: 600, color: theme.text }}>Rs. {tax.toFixed(2)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0', borderTop: `2px solid ${theme.border}`, marginTop: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>GRAND TOTAL</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: theme.primary }}>Rs. {total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div style={{ padding: '14px 20px', display: 'flex', gap: 8, background: theme.cardBg }}>
              <Btn variant="danger" onClick={clearCart} disabled={cart.length === 0} style={{ padding: '10px 14px' }}>Clear</Btn>
              {cart.length > 0 && (
                <Btn variant={isStorekeeper && !isAdmin ? 'success' : 'primary'} onClick={placeOrder} disabled={processing} style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}>
                  {processing ? 'Processing...' : (isAdmin && !isStorekeeper ? 'Complete Sale' : 'Place Order')}
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ PENDING ORDERS TAB ═══════════════════════ */}
      {activeTab === 'pending' && (
        <OrdersListView
          theme={theme} title="Pending Orders" icon="ClipboardList"
          orders={pendingOrders} loading={ordersLoading}
          search={listSearch} onSearch={setListSearch}
          StatusBadge={StatusBadge}
          emptyTitle="No pending orders" emptyMessage="All orders have been processed"
          renderActions={(order) => (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn variant="outline" onClick={() => viewOrderDetails(order)} style={{ padding: '5px 10px', fontSize: 11 }}>View</Btn>
              <Btn variant="outline" onClick={() => printOrderRow(order)} style={{ padding: '5px 10px', fontSize: 11 }}>Print</Btn>
              {canModifyOrder(order) && (
                <>
                  {canEditOrder(order) && <Btn variant="warning" onClick={() => initiateEditOrder(order)} style={{ padding: '5px 10px', fontSize: 11 }}>Edit</Btn>}
                  {order.status === ORDER_STATUS.PENDING && (
                    <Btn variant="success" onClick={() => initiateCompleteOrder(order)} style={{ padding: '5px 10px', fontSize: 11 }}>Complete</Btn>
                  )}
                  <Btn variant="primary" onClick={() => initiatePayment(order)} style={{ padding: '5px 10px', fontSize: 11 }}>Pay</Btn>
                  <Btn variant="danger" onClick={() => initiateCancel(order.id)} style={{ padding: '5px 10px', fontSize: 11 }}>Cancel</Btn>
                </>
              )}
            </div>
          )}
        />
      )}

      {/* ═══════════════════════ CANCELLED ORDERS TAB ═══════════════════════ */}
      {activeTab === 'cancelled' && (
        <OrdersListView
          theme={theme} title="Cancelled Orders" icon="AlertTriangle"
          orders={cancelledOrders} loading={ordersLoading}
          search={listSearch} onSearch={setListSearch}
          StatusBadge={StatusBadge}
          emptyTitle="No cancelled orders" emptyMessage="No orders have been cancelled"
          faded
          renderActions={(order) => (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn variant="outline" onClick={() => viewOrderDetails(order)} style={{ padding: '5px 10px', fontSize: 11 }}>View</Btn>
              <Btn variant="outline" onClick={() => printOrderRow(order)} style={{ padding: '5px 10px', fontSize: 11 }}>Print</Btn>
            </div>
          )}
          extraColumn={{ label: 'Cancelled By', render: (o) => o.cancelled_by_name || '—' }}
        />
      )}

      {/* ═══════════════════════ REPORTS TAB ═══════════════════════ */}
      {activeTab === 'reports' && hasReportAccess && (
        <div>
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: theme.shadow }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: '0 0 16px' }}>Filter Orders</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              <Input label="Start Date" type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} />
              <Input label="End Date" type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
              <Select label="Customer" value={reportCustomer} onChange={e => setReportCustomer(e.target.value)}>
                <option value="">All Customers</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Payment Method" value={reportPaymentType} onChange={e => setReportPaymentType(e.target.value)}>
                <option value="all">All</option>
                <option value={PAYMENT_METHODS.CASH}>Cash</option>
                <option value={PAYMENT_METHODS.CARD}>Card</option>
                <option value={PAYMENT_METHODS.BANK_TRANSFER}>Bank Transfer</option>
                <option value={PAYMENT_METHODS.CREDIT}>Credit</option>
              </Select>
              <Select label="Order Status" value={reportStatus} onChange={e => setReportStatus(e.target.value)}>
                <option value="all">All</option>
                <option value={ORDER_STATUS.PENDING}>Pending</option>
                <option value={ORDER_STATUS.PARTIALLY_PAID}>Partially Paid</option>
                <option value={ORDER_STATUS.PAID}>Paid</option>
                <option value={ORDER_STATUS.CREDIT}>Credit</option>
                <option value={ORDER_STATUS.COMPLETED}>Completed</option>
                <option value={ORDER_STATUS.CANCELLED}>Cancelled</option>
              </Select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
              <Btn variant="outline" onClick={resetReportFilters}>Reset</Btn>
              <Btn variant="primary" onClick={loadOrders} disabled={ordersLoading}>{ordersLoading ? 'Loading...' : 'Refresh'}</Btn>
            </div>
          </div>

          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: theme.shadow }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 14, color: theme.textMuted, fontWeight: 600 }}>
                Showing {reportRows.length} order(s) — Rs. {reportRows.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)} total
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn variant="outline" onClick={exportReportCSV} style={{ padding: '6px 12px', fontSize: 12 }}>
                  <Ic n="Download" size={13} /> Export CSV
                </Btn>
                <Btn variant="outline" onClick={printReport} style={{ padding: '6px 12px', fontSize: 12 }}>
                  <Ic n="Printer" size={13} /> Print
                </Btn>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: theme.tableHeaderBg, borderBottom: `2px solid ${theme.border}` }}>
                    {['Invoice', 'Order Time', 'Customer', 'Bill', 'Disc', 'Tax', 'Grand Total', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: theme.tableHeaderText, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 0 }}><EmptyState icon="FileText" title="No data found" message="Adjust the filters above and press Refresh" /></td></tr>
                  ) : (
                    reportRows.map((order, i) => (
                      <tr key={order.id} style={{ background: i % 2 === 0 ? theme.cardBg : theme.tableRowAlt, borderBottom: `1px solid ${theme.borderLight}` }}>
                        <td style={{ padding: '10px 12px', color: theme.primary, fontWeight: 700 }}>#{order.invoice_no || order.id?.slice(0, 8)}</td>
                        <td style={{ padding: '10px 12px', color: theme.textMuted, whiteSpace: 'nowrap' }}>{new Date(order.created_at).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', color: theme.text }}>{order.customer_name || 'Walk-In'}</td>
                        <td style={{ padding: '10px 12px', color: theme.text, fontWeight: 700 }}>Rs. {(order.subtotal || 0).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', color: theme.success }}>{order.discount > 0 ? `Rs. ${order.discount.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '10px 12px', color: theme.text }}>{order.tax > 0 ? `Rs. ${order.tax.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '10px 12px', color: theme.primary, fontWeight: 800 }}>Rs. {(order.total || 0).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px' }}><StatusBadge status={order.status} /></td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Btn variant="outline" onClick={() => viewOrderDetails(order)} style={{ padding: '4px 8px', fontSize: 11 }}>View</Btn>
                            <Btn variant="outline" onClick={() => printOrderRow(order)} style={{ padding: '4px 8px', fontSize: 11 }}>Print</Btn>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════════ */}

      <Modal open={showCreateCustomerModal} onClose={() => setShowCreateCustomerModal(false)} title="New Customer" width={420}>
        <Input label="Full Name *" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="e.g. Ali Raza" />
        <Input label="Phone" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
        <Input label="Email" type="email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} />
        <Input label="Address" value={newCustomerAddress} onChange={e => setNewCustomerAddress(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn variant="outline" onClick={() => setShowCreateCustomerModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn variant="success" onClick={handleCreateCustomer} disabled={creatingCustomer} style={{ flex: 1, justifyContent: 'center' }}>
            {creatingCustomer ? 'Creating...' : 'Create Customer'}
          </Btn>
        </div>
      </Modal>

      <Modal open={showPasswordModal} onClose={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(''); setPendingAction(null); setPendingActionData(null) }} title="Manager Verification" width={360}>
        <p style={{ fontSize: 13, color: theme.textMuted, margin: '0 0 16px' }}>Enter your password to confirm this action</p>
        <Input type="password" placeholder="Password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && verifyPasswordAndExecute()} error={passwordError} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn variant="outline" onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(''); setPendingAction(null); setPendingActionData(null) }} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn variant="primary" onClick={verifyPasswordAndExecute} disabled={processing} style={{ flex: 1, justifyContent: 'center' }}>
            {processing ? 'Verifying...' : 'Confirm'}
          </Btn>
        </div>
      </Modal>

      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Process Payment" width={400}>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: '0 0 8px' }}>Order: #{selectedOrder?.invoice_no || selectedOrder?.id?.slice(0, 8)}</p>
        <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: theme.text }}>Due: Rs. {(selectedOrder?.due_amount ?? selectedOrder?.total ?? 0).toFixed(2)}</p>
        <Select label="Payment Method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
          <option value={PAYMENT_METHODS.CASH}>Cash</option>
          <option value={PAYMENT_METHODS.CARD}>Card</option>
          <option value={PAYMENT_METHODS.BANK_TRANSFER}>Bank Transfer</option>
        </Select>
        <Input label="Amount Paid" type="number" min="0" max={selectedOrder?.due_amount ?? selectedOrder?.total ?? 0} step="0.01" value={paidAmount} onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)} />
        <Input label="Remarks" value={paymentRemarks} onChange={e => setPaymentRemarks(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn variant="outline" onClick={() => setShowPaymentModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn variant="primary" onClick={confirmPayment} style={{ flex: 1, justifyContent: 'center' }}>Confirm Payment</Btn>
        </div>
      </Modal>

      <Modal open={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Complete Order" width={400}>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: '0 0 8px' }}>Order: #{completeOrderData?.invoice_no || completeOrderData?.id?.slice(0, 8)}</p>
        <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: theme.text }}>Total: Rs. {completeOrderData?.total?.toFixed(2)}</p>
        <Select label="Payment Method" value={completePaymentMethod} onChange={e => {
          const method = e.target.value
          setCompletePaymentMethod(method)
          setCompletePaidAmount(method === PAYMENT_METHODS.CREDIT ? 0 : (completeOrderData?.due_amount ?? completeOrderData?.total ?? 0))
        }}>
          <option value={PAYMENT_METHODS.CASH}>Cash</option>
          <option value={PAYMENT_METHODS.CARD}>Card</option>
          <option value={PAYMENT_METHODS.BANK_TRANSFER}>Bank Transfer</option>
          <option value={PAYMENT_METHODS.CREDIT}>Credit</option>
        </Select>
        <Input label="Amount Paid" type="number" min="0" max={completeOrderData?.due_amount ?? completeOrderData?.total ?? 0} step="0.01" value={completePaidAmount} disabled={completePaymentMethod === PAYMENT_METHODS.CREDIT} onChange={e => setCompletePaidAmount(parseFloat(e.target.value) || 0)} />
        <Input label="Remarks" value={completeRemarks} onChange={e => setCompleteRemarks(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn variant="outline" onClick={() => setShowCompleteModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn variant="success" onClick={confirmCompleteOrder} style={{ flex: 1, justifyContent: 'center' }}>Complete Order</Btn>
        </div>
      </Modal>

      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Order" width={400}>
        <p style={{ fontSize: 13, color: theme.textMuted, margin: '0 0 16px' }}>This action cannot be undone. Inventory will be restored.</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Cancellation Reason *</label>
          <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
            style={{ width: '100%', padding: '8px 12px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, background: theme.inputBg, color: theme.text, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="outline" onClick={() => setShowCancelModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Back</Btn>
          <Btn variant="danger" onClick={confirmCancel} style={{ flex: 1, justifyContent: 'center' }}>Confirm Cancel</Btn>
        </div>
      </Modal>

      <Modal open={showEditModal && !!editOrderData} onClose={() => setShowEditModal(false)} title="Edit Order" width={560}>
        {editOrderData && (
          <>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: '0 0 16px' }}>Order: #{editOrderData.invoice_no || editOrderData.id?.slice(0, 8)}</p>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: theme.tableHeaderBg }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: theme.tableHeaderText, fontSize: 11 }}>Item</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: theme.tableHeaderText, fontSize: 11 }}>Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: theme.tableHeaderText, fontSize: 11 }}>Price</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: theme.tableHeaderText, fontSize: 11 }}>Total</th>
                    <th style={{ padding: '8px 10px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                      <td style={{ padding: '8px 10px', color: theme.text }}>{item.name}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => updateEditQty(idx, item.quantity - 1)} style={{ width: 22, height: 22, border: `1px solid ${theme.border}`, background: theme.bg, borderRadius: 4, cursor: 'pointer', color: theme.text }}>−</button>
                          <span style={{ minWidth: 20, display: 'inline-block', textAlign: 'center', color: theme.text }}>{item.quantity}</span>
                          <button onClick={() => updateEditQty(idx, item.quantity + 1)} style={{ width: 22, height: 22, border: `1px solid ${theme.border}`, background: theme.bg, borderRadius: 4, cursor: 'pointer', color: theme.text }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: theme.text }}>Rs. {item.price?.toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: theme.text }}>Rs. {(item.quantity * item.price).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button onClick={() => removeEditItem(idx)} style={{ background: 'transparent', color: theme.danger, border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <Input label="Discount (Rs)" type="number" min="0" value={editDiscount || ''} onChange={e => setEditDiscount(parseFloat(e.target.value) || 0)} style={{ marginBottom: 0 }} />
              <Input label="Tax (Rs)" type="number" min="0" value={editTax || ''} onChange={e => setEditTax(parseFloat(e.target.value) || 0)} style={{ marginBottom: 0 }} />
            </div>
            <div style={{ borderTop: `2px solid ${theme.border}`, paddingTop: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: theme.textMuted }}>Subtotal:</span><span style={{ fontWeight: 600, color: theme.text }}>Rs. {editSubtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: theme.text }}>
                <span>New Total</span><span>Rs. {editTotal.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="outline" onClick={() => setShowEditModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn variant="warning" onClick={saveEditOrder} disabled={processing} style={{ flex: 1, justifyContent: 'center' }}>
                {processing ? 'Saving...' : 'Save Changes'}
              </Btn>
            </div>
          </>
        )}
      </Modal>

      <Modal open={showOrderDetailsModal && !!orderDetails} onClose={() => setShowOrderDetailsModal(false)} title="Order Details" width={520}>
        {orderDetails && (
          <>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, marginTop: -12 }}>
              <Btn variant="outline" onClick={() => printOrderRow(orderDetails)} style={{ padding: '6px 10px', fontSize: 11 }}>Print</Btn>
              {canEditOrder(orderDetails) && (
                <Btn variant="warning" onClick={() => { setShowOrderDetailsModal(false); initiateEditOrder(orderDetails) }} style={{ padding: '6px 10px', fontSize: 11 }}>Edit</Btn>
              )}
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: theme.bg, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: theme.textMuted }}>Invoice:</span><span style={{ fontWeight: 600, color: theme.text }}>#{orderDetails.invoice_no || orderDetails.id?.slice(0, 8)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: theme.textMuted }}>Customer:</span><span style={{ fontWeight: 600, color: theme.text }}>{orderDetails.customer_name || 'Walk-In'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: theme.textMuted }}>Date:</span><span style={{ color: theme.text }}>{new Date(orderDetails.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: theme.textMuted }}>Status:</span><StatusBadge status={orderDetails.status} />
              </div>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: theme.text }}>Items</h4>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: theme.tableHeaderBg }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: theme.tableHeaderText, fontSize: 11 }}>Item</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: theme.tableHeaderText, fontSize: 11 }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: theme.tableHeaderText, fontSize: 11 }}>Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: theme.tableHeaderText, fontSize: 11 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(orderDetails.order_items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                      <td style={{ padding: '8px 12px', color: theme.text }}>{item.name || `Item #${idx + 1}`}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: theme.text }}>{item.quantity}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: theme.text }}>Rs. {item.price?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: theme.text }}>Rs. {(item.quantity * item.price)?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: `2px solid ${theme.border}`, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: theme.textMuted }}>Subtotal:</span><span style={{ fontWeight: 600, color: theme.text }}>Rs. {orderDetails.subtotal?.toFixed(2)}</span>
              </div>
              {orderDetails.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span style={{ color: theme.textMuted }}>Discount:</span><span style={{ fontWeight: 600, color: theme.success }}>−Rs. {orderDetails.discount?.toFixed(2)}</span></div>}
              {orderDetails.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span style={{ color: theme.textMuted }}>Tax:</span><span style={{ fontWeight: 600, color: theme.text }}>Rs. {orderDetails.tax?.toFixed(2)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: theme.text }}>
                <span>Total</span><span>Rs. {orderDetails.total?.toFixed(2)}</span>
              </div>
            </div>

            {orderDetails?.customer_id && customerLedger.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: theme.text }}>Customer Ledger</h4>
                <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: theme.tableHeaderBg }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: theme.tableHeaderText, fontSize: 10 }}>Date</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: theme.tableHeaderText, fontSize: 10 }}>Type</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: theme.tableHeaderText, fontSize: 10 }}>Amount</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: theme.tableHeaderText, fontSize: 10 }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerLedger.map((entry, idx) => (
                        <tr key={idx} style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                          <td style={{ padding: '6px 10px', color: theme.text }}>{new Date(entry.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: entry.amount >= 0 ? theme.completed : theme.rejected, color: entry.amount >= 0 ? theme.completedText : theme.rejectedText }}>
                              {entry.type}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: entry.amount >= 0 ? theme.success : theme.danger }}>Rs. {Math.abs(entry.amount).toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: theme.text }}>Rs. {entry.balance_after?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared list view for Pending / Cancelled tabs
   ═══════════════════════════════════════════════════════════════════════════ */
function OrdersListView({ theme, title, icon, orders, loading, search, onSearch, StatusBadge, emptyTitle, emptyMessage, renderActions, faded, extraColumn }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ic n={icon} size={18} /> {title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="text" placeholder="Search invoice, customer..." value={search} onChange={e => onSearch(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${theme.inputBorder}`, borderRadius: 8, background: theme.inputBg, color: theme.text, fontSize: 13, minWidth: 220 }} />
          <div style={{ padding: '6px 14px', background: theme.cardBg, borderRadius: 20, color: theme.textMuted, fontSize: 13, border: `1px solid ${theme.border}`, fontWeight: 600 }}>
            {orders.length} order{orders.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted }}>Loading orders...</div>
      ) : orders.length === 0 ? (
        <div style={{ background: theme.cardBg, borderRadius: 12, border: `1px solid ${theme.border}` }}>
          <EmptyState icon={icon} title={emptyTitle} message={emptyMessage} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(order => (
            <div key={order.id} style={{
              background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 18,
              boxShadow: theme.shadow, opacity: faded ? 0.9 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
                    Order #{order.invoice_no || order.id?.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 13, color: theme.textMuted }}>
                    {new Date(order.created_at).toLocaleString()} · {order.customer_name || 'Walk-In'}
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div style={{ display: 'flex', gap: 24, marginBottom: 14, fontSize: 13, flexWrap: 'wrap' }}>
                <div><span style={{ color: theme.textMuted }}>Items: </span><span style={{ color: theme.text, fontWeight: 700 }}>{order.order_items?.length || 0}</span></div>
                <div><span style={{ color: theme.textMuted }}>Total: </span><span style={{ color: theme.primary, fontWeight: 800 }}>Rs. {(order.total || 0).toFixed(2)}</span></div>
                {order.due_amount > 0 && <div><span style={{ color: theme.textMuted }}>Due: </span><span style={{ color: theme.danger, fontWeight: 700 }}>Rs. {order.due_amount.toFixed(2)}</span></div>}
                <div><span style={{ color: theme.textMuted }}>By: </span><span style={{ color: theme.text }}>{order.created_by_name || 'Unknown'}</span></div>
                {extraColumn && <div><span style={{ color: theme.textMuted }}>{extraColumn.label}: </span><span style={{ color: theme.text }}>{extraColumn.render(order)}</span></div>}
              </div>

              {order.cancellation_reason && (
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12, fontStyle: 'italic' }}>
                  Reason: {order.cancellation_reason}
                </div>
              )}

              <div style={{ paddingTop: 12, borderTop: `1px solid ${theme.borderLight}` }}>
                {renderActions(order)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
