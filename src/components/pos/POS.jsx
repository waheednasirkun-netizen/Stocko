import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

/**
 * STOCKO POS — Store Edition (Light Theme)
 * 
 * ADJUSTED FOR STORE USE:
 * ✓ Light theme as default
 * ✓ Professional design (no emojis)
 * ✓ Header tabs: Cancelled Orders, Reports, Pending Orders, New Order
 * ✓ Search bar, customer select, new customer button only on New Order page
 * ✓ History button shows customer order history
 * ✓ Reports auto-show today's completed orders
 * ✓ Payment modal with 4 options: Cash, Credit, Bank Transfer, Debit Card
 * ✓ All paid orders go to customer ledger
 * ✓ Manager auth required for cancellations
 * 
 * ACCESS CONTROL:
 * - Cancelled Orders: Storekeeper, Admin, Manager, Developer
 * - Reports: Admin, Manager, Developer only
 * - Pending Orders: All authorized users
 * - New Order: All authorized users
 */

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

const now = () => new Date().toISOString()

const PAYMENT_METHODS = {
  CASH: 'cash',
  CREDIT: 'credit',
  BANK: 'bank_transfer',
  DEBIT: 'debit_card',
}

const ORDER_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  PAID: 'paid',
  CREDIT: 'credit',
  CANCELLED: 'cancelled',
}

// Extract sale price from inventory item
const extractSalePrice = (product) => {
  if (!product) return 0

  const price = Number(
    product?.sale_price ?? 
    product?.selling_price ?? 
    product?.default_price ?? 
    product?.price ?? 
    0
  )

  if (isNaN(price)) return 0
  return Math.max(0, price)
}

const formatPrice = (value) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
  }).format(value)
}

const printReceipt = (order, items, user) => {
  const printWindow = window.open('', '_blank', 'width=320,height=600')
  if (!printWindow) {
    alert('Popup blocked. Please allow popups to print receipts.')
    return
  }

  const date = new Date().toLocaleString('en-PK')
  const invoice = order.invoice_no || order.id?.slice(0, 8) || 'N/A'

  const html = `
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
  </style>
</head>
<body>
  <div class="center bold" style="font-size:14px;">STOCKO POS</div>
  <div class="center">${user?.branch_name || 'Branch'}</div>
  <div class="center" style="font-size:10px;">${date}</div>
  <div class="line"></div>
  <div>Invoice: #${invoice}</div>
  <div>Customer: ${order.customer_name || 'Walk-In'}</div>
  <div>Status: ${(order.status || 'pending').toUpperCase()}</div>
  <div class="line"></div>
  <table style="width:100%; border-collapse:collapse;">
    <tr style="font-weight:bold;">
      <td style="text-align:left;">Item</td>
      <td style="text-align:center;">Qty</td>
      <td style="text-align:right;">Price</td>
      <td style="text-align:right;">Total</td>
    </tr>
  </table>
  ${items.map(item => `
    <div style="display:flex; justify-content:space-between; font-size:11px; margin:4px 0;">
      <span style="flex:1;">${item.name}</span>
      <span style="width:40px; text-align:center;">${item.quantity}</span>
      <span style="width:50px; text-align:right;">Rs. ${Number(item.sale_price || 0).toFixed(2)}</span>
      <span style="width:50px; text-align:right;">Rs. ${(item.quantity * (item.sale_price || 0)).toFixed(2)}</span>
    </div>
  `).join('')}
  <div class="line"></div>
  <div style="display:flex; justify-content:space-between; margin:4px 0;">
    <span>Subtotal:</span>
    <span class="bold">Rs. ${(order.subtotal || 0).toFixed(2)}</span>
  </div>
  ${order.discount > 0 ? `
    <div style="display:flex; justify-content:space-between; margin:4px 0; color:green;">
      <span>Discount:</span>
      <span class="bold">-Rs. ${order.discount.toFixed(2)}</span>
    </div>
  ` : ''}
  ${order.tax > 0 ? `
    <div style="display:flex; justify-content:space-between; margin:4px 0;">
      <span>Tax:</span>
      <span class="bold">Rs. ${order.tax.toFixed(2)}</span>
    </div>
  ` : ''}
  <div class="line"></div>
  <div style="display:flex; justify-content:space-between; margin:4px 0;">
    <span class="total">TOTAL</span>
    <span class="total">Rs. ${(order.total || 0).toFixed(2)}</span>
  </div>
  <div class="line"></div>
  <div class="footer">Thank you for your business!</div>
  <div class="footer">Powered by Stocko</div>
  <div style="margin-top:20px; text-align:center; display:no-print;">
    <button onclick="window.print()" style="padding:10px 20px; font-size:12px;">Print</button>
  </div>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()
  setTimeout(() => { printWindow.focus(); printWindow.print() }, 300)
}

/* ══════════════════════════════════════════════════════════════════════════
   LIGHT THEME COLOR PALETTE
   ══════════════════════════════════════════════════════════════════════════ */

const colors = {
  // Backgrounds
  bgPage: '#f5f6fa',
  bgCard: '#ffffff',
  bgHeader: '#ffffff',
  bgInput: '#ffffff',
  bgModal: '#ffffff',
  bgHover: '#f8f9fa',
  bgDark: '#2c3e50',

  // Borders
  border: '#e0e0e0',
  borderLight: '#eeeeee',
  borderActive: '#2196f3',
  borderHover: '#bdbdbd',

  // Text
  textPrimary: '#2c3e50',
  textSecondary: '#546e7a',
  textMuted: '#90a4ae',
  textLight: '#b0bec5',
  textWhite: '#ffffff',

  // Accent colors
  primary: '#2196f3',
  primaryHover: '#1976d2',
  primaryLight: '#e3f2fd',

  success: '#4caf50',
  successLight: '#e8f5e9',
  danger: '#f44336',
  dangerLight: '#ffebee',
  warning: '#ff9800',
  warningLight: '#fff3e0',
  info: '#00bcd4',
  infoLight: '#e0f7fa',

  // Special
  redText: '#e53935',
  greenText: '#2e7d32',
  goldText: '#f9a825',

  // Table
  tableHeader: '#f5f6fa',
  tableRow: '#ffffff',
  tableRowAlt: '#fafafa',
  tableBorder: '#e0e0e0',

  // Shadows
  shadowSm: '0 1px 3px rgba(0,0,0,0.08)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.1)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.12)',
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN POS COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

export default function POS() {
  const { user, currentBranch, theme, showToast } = useApp()

  // ── Role Checks ──
  const userRole = (user?.role || '').toLowerCase()
  const isStorekeeper = ['storekeeper', 'staff', 'cashier', 'store keeper'].includes(userRole)
  const isAdmin = ['admin', 'manager', 'owner', 'developer'].includes(userRole)
  const hasAccess = isStorekeeper || isAdmin
  const hasReportAccess = isAdmin

  // ── State ──
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [discount, setDiscount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [productSearch, setProductSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Active tab: cancelled, reports, pending, new_order
  const [activeTab, setActiveTab] = useState('new_order')

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showOrdersModal, setShowOrdersModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [authAction, setAuthAction] = useState(null)
  const [authPassword, setAuthPassword] = useState('')
  const [orders, setOrders] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [cancelledOrders, setCancelledOrders] = useState([])
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' })
  const [customerHistory, setCustomerHistory] = useState([])

  // Payment modal state
  const [paymentOrder, setPaymentOrder] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CASH)
  const [cashReceived, setCashReceived] = useState(0)
  const [paymentProcessing, setPaymentProcessing] = useState(false)

  // Report filters
  const [reportFilters, setReportFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    customer: '',
    paymentType: 'all',
    orderType: 'all',
  })
  const [reportData, setReportData] = useState([])
  const [reportLoading, setReportLoading] = useState(false)

  // ── Load Inventory ──
  const loadInventory = useCallback(async () => {
    if (!currentBranch?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .order('name')

      if (error) throw error
      setInventory(data || [])
    } catch (err) {
      console.error('[POS] Inventory load error:', err)
      showToast('error', 'Load Failed', err.message)
    } finally {
      setLoading(false)
    }
  }, [currentBranch?.id, showToast])

  const loadCustomers = useCallback(async () => {
    if (!currentBranch?.id) return
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .order('name')

      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      console.error('[POS] Customers load error:', err)
    }
  }, [currentBranch?.id])

  const loadOrders = useCallback(async () => {
    if (!currentBranch?.id) return
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('branch_id', currentBranch.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setOrders(data || [])
      setPendingOrders(data?.filter(o => o.status === ORDER_STATUS.PENDING) || [])
      setCancelledOrders(data?.filter(o => o.status === ORDER_STATUS.CANCELLED) || [])
    } catch (err) {
      console.error('[POS] Orders load error:', err)
    }
  }, [currentBranch?.id])

  // Auto-load today's orders for reports
  const loadTodayOrders = useCallback(async () => {
    if (!currentBranch?.id || !hasReportAccess) return
    const today = new Date().toISOString().split('T')[0]
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), customers(*)')
        .eq('branch_id', currentBranch.id)
        .gte('created_at', today)
        .lte('created_at', today + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (error) throw error
      setReportData(data || [])
    } catch (err) {
      console.error('[POS] Today orders load error:', err)
    }
  }, [currentBranch?.id, hasReportAccess])

  useEffect(() => {
    if (hasAccess && currentBranch?.id) {
      loadInventory()
      loadCustomers()
      loadOrders()
      loadTodayOrders()
    }
  }, [hasAccess, currentBranch?.id, loadInventory, loadCustomers, loadOrders, loadTodayOrders])

  // ── Derived Data ──
  const categories = useMemo(() => {
    const cats = new Set(inventory.map(i => i.category).filter(Boolean))
    return ['all', ...Array.from(cats).sort()]
  }, [inventory])

  const filteredInventory = useMemo(() => {
    let result = inventory

    if (category !== 'all') {
      result = result.filter(i => i.category === category)
    }

    if (productSearch.trim()) {
      const q = productSearch.toLowerCase()
      result = result.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.barcode?.toLowerCase().includes(q)
      )
    }

    return result
  }, [inventory, category, productSearch])

  const cartSubtotal = useMemo(() =>
    cart.reduce((sum, item) => sum + (item.quantity * item.sale_price), 0),
    [cart]
  )

  const cartTax = useMemo(() =>
    Math.max(0, (cartSubtotal - discount) * (taxRate / 100)),
    [cartSubtotal, discount, taxRate]
  )

  const cartTotal = useMemo(() =>
    Math.max(0, cartSubtotal - discount + cartTax),
    [cartSubtotal, discount, cartTax]
  )

  // ── Cart Operations ──
  const addToCart = useCallback((product) => {
    const salePrice = extractSalePrice(product)

    if (product.quantity <= 0) {
      showToast('error', 'Out of Stock', `${product.name} is out of stock`)
      return
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        if (existing.quantity >= product.quantity) {
          showToast('error', 'Stock Limit', `Only ${product.quantity} available`)
          return prev
        }
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...prev, {
        id: product.id,
        name: product.name,
        quantity: 1,
        sale_price: salePrice,
        unit: product.unit || 'unit',
        max_stock: product.quantity,
      }]
    })

    showToast('success', 'Added', `${product.name} added to cart`)
  }, [showToast])

  const updateQuantity = useCallback((id, qty) => {
    if (qty < 1) {
      removeFromCart(id)
      return
    }

    const product = inventory.find(p => p.id === id)
    const maxStock = product?.quantity || 0

    if (qty > maxStock) {
      showToast('error', 'Stock Limit', `Only ${maxStock} available`)
      return
    }

    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, quantity: qty } : item
    ))
  }, [inventory, showToast])

  const removeFromCart = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setSelectedCustomer(null)
    setDiscount(0)
    setTaxRate(0)
  }, [])

  // ── Create Customer ──
  const createCustomer = async () => {
    if (!newCustomer.name.trim()) {
      showToast('error', 'Required', 'Customer name is required')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          branch_id: currentBranch.id,
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim() || null,
          email: newCustomer.email.trim() || null,
        }])
        .select()
        .single()

      if (error) throw error

      setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedCustomer(data)
      setNewCustomer({ name: '', phone: '', email: '' })
      setShowCustomerModal(false)
      showToast('success', 'Created', 'Customer created successfully')
    } catch (err) {
      showToast('error', 'Failed', err.message)
    }
  }

  // ── Place Order ──
  const placeOrder = async () => {
    if (cart.length === 0) {
      showToast('error', 'Empty Cart', 'Add items to place an order')
      return
    }

    setProcessing(true)
    try {
      const orderData = {
        branch_id: currentBranch.id,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || 'Walk-In',
        subtotal: cartSubtotal,
        discount,
        tax: cartTax,
        total: cartTotal,
        status: ORDER_STATUS.PENDING,
        created_by: user?.id,
        created_by_name: user?.name,
        created_at: now(),
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single()

      if (orderError) throw orderError

      const lineItems = cart.map(item => ({
        order_id: order.id,
        inventory_id: item.id,
        quantity: item.quantity,
        sale_price: item.sale_price,
        subtotal: item.quantity * item.sale_price,
        name: item.name,
        created_at: now(),
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(lineItems)

      if (itemsError) throw itemsError

      for (const item of cart) {
        const product = inventory.find(p => p.id === item.id)
        if (product) {
          await supabase
            .from('inventory')
            .update({ quantity: Math.max(0, product.quantity - item.quantity) })
            .eq('id', item.id)
        }
      }

      showToast('success', 'Order Placed', `Order #${order.id.slice(0, 8)} created`)
      printReceipt(order, lineItems, user)
      clearCart()
      await loadInventory()
      await loadOrders()
    } catch (err) {
      console.error('[POS] Order error:', err)
      showToast('error', 'Failed', err.message)
    } finally {
      setProcessing(false)
    }
  }

  // ── Open Payment Modal ──
  const openPaymentModal = (order) => {
    setPaymentOrder(order)
    setCashReceived(order.total || 0)
    setPaymentMethod(PAYMENT_METHODS.CASH)
    setShowPaymentModal(true)
  }

  // ── Process Payment ──
  const processPayment = async () => {
    if (!paymentOrder) return

    setPaymentProcessing(true)
    try {
      const status = paymentMethod === PAYMENT_METHODS.CREDIT 
        ? ORDER_STATUS.CREDIT 
        : ORDER_STATUS.PAID

      const { data: order, error } = await supabase
        .from('orders')
        .update({ 
          status,
          payment_type: paymentMethod,
          payment_time: now(),
          payment_received_by: user?.name,
          cash_received: paymentMethod === PAYMENT_METHODS.CASH ? cashReceived : null,
          change_return: paymentMethod === PAYMENT_METHODS.CASH ? (cashReceived - paymentOrder.total) : null,
        })
        .eq('id', paymentOrder.id)
        .select()
        .single()

      if (error) throw error

      // Add to customer ledger for ALL paid orders (including credit)
      if (order.customer_id && (status === ORDER_STATUS.PAID || status === ORDER_STATUS.CREDIT)) {
        await supabase
          .from('customer_ledger')
          .insert([{
            customer_id: order.customer_id,
            order_id: order.id,
            branch_id: currentBranch.id,
            type: paymentMethod === PAYMENT_METHODS.CREDIT ? 'credit' : 'sale',
            amount: order.total,
            payment_method: paymentMethod,
            description: `Payment for order #${order.id.slice(0, 8)} via ${paymentMethod.replace('_', ' ')}`,
            created_by: user?.id,
            created_at: now(),
          }])
      }

      showToast('success', 'Payment Processed', `Order #${paymentOrder.id.slice(0, 8)} marked as ${status}`)
      setShowPaymentModal(false)
      setPaymentOrder(null)
      setCashReceived(0)
      await loadOrders()
      await loadTodayOrders()
    } catch (err) {
      showToast('error', 'Failed', err.message)
    } finally {
      setPaymentProcessing(false)
    }
  }

  // ── Cancel Order ──
  const cancelOrder = async (orderId) => {
    setAuthAction({ type: 'cancel', orderId })
    setShowAuthModal(true)
  }

  const confirmCancelOrder = async () => {
    if (!authAction) return

    try {
      const { data: order, error } = await supabase
        .from('orders')
        .update({ 
          status: ORDER_STATUS.CANCELLED,
          cancelled_by: user?.id,
          cancelled_at: now(),
        })
        .eq('id', authAction.orderId)
        .select()
        .single()

      if (error) throw error

      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', authAction.orderId)

      for (const item of (items || [])) {
        const product = inventory.find(p => p.id === item.inventory_id)
        if (product) {
          await supabase
            .from('inventory')
            .update({ quantity: product.quantity + item.quantity })
            .eq('id', item.inventory_id)
        }
      }

      showToast('success', 'Order Cancelled', `Order #${authAction.orderId.slice(0, 8)} cancelled`)
      setShowAuthModal(false)
      setAuthAction(null)
      setAuthPassword('')
      await loadOrders()
      await loadInventory()
    } catch (err) {
      showToast('error', 'Failed', err.message)
    }
  }

  // ── View Customer History ──
  const viewCustomerHistory = async () => {
    if (!selectedCustomer) {
      showToast('error', 'No Customer', 'Please select a customer first')
      return
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('customer_id', selectedCustomer.id)
        .eq('branch_id', currentBranch.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomerHistory(data || [])
      setShowHistoryModal(true)
    } catch (err) {
      showToast('error', 'Failed', err.message)
    }
  }

  // ── Generate Report ──
  const generateReport = async () => {
    if (!hasReportAccess) {
      showToast('error', 'Access Denied', 'You do not have permission to view reports')
      return
    }

    setReportLoading(true)
    try {
      let query = supabase
        .from('orders')
        .select('*, order_items(*), customers(*)')
        .eq('branch_id', currentBranch.id)
        .order('created_at', { ascending: false })

      if (reportFilters.startDate) {
        query = query.gte('created_at', reportFilters.startDate)
      }
      if (reportFilters.endDate) {
        query = query.lte('created_at', reportFilters.endDate + 'T23:59:59')
      }
      if (reportFilters.customer) {
        query = query.eq('customer_id', reportFilters.customer)
      }
      if (reportFilters.paymentType !== 'all') {
        query = query.eq('payment_type', reportFilters.paymentType)
      }
      if (reportFilters.orderType !== 'all') {
        query = query.eq('status', reportFilters.orderType)
      }

      const { data, error } = await query

      if (error) throw error
      setReportData(data || [])
    } catch (err) {
      showToast('error', 'Failed', err.message)
    } finally {
      setReportLoading(false)
    }
  }

  // ── Auth Check ──
  const checkAuth = () => {
    if (authPassword === 'admin123') {
      if (authAction?.type === 'cancel') {
        confirmCancelOrder()
      }
    } else {
      showToast('error', 'Auth Failed', 'Invalid password')
      setAuthPassword('')
    }
  }

  // ── Access Gate ──
  if (!hasAccess) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: colors.bgPage,
        textAlign: 'center',
        padding: '20px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', color: colors.danger }}>!</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.textPrimary, marginBottom: '8px' }}>
          Access Denied
        </h2>
        <p style={{ fontSize: '14px', color: colors.textMuted, maxWidth: '400px' }}>
          Your role ({user?.role || 'unknown'}) does not have access to POS.
          Only Admins, Managers, and Storekeepers can access this.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: colors.bgPage,
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      overflow: 'hidden',
    }}>
      {/* ═══════════════════════════════════════════════════════════════
          HEADER NAVIGATION BAR
          Tab Order: Cancelled | Reports | Pending | New Order
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        background: colors.bgHeader,
        borderBottom: `1px solid ${colors.border}`,
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '52px',
        flexShrink: 0,
        boxShadow: colors.shadowSm,
      }}>
        {/* Left: Brand */}
        <div style={{
          padding: '0 20px',
          fontSize: '16px',
          fontWeight: 800,
          color: colors.primary,
          letterSpacing: '0.5px',
          borderRight: `1px solid ${colors.borderLight}`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}>
          STOCKO POS
        </div>

        {/* Center: Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          {[
            { id: 'cancelled', label: 'Cancelled Orders' },
            { id: 'reports', label: 'Reports', restricted: true },
            { id: 'pending', label: 'Pending Orders' },
            { id: 'new_order', label: 'New Order' },
          ].map((tab) => {
            if (tab.restricted && !hasReportAccess) return null

            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '14px 24px',
                  background: isActive ? colors.primaryLight : 'transparent',
                  color: isActive ? colors.primary : colors.textSecondary,
                  border: 'none',
                  borderBottom: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = colors.textPrimary
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = colors.textSecondary
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right: User Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 20px',
          borderLeft: `1px solid ${colors.borderLight}`,
          height: '100%',
        }}>
          <div style={{
            fontSize: '12px',
            color: colors.textMuted,
          }}>
            {currentBranch?.name || 'Select Branch'}
          </div>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: colors.primaryLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
            color: colors.primary,
          }}>
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>

        {/* ── TAB: NEW ORDER ── */}
        {activeTab === 'new_order' && (
          <>
            {/* LEFT: PRODUCTS */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: colors.bgPage,
              borderRight: `1px solid ${colors.border}`,
              overflow: 'hidden',
            }}>
              {/* Search & Filter Bar */}
              <div style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                gap: '10px',
                background: colors.bgCard,
                alignItems: 'center',
              }}>
                <div style={{
                  flex: 1,
                  position: 'relative',
                }}>
                  <input
                    type="text"
                    placeholder="Search products by name, SKU, or barcode..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = colors.borderActive
                      e.target.style.boxShadow = `0 0 0 3px ${colors.primaryLight}`
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = colors.border
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.textMuted,
                    fontSize: '14px',
                  }}>Q</span>
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.textPrimary,
                    fontSize: '14px',
                    minWidth: '160px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
                <div style={{
                  padding: '10px 14px',
                  background: colors.bgHover,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.textMuted,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}>
                  {filteredInventory.length} items
                </div>
              </div>

              {/* Products Grid */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '14px',
              }}>
                {loading ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '60px 20px', 
                    color: colors.textMuted 
                  }}>
                    <div style={{ fontSize: '20px', marginBottom: '12px' }}>Loading inventory...</div>
                  </div>
                ) : filteredInventory.length === 0 ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '60px 20px', 
                    color: colors.textMuted 
                  }}>
                    <div style={{ fontSize: '20px', marginBottom: '12px' }}>No products found</div>
                  </div>
                ) : (
                  filteredInventory.map(product => {
                    const salePrice = extractSalePrice(product)
                    const inStock = product.quantity > 0
                    const inCart = cart.find(c => c.id === product.id)

                    return (
                      <div
                        key={product.id}
                        onClick={() => inStock && addToCart(product)}
                        style={{
                          background: colors.bgCard,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '10px',
                          padding: '16px',
                          cursor: inStock ? 'pointer' : 'not-allowed',
                          opacity: inStock ? 1 : 0.5,
                          transition: 'all 0.2s ease',
                          position: 'relative',
                          boxShadow: colors.shadowSm,
                        }}
                        onMouseEnter={(e) => {
                          if (inStock) {
                            e.currentTarget.style.borderColor = colors.borderActive
                            e.currentTarget.style.transform = 'translateY(-3px)'
                            e.currentTarget.style.boxShadow = colors.shadowMd
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = colors.border
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = colors.shadowSm
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: inStock ? colors.successLight : colors.dangerLight,
                          color: inStock ? colors.success : colors.danger,
                          fontWeight: 700,
                          border: `1px solid ${inStock ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`,
                        }}>
                          {inStock ? `Stock: ${product.quantity}` : 'Out of Stock'}
                        </div>

                        <div style={{ marginTop: '4px' }}>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: colors.textPrimary,
                            marginBottom: '6px',
                            lineHeight: 1.3,
                            paddingRight: '80px',
                          }}>
                            {product.name}
                          </div>
                          <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '12px' }}>
                            {product.sku && `SKU: ${product.sku}`}
                            {product.barcode && ` | Barcode: ${product.barcode}`}
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <span style={{ 
                              fontSize: '18px', 
                              fontWeight: 800, 
                              color: colors.primary 
                            }}>
                              Rs. {salePrice.toFixed(2)}
                            </span>
                            {inCart && (
                              <span style={{
                                fontSize: '12px',
                                background: colors.primary,
                                color: '#fff',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontWeight: 700,
                              }}>
                                {inCart.quantity} in cart
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* RIGHT: CART & CHECKOUT */}
            <div style={{
              width: '400px',
              display: 'flex',
              flexDirection: 'column',
              background: colors.bgCard,
              borderLeft: `1px solid ${colors.border}`,
              boxShadow: '-2px 0 8px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}>
              {/* Cart Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${colors.border}`,
                background: colors.bgPage,
              }}>
                <h2 style={{ 
                  fontSize: '18px', 
                  fontWeight: 700, 
                  color: colors.textPrimary, 
                  margin: '0 0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  Cart ({cart.length})
                </h2>

                {/* Customer Selection */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <select
                      value={selectedCustomer?.id || ''}
                      onChange={(e) => {
                        const cust = customers.find(c => c.id === e.target.value)
                        setSelectedCustomer(cust || null)
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 28px 8px 10px',
                        background: colors.bgInput,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        color: colors.textPrimary,
                        fontSize: '13px',
                        cursor: 'pointer',
                        appearance: 'none',
                        outline: 'none',
                      }}
                    >
                      <option value="">Walk-In Customer</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <span style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: colors.textMuted,
                      fontSize: '10px',
                      pointerEvents: 'none',
                    }}>v</span>
                  </div>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    style={{
                      padding: '8px 14px',
                      background: colors.success,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + New
                  </button>
                  <button
                    onClick={viewCustomerHistory}
                    disabled={!selectedCustomer}
                    style={{
                      padding: '8px 14px',
                      background: colors.bgHover,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: selectedCustomer ? colors.primary : colors.textMuted,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: selectedCustomer ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    History
                  </button>
                </div>

                {selectedCustomer && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: colors.textMuted,
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    Customer: <strong style={{ color: colors.textSecondary }}>{selectedCustomer.name}</strong>
                  </div>
                )}
              </div>

              {/* Cart Items */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px',
                background: colors.bgPage,
              }}>
                {cart.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '50px 20px', 
                    color: colors.textMuted 
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                      Cart is empty
                    </div>
                    <div style={{ fontSize: '13px' }}>Add products from the left</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cart.map(item => (
                      <div
                        key={item.id}
                        style={{
                          background: colors.bgCard,
                          padding: '14px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          boxShadow: colors.shadowSm,
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '10px',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: '14px', 
                              fontWeight: 600, 
                              color: colors.textPrimary 
                            }}>
                              {item.name}
                            </div>
                            <div style={{ 
                              fontSize: '12px', 
                              color: colors.textMuted, 
                              marginTop: '3px' 
                            }}>
                              Rs. {item.sale_price.toFixed(2)} each
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: colors.danger,
                              cursor: 'pointer',
                              fontSize: '20px',
                              padding: '0 4px',
                              opacity: 0.6,
                              transition: 'opacity 0.2s',
                              lineHeight: 1,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                          >
                            x
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={{
                              width: '30px',
                              height: '30px',
                              border: `1px solid ${colors.border}`,
                              background: colors.bgPage,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              color: colors.textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              fontWeight: 700,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = colors.borderActive
                              e.currentTarget.style.color = colors.primary
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = colors.border
                              e.currentTarget.style.color = colors.textSecondary
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                            style={{
                              width: '55px',
                              textAlign: 'center',
                              padding: '6px',
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              background: colors.bgInput,
                              color: colors.textPrimary,
                              outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            style={{
                              width: '30px',
                              height: '30px',
                              border: `1px solid ${colors.border}`,
                              background: colors.bgPage,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              color: colors.textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              fontWeight: 700,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = colors.borderActive
                              e.currentTarget.style.color = colors.primary
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = colors.border
                              e.currentTarget.style.color = colors.textSecondary
                            }}
                          >
                            +
                          </button>
                          <div style={{
                            flex: 1,
                            textAlign: 'right',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: colors.primary,
                          }}>
                            Rs. {(item.quantity * item.sale_price).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount & Tax */}
              {cart.length > 0 && (
                <div style={{
                  padding: '14px 20px',
                  borderTop: `1px solid ${colors.border}`,
                  borderBottom: `1px solid ${colors.border}`,
                  background: colors.bgPage,
                  display: 'flex',
                  gap: '10px',
                }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: colors.textMuted, 
                      display: 'block', 
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Discount (Rs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: colors.bgInput,
                        color: colors.textPrimary,
                        outline: 'none',
                      }}
                      onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                      onBlur={(e) => e.target.style.borderColor = colors.border}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: colors.textMuted, 
                      display: 'block', 
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Tax (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: colors.bgInput,
                        color: colors.textPrimary,
                        outline: 'none',
                      }}
                      onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                      onBlur={(e) => e.target.style.borderColor = colors.border}
                    />
                  </div>
                </div>
              )}

              {/* Totals */}
              {cart.length > 0 && (
                <div style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${colors.border}`,
                  background: colors.bgCard,
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '6px', 
                    fontSize: '14px' 
                  }}>
                    <span style={{ color: colors.textMuted }}>Subtotal:</span>
                    <span style={{ fontWeight: 600, color: colors.textSecondary }}>Rs. {cartSubtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '6px', 
                      fontSize: '14px' 
                    }}>
                      <span style={{ color: colors.textMuted }}>Discount:</span>
                      <span style={{ color: colors.success, fontWeight: 600 }}>-Rs. {discount.toFixed(2)}</span>
                    </div>
                  )}
                  {cartTax > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '8px', 
                      fontSize: '14px' 
                    }}>
                      <span style={{ color: colors.textMuted }}>Tax:</span>
                      <span style={{ fontWeight: 600, color: colors.textSecondary }}>Rs. {cartTax.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0 0',
                    borderTop: `2px solid ${colors.border}`,
                    fontSize: '16px',
                  }}>
                    <span style={{ fontWeight: 700, color: colors.textPrimary }}>TOTAL</span>
                    <span style={{ 
                      fontSize: '24px', 
                      fontWeight: 900, 
                      color: colors.primary 
                    }}>
                      Rs. {cartTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                padding: '16px 20px',
                display: 'flex',
                gap: '10px',
                background: colors.bgCard,
              }}>
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  style={{
                    padding: '12px 18px',
                    background: colors.danger,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: cart.length === 0 ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={placeOrder}
                  disabled={processing || cart.length === 0}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: processing || cart.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: processing || cart.length === 0 ? 0.5 : 1,
                    transition: 'all 0.2s',
                    boxShadow: processing || cart.length === 0 ? 'none' : '0 2px 8px rgba(33, 150, 243, 0.3)',
                  }}
                >
                  {processing ? 'Processing...' : 'Complete Sale'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── TAB: PENDING ORDERS ── */}
        {activeTab === 'pending' && (
          <div style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h2 style={{ 
                fontSize: '22px', 
                fontWeight: 700, 
                color: colors.textPrimary,
                margin: 0,
              }}>
                Pending Orders
              </h2>
              <div style={{
                padding: '8px 16px',
                background: colors.bgCard,
                borderRadius: '20px',
                color: colors.textMuted,
                fontSize: '14px',
                border: `1px solid ${colors.border}`,
                fontWeight: 600,
              }}>
                {pendingOrders.length} orders
              </div>
            </div>

            {pendingOrders.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                color: colors.textMuted,
                background: colors.bgCard,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
              }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                  No pending orders
                </div>
                <div style={{ fontSize: '14px' }}>All orders have been processed</div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      padding: '20px',
                      transition: 'all 0.2s',
                      boxShadow: colors.shadowSm,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.borderHover
                      e.currentTarget.style.boxShadow = colors.shadowMd
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border
                      e.currentTarget.style.boxShadow = colors.shadowSm
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '14px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: colors.textPrimary,
                          marginBottom: '6px',
                        }}>
                          Order #{order.id?.slice(0, 8)}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: colors.textMuted,
                        }}>
                          {new Date(order.created_at).toLocaleString('en-PK')} | {order.customer_name || 'Walk-In'}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 14px',
                        background: colors.warningLight,
                        borderRadius: '20px',
                        color: colors.warning,
                        fontSize: '12px',
                        fontWeight: 700,
                        border: `1px solid rgba(255, 152, 0, 0.2)`,
                      }}>
                        PENDING
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '24px',
                      marginBottom: '14px',
                      fontSize: '14px',
                    }}>
                      <div>
                        <span style={{ color: colors.textMuted }}>Items: </span>
                        <span style={{ color: colors.textSecondary, fontWeight: 700 }}>
                          {order.order_items?.length || 0}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>Total: </span>
                        <span style={{ color: colors.primary, fontWeight: 800 }}>
                          Rs. {(order.total || 0).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>By: </span>
                        <span style={{ color: colors.textSecondary }}>
                          {order.created_by_name || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      paddingTop: '14px',
                      borderTop: `1px solid ${colors.border}`,
                    }}>
                      <button
                        onClick={() => openPaymentModal(order)}
                        style={{
                          padding: '10px 18px',
                          background: colors.success,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(76, 175, 80, 0.3)',
                        }}
                      >
                        Pay
                      </button>
                      <button
                        onClick={() => {
                          setCart(order.order_items?.map(item => ({
                            id: item.inventory_id,
                            name: item.name,
                            quantity: item.quantity,
                            sale_price: item.sale_price,
                            unit: 'unit',
                            max_stock: 999,
                          })) || [])
                          setActiveTab('new_order')
                          showToast('info', 'Edit Mode', 'Order loaded for editing')
                        }}
                        style={{
                          padding: '10px 18px',
                          background: colors.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(33, 150, 243, 0.3)',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => cancelOrder(order.id)}
                        style={{
                          padding: '10px 18px',
                          background: colors.danger,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(244, 67, 54, 0.3)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CANCELLED ORDERS ── */}
        {activeTab === 'cancelled' && (
          <div style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h2 style={{ 
                fontSize: '22px', 
                fontWeight: 700, 
                color: colors.textPrimary,
                margin: 0,
              }}>
                Cancelled Orders
              </h2>
              <div style={{
                padding: '8px 16px',
                background: colors.bgCard,
                borderRadius: '20px',
                color: colors.textMuted,
                fontSize: '14px',
                border: `1px solid ${colors.border}`,
                fontWeight: 600,
              }}>
                {cancelledOrders.length} orders
              </div>
            </div>

            {cancelledOrders.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                color: colors.textMuted,
                background: colors.bgCard,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
              }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                  No cancelled orders
                </div>
                <div style={{ fontSize: '14px' }}>No orders have been cancelled</div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                {cancelledOrders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      padding: '20px',
                      opacity: 0.85,
                      boxShadow: colors.shadowSm,
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '14px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: colors.textPrimary,
                          marginBottom: '6px',
                        }}>
                          Order #{order.id?.slice(0, 8)}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: colors.textMuted,
                        }}>
                          {new Date(order.created_at).toLocaleString('en-PK')} | {order.customer_name || 'Walk-In'}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 14px',
                        background: colors.dangerLight,
                        borderRadius: '20px',
                        color: colors.danger,
                        fontSize: '12px',
                        fontWeight: 700,
                        border: `1px solid rgba(244, 67, 54, 0.2)`,
                      }}>
                        CANCELLED
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '24px',
                      marginBottom: '14px',
                      fontSize: '14px',
                    }}>
                      <div>
                        <span style={{ color: colors.textMuted }}>Items: </span>
                        <span style={{ color: colors.textSecondary, fontWeight: 700 }}>
                          {order.order_items?.length || 0}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>Total: </span>
                        <span style={{ color: colors.primary, fontWeight: 800 }}>
                          Rs. {(order.total || 0).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>Cancelled By: </span>
                        <span style={{ color: colors.textSecondary }}>
                          {order.cancelled_by || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: REPORTS ── */}
        {activeTab === 'reports' && hasReportAccess && (
          <div style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            {/* Filter Section */}
            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: colors.shadowSm,
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 700,
                color: colors.textPrimary,
                margin: '0 0 20px',
              }}>
                Filter Orders
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '14px',
              }}>
                <div>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={reportFilters.startDate}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={reportFilters.endDate}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Customer
                  </label>
                  <select
                    value={reportFilters.customer}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, customer: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="">All Customers</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Payment Type
                  </label>
                  <select
                    value={reportFilters.paymentType}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, paymentType: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="debit_card">Debit Card</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Order Type
                  </label>
                  <select
                    value={reportFilters.orderType}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, orderType: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="credit">Credit</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '20px',
                gap: '10px',
              }}>
                <button
                  onClick={() => {
                    setReportFilters({
                      startDate: new Date().toISOString().split('T')[0],
                      endDate: new Date().toISOString().split('T')[0],
                      customer: '',
                      paymentType: 'all',
                      orderType: 'all',
                    })
                    loadTodayOrders()
                  }}
                  style={{
                    padding: '10px 20px',
                    background: colors.bgPage,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.textSecondary,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  style={{
                    padding: '10px 24px',
                    background: colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: reportLoading ? 'not-allowed' : 'pointer',
                    opacity: reportLoading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                  }}
                >
                  {reportLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {/* Report Results */}
            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: colors.shadowSm,
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{
                  fontSize: '14px',
                  color: colors.textMuted,
                  fontWeight: 600,
                }}>
                  Showing {reportData.length} entries
                </div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                }}>
                  {['Excel', 'CSV', 'PDF', 'Print'].map(format => (
                    <button
                      key={format}
                      style={{
                        padding: '6px 12px',
                        background: colors.bgPage,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        color: colors.textMuted,
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.primary
                        e.currentTarget.style.color = colors.primary
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = colors.border
                        e.currentTarget.style.color = colors.textMuted
                      }}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                }}>
                  <thead>
                    <tr style={{
                      background: colors.tableHeader,
                      borderBottom: `2px solid ${colors.tableBorder}`,
                    }}>
                      {['Sr.', 'Type', 'ID', 'Invoice#', 'Order Time', 'Customer', 'Payment', 'Bill', 'Disc', 'Tax', 'Grand Total', 'Status', 'Action'].map((header) => (
                        <th key={header} style={{
                          padding: '12px 10px',
                          textAlign: 'left',
                          color: colors.textSecondary,
                          fontWeight: 700,
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap',
                        }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.length === 0 ? (
                      <tr>
                        <td colSpan="13" style={{
                          padding: '50px',
                          textAlign: 'center',
                          color: colors.textMuted,
                        }}>
                          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                            No data found
                          </div>
                          <div>Click Search to generate report</div>
                        </td>
                      </tr>
                    ) : (
                      reportData.map((order, index) => (
                        <tr
                          key={order.id}
                          style={{
                            background: index % 2 === 0 ? colors.tableRow : colors.tableRowAlt,
                            borderBottom: `1px solid ${colors.tableBorder}`,
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = colors.bgHover
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = index % 2 === 0 ? colors.tableRow : colors.tableRowAlt
                          }}
                        >
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>{index + 1}</td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>{order.type || 'Sale'}</td>
                          <td style={{ padding: '12px 10px', color: colors.primary, fontWeight: 700 }}>
                            {order.id?.slice(0, 8)}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>{order.invoice_no || 'N/A'}</td>
                          <td style={{ padding: '12px 10px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                            {new Date(order.created_at).toLocaleString('en-PK')}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>
                            {order.customer_name || 'Walk-In'}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: order.payment_type === 'cash' ? colors.successLight : 
                                         order.payment_type === 'credit' ? colors.infoLight : 
                                         colors.bgPage,
                              color: order.payment_type === 'cash' ? colors.success : 
                                    order.payment_type === 'credit' ? colors.info : 
                                    colors.textSecondary,
                              border: `1px solid ${colors.border}`,
                            }}>
                              {order.payment_type?.replace('_', ' ') || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary, fontWeight: 700 }}>
                            Rs. {(order.subtotal || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.success }}>
                            {order.discount > 0 ? `Rs. ${order.discount.toFixed(2)}` : '0'}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>
                            {order.tax > 0 ? `Rs. ${order.tax.toFixed(2)}` : '0'}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.primary, fontWeight: 800 }}>
                            Rs. {(order.total || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: order.status === 'paid' ? colors.successLight :
                                         order.status === 'pending' ? colors.warningLight :
                                         order.status === 'cancelled' ? colors.dangerLight :
                                         colors.infoLight,
                              color: order.status === 'paid' ? colors.success :
                                    order.status === 'pending' ? colors.warning :
                                    order.status === 'cancelled' ? colors.danger :
                                    colors.info,
                              border: `1px solid ${colors.border}`,
                            }}>
                              {order.status?.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                style={{
                                  padding: '5px 10px',
                                  background: colors.primary,
                                  border: 'none',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Print
                              </button>
                              <button
                                style={{
                                  padding: '5px 10px',
                                  background: colors.bgPage,
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: '4px',
                                  color: colors.textSecondary,
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Action
                              </button>
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
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════ */}

      {/* Payment Modal */}
      {showPaymentModal && paymentOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => { setShowPaymentModal(false); setPaymentOrder(null) }}>
          <div style={{
            background: colors.bgModal,
            borderRadius: '10px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: colors.shadowLg,
            border: `1px solid ${colors.border}`,
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                margin: 0, 
                color: colors.textPrimary 
              }}>
                Make Payment
              </h3>
              <button
                onClick={() => { setShowPaymentModal(false); setPaymentOrder(null) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                x
              </button>
            </div>

            <div style={{ display: 'flex' }}>
              {/* Left: Order Details */}
              <div style={{
                flex: 1,
                padding: '24px',
                borderRight: `1px solid ${colors.border}`,
              }}>
                {/* Order Info */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}>
                  <div><span style={{ color: colors.textMuted }}>Order ID:</span> <span style={{ fontWeight: 600 }}>{paymentOrder.id?.slice(0, 8)}</span></div>
                  <div><span style={{ color: colors.textMuted }}>Customer:</span> <span style={{ fontWeight: 600 }}>{paymentOrder.customer_name || 'Walk-In'}</span></div>
                  <div><span style={{ color: colors.textMuted }}>Order Status:</span> <span style={{ color: colors.greenText, fontWeight: 600 }}>Processing</span></div>
                  <div><span style={{ color: colors.textMuted }}>Order Date:</span> <span>{new Date(paymentOrder.created_at).toLocaleDateString('en-PK')}</span></div>
                </div>

                {/* Items Table */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: colors.textPrimary,
                    margin: '0 0 12px',
                    paddingBottom: '8px',
                    borderBottom: `1px solid ${colors.border}`,
                  }}>
                    Items Detail
                  </h4>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}>
                    <thead>
                      <tr style={{
                        borderBottom: `2px solid ${colors.border}`,
                      }}>
                        {['Item', 'Qty', 'Price', 'Discount', 'Tax', 'Total'].map(h => (
                          <th key={h} style={{
                            padding: '8px',
                            textAlign: h === 'Item' ? 'left' : 'center',
                            color: colors.textSecondary,
                            fontWeight: 700,
                            fontSize: '12px',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paymentOrder.order_items?.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                          <td style={{ padding: '8px', color: colors.textPrimary }}>{item.name}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textSecondary }}>{item.quantity}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textSecondary }}>Rs. {item.sale_price?.toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textMuted }}>-</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textMuted }}>-</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textPrimary, fontWeight: 700 }}>
                            Rs. {(item.quantity * item.sale_price).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="5" style={{ padding: '10px 8px', textAlign: 'right', color: colors.textMuted, fontWeight: 600 }}>
                          Sub Total
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: colors.textPrimary, fontWeight: 700 }}>
                          Rs. {(paymentOrder.subtotal || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Payment Options */}
              <div style={{
                width: '380px',
                padding: '24px',
                background: colors.bgPage,
              }}>
                {/* Payment Method Selection */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                  }}>
                    Payment Method
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                  }}>
                    {[
                      { id: PAYMENT_METHODS.CASH, label: 'Cash', icon: 'C' },
                      { id: PAYMENT_METHODS.CREDIT, label: 'Credit', icon: 'Cr' },
                      { id: PAYMENT_METHODS.BANK, label: 'Bank Transfer', icon: 'B' },
                      { id: PAYMENT_METHODS.DEBIT, label: 'Debit Card', icon: 'D' },
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        style={{
                          padding: '14px',
                          background: paymentMethod === method.id ? colors.primary : colors.bgCard,
                          color: paymentMethod === method.id ? '#fff' : colors.textSecondary,
                          border: `2px solid ${paymentMethod === method.id ? colors.primary : colors.border}`,
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: paymentMethod === method.id ? 'rgba(255,255,255,0.2)' : colors.bgPage,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 800,
                        }}>
                          {method.icon}
                        </span>
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash Input (only for cash) */}
                {paymentMethod === PAYMENT_METHODS.CASH && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: colors.textMuted,
                      display: 'block',
                      marginBottom: '6px',
                    }}>
                      Cash Given By Customer
                    </label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: colors.bgCard,
                        border: `2px solid ${colors.borderActive}`,
                        borderRadius: '6px',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: colors.textPrimary,
                        outline: 'none',
                        textAlign: 'right',
                      }}
                    />
                    <div style={{
                      marginTop: '8px',
                      padding: '10px',
                      background: colors.bgCard,
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '14px',
                    }}>
                      <span style={{ color: colors.textMuted }}>Change Return:</span>
                      <span style={{ 
                        color: cashReceived >= (paymentOrder.total || 0) ? colors.success : colors.danger,
                        fontWeight: 700,
                      }}>
                        Rs. {(cashReceived - (paymentOrder.total || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div style={{
                  borderTop: `2px solid ${colors.border}`,
                  paddingTop: '16px',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '14px', color: colors.textMuted, fontWeight: 600 }}>Grand Total</span>
                    <span style={{ 
                      fontSize: '28px', 
                      fontWeight: 900, 
                      color: colors.redText 
                    }}>
                      Rs. {(paymentOrder.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '10px',
                }}>
                  <button
                    onClick={() => {
                      setCart(paymentOrder.order_items?.map(item => ({
                        id: item.inventory_id,
                        name: item.name,
                        quantity: item.quantity,
                        sale_price: item.sale_price,
                        unit: 'unit',
                        max_stock: 999,
                      })) || [])
                      setShowPaymentModal(false)
                      setActiveTab('new_order')
                      showToast('info', 'Edit Mode', 'Order loaded for editing')
                    }}
                    style={{
                      padding: '12px 16px',
                      background: colors.warning,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(255, 152, 0, 0.3)',
                    }}
                  >
                    Edit Order
                  </button>
                  <button
                    onClick={processPayment}
                    disabled={paymentProcessing || (paymentMethod === PAYMENT_METHODS.CASH && cashReceived < (paymentOrder.total || 0))}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: colors.primary,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: paymentProcessing ? 'not-allowed' : 'pointer',
                      opacity: paymentProcessing ? 0.6 : 1,
                      boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                    }}
                  >
                    {paymentProcessing ? 'Processing...' : 'Pay Only'}
                  </button>
                  <button
                    onClick={() => {
                      processPayment()
                      // Also print receipt
                    }}
                    disabled={paymentProcessing || (paymentMethod === PAYMENT_METHODS.CASH && cashReceived < (paymentOrder.total || 0))}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: colors.primary,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: paymentProcessing ? 'not-allowed' : 'pointer',
                      opacity: paymentProcessing ? 0.6 : 1,
                      boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                    }}
                  >
                    {paymentProcessing ? 'Processing...' : 'Pay & Print'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showCustomerModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowCustomerModal(false)}>
          <div style={{
            background: colors.bgModal,
            borderRadius: '10px',
            padding: '28px',
            width: '90%',
            maxWidth: '440px',
            boxShadow: colors.shadowLg,
            border: `1px solid ${colors.border}`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                margin: 0, 
                color: colors.textPrimary 
              }}>
                New Customer
              </h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                x
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '15px',
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  Phone
                </label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '15px',
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '15px',
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowCustomerModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: colors.bgPage,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: colors.textSecondary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={createCustomer}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: colors.success,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(76, 175, 80, 0.3)',
                }}
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Auth Modal (Manager Password Required) */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => { setShowAuthModal(false); setAuthAction(null); setAuthPassword('') }}>
          <div style={{
            background: colors.bgModal,
            borderRadius: '10px',
            padding: '28px',
            width: '90%',
            maxWidth: '480px',
            boxShadow: colors.shadowLg,
            border: `1px solid ${colors.border}`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                margin: 0, 
                color: colors.textPrimary 
              }}>
                Manager Authorization Required
              </h3>
              <button
                onClick={() => { setShowAuthModal(false); setAuthAction(null); setAuthPassword('') }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                }}
              >
                x
              </button>
            </div>

            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: colors.dangerLight,
              borderRadius: '8px',
              border: `1px solid rgba(244, 67, 54, 0.2)`,
            }}>
              <p style={{ margin: 0, color: colors.danger, fontSize: '14px', fontWeight: 600 }}>
                This action requires manager or admin authorization.
                Please enter your password to proceed.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  User
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.borderActive}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                    outline: 'none',
                  }}
                >
                  <option>{user?.name || 'Select User'}</option>
                </select>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkAuth()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAuthModal(false); setAuthAction(null); setAuthPassword('') }}
                style={{
                  padding: '12px 20px',
                  background: colors.bgPage,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: colors.textSecondary,
                }}
              >
                Close
              </button>
              <button
                onClick={checkAuth}
                style={{
                  padding: '12px 20px',
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer History Modal */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowHistoryModal(false)}>
          <div style={{
            background: colors.bgModal,
            borderRadius: '10px',
            padding: '24px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: colors.shadowLg,
            border: `1px solid ${colors.border}`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                margin: 0, 
                color: colors.textPrimary 
              }}>
                Customer History: {selectedCustomer?.name}
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                }}
              >
                x
              </button>
            </div>

            {customerHistory.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: colors.textMuted,
              }}>
                <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                  No order history
                </div>
                <div>This customer has no previous orders</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {customerHistory.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      background: colors.bgPage,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '14px',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}>
                      <span style={{ color: colors.textPrimary, fontWeight: 700 }}>
                        #{order.id?.slice(0, 8)}
                      </span>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: order.status === 'paid' ? colors.successLight :
                                   order.status === 'pending' ? colors.warningLight :
                                   order.status === 'cancelled' ? colors.dangerLight :
                                   colors.infoLight,
                        color: order.status === 'paid' ? colors.success :
                              order.status === 'pending' ? colors.warning :
                              order.status === 'cancelled' ? colors.danger :
                              colors.info,
                        border: `1px solid ${colors.border}`,
                      }}>
                        {order.status?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.textMuted,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span>{new Date(order.created_at).toLocaleString('en-PK')}</span>
                      <span style={{ color: colors.primary, fontWeight: 700 }}>
                        Rs. {(order.total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}