
import { useState, useMemo, useCallback, useEffect, Fragment } from 'react'
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
    price: item.price,
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
    }]);

  if (paymentError) {
    console.warn('[POS] payment error:', paymentError);
  }
}
 if (ledgerEntry) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("Current Auth User:", user);
  console.log("Ledger Entry:", ledgerEntry);

  const { data, error: ledgerErr } = await supabase
    .from("ledger_entries")
    .insert([{
      ...ledgerEntry,
      created_at: _now(),
    }])
    .select();

  console.log("Insert Result:", data);

  if (ledgerErr) {
    console.error("Ledger Error:", ledgerErr);
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
      }]);

    if (error) throw error;
  } catch (err) {
    console.warn('[POS] payment error:', err);
  }
}
  if (ledgerEntry) {
    const { error: ledgerErr } = await supabase.from('ledger_entries').insert([{ ...ledgerEntry, created_at: _now() }])
    if (ledgerErr) console.error('[POS] ledger insert error:', ledgerErr.message, ledgerErr.details)
  }
  if (activityLog) await _logPosActivity({ ...activityLog, action: 'Payment Processed' })
  return { data: orderData, error: null }
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

async function _getCustomerBalance(customerId) {
  if (!customerId) return 0
  const { data } = await supabase
    .from('ledger_entries')
    .select('amount')
    .eq('customer_id', customerId)
  return (data || []).reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0)
}

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
    .item { display: flex; justify-content: space-between; }
    .item-name { flex: 1; }
    .item-qty { width: 30px; text-align: center; }
    .item-price { width: 60px; text-align: right; }
    .item-total { width: 60px; text-align: right; }
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
      <span style="width:60px; text-align:right;">${item.price?.toFixed(2)}</span>
      <span style="width:60px; text-align:right;">${(item.quantity * item.price)?.toFixed(2)}</span>
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

export default function POS() {
  const { user, branch, theme } = useApp()

  const userRole = (user?.role || user?.user_role || user?.type || 'storekeeper').toLowerCase()
  const isStorekeeper = ['storekeeper', 'staff', 'cashier'].includes(userRole)
  const isAdmin = ['admin', 'manager', 'developer', 'superadmin', 'owner'].includes(userRole)

  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
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

  const [showOrdersModal, setShowOrdersModal] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderFilter, setOrderFilter] = useState('all')
  const [orderSearch, setOrderSearch] = useState('')

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

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmMessage, setConfirmMessage] = useState('')

  const colors = {
    bg: '#f8f9fa', panelBg: '#ffffff', sidebar: '#ffffff', text: '#1a1a2e',
    muted: '#6c757d', border: '#e9ecef', accent: '#0d6efd', accentHover: '#0b5ed7',
    success: '#198754', danger: '#dc3545', warning: '#ffc107', info: '#0dcaf0',
    purple: '#6f42c1', orange: '#fd7e14', darkBlue: '#2c3e50',
    tableHeader: '#f8f9fa', tableBorder: '#dee2e6',
  }

  // Toast helpers
  const showError = useCallback((msg) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 4000)
  }, [])

  const showSuccess = useCallback((msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }, [])

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

  useEffect(() => {
    const load = async () => {
      if (!user?.branch_id) return
      const { data, error } = await inventoryApi.getAll(user.branch_id)
      if (error) console.error('[POS] inventory error:', error.message)
      else setInventory(data || [])
    }
    load()
  }, [user?.branch_id])

  useEffect(() => {
    const loadBranches = async () => {
      setBranchesLoading(true)
      try {
        const { data, error } = await supabase.from('branches').select('*')
        if (error) console.error('[POS] branches error:', error.message)
        else setBranches(data || [])
      } catch (err) { console.error('[POS] branches load failed:', err) }
      finally { setBranchesLoading(false) }
    }
    loadBranches()
  }, [])

  useEffect(() => {
    const loadCustomers = async () => {
      setCustomersLoading(true)
      try {
        const { data, error } = await supabase.from('customers').select('*').order('name')
        if (error) console.error('[POS] customers error:', error.message)
        else setCustomers(data || [])
      } catch (err) { console.error('[POS] customers load failed:', err) }
      finally { setCustomersLoading(false) }
    }
    loadCustomers()
  }, [])

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) { showError('Customer name is required'); return }
    setCreatingCustomer(true)
    try {
      const payload = {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
        email: newCustomerEmail.trim() || null,
        address: newCustomerAddress.trim() || null,
      }
      const { data, error } = await supabase.from('customers').insert([payload]).select().single()
      if (error) { showError('Failed to create customer: ' + error.message); return }

      const newCust = data?.[0] || data
      if (newCust) {
        setCustomers(prev => [...prev, newCust].sort((a, b) => a.name?.localeCompare(b.name)))
        setSelectedCustomer(newCust)
      }
      setShowCreateCustomerModal(false)
      setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail(''); setNewCustomerAddress('')
      showSuccess('Customer created successfully!')
    } catch (err) {
      console.error('[Create Customer] Error:', err)
      showError('Error creating customer: ' + (err.message || 'Unknown error'))
    }
    finally { setCreatingCustomer(false) }
  }

  const loadOrders = useCallback(async () => {
    if (!user?.branch_id) return
    setOrdersLoading(true)
    try {
      const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('branch_id', user.branch_id).order('created_at', { ascending: false })
      if (error) showError('Failed to load orders')
      else setOrders(data || [])
    } catch (err) { showError('Error loading orders') }
    finally { setOrdersLoading(false) }
  }, [user?.branch_id, showError])

  useEffect(() => { if (showOrdersModal) loadOrders() }, [showOrdersModal, loadOrders])

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(x => x.id === product.id)
      const maxStock = product.quantity || 0
      if (existing) {
        if (existing.qty >= maxStock) { showError(`Only ${maxStock} in stock for "${product.name}"`); return prev }
        return prev.map(x => x.id === product.id ? { ...x, qty: Math.min(x.qty + 1, maxStock) } : x)
      }
      if (maxStock <= 0) { showError(`"${product.name}" is out of stock`); return prev }
      return [...prev, { id: product.id, name: product.name, qty: 1, price: product.selling_price || 0, unit: product.unit || 'unit', inventory_id: product.id, sku: product.sku || '', category: product.category || '' }]
    })
  }, [showError])

  const updateQty = useCallback((id, qty) => {
    if (qty < 1) return
    const product = inventory.find(p => p.id === id)
    const maxStock = product ? product.quantity || 0 : Infinity
    if (qty > maxStock) { showError(`Only ${maxStock} units available`); return }
    setCart(prev => prev.map(x => x.id === id ? { ...x, qty } : x))
  }, [inventory, showError])

  const removeItem = useCallback((id) => { setCart(prev => prev.filter(x => x.id !== id)) }, [])
  const clearCart = useCallback(() => { setCart([]); setSelectedCustomer(null); setDiscount(0); setTaxRate(0) }, [])

  // ========================
  // PASSWORD VERIFICATION
  // ========================
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
      }
      setShowPasswordModal(false); setPasswordInput(''); setPendingAction(null); setPendingActionData(null)
    } catch (err) { showError('Action failed: ' + err.message) }
    finally { setProcessing(false) }
  }

  const requirePassword = (action, data) => {
    if (!isAdmin) { showError('Only managers can perform this action'); return }
    setPendingAction(action); setPendingActionData(data); setShowPasswordModal(true)
  }

  // ========================
  // CONFIRMATION DIALOG
  // ========================
  const askConfirm = (message, action) => {
    setConfirmMessage(message)
    setConfirmAction(() => action)
    setShowConfirmModal(true)
  }

  const handleConfirm = () => {
    if (confirmAction) confirmAction()
    setShowConfirmModal(false)
    setConfirmAction(null)
    setConfirmMessage('')
  }

  // ========================
  // ORDER WORKFLOW
  // ========================

  const placeOrder = async () => {
    if (!selectedCustomer && !confirm('No customer selected. Continue as Walk-In?')) return
    if (cart.length === 0) { showError('Cart is empty'); return }

    askConfirm(
      `Place order for ${selectedCustomer?.name || 'Walk-In'}?\\nTotal: Rs. ${total.toFixed(2)}\\n${cart.length} item(s) in cart.`,
      async () => {
        setProcessing(true)
        try {
          const saleData = {
            branch_id: user?.branch_id,
            customer_id: selectedCustomer?.id || null,
            customer_name: selectedCustomer?.name || 'Walk-In',
            subtotal,
            tax,
            discount,
            total,
            status: ORDER_STATUS.PENDING,
            created_by: user?.id,
            created_by_name: user?.name,
          }
          const saleItems = cart.map(item => ({
            inventory_id: item.inventory_id,
            quantity: item.qty,
            price: item.price,
            subtotal: item.qty * item.price,
            name: item.name,
          }))
          const inventoryUpdates = cart.map(item => ({
            inventoryId: item.inventory_id,
            quantity: item.qty
          }))

          const { data, error } = await _placeOrder({
            sale: saleData,
            saleItems,
            inventoryUpdates,
            activityLog: {
              branchId: user?.branch_id,
              userId: user?.id,
              userName: user?.name,
              description: `Order placed: ${cart.length} items, Total: ${total}`
            },
          })
          if (error) { 
            console.error('[POS] placeOrder error:', error)
            showError('Order failed: ' + (error.message || error.details || 'Unknown error')); 
            return 
          }
          showSuccess('Order placed successfully!')
          clearCart()
          await loadOrders()

          if (data) {
            printReceipt(data, saleItems, user)
          }
        } catch (err) { 
          console.error('[POS] placeOrder exception:', err)
          showError('Error placing order: ' + (err.message || 'Unknown error')) 
        }
        finally { setProcessing(false) }
      }
    )
  }

  const initiateCompleteOrder = (order) => {
    if (!isAdmin) { showError('Only managers can complete orders'); return }
    setCompleteOrderData(order)
    setCompletePaidAmount(order.total || 0)
    setCompletePaymentMethod(PAYMENT_METHODS.CASH)
    setCompleteRemarks('')
    setShowCompleteModal(true)
  }

  const confirmCompleteOrder = () => {
    setShowCompleteModal(false)
    requirePassword('complete', completeOrderData.id)
  }

  const doCompleteOrder = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) { showError('Order not found'); return }

      const totalDue = order.total || 0
      const paid = completePaidAmount || totalDue
      const newDue = Math.max(0, totalDue - paid)
      const finalStatus = newDue > 0
        ? ORDER_STATUS.PARTIALLY_PAID
        : (completePaymentMethod === PAYMENT_METHODS.CREDIT ? ORDER_STATUS.CREDIT : ORDER_STATUS.PAID)

      // Auto-create ledger entry for payment
      const ledgerEntry = {
        customer_id: order.customer_id,
        branch_id: user?.branch_id,
        amount: paid,
        type: 'payment',
        description: `Payment received - ${completePaymentMethod} - Order #${order.invoice_no || order.id}`,
        order_id: order.id,
        balance_after: newDue,
      }

      const { data, error } = await _completeOrder({
        orderId,
        status: finalStatus,
        payment: {
          amount: paid,
          method: completePaymentMethod,
          remarks: completeRemarks,
        },
        paid_amount: paid,
        due_amount: newDue,
        completed_by: user?.id,
        completed_by_name: user?.name,
        ledgerEntry,
        activityLog: {
          branchId: user?.branch_id,
          userId: user?.id,
          userName: user?.name,
          description: `Order completed: #${order.invoice_no || order.id} - Paid: ${paid} via ${completePaymentMethod}`
        },
      })
      if (error) { showError('Completion failed: ' + error.message); return }
      showSuccess('Order completed successfully!')
      setCompleteOrderData(null)
      await loadOrders()
    } catch (err) { showError('Completion error: ' + err.message) }
  }

  const initiateCancel = (orderId) => {
    if (!isAdmin) { showError('Only managers can cancel orders'); return }
    setCancelOrderId(orderId)
    setCancelReason('')
    setShowCancelModal(true)
  }

  const confirmCancel = () => {
    if (!cancelReason.trim()) { showError('Please provide a cancellation reason'); return }
    setShowCancelModal(false)
    requirePassword('cancel', cancelOrderId)
  }

  const doCancelOrder = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) { showError('Order not found'); return }

      const ledgerEntry = (order.paid_amount || 0) > 0 ? {
        customer_id: order.customer_id,
        branch_id: user?.branch_id,
        amount: -(order.paid_amount || 0),
        type: 'refund',
        description: `Refund for cancelled order #${order.invoice_no || order.id} - Reason: ${cancelReason}`,
        order_id: order.id,
      } : null

      const { data, error } = await _cancelOrder({
        orderId,
        cancelledBy: user?.id,
        cancelledByName: user?.name,
        reason: cancelReason,
        ledgerEntry,
        activityLog: {
          branchId: user?.branch_id,
          userId: user?.id,
          userName: user?.name,
          description: `Order cancelled: #${order.invoice_no || order.id} - Reason: ${cancelReason}`
        },
      })
      if (error) { showError('Cancel failed: ' + error.message); return }
      showSuccess('Order cancelled successfully')
      await loadOrders()
    } catch (err) { showError('Cancel error: ' + err.message) }
  }

  const initiatePayment = (order) => {
    if (!isAdmin) { showError('Only managers can process payments'); return }
    setSelectedOrder(order)
    setPaidAmount(order.due_amount || 0)
    setPaymentMethod(PAYMENT_METHODS.CASH)
    setPaymentRemarks('')
    setShowPaymentModal(true)
  }

  const confirmPayment = () => {
    if (!paidAmount || paidAmount <= 0) { showError('Enter a valid paid amount'); return }
    setShowPaymentModal(false)
    requirePassword('payment', selectedOrder.id)
  }

  const doProcessPayment = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) { showError('Order not found'); return }
      const totalDue = order.due_amount || order.total || 0
      const newPaid = (order.paid_amount || 0) + paidAmount
      const newDue = Math.max(0, totalDue - paidAmount)
      const finalStatus = newDue > 0 ? ORDER_STATUS.PARTIALLY_PAID : ORDER_STATUS.PAID

      const ledgerEntry = {
        customer_id: order.customer_id,
        branch_id: user?.branch_id,
        amount: paidAmount,
        type: 'payment',
        description: `Payment received - ${paymentMethod} - Order #${order.invoice_no || order.id}`,
        order_id: order.id,
        balance_after: newDue,
      }

      const { data, error } = await _processPayment({
        orderId,
        payment: { amount: paidAmount, method: paymentMethod, remarks: paymentRemarks },
        status: finalStatus,
        paid: newPaid,
        due: newDue,
        ledgerEntry,
        activityLog: {
          branchId: user?.branch_id,
          userId: user?.id,
          userName: user?.name,
          description: `Payment processed: ${paidAmount} via ${paymentMethod} for Order #${order.invoice_no || order.id}`
        },
      })
      if (error) { showError('Payment failed: ' + error.message); return }
      showSuccess('Payment processed successfully')
      setPaidAmount(0)
      setPaymentRemarks('')
      setPaymentMethod(PAYMENT_METHODS.CASH)
      await loadOrders()
    } catch (err) { showError('Payment error: ' + err.message) }
  }

  const viewOrderDetails = async (order) => {
    setOrderDetails(order)
    setShowOrderDetailsModal(true)
    if (order?.customer_id) {
      const { data: ledgerData } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('customer_id', order.customer_id)
        .order('created_at', { ascending: false })
      setCustomerLedger(ledgerData || [])
    } else {
      setCustomerLedger([])
    }
  }

  const filteredOrders = useMemo(() => {
    let result = orders
    if (orderFilter !== 'all') result = result.filter(o => o.status === orderFilter)
    if (orderSearch.trim()) {
      const search = orderSearch.toLowerCase()
      result = result.filter(o => o.invoice_no?.toLowerCase().includes(search) || o.customer_name?.toLowerCase().includes(search) || o.id?.toLowerCase().includes(search))
    }
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [orders, orderFilter, orderSearch])

  const statusBadgeStyle = (status) => {
    switch (status) {
      case ORDER_STATUS.PENDING: return { background: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7' }
      case ORDER_STATUS.PAID: return { background: '#d1e7dd', color: '#0f5132', border: '1px solid #badbcc' }
      case ORDER_STATUS.CREDIT: return { background: '#cff4fc', color: '#055160', border: '1px solid #b6effb' }
      case ORDER_STATUS.PARTIALLY_PAID: return { background: '#fff3cd', color: '#664d03', border: '1px solid #ffc107' }
      case ORDER_STATUS.CANCELLED: return { background: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7' }
      case ORDER_STATUS.COMPLETED: return { background: '#d1e7dd', color: '#0f5132', border: '1px solid #badbcc' }
      default: return { background: '#e9ecef', color: '#495057', border: '1px solid #dee2e6' }
    }
  }

  const canModifyOrder = (order) => {
    return isAdmin && [ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID].includes(order.status)
  }

''

  return (
    <>
      {/* ── Toasts ── */}
      {errorMsg && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: colors.danger, color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: '400px' }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: colors.success, color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: '400px' }}>
          {successMsg}
        </div>
      )}

      {/* ── Main Layout ── */}
      <div style={{ display: 'flex', height: '100vh', background: colors.bg, fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', overflow: 'hidden' }}>
        {/* LEFT PANEL - Product Catalog */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.panelBg, borderRight: `1px solid ${colors.border}`, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, margin: '0 0 4px' }}>Point of Sale</h1>
              <p style={{ fontSize: '12px', color: colors.muted, margin: 0 }}>
                {isStorekeeper && !isAdmin ? 'Create orders for customers' : 'Manage orders, payments & complete sales'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ background: isAdmin ? colors.accent : colors.success, color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                {user?.name || 'User'} — {isAdmin ? 'Manager' : 'Storekeeper'}
              </div>
              <button onClick={() => setShowOrdersModal(true)}
                style={{ padding: '8px 16px', background: colors.darkBlue, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                📋 Orders
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <input type="text" placeholder="Search products by name, SKU, or barcode..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 14px 10px 36px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.panelBg, color: colors.text, fontSize: '14px', outline: 'none' }} />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.muted, fontSize: '14px' }}>🔍</span>
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '10px 14px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.panelBg, color: colors.text, fontSize: '14px', cursor: 'pointer', minWidth: '150px' }}>
              {categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>)}
            </select>
          </div>

          {/* Products Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {filteredInventory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.muted }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📦</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>No products found</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Try adjusting your search or category filter</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {filteredInventory.map(product => {
                  const inCart = cart.find(c => c.id === product.id)
                  const stock = product.quantity || 0
                  const lowStock = stock > 0 && stock <= 5
                  return (
                    <div key={product.id} onClick={() => addToCart(product)}
                      style={{ background: colors.panelBg, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '14px', cursor: stock > 0 ? 'pointer' : 'not-allowed', opacity: stock > 0 ? 1 : 0.5, transition: 'all 0.15s ease', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                      onMouseEnter={(e) => { if (stock > 0) e.currentTarget.style.borderColor = colors.accent }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border }}>
                      <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700',
                        ...(stock === 0 ? { background: '#f8d7da', color: '#842029' } : lowStock ? { background: '#fff3cd', color: '#856404' } : { background: '#d1e7dd', color: '#0f5132' }) }}>
                        {stock === 0 ? 'Out of Stock' : lowStock ? `Low: ${stock}` : `Stock: ${stock}`}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text, marginBottom: '4px', lineHeight: '1.3' }}>{product.name}</div>
                        {product.sku && <div style={{ fontSize: '11px', color: colors.muted, marginBottom: '4px' }}>SKU: {product.sku}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: colors.accent }}>Rs. {product.selling_price?.toFixed(2) || '0.00'}</span>
                          {inCart && <span style={{ background: colors.accent, color: '#fff', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>In Cart: {inCart.qty}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Cart & Checkout */}
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', background: colors.panelBg, borderLeft: `1px solid ${colors.border}`, boxShadow: '-2px 0 8px rgba(0,0,0,0.04)' }}>
          {/* Cart Header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: colors.text, margin: 0 }}>🛒 Cart ({cart.length})</h2>
            {cart.length > 0 && (
              <button onClick={clearCart} style={{ padding: '6px 12px', background: colors.danger, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Clear All</button>
            )}
          </div>

          {/* Customer / Branch Select */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer / Branch</label>
              <button onClick={() => setShowCreateCustomerModal(true)} style={{ padding: '4px 10px', background: colors.success, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>+ New</button>
            </div>
            <select value={selectedCustomer?.id || ''} onChange={(e) => {
              const val = e.target.value
              if (val === 'walkin' || val === '') setSelectedCustomer(null)
              else { const found = customers.find(c => c.id === val) || branches.find(b => b.id === val); setSelectedCustomer(found || null) }
            }} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.panelBg, color: colors.text, fontSize: '14px', cursor: 'pointer' }}>
              <option value="walkin">🚶 Walk-In Customer</option>
              {customers.length > 0 && (
                <optgroup label="Customers">
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                </optgroup>
              )}
              {branches.length > 0 && (
                <optgroup label="Branches">
                  {branches.map(b => <option key={b.id} value={b.id}>🏢 {b.name} {b.location ? `- ${b.location}` : ''}</option>)}
                </optgroup>
              )}
            </select>
            {customersLoading && <div style={{ fontSize: '11px', color: colors.muted, marginTop: '4px' }}>Loading customers...</div>}
            {branchesLoading && <div style={{ fontSize: '11px', color: colors.muted, marginTop: '4px' }}>Loading branches...</div>}
          </div>

          {/* Cart Items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', background: colors.bg }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.muted }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🛒</div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>Your cart is empty</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Click products on the left to add them</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ background: colors.panelBg, padding: '12px', borderRadius: '8px', border: `1px solid ${colors.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text, lineHeight: '1.3' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: colors.muted, marginTop: '2px' }}>Rs. {item.price?.toFixed(2)} / {item.unit}</div>
                      </div>
                      <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', color: colors.danger, border: 'none', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: '28px', height: '28px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '4px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text }}>−</button>
                      <input type="number" min="1" value={item.qty} onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                        style={{ width: '50px', textAlign: 'center', padding: '6px', border: `1px solid ${colors.border}`, borderRadius: '4px', background: colors.panelBg, color: colors.text, fontSize: '14px', fontWeight: '600' }} />
                      <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: '28px', height: '28px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '4px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text }}>+</button>
                      <div style={{ flex: 1, textAlign: 'right', fontSize: '14px', fontWeight: '700', color: colors.accent }}>Rs. {(item.qty * item.price).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discount & Tax */}
          {cart.length > 0 && (
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, background: colors.panelBg }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: colors.muted, marginBottom: '4px', textTransform: 'uppercase' }}>Discount (Rs)</label>
                  <input type="number" min="0" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.bg, color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: colors.muted, marginBottom: '4px', textTransform: 'uppercase' }}>Tax Rate (%)</label>
                  <input type="number" min="0" max="100" value={taxRate || ''} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.bg, color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
          )}

          {/* Totals */}
          {cart.length > 0 && (
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.border}`, background: colors.panelBg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: colors.muted }}>Subtotal:</span><span style={{ fontWeight: '600' }}>Rs. {subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}><span style={{ color: colors.muted }}>Discount:</span><span style={{ fontWeight: '600', color: colors.success }}>−Rs. {discount.toFixed(2)}</span></div>}
              {tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}><span style={{ color: colors.muted }}>Tax:</span><span style={{ fontWeight: '600' }}>Rs. {tax.toFixed(2)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0', borderTop: `2px solid ${colors.border}`, marginTop: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: '800', color: colors.text }}>GRAND TOTAL</span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: colors.accent }}>Rs. {total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ padding: '14px 20px', display: 'flex', gap: '8px', background: colors.panelBg }}>
            <button onClick={clearCart} disabled={cart.length === 0} style={{ padding: '10px 14px', background: colors.danger, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', opacity: cart.length === 0 ? 0.5 : 1 }}>Clear</button>
            {cart.length > 0 && isStorekeeper && (
              <button onClick={placeOrder} disabled={processing} style={{ flex: 1, padding: '10px 14px', background: colors.success, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.6 : 1 }}>
                {processing ? 'Processing...' : 'Place Order'}
              </button>
            )}
            {cart.length > 0 && isAdmin && !isStorekeeper && (
              <button onClick={placeOrder} disabled={processing} style={{ flex: 1, padding: '10px 14px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.6 : 1 }}>
                {processing ? 'Processing...' : 'Complete Sale'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002 }} onClick={() => setShowConfirmModal(false)}>
          <div style={{ background: colors.panelBg, borderRadius: '12px', padding: '24px', width: '400px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: colors.text }}>Confirm Action</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: colors.muted, whiteSpace: 'pre-line' }}>{confirmMessage}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirmModal(false)} style={{ flex: 1, padding: '10px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirm} style={{ flex: 1, padding: '10px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Customer Modal ── */}
      {showCreateCustomerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCreateCustomerModal(false)}>
          <div style={{ background: colors.panelBg, borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700', color: colors.text }}>New Customer</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Full Name *" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}
                style={{ padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
              <input type="tel" placeholder="Phone" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
                style={{ padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
              <input type="email" placeholder="Email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)}
                style={{ padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
              <input type="text" placeholder="Address" value={newCustomerAddress} onChange={e => setNewCustomerAddress(e.target.value)}
                style={{ padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowCreateCustomerModal(false)} style={{ flex: 1, padding: '10px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreateCustomer} disabled={creatingCustomer} style={{ flex: 1, padding: '10px', background: colors.success, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: creatingCustomer ? 'not-allowed' : 'pointer' }}>
                {creatingCustomer ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Orders Modal ── */}
      {showOrdersModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowOrdersModal(false)}>
          <div style={{ background: colors.panelBg, borderRadius: '12px', padding: '24px', width: '700px', maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: colors.text }}>Orders</h3>
              <button onClick={() => setShowOrdersModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: colors.muted }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)} style={{ padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px' }}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="credit">Credit</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <input type="text" placeholder="Search orders..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
              {ordersLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: colors.muted }}>Loading...</div>
              ) : filteredOrders.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: colors.muted }}>No orders found</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: colors.tableHeader, borderBottom: `2px solid ${colors.tableBorder}` }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: colors.muted }}>Invoice</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: colors.muted }}>Customer</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: colors.muted }}>Total</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: colors.muted }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: colors.muted }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => (
                      <tr key={order.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '10px 12px', fontWeight: '600' }}>#{order.invoice_no || order.id?.slice(0, 8)}</td>
                        <td style={{ padding: '10px 12px' }}>{order.customer_name || 'Walk-In'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Rs. {order.total?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', ...statusBadgeStyle(order.status) }}>
                            {order.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button onClick={() => viewOrderDetails(order)} style={{ padding: '4px 8px', background: colors.info, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', marginRight: '4px' }}>View</button>
                          {canModifyOrder(order) && (
                            <>
                              {order.status === ORDER_STATUS.PENDING && (
                                <button onClick={() => initiateCompleteOrder(order)} style={{ padding: '4px 8px', background: colors.success, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', marginRight: '4px' }}>Complete</button>
                              )}
                              {[ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID].includes(order.status) && (
                                <button onClick={() => initiatePayment(order)} style={{ padding: '4px 8px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', marginRight: '4px' }}>Pay</button>
                              )}
                              <button onClick={() => initiateCancel(order.id)} style={{ padding: '4px 8px', background: colors.danger, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Password Modal ── */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }} onClick={() => setShowPasswordModal(false)}>
          <div style={{ background: colors.panelBg, borderRadius: '12px', padding: '24px', width: '350px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: colors.text }}>Manager Verification</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: colors.muted }}>Enter your password to confirm this action</p>
            <input type="password" placeholder="Password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }} />
            {passwordError && <p style={{ color: colors.danger, fontSize: '12px', margin: '0 0 12px' }}>{passwordError}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(''); setPendingAction(null); setPendingActionData(null); }} style={{ flex: 1, padding: '10px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={verifyPasswordAndExecute} disabled={processing} style={{ flex: 1, padding: '10px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: processing ? 'not-allowed' : 'pointer' }}>
                {processing ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowPaymentModal(false)}>
          <div style={{ background: colors.panelBg, borderRadius: '12px', padding: '24px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700', color: colors.text }}>Process Payment</h3>
            <p style={{ fontSize: '14px', color: colors.muted, margin: '0 0 12px' }}>Order: #{selectedOrder?.invoice_no || selectedOrder?.id?.slice(0, 8)}</p>
            <p style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px' }}>Due: Rs. {selectedOrder?.due_amount?.toFixed(2) || selectedOrder?.total?.toFixed(2)}</p>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px' }}>
                <option value={PAYMENT_METHODS.CASH}>Cash</option>
                <option value={PAYMENT_METHODS.CARD}>Card</option>
                <option value={PAYMENT_METHODS.BANK_TRANSFER}>Bank Transfer</option>
                <option value={PAYMENT_METHODS.CREDIT}>Credit</option>
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Amount Paid</label>
              <input type="number" min="0" step="0.01" value={paidAmount} onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Remarks</label>
              <input type="text" value={paymentRemarks} onChange={e => setPaymentRemarks(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowPaymentModal(false)} style={{ flex: 1, padding: '10px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmPayment} style={{ flex: 1, padding: '10px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Complete Order Modal ── */}
      {showCompleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCompleteModal(false)}>
          <div style={{ background: colors.panelBg, borderRadius: '12px', padding: '24px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700', color: colors.text }}>Complete Order</h3>
            <p style={{ fontSize: '14px', color: colors.muted, margin: '0 0 12px' }}>Order: #{completeOrderData?.invoice_no || completeOrderData?.id?.slice(0, 8)}</p>
            <p style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px' }}>Total: Rs. {completeOrderData?.total?.toFixed(2)}</p>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Payment Method</label>
              <select value={completePaymentMethod} onChange={e => setCompletePaymentMethod(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px' }}>
                <option value={PAYMENT_METHODS.CASH}>Cash</option>
                <option value={PAYMENT_METHODS.CARD}>Card</option>
                <option value={PAYMENT_METHODS.BANK_TRANSFER}>Bank Transfer</option>
                <option value={PAYMENT_METHODS.CREDIT}>Credit</option>
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Amount Paid</label>
              <input type="number" min="0" step="0.01" value={completePaidAmount} onChange={e => setCompletePaidAmount(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Remarks</label>
              <input type="text" value={completeRemarks} onChange={e => setCompleteRemarks(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCompleteModal(false)} style={{ flex: 1, padding: '10px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmCompleteOrder} style={{ flex: 1, padding: '10px', background: colors.success, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Complete Order</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Order Modal ── */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCancelModal(false)}>
          <div style={{ background: colors.panelBg, borderRadius: '12px', padding: '24px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: colors.danger }}>Cancel Order</h3>
            <p style={{ fontSize: '13px', color: colors.muted, margin: '0 0 16px' }}>This action cannot be undone. Inventory will be restored.</p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Cancellation Reason *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCancelModal(false)} style={{ flex: 1, padding: '10px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Back</button>
              <button onClick={confirmCancel} style={{ flex: 1, padding: '10px', background: colors.danger, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order Details Modal ── */}
      {showOrderDetailsModal && orderDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowOrderDetailsModal(false)}>
          <div style={{ background: colors.panelBg, borderRadius: '12px', padding: '24px', width: '500px', maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: colors.text }}>Order Details</h3>
              <button onClick={() => setShowOrderDetailsModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: colors.muted }}>×</button>
            </div>
            <div style={{ marginBottom: '16px', padding: '12px', background: colors.bg, borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: colors.muted }}>Invoice:</span>
                <span style={{ fontWeight: '600' }}>#{orderDetails.invoice_no || orderDetails.id?.slice(0, 8)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: colors.muted }}>Customer:</span>
                <span style={{ fontWeight: '600' }}>{orderDetails.customer_name || 'Walk-In'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: colors.muted }}>Date:</span>
                <span>{new Date(orderDetails.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: colors.muted }}>Status:</span>
                <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', ...statusBadgeStyle(orderDetails.status) }}>
                  {orderDetails.status?.replace('_', ' ')}
                </span>
              </div>
            </div>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 10px', color: colors.text }}>Items</h4>
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: colors.tableHeader }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: colors.muted, fontSize: '11px' }}>Item</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '700', color: colors.muted, fontSize: '11px' }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: colors.muted, fontSize: '11px' }}>Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: colors.muted, fontSize: '11px' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(orderDetails.order_items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '8px 12px' }}>{item.name || `Item #${idx + 1}`}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs. {item.price?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>Rs. {(item.quantity * item.price)?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: `2px solid ${colors.border}`, paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: colors.muted }}>Subtotal:</span>
                <span style={{ fontWeight: '600' }}>Rs. {orderDetails.subtotal?.toFixed(2)}</span>
              </div>
              {orderDetails.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}><span style={{ color: colors.muted }}>Discount:</span><span style={{ fontWeight: '600', color: colors.success }}>−Rs. {orderDetails.discount?.toFixed(2)}</span></div>}
              {orderDetails.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}><span style={{ color: colors.muted }}>Tax:</span><span style={{ fontWeight: '600' }}>Rs. {orderDetails.tax?.toFixed(2)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: colors.text }}>
                <span>Total</span>
                <span>Rs. {orderDetails.total?.toFixed(2)}</span>
              </div>
            </div>

            {orderDetails?.customer_id && customerLedger.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 10px', color: colors.text }}>Customer Ledger</h4>
                <div style={{ border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: colors.tableHeader }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '700', color: colors.muted, fontSize: '10px' }}>Date</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '700', color: colors.muted, fontSize: '10px' }}>Type</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', color: colors.muted, fontSize: '10px' }}>Amount</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', color: colors.muted, fontSize: '10px' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerLedger.map((entry, idx) => (
                        <tr key={idx} style={{ borderTop: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '6px 10px' }}>{new Date(entry.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
                              ...(entry.amount >= 0 ? { background: '#d1e7dd', color: '#0f5132' } : { background: '#f8d7da', color: '#842029' }) }}>
                              {entry.type}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', color: entry.amount >= 0 ? colors.success : colors.danger }}>
                            Rs. {Math.abs(entry.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700' }}>Rs. {entry.balance_after?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
''

