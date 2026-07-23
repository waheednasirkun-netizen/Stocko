// STOCKO POS — COMPACT BRANCH DISPATCH V2
// If this marker is missing in Cursor, the old POS file is still installed.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { Ic } from '../ui'

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
  PARTIALLY_PAID: 'partially_paid',
  CANCELLED: 'cancelled',
}

const PAYMENT_OPTIONS = [
  { id: PAYMENT_METHODS.CASH, label: 'Cash', icon: 'DollarSign' },
  { id: PAYMENT_METHODS.CREDIT, label: 'Credit', icon: 'FileText' },
  { id: PAYMENT_METHODS.BANK, label: 'Bank Transfer', icon: 'ArrowLeftRight' },
  { id: PAYMENT_METHODS.DEBIT, label: 'Debit Card', icon: 'CreditCard' },
]

const REPORT_STATUS_OPTIONS = [
  { id: 'all', label: 'All statuses' },
  { id: ORDER_STATUS.PENDING, label: 'Pending' },
  { id: ORDER_STATUS.PARTIALLY_PAID, label: 'Partially paid' },
  { id: ORDER_STATUS.PAID, label: 'Paid' },
  { id: ORDER_STATUS.CREDIT, label: 'Credit' },
  { id: ORDER_STATUS.CANCELLED, label: 'Cancelled' },
]

const ROLE_GROUPS = {
  POS: ['developer', 'superadmin', 'admin', 'owner', 'manager', 'storekeeper', 'store keeper', 'staff', 'cashier'],
  MANAGE: ['developer', 'superadmin', 'admin', 'owner', 'manager'],
  REPORTS: ['developer', 'superadmin', 'admin', 'owner', 'manager'],
}

const normalizeRole = (role) => String(role || '').trim().toLowerCase()
const safeNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const getStock = (product) => Math.max(0, safeNumber(product?.quantity))

// Extract sale price from both current and legacy inventory shapes.
const extractSalePrice = (product) => {
  if (!product) return 0

  const price = safeNumber(
    product?.sale_price ?? 
    product?.selling_price ?? 
    product?.default_price ?? 
    product?.price ?? 
    0
  )

  return Math.max(0, price)
}

const extractLinePrice = (item) => Math.max(
  0,
  safeNumber(item?.price ?? item?.sale_price ?? item?.selling_price)
)

const formatPrice = (value) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
  }).format(value)
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const csvCell = (value) => {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

const downloadTextFile = (filename, content, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const orderReference = (order) => order?.invoice_no || order?.id?.slice(0, 8)?.toUpperCase() || 'N/A'
const getPaymentMethod = (order) => (
  order?.payment_type ||
  order?.order_payments?.at?.(-1)?.method ||
  order?.order_payments?.[0]?.method ||
  null
)

const printReceipt = (order, items, user) => {
  const printWindow = window.open('', '_blank', 'width=320,height=600')
  if (!printWindow) {
    alert('Popup blocked. Please allow popups to print receipts.')
    return
  }

  const date = new Date().toLocaleString('en-PK')
  const invoice = escapeHtml(orderReference(order))
  const branchName = escapeHtml(user?.branch_name || order?.branch_name || 'Branch')
  const customerName = escapeHtml(order.customer_name || 'Walk-In')
  const cashierName = escapeHtml(order.created_by_name || user?.name || 'Cashier')
  const paymentMethod = escapeHtml((getPaymentMethod(order) || 'Pending').replaceAll('_', ' '))
  const safeItems = Array.isArray(items) ? items : []

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
  <div class="center">${branchName}</div>
  <div class="center" style="font-size:10px;">${date}</div>
  <div class="line"></div>
  <div>Invoice: #${invoice}</div>
  <div>Customer: ${customerName}</div>
  <div>Cashier: ${cashierName}</div>
  <div>Type: ${escapeHtml((order.type || order.order_type || 'sale').replaceAll('_', ' '))}</div>
  <div>Payment: ${paymentMethod}</div>
  <div>Status: ${escapeHtml((order.status || 'pending').toUpperCase())}</div>
  <div class="line"></div>
  <table style="width:100%; border-collapse:collapse;">
    <tr style="font-weight:bold;">
      <td style="text-align:left;">Item</td>
      <td style="text-align:center;">Qty</td>
      <td style="text-align:right;">Price</td>
      <td style="text-align:right;">Total</td>
    </tr>
  </table>
  ${safeItems.map(item => {
    const price = extractLinePrice(item)
    return `
    <div style="display:flex; justify-content:space-between; font-size:11px; margin:4px 0;">
      <span style="flex:1;">${escapeHtml(item.name || 'Item')}</span>
      <span style="width:40px; text-align:center;">${safeNumber(item.quantity)}</span>
      <span style="width:50px; text-align:right;">Rs. ${price.toFixed(2)}</span>
      <span style="width:50px; text-align:right;">Rs. ${(safeNumber(item.quantity) * price).toFixed(2)}</span>
    </div>
  `}).join('')}
  <div class="line"></div>
  <div style="display:flex; justify-content:space-between; margin:4px 0;">
    <span>Subtotal:</span>
    <span class="bold">Rs. ${safeNumber(order.subtotal).toFixed(2)}</span>
  </div>
  ${safeNumber(order.discount) > 0 ? `
    <div style="display:flex; justify-content:space-between; margin:4px 0; color:green;">
      <span>Discount:</span>
      <span class="bold">-Rs. ${safeNumber(order.discount).toFixed(2)}</span>
    </div>
  ` : ''}
  ${safeNumber(order.tax) > 0 ? `
    <div style="display:flex; justify-content:space-between; margin:4px 0;">
      <span>Tax:</span>
      <span class="bold">Rs. ${safeNumber(order.tax).toFixed(2)}</span>
    </div>
  ` : ''}
  <div class="line"></div>
  <div style="display:flex; justify-content:space-between; margin:4px 0;">
    <span class="total">TOTAL</span>
    <span class="total">Rs. ${safeNumber(order.total).toFixed(2)}</span>
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

const baseColors = {
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
  const {
    user,
    currentBranch,
    theme,
    dark,
    showToast,
    canAccessPOS,
    canViewReports,
  } = useApp()

  // ── Role Checks ──
  const userRole = normalizeRole(user?.role || user?.user_role || user?.type)
  const isStorekeeper = ['storekeeper', 'store keeper', 'staff', 'cashier'].includes(userRole)
  const isAdmin = ROLE_GROUPS.MANAGE.includes(userRole)
  const hasAccess = typeof canAccessPOS === 'function'
    ? canAccessPOS()
    : ROLE_GROUPS.POS.includes(userRole)
  const hasReportAccess = typeof canViewReports === 'function'
    ? canViewReports()
    : ROLE_GROUPS.REPORTS.includes(userRole)
  const branchId = currentBranch?.id || user?.branch_id || null

  // Map the page to Stocko's real light/dark theme while keeping fallbacks for
  // projects that are still on an older theme object.
  const colors = useMemo(() => ({
    ...baseColors,
    bgPage: theme?.bg || baseColors.bgPage,
    bgCard: theme?.cardBg || theme?.card || baseColors.bgCard,
    bgHeader: theme?.cardBg || theme?.card || baseColors.bgHeader,
    bgInput: theme?.inputBg || baseColors.bgInput,
    bgModal: theme?.modalBg || theme?.cardBg || baseColors.bgModal,
    bgHover: theme?.cardHover || theme?.rowHover || baseColors.bgHover,
    bgDark: dark ? '#020617' : '#0f172a',
    border: theme?.border || baseColors.border,
    borderLight: theme?.borderLight || baseColors.borderLight,
    borderActive: theme?.inputFocus || theme?.primary || baseColors.borderActive,
    borderHover: dark ? '#64748b' : '#cbd5e1',
    textPrimary: theme?.text || baseColors.textPrimary,
    textSecondary: theme?.textLight || theme?.text || baseColors.textSecondary,
    textMuted: theme?.textMuted || baseColors.textMuted,
    textLight: theme?.inputPlaceholder || theme?.textMuted || baseColors.textLight,
    primary: theme?.primary || baseColors.primary,
    primaryHover: theme?.primaryHover || baseColors.primaryHover,
    primaryLight: theme?.navActive || baseColors.primaryLight,
    success: theme?.success || baseColors.success,
    successLight: theme?.completed || baseColors.successLight,
    danger: theme?.danger || baseColors.danger,
    dangerLight: theme?.rejected || baseColors.dangerLight,
    warning: theme?.warning || baseColors.warning,
    warningLight: theme?.pending || baseColors.warningLight,
    info: dark ? '#22d3ee' : '#0891b2',
    infoLight: dark ? '#083344' : '#cffafe',
    redText: theme?.danger || baseColors.redText,
    greenText: theme?.success || baseColors.greenText,
    goldText: theme?.warning || baseColors.goldText,
    tableHeader: theme?.tableHeaderBg || baseColors.tableHeader,
    tableRow: theme?.cardBg || baseColors.tableRow,
    tableRowAlt: theme?.tableRowAlt || baseColors.tableRowAlt,
    tableBorder: theme?.border || baseColors.tableBorder,
    shadowSm: theme?.shadow || baseColors.shadowSm,
    shadowMd: theme?.shadowMd || baseColors.shadowMd,
    shadowLg: theme?.shadowLg || baseColors.shadowLg,
  }), [theme, dark])

  const searchInputRef = useRef(null)
  const lastSubmissionRef = useRef(0)

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
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [orderType, setOrderType] = useState('branch_dispatch')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderReferenceText, setOrderReferenceText] = useState('')
  const [editingOrder, setEditingOrder] = useState(null)

  // Active tab: cancelled, reports, pending, new_order
  const [activeTab, setActiveTab] = useState('new_order')

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [detailOrder, setDetailOrder] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [authAction, setAuthAction] = useState(null)
  const [authPassword, setAuthPassword] = useState('')
  const [authProcessing, setAuthProcessing] = useState(false)
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
  const [printAfterPayment, setPrintAfterPayment] = useState(false)
  const [paymentRemarks, setPaymentRemarks] = useState('')

  // Report filters
  const [reportFilters, setReportFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    customer: '',
    paymentType: 'all',
    status: 'all',
  })
  const [reportData, setReportData] = useState([])
  const [reportLoading, setReportLoading] = useState(false)

  // ── Load Inventory ──
  const loadInventory = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', branchId)
        .order('name')

      if (error) throw error
      setInventory(data || [])
    } catch (err) {
      console.error('[POS] Inventory load error:', err)
      showToast('error', 'Load Failed', err.message)
    } finally {
      setLoading(false)
    }
  }, [branchId, showToast])

  const loadCustomers = useCallback(async () => {
    if (!branchId) return
    setCustomersLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('branch_id', branchId)
        .order('name')

      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      console.error('[POS] Customers load error:', err)
      showToast('error', 'Customers unavailable', err.message)
    } finally {
      setCustomersLoading(false)
    }
  }, [branchId, showToast])

  const loadOrders = useCallback(async () => {
    if (!branchId) return
    setOrdersLoading(true)
    try {
      let response = await supabase
        .from('orders')
        .select('*, order_items(*), order_payments(*)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(250)

      // Some older deployments do not expose the relationship in PostgREST.
      // Fall back to orders + items without breaking the page.
      if (response.error) {
        response = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
          .limit(250)
      }

      if (response.error) throw response.error
      const nextOrders = response.data || []
      setOrders(nextOrders)
      setPendingOrders(nextOrders.filter(order => (
        order.status === ORDER_STATUS.PENDING ||
        order.status === ORDER_STATUS.PARTIALLY_PAID
      )))
      setCancelledOrders(nextOrders.filter(order => order.status === ORDER_STATUS.CANCELLED))
    } catch (err) {
      console.error('[POS] Orders load error:', err)
      showToast('error', 'Orders unavailable', err.message)
    } finally {
      setOrdersLoading(false)
    }
  }, [branchId, showToast])

  // Auto-load today's orders for reports
  const loadTodayOrders = useCallback(async () => {
    if (!branchId || !hasReportAccess) return
    const today = new Date().toISOString().split('T')[0]
    try {
      let response = await supabase
        .from('orders')
        .select('*, order_items(*), order_payments(*)')
        .eq('branch_id', branchId)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', today + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (response.error) {
        response = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('branch_id', branchId)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`)
          .order('created_at', { ascending: false })
      }

      if (response.error) throw response.error
      setReportData(response.data || [])
    } catch (err) {
      console.error('[POS] Today orders load error:', err)
      showToast('error', 'Report unavailable', err.message)
    }
  }, [branchId, hasReportAccess, showToast])

  const refreshAll = useCallback(async ({ quiet = false } = {}) => {
    if (!branchId) return
    if (!quiet) setRefreshing(true)
    await Promise.all([
      loadInventory(),
      loadCustomers(),
      loadOrders(),
      hasReportAccess ? loadTodayOrders() : Promise.resolve(),
    ])
    if (!quiet) {
      setRefreshing(false)
      showToast('success', 'POS refreshed', 'Inventory, customers and orders are up to date')
    }
  }, [branchId, hasReportAccess, loadCustomers, loadInventory, loadOrders, loadTodayOrders, showToast])

  useEffect(() => {
    if (hasAccess && branchId) {
      refreshAll({ quiet: true })
    }
  }, [hasAccess, branchId, refreshAll])

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement

      if (event.key === 'F2') {
        event.preventDefault()
        setActiveTab('new_order')
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }

      if (!isTyping && event.key === '/') {
        event.preventDefault()
        setActiveTab('new_order')
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }

      if (event.key === 'Escape') {
        setShowPaymentModal(false)
        setShowCustomerModal(false)
        setShowHistoryModal(false)
        setShowOrderDetailModal(false)
        setShowCancelModal(false)
        setShowAuthModal(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
      const q = productSearch.trim().toLowerCase()
      result = result.filter(i =>
        String(i.name || '').toLowerCase().includes(q) ||
        String(i.sku || '').toLowerCase().includes(q) ||
        String(i.barcode || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [inventory, category, productSearch])

  const cartSubtotal = useMemo(() =>
    cart.reduce((sum, item) => sum + (safeNumber(item.quantity) * extractLinePrice(item)), 0),
    [cart]
  )

  const normalizedDiscount = useMemo(
    () => clamp(safeNumber(discount), 0, cartSubtotal),
    [discount, cartSubtotal]
  )

  const cartTax = useMemo(() =>
    Math.max(0, (cartSubtotal - normalizedDiscount) * (clamp(safeNumber(taxRate), 0, 100) / 100)),
    [cartSubtotal, normalizedDiscount, taxRate]
  )

  const cartTotal = useMemo(() =>
    Math.max(0, cartSubtotal - normalizedDiscount + cartTax),
    [cartSubtotal, normalizedDiscount, cartTax]
  )

  const paymentDue = useMemo(() => {
    if (!paymentOrder) return 0
    return Math.max(
      0,
      safeNumber(
        paymentOrder.due_amount,
        safeNumber(paymentOrder.total) - safeNumber(paymentOrder.paid_amount)
      )
    )
  }, [paymentOrder])

  const todaySales = useMemo(
    () => orders.filter(order => {
      if (![ORDER_STATUS.PAID, ORDER_STATUS.CREDIT, ORDER_STATUS.COMPLETED].includes(order.status)) return false
      const date = new Date(order.created_at)
      const today = new Date()
      return date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    }).reduce((sum, order) => sum + safeNumber(order.total), 0),
    [orders]
  )

  const todayOrderCount = useMemo(
    () => orders.filter(order => {
      const date = new Date(order.created_at)
      const today = new Date()
      return date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    }).length,
    [orders]
  )

  const statusStyle = useCallback((status) => {
    switch (status) {
      case ORDER_STATUS.PENDING:
      case ORDER_STATUS.PARTIALLY_PAID:
        return { background: colors.warningLight, color: dark ? '#fbbf24' : '#92400e' }
      case ORDER_STATUS.PAID:
      case ORDER_STATUS.COMPLETED:
        return { background: colors.successLight, color: dark ? '#86efac' : '#166534' }
      case ORDER_STATUS.CREDIT:
        return { background: colors.infoLight, color: dark ? '#67e8f9' : '#155e75' }
      case ORDER_STATUS.CANCELLED:
        return { background: colors.dangerLight, color: dark ? '#fca5a5' : '#991b1b' }
      default:
        return { background: colors.bgHover, color: colors.textSecondary }
    }
  }, [colors, dark])

  const logPosActivity = useCallback(async (action, details) => {
    if (!branchId) return
    try {
      const { error } = await supabase.from('activity_logs').insert([{
        branch_id: branchId,
        user_id: user?.id,
        user_name: user?.name,
        action,
        details,
        created_at: now(),
      }])
      if (error) console.warn('[POS] Activity log failed:', error.message)
    } catch (error) {
      console.warn('[POS] Activity log exception:', error)
    }
  }, [branchId, user?.id, user?.name])

  // ── Cart Operations ──
  const addToCart = useCallback((product) => {
    const salePrice = extractSalePrice(product)
    const stock = getStock(product)
    const editedOriginalQty = editingOrder?.order_items?.find(
      item => item.inventory_id === product.id
    )?.quantity || 0
    const availableForCart = editingOrder ? stock + safeNumber(editedOriginalQty) : stock

    if (availableForCart <= 0) {
      showToast('error', 'Out of Stock', `${product.name} is out of stock`)
      return
    }

    const existing = cart.find(item => item.id === product.id)
    if (existing && existing.quantity >= availableForCart) {
      showToast('error', 'Stock Limit', `Only ${availableForCart} available`)
      return
    }

    if (existing) {
      setCart(previous => previous.map(item => (
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1, max_stock: availableForCart }
          : item
      )))
    } else {
      setCart(previous => [...previous, {
        id: product.id,
        inventory_id: product.id,
        name: product.name,
        quantity: 1,
        price: salePrice,
        sale_price: salePrice,
        unit: product.unit || 'unit',
        sku: product.sku || '',
        max_stock: availableForCart,
        original_quantity: safeNumber(editedOriginalQty),
      }])
    }

    showToast('success', 'Added', `${product.name} added to cart`)
  }, [cart, editingOrder, showToast])

  const updateQuantity = useCallback((id, qty) => {
    const nextQuantity = Math.floor(safeNumber(qty, 1))
    if (nextQuantity < 1) {
      removeFromCart(id)
      return
    }

    const product = inventory.find(p => p.id === id)
    const cartItem = cart.find(item => item.id === id)
    const maxStock = editingOrder
      ? getStock(product) + safeNumber(cartItem?.original_quantity)
      : getStock(product)

    if (nextQuantity > maxStock) {
      showToast('error', 'Stock Limit', `Only ${maxStock} available`)
      return
    }

    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, quantity: nextQuantity, max_stock: maxStock } : item
    ))
  }, [cart, editingOrder, inventory, showToast])

  const removeFromCart = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setSelectedCustomer(null)
    setDiscount(0)
    setTaxRate(0)
    setOrderType('branch_dispatch')
    setOrderNotes('')
    setOrderReferenceText('')
    setEditingOrder(null)
  }, [])

  const cancelEditing = useCallback(() => {
    clearCart()
    setActiveTab('pending')
    showToast('info', 'Edit cancelled', 'The original order was not changed')
  }, [clearCart, showToast])

  // ── Create Customer ──
  const createCustomer = async () => {
    if (!branchId) {
      showToast('error', 'No branch', 'Select a branch before creating customers')
      return
    }

    if (!newCustomer.name.trim()) {
      showToast('error', 'Required', 'Customer name is required')
      return
    }

    const normalizedPhone = newCustomer.phone.trim()
    if (normalizedPhone && customers.some(customer => customer.phone === normalizedPhone)) {
      showToast('warning', 'Customer exists', 'A customer with this phone number already exists')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          branch_id: branchId,
          name: newCustomer.name.trim(),
          phone: normalizedPhone || null,
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

  const insertOrderWithFallback = async (corePayload, optionalPayload) => {
    let response = await supabase
      .from('orders')
      .insert([{ ...corePayload, ...optionalPayload }])
      .select()
      .single()

    if (response.error && Object.keys(optionalPayload).length > 0) {
      const schemaError = response.error.code === 'PGRST204' ||
        response.error.code === '42703' ||
        /column|schema cache/i.test(response.error.message || '')

      if (schemaError) {
        response = await supabase
          .from('orders')
          .insert([corePayload])
          .select()
          .single()
      }
    }

    return response
  }

  const adjustInventoryBy = async (inventoryId, delta) => {
    if (!inventoryId || !delta) return
    const { data: item, error: readError } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('id', inventoryId)
      .eq('branch_id', branchId)
      .single()

    if (readError) throw readError
    const nextQuantity = safeNumber(item.quantity) + delta
    if (nextQuantity < 0) {
      throw new Error(`Insufficient stock for inventory item ${inventoryId}`)
    }

    const { error: updateError } = await supabase
      .from('inventory')
      .update({ quantity: nextQuantity, updated_at: now() })
      .eq('id', inventoryId)
      .eq('branch_id', branchId)

    if (updateError) throw updateError
  }

  const saveEditedOrder = async () => {
    if (!editingOrder) return

    const oldItems = editingOrder.order_items || []
    const oldById = new Map(oldItems.map(item => [item.inventory_id, item]))
    const newById = new Map(cart.map(item => [item.id, item]))
    const ids = new Set([...oldById.keys(), ...newById.keys()])
    const inventoryDiffs = []

    ids.forEach(id => {
      const previousQuantity = safeNumber(oldById.get(id)?.quantity)
      const nextQuantity = safeNumber(newById.get(id)?.quantity)
      const difference = nextQuantity - previousQuantity
      if (difference !== 0) inventoryDiffs.push({ id, difference })
    })

    for (const difference of inventoryDiffs) {
      const item = inventory.find(product => product.id === difference.id)
      if (difference.difference > getStock(item)) {
        throw new Error(`Only ${getStock(item)} additional units are available for ${item?.name || 'this product'}`)
      }
    }

    const updatePayload = {
      customer_id: selectedCustomer?.id || null,
      customer_name: selectedCustomer?.name || 'Walk-In',
      subtotal: cartSubtotal,
      discount: normalizedDiscount,
      tax: cartTax,
      total: cartTotal,
      updated_at: now(),
    }

    const optionalPayload = {
      type: orderType,
      notes: orderNotes.trim() || null,
      reference: orderReferenceText.trim() || null,
    }

    let updateResponse = await supabase
      .from('orders')
      .update({ ...updatePayload, ...optionalPayload })
      .eq('id', editingOrder.id)
      .eq('branch_id', branchId)

    if (updateResponse.error && (
      updateResponse.error.code === 'PGRST204' ||
      updateResponse.error.code === '42703' ||
      /column|schema cache/i.test(updateResponse.error.message || '')
    )) {
      updateResponse = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', editingOrder.id)
        .eq('branch_id', branchId)
    }

    if (updateResponse.error) throw updateResponse.error

    const replacementItems = cart.map(item => ({
      order_id: editingOrder.id,
      inventory_id: item.id,
      quantity: safeNumber(item.quantity),
      price: extractLinePrice(item),
      subtotal: safeNumber(item.quantity) * extractLinePrice(item),
      name: item.name,
      created_at: now(),
    }))

    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', editingOrder.id)

    if (deleteError) throw deleteError

    const { error: insertError } = await supabase
      .from('order_items')
      .insert(replacementItems)

    if (insertError) {
      const originalItems = oldItems.map(item => ({
        order_id: editingOrder.id,
        inventory_id: item.inventory_id,
        quantity: safeNumber(item.quantity),
        price: extractLinePrice(item),
        subtotal: safeNumber(item.quantity) * extractLinePrice(item),
        name: item.name,
        created_at: item.created_at || now(),
      }))
      if (originalItems.length > 0) {
        await supabase.from('order_items').insert(originalItems)
      }
      throw insertError
    }

    for (const difference of inventoryDiffs) {
      await adjustInventoryBy(difference.id, -difference.difference)
    }

    await logPosActivity(
      'Order Edited',
      `Order #${orderReference(editingOrder)} updated; ${cart.length} line items; total ${cartTotal.toFixed(2)}`
    )

    const updatedOrder = {
      ...editingOrder,
      ...updatePayload,
      ...optionalPayload,
      order_items: replacementItems,
    }

    showToast('success', 'Order updated', `Order #${orderReference(editingOrder)} was updated`)
    clearCart()
    await Promise.all([loadInventory(), loadOrders(), loadTodayOrders()])
    printReceipt(updatedOrder, replacementItems, {
      ...user,
      branch_name: currentBranch?.name || user?.branch_name,
    })
  }

  // ── Place Order ──
  const placeOrder = async () => {
    if (!branchId) {
      showToast('error', 'No branch', 'Select a branch before placing orders')
      return
    }

    if (cart.length === 0) {
      showToast('error', 'Empty Cart', 'Add items to place an order')
      return
    }

    if (processing || Date.now() - lastSubmissionRef.current < 1200) return
    lastSubmissionRef.current = Date.now()
    setProcessing(true)

    try {
      if (editingOrder) {
        await saveEditedOrder()
        return
      }

      const invalidItem = cart.find(item => (
        safeNumber(item.quantity) <= 0 ||
        safeNumber(item.quantity) > getStock(inventory.find(product => product.id === item.id))
      ))
      if (invalidItem) {
        throw new Error(`Stock changed for ${invalidItem.name}. Refresh the cart and try again.`)
      }

      const coreOrderData = {
        branch_id: branchId,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || 'Walk-In',
        subtotal: cartSubtotal,
        discount: normalizedDiscount,
        tax: cartTax,
        total: cartTotal,
        status: ORDER_STATUS.PENDING,
        created_by: user?.id,
        created_by_name: user?.name,
        created_at: now(),
      }

      const optionalOrderData = {
        type: orderType,
        notes: orderNotes.trim() || null,
        reference: orderReferenceText.trim() || null,
      }

      const { data: order, error: orderError } = await insertOrderWithFallback(
        coreOrderData,
        optionalOrderData
      )

      if (orderError) throw orderError

      const lineItems = cart.map(item => ({
        order_id: order.id,
        inventory_id: item.id,
        quantity: safeNumber(item.quantity),
        price: extractLinePrice(item),
        subtotal: safeNumber(item.quantity) * extractLinePrice(item),
        name: item.name,
        created_at: now(),
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(lineItems)

      if (itemsError) {
        await supabase.from('orders').delete().eq('id', order.id)
        throw itemsError
      }

      const adjustedItems = []
      try {
        for (const item of cart) {
          await adjustInventoryBy(item.id, -safeNumber(item.quantity))
          adjustedItems.push(item)
        }
      } catch (inventoryError) {
        for (const item of adjustedItems) {
          await adjustInventoryBy(item.id, safeNumber(item.quantity))
        }
        await supabase.from('order_items').delete().eq('order_id', order.id)
        await supabase.from('orders').delete().eq('id', order.id)
        throw inventoryError
      }

      const completedOrder = {
        ...order,
        ...optionalOrderData,
        order_items: lineItems,
      }

      await logPosActivity(
        'Order Placed',
        `Order #${orderReference(order)}; ${cart.length} line items; ${orderType}; total ${cartTotal.toFixed(2)}`
      )

      showToast('success', 'Order placed', `Order #${orderReference(order)} is ready for payment`)
      printReceipt(completedOrder, lineItems, {
        ...user,
        branch_name: currentBranch?.name || user?.branch_name,
      })
      clearCart()
      await Promise.all([loadInventory(), loadOrders()])
    } catch (err) {
      console.error('[POS] Order error:', err)
      showToast('error', editingOrder ? 'Update failed' : 'Order failed', err.message)
    } finally {
      setProcessing(false)
    }
  }

  // ── Open Payment Modal ──
  const openPaymentModal = (order, shouldPrint = false) => {
    const paidSoFar = safeNumber(order.paid_amount)
    const due = Math.max(0, safeNumber(order.due_amount, safeNumber(order.total) - paidSoFar))
    setPaymentOrder(order)
    setCashReceived(due)
    setPaymentMethod(PAYMENT_METHODS.CASH)
    setPaymentRemarks('')
    setPrintAfterPayment(shouldPrint)
    setShowPaymentModal(true)
  }

  const ensureLedgerSale = async (order) => {
    if (!order.customer_id) return
    const { data: existing, error: lookupError } = await supabase
      .from('ledger_entries')
      .select('id')
      .eq('order_id', order.id)
      .eq('branch_id', branchId)
      .eq('type', 'sale')
      .limit(1)

    if (lookupError) {
      console.warn('[POS] Ledger lookup failed:', lookupError.message)
      return
    }

    if ((existing || []).length === 0) {
      const { error } = await supabase.from('ledger_entries').insert([{
        customer_id: order.customer_id,
        branch_id: branchId,
        order_id: order.id,
        amount: safeNumber(order.total),
        type: 'sale',
        description: `Sale order #${orderReference(order)}`,
        created_by: user?.id,
        created_by_name: user?.name,
        created_at: now(),
      }])
      if (error) console.warn('[POS] Sale ledger entry failed:', error.message)
    }
  }

  // ── Process Payment ──
  const processPayment = async (shouldPrint = printAfterPayment) => {
    if (!paymentOrder || paymentProcessing) return

    const total = safeNumber(paymentOrder.total)
    const alreadyPaid = safeNumber(paymentOrder.paid_amount)
    const dueBefore = Math.max(
      0,
      safeNumber(paymentOrder.due_amount, total - alreadyPaid)
    )

    if (dueBefore <= 0) {
      showToast('info', 'Already paid', 'This order has no outstanding balance')
      setShowPaymentModal(false)
      return
    }

    const paymentAmount = paymentMethod === PAYMENT_METHODS.CREDIT ? 0 : dueBefore
    if (paymentMethod === PAYMENT_METHODS.CASH && safeNumber(cashReceived) < paymentAmount) {
      showToast('error', 'Insufficient cash', `Receive at least ${formatPrice(paymentAmount)}`)
      return
    }

    setPaymentProcessing(true)

    try {
      const status = paymentMethod === PAYMENT_METHODS.CREDIT 
        ? ORDER_STATUS.CREDIT 
        : ORDER_STATUS.PAID
      const paidTotal = alreadyPaid + paymentAmount
      const dueAfter = Math.max(0, total - paidTotal)
      let paymentRecord = null

      if (paymentAmount > 0) {
        const { data, error: paymentError } = await supabase
          .from('order_payments')
          .insert([{
            order_id: paymentOrder.id,
            amount: paymentAmount,
            method: paymentMethod,
            remarks: paymentRemarks.trim() || null,
            created_at: now(),
          }])
          .select()
          .single()

        if (paymentError) throw paymentError
        paymentRecord = data
      }

      const { data: order, error } = await supabase
        .from('orders')
        .update({ 
          status,
          paid_amount: paidTotal,
          due_amount: paymentMethod === PAYMENT_METHODS.CREDIT ? dueBefore : dueAfter,
          completed_by: user?.id,
          completed_by_name: user?.name,
          completed_at: now(),
          updated_at: now(),
        })
        .eq('id', paymentOrder.id)
        .eq('branch_id', branchId)
        .select()
        .single()

      if (error) {
        if (paymentRecord?.id) {
          await supabase.from('order_payments').delete().eq('id', paymentRecord.id)
        }
        throw error
      }

      if (order.customer_id) {
        await ensureLedgerSale({ ...paymentOrder, ...order })
        if (paymentAmount > 0) {
          const { error: ledgerPaymentError } = await supabase.from('ledger_entries').insert([{
            customer_id: order.customer_id,
            branch_id: branchId,
            order_id: order.id,
            amount: -paymentAmount,
            type: 'payment',
            description: `Payment received via ${paymentMethod.replaceAll('_', ' ')} for order #${orderReference(order)}`,
            created_by: user?.id,
            created_by_name: user?.name,
            created_at: now(),
          }])
          if (ledgerPaymentError) {
            console.warn('[POS] Payment ledger entry failed:', ledgerPaymentError.message)
            showToast('warning', 'Payment saved', 'The ledger entry could not be recorded automatically')
          }
        }
      }

      const printableOrder = {
        ...paymentOrder,
        ...order,
        payment_type: paymentMethod,
        order_payments: [
          ...(paymentOrder.order_payments || []),
          ...(paymentRecord ? [paymentRecord] : []),
        ],
      }

      await logPosActivity(
        'Payment Processed',
        `Order #${orderReference(order)}; ${paymentMethod}; amount ${paymentAmount.toFixed(2)}; status ${status}`
      )

      showToast('success', 'Payment processed', `Order #${orderReference(order)} is ${status.replaceAll('_', ' ')}`)

      if (shouldPrint) {
        printReceipt(printableOrder, paymentOrder.order_items || [], {
          ...user,
          branch_name: currentBranch?.name || user?.branch_name,
        })
      }

      setShowPaymentModal(false)
      setPaymentOrder(null)
      setCashReceived(0)
      setPaymentRemarks('')
      setPrintAfterPayment(false)
      await Promise.all([loadOrders(), loadTodayOrders()])
    } catch (err) {
      showToast('error', 'Payment failed', err.message)
    } finally {
      setPaymentProcessing(false)
    }
  }

  // ── Cancel Order ──
  const cancelOrder = (order) => {
    if (!isAdmin) {
      showToast('error', 'Manager required', 'Only managers and administrators can cancel orders')
      return
    }
    if (!order || order.status === ORDER_STATUS.CANCELLED) return
    setCancelTarget(order)
    setCancelReason('')
    setShowCancelModal(true)
  }

  const requestCancellationAuthorization = () => {
    if (!cancelTarget || !cancelReason.trim()) {
      showToast('error', 'Reason required', 'Enter a cancellation reason before continuing')
      return
    }
    setShowCancelModal(false)
    setAuthAction({ type: 'cancel', order: cancelTarget })
    setShowAuthModal(true)
  }

  const confirmCancelOrder = async (targetOrder) => {
    if (!targetOrder || targetOrder.status === ORDER_STATUS.CANCELLED) return

    try {
      const { data: order, error } = await supabase
        .from('orders')
        .update({ 
          status: ORDER_STATUS.CANCELLED,
          cancelled_by: user?.id,
          cancelled_by_name: user?.name,
          cancellation_reason: cancelReason.trim(),
          cancelled_at: now(),
          updated_at: now(),
        })
        .eq('id', targetOrder.id)
        .eq('branch_id', branchId)
        .neq('status', ORDER_STATUS.CANCELLED)
        .select()
        .single()

      if (error) throw error

      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', targetOrder.id)

      for (const item of (items || [])) {
        if (item.inventory_id && safeNumber(item.quantity) > 0) {
          await adjustInventoryBy(item.inventory_id, safeNumber(item.quantity))
        }
      }

      if (order.customer_id) {
        const { data: ledgerRows, error: ledgerLookupError } = await supabase
          .from('ledger_entries')
          .select('amount')
          .eq('order_id', order.id)
          .eq('branch_id', branchId)

        if (!ledgerLookupError) {
          const netAmount = (ledgerRows || []).reduce(
            (sum, entry) => sum + safeNumber(entry.amount),
            0
          )
          if (Math.abs(netAmount) > 0.0001) {
            await supabase.from('ledger_entries').insert([{
              customer_id: order.customer_id,
              branch_id: branchId,
              order_id: order.id,
              amount: -netAmount,
              type: 'cancellation',
              description: `Cancellation adjustment for order #${orderReference(order)}: ${cancelReason.trim()}`,
              created_by: user?.id,
              created_by_name: user?.name,
              created_at: now(),
            }])
          }
        }
      }

      await logPosActivity(
        'Order Cancelled',
        `Order #${orderReference(order)}; reason: ${cancelReason.trim()}`
      )

      showToast('success', 'Order cancelled', `Order #${orderReference(order)} was cancelled and stock restored`)
      setShowAuthModal(false)
      setAuthAction(null)
      setAuthPassword('')
      setCancelTarget(null)
      setCancelReason('')
      await Promise.all([loadOrders(), loadInventory(), loadTodayOrders()])
    } catch (err) {
      showToast('error', 'Cancellation failed', err.message)
    }
  }

  const beginEditOrder = (order) => {
    if (!order || ![ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID].includes(order.status)) {
      showToast('error', 'Cannot edit', 'Only pending or partially paid orders can be edited')
      return
    }

    const selected = customers.find(customer => customer.id === order.customer_id) || null
    const editableItems = (order.order_items || []).map(item => {
      const product = inventory.find(inventoryItem => inventoryItem.id === item.inventory_id)
      const originalQuantity = safeNumber(item.quantity)
      return {
        id: item.inventory_id,
        inventory_id: item.inventory_id,
        name: item.name || product?.name || 'Item',
        quantity: originalQuantity,
        original_quantity: originalQuantity,
        price: extractLinePrice(item),
        sale_price: extractLinePrice(item),
        unit: product?.unit || 'unit',
        sku: product?.sku || '',
        max_stock: getStock(product) + originalQuantity,
      }
    })

    setEditingOrder(order)
    setCart(editableItems)
    setSelectedCustomer(selected)
    setDiscount(safeNumber(order.discount))
    const taxableBase = Math.max(0, safeNumber(order.subtotal) - safeNumber(order.discount))
    setTaxRate(taxableBase > 0 ? (safeNumber(order.tax) / taxableBase) * 100 : 0)
    setOrderType(order.type || order.order_type || 'branch_dispatch')
    setOrderNotes(order.notes || '')
    setOrderReferenceText(order.reference || '')
    setActiveTab('new_order')
    setTimeout(() => searchInputRef.current?.focus(), 0)
    showToast('info', 'Editing order', `Changes will update order #${orderReference(order)} without creating a duplicate`)
  }

  const requestEditAuthorization = (order) => {
    if (!isAdmin) {
      showToast('error', 'Manager required', 'Only managers and administrators can edit existing orders')
      return
    }
    setAuthAction({ type: 'edit', order })
    setShowAuthModal(true)
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
        .eq('branch_id', branchId)
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
        .select('*, order_items(*), order_payments(*)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })

      if (reportFilters.startDate) {
        query = query.gte('created_at', `${reportFilters.startDate}T00:00:00`)
      }
      if (reportFilters.endDate) {
        query = query.lte('created_at', reportFilters.endDate + 'T23:59:59')
      }
      if (reportFilters.customer) {
        query = query.eq('customer_id', reportFilters.customer)
      }
      if (reportFilters.status !== 'all') {
        query = query.eq('status', reportFilters.status)
      }

      let { data, error } = await query

      if (error) {
        let fallbackQuery = supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
        if (reportFilters.startDate) fallbackQuery = fallbackQuery.gte('created_at', `${reportFilters.startDate}T00:00:00`)
        if (reportFilters.endDate) fallbackQuery = fallbackQuery.lte('created_at', `${reportFilters.endDate}T23:59:59`)
        if (reportFilters.customer) fallbackQuery = fallbackQuery.eq('customer_id', reportFilters.customer)
        if (reportFilters.status !== 'all') fallbackQuery = fallbackQuery.eq('status', reportFilters.status)
        const fallback = await fallbackQuery
        data = fallback.data
        error = fallback.error
      }

      if (error) throw error
      const filtered = reportFilters.paymentType === 'all'
        ? (data || [])
        : (data || []).filter(order => getPaymentMethod(order) === reportFilters.paymentType)
      setReportData(filtered)
    } catch (err) {
      showToast('error', 'Report failed', err.message)
    } finally {
      setReportLoading(false)
    }
  }

  const viewOrderDetail = (order) => {
    setDetailOrder(order)
    setShowOrderDetailModal(true)
  }

  const handlePrintOrder = async (order) => {
    let items = order.order_items || []
    if (items.length === 0) {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)
      if (error) {
        showToast('error', 'Print failed', error.message)
        return
      }
      items = data || []
    }
    printReceipt(order, items, {
      ...user,
      branch_name: currentBranch?.name || user?.branch_name,
    })
  }

  const exportReportCSV = () => {
    if (reportData.length === 0) {
      showToast('info', 'Nothing to export', 'Run a report that contains at least one order')
      return
    }

    const rows = [
      ['Invoice', 'Created', 'Customer', 'Type', 'Payment', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status'],
      ...reportData.map(order => [
        orderReference(order),
        formatDateTime(order.created_at),
        order.customer_name || 'Walk-In',
        (order.type || order.order_type || 'sale').replaceAll('_', ' '),
        (getPaymentMethod(order) || 'N/A').replaceAll('_', ' '),
        safeNumber(order.subtotal).toFixed(2),
        safeNumber(order.discount).toFixed(2),
        safeNumber(order.tax).toFixed(2),
        safeNumber(order.total).toFixed(2),
        order.status || 'pending',
      ]),
    ]

    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n')
    downloadTextFile(
      `stocko-pos-report-${reportFilters.startDate || 'all'}-${reportFilters.endDate || 'all'}.csv`,
      `\uFEFF${csv}`,
      'text/csv;charset=utf-8'
    )
    showToast('success', 'CSV exported', `${reportData.length} orders were exported`)
  }

  const printReport = () => {
    if (reportData.length === 0) {
      showToast('info', 'Nothing to print', 'Run a report that contains at least one order')
      return
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=760')
    if (!printWindow) {
      showToast('error', 'Popup blocked', 'Allow popups to print the report')
      return
    }

    const totalRevenue = reportData.reduce((sum, order) => (
      order.status === ORDER_STATUS.CANCELLED ? sum : sum + safeNumber(order.total)
    ), 0)

    const rows = reportData.map((order, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(orderReference(order))}</td>
        <td>${escapeHtml(formatDateTime(order.created_at))}</td>
        <td>${escapeHtml(order.customer_name || 'Walk-In')}</td>
        <td>${escapeHtml((getPaymentMethod(order) || 'N/A').replaceAll('_', ' '))}</td>
        <td class="right">Rs. ${safeNumber(order.total).toFixed(2)}</td>
        <td>${escapeHtml((order.status || 'pending').replaceAll('_', ' '))}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Stocko POS Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            h1 { font-size: 22px; margin: 0 0 4px; }
            p { color: #6b7280; margin: 0 0 18px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #f8fafc; }
            .right { text-align: right; }
            .summary { margin: 18px 0; display: flex; gap: 24px; font-weight: 700; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>Stocko POS Sales Report</h1>
          <p>${escapeHtml(currentBranch?.name || user?.branch_name || 'Branch')} · ${escapeHtml(reportFilters.startDate || 'Beginning')} to ${escapeHtml(reportFilters.endDate || 'Today')}</p>
          <div class="summary">
            <span>Orders: ${reportData.length}</span>
            <span>Revenue: Rs. ${totalRevenue.toFixed(2)}</span>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Invoice</th><th>Time</th><th>Customer</th><th>Payment</th><th>Total</th><th>Status</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <button onclick="window.print()" style="margin-top:18px;padding:10px 18px;">Print report</button>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
  }

  // ── Auth Check ──
  const checkAuth = async () => {
    if (!isAdmin || !authAction) {
      showToast('error', 'Access denied', 'Manager authorization is required')
      return
    }
    if (!authPassword) {
      showToast('error', 'Password required', 'Enter your current Stocko password')
      return
    }

    setAuthProcessing(true)
    try {
      let email = user?.email
      if (!email && user?.id) {
        const { data } = await supabase
          .from('users')
          .select('email')
          .eq('id', user.id)
          .single()
        email = data?.email
      }

      if (!email) throw new Error('The current user email could not be verified')

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: authPassword,
      })
      if (error) throw new Error('The password is incorrect')

      const action = authAction
      setShowAuthModal(false)
      setAuthAction(null)
      setAuthPassword('')

      if (action.type === 'cancel') {
        await confirmCancelOrder(action.order)
      } else if (action.type === 'edit') {
        beginEditOrder(action.order)
      }
    } catch (error) {
      showToast('error', 'Authorization failed', error.message)
      setAuthPassword('')
    } finally {
      setAuthProcessing(false)
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
        minHeight: '60vh',
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
    <div className="stocko-pos-shell animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'calc(100dvh - 100px)',
      minHeight: '660px',
      background: colors.bgPage,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
      boxShadow: colors.shadowSm,
    }}>
      <style>{`
        .stocko-pos-shell, .stocko-pos-shell * {
          box-sizing: border-box;
        }
        .stocko-pos-shell {
          font-size: 13px;
        }
        .stocko-pos-shell button,
        .stocko-pos-shell input,
        .stocko-pos-shell select,
        .stocko-pos-shell textarea {
          font: inherit;
        }
        .stocko-pos-shell button:focus-visible,
        .stocko-pos-shell input:focus-visible,
        .stocko-pos-shell select:focus-visible,
        .stocko-pos-shell textarea:focus-visible {
          outline: 3px solid ${dark ? 'rgba(96,165,250,.35)' : 'rgba(37,99,235,.22)'};
          outline-offset: 2px;
        }
        .stocko-pos-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${theme?.scrollbarThumb || '#94a3b8'} transparent;
        }
        .stocko-pos-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .stocko-pos-scroll::-webkit-scrollbar-thumb {
          background: ${theme?.scrollbarThumb || '#94a3b8'};
          border-radius: 999px;
        }
        .stocko-pos-tab-strip {
          min-width: 0;
        }
        .stocko-pos-product-card:hover {
          transform: translateY(-1px);
        }
        .stocko-pos-product-grid {
          align-content: start;
          grid-auto-rows: minmax(82px, auto);
        }
        .stocko-pos-product-card {
          min-height: 82px;
          align-self: start;
        }
        .stocko-pos-product-name,
        .stocko-pos-product-price {
          font-size: 13px !important;
        }
        .stocko-pos-cart-panel {
          width: clamp(440px, 35%, 540px) !important;
          min-width: 440px;
        }
        .stocko-pos-table-row:hover {
          background: ${colors.bgHover} !important;
        }
        @media (max-width: 1180px) {
          .stocko-pos-cart-panel {
            width: 410px !important;
            min-width: 410px !important;
          }
          .stocko-pos-product-grid {
            grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)) !important;
          }
          .stocko-pos-toolbar-metric {
            display: none !important;
          }
        }
        @media (max-width: 900px) {
          .stocko-pos-shell {
            height: auto !important;
            min-height: calc(100vh - 145px) !important;
            overflow: visible !important;
          }
          .stocko-pos-tab-strip {
            overflow-x: auto !important;
            justify-content: flex-start !important;
          }
          .stocko-pos-main {
            overflow: visible !important;
          }
          .stocko-pos-sale-layout {
            flex-direction: column !important;
            overflow: visible !important;
          }
          .stocko-pos-products-panel {
            min-height: 560px;
            border-right: 0 !important;
          }
          .stocko-pos-cart-panel {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 620px;
            border-left: 0 !important;
            border-top: 1px solid ${colors.border};
          }
          .stocko-pos-payment-layout {
            flex-direction: column !important;
          }
          .stocko-pos-payment-options {
            width: 100% !important;
            border-left: 0 !important;
            border-top: 1px solid ${colors.border};
          }
        }
        @media (max-width: 640px) {
          .stocko-pos-shell {
            border-radius: 10px !important;
          }
          .stocko-pos-command-bar {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .stocko-pos-tab-strip {
            width: 100%;
          }
          .stocko-pos-tab-button {
            padding: 9px 11px !important;
          }
          .stocko-pos-search-bar {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .stocko-pos-search-bar > * {
            width: 100% !important;
            max-width: none !important;
          }
          .stocko-pos-product-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            padding: 8px !important;
            gap: 8px !important;
          }
          .stocko-pos-product-card {
            padding: 10px !important;
          }
          .stocko-pos-order-card-header,
          .stocko-pos-order-actions,
          .stocko-pos-report-header {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .stocko-pos-modal {
            width: calc(100vw - 20px) !important;
            max-height: calc(100vh - 20px) !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          POS COMMAND BAR — global application Header remains the only header
          ═══════════════════════════════════════════════════════════════ */}
      <div className="stocko-pos-command-bar" style={{
        background: colors.bgHeader,
        borderBottom: `1px solid ${colors.border}`,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minHeight: '52px',
        flexShrink: 0,
      }}>
        <div className="stocko-pos-tab-strip stocko-pos-scroll" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
        }}>
          {[
            { id: 'new_order', label: editingOrder ? 'Edit Dispatch' : 'New Dispatch', icon: editingOrder ? 'Edit' : 'Plus', count: null },
            { id: 'pending', label: 'Pending', icon: 'History', count: pendingOrders.length },
            { id: 'cancelled', label: 'Cancelled', icon: 'X', count: cancelledOrders.length },
            { id: 'reports', label: 'Reports', icon: 'BarChart2', restricted: true, count: null },
          ].map((tab) => {
            if (tab.restricted && !hasReportAccess) return null

            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                className="stocko-pos-tab-button"
                onClick={() => {
                  if (editingOrder && tab.id !== 'new_order') {
                    showToast('warning', 'Finish editing first', 'Save or cancel the current order edit before leaving')
                    return
                  }
                  setActiveTab(tab.id)
                  if (tab.id === 'reports' && reportData.length === 0) loadTodayOrders()
                }}
                style={{
                  padding: '7px 11px',
                  background: isActive ? colors.primaryLight : colors.bgCard,
                  color: isActive ? colors.primary : colors.textSecondary,
                  border: `1px solid ${isActive ? colors.primary : colors.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 600,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Ic n={tab.icon} size={14} />
                {tab.label}
                {tab.count !== null && (
                  <span style={{
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    borderRadius: '999px',
                    background: isActive ? colors.primary : colors.bgHover,
                    color: isActive ? '#fff' : colors.textMuted,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 800,
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}>
          <div className="stocko-pos-toolbar-metric" style={{
            padding: '5px 9px',
            borderRadius: '8px',
            background: colors.bgHover,
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: '9px', color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
              Today
            </div>
            <div style={{ fontSize: '11px', color: colors.textPrimary, fontWeight: 750 }}>
              {formatPrice(todaySales)} · {todayOrderCount} orders
            </div>
          </div>

          <button
            onClick={() => refreshAll()}
            disabled={refreshing}
            title="Refresh POS data"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              background: colors.bgCard,
              color: colors.textMuted,
              cursor: refreshing ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <Ic n="RefreshCw" size={14} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════════════ */}
      <div className="stocko-pos-main" style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>

        {/* ── TAB: NEW ORDER ── */}
        {activeTab === 'new_order' && (
          <div className="stocko-pos-sale-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* LEFT: PRODUCTS */}
            <div className="stocko-pos-products-panel" style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: colors.bgPage,
              borderRight: `1px solid ${colors.border}`,
              overflow: 'hidden',
            }}>
              {/* Search & Filter Bar */}
              <div className="stocko-pos-search-bar" style={{
                padding: '10px 12px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                gap: '8px',
                background: colors.bgCard,
                alignItems: 'center',
              }}>
                <div style={{
                  flex: 1,
                  position: 'relative',
                }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search products by name, SKU, or barcode..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: productSearch ? '8px 38px 8px 36px' : '8px 10px 8px 36px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      fontSize: '13px',
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
                  <span aria-hidden="true" style={{
                    position: 'absolute',
                    left: '11px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.textMuted,
                    display: 'inline-flex',
                  }}>
                    <Ic n="Search" size={15} />
                  </span>
                  {productSearch && (
                    <button
                      onClick={() => {
                        setProductSearch('')
                        searchInputRef.current?.focus()
                      }}
                      aria-label="Clear product search"
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '28px',
                        height: '28px',
                        border: 'none',
                        borderRadius: '7px',
                        background: colors.bgHover,
                        color: colors.textMuted,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ic n="X" size={14} />
                    </button>
                  )}
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.textPrimary,
                    fontSize: '13px',
                    minWidth: '150px',
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
                  padding: '8px 11px',
                  background: colors.bgHover,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textMuted,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}>
                  <Ic n="Package" size={14} />
                  {filteredInventory.length} items
                </div>
              </div>

              {/* Products Grid */}
              <div className="stocko-pos-product-grid stocko-pos-scroll" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gridAutoRows: 'minmax(82px, auto)',
                alignContent: 'start',
                gap: '8px',
              }}>
                {loading ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '60px 20px', 
                    color: colors.textMuted 
                  }}>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>Loading inventory...</div>
                  </div>
                ) : filteredInventory.length === 0 ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '60px 20px', 
                    color: colors.textMuted 
                  }}>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>No products found</div>
                  </div>
                ) : (
                  filteredInventory.map(product => {
                    const salePrice = extractSalePrice(product)
                    const stock = getStock(product)
                    const inStock = stock > 0
                    const inCart = cart.find(c => c.id === product.id)
                    const lowStock = stock > 0 && stock <= Math.max(5, safeNumber(product.threshold))

                    return (
                      <div
                        key={product.id}
                        className="stocko-pos-product-card"
                        onClick={() => inStock && addToCart(product)}
                        onKeyDown={(event) => {
                          if (inStock && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault()
                            addToCart(product)
                          }
                        }}
                        role="button"
                        tabIndex={inStock ? 0 : -1}
                        aria-disabled={!inStock}
                        style={{
                          background: colors.bgCard,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          padding: '11px 12px',
                          cursor: inStock ? 'pointer' : 'not-allowed',
                          opacity: inStock ? 1 : 0.5,
                          transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
                          position: 'relative',
                          boxShadow: colors.shadowSm,
                        }}
                        onMouseEnter={(e) => {
                          if (inStock) {
                            e.currentTarget.style.borderColor = colors.borderActive
                            e.currentTarget.style.boxShadow = colors.shadowMd
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = colors.border
                          e.currentTarget.style.boxShadow = colors.shadowSm
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          fontSize: '10px',
                          padding: '3px 7px',
                          borderRadius: '20px',
                          background: !inStock ? colors.dangerLight : lowStock ? colors.warningLight : colors.successLight,
                          color: !inStock ? colors.danger : lowStock ? colors.warning : colors.success,
                          fontWeight: 700,
                          border: `1px solid ${inStock ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`,
                        }}>
                          {inStock ? `${stock} ${product.unit || ''}`.trim() : 'Out of stock'}
                        </div>

                        <div>
                          <div className="stocko-pos-product-name" style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: colors.textPrimary,
                            marginBottom: '3px',
                            lineHeight: 1.3,
                            paddingRight: '72px',
                          }}>
                            {product.name}
                          </div>
                          <div style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '6px', minHeight: '12px' }}>
                            {product.sku && `SKU: ${product.sku}`}
                            {product.barcode && ` | Barcode: ${product.barcode}`}
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <span className="stocko-pos-product-price" style={{
                              fontSize: '13px',
                              fontWeight: 650,
                              color: colors.textSecondary,
                            }}>
                              {formatPrice(salePrice)}
                            </span>
                            {inCart && (
                              <span style={{
                                fontSize: '10px',
                                background: colors.primary,
                                color: '#fff',
                                padding: '3px 7px',
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
            <div className="stocko-pos-cart-panel" style={{
              width: 'clamp(440px, 35%, 540px)',
              minWidth: '440px',
              display: 'flex',
              flexDirection: 'column',
              background: colors.bgCard,
              borderLeft: `1px solid ${colors.border}`,
              boxShadow: '-1px 0 4px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              {/* Cart Header */}
              <div className="stocko-pos-report-header" style={{
                padding: '11px 13px',
                borderBottom: `1px solid ${colors.border}`,
                background: colors.bgPage,
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '10px',
                }}>
                  <h2 style={{
                    fontSize: '14px',
                    fontWeight: 750,
                    color: colors.textPrimary,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <Ic n="Package" size={16} />
                    Current dispatch
                    <span style={{
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      background: colors.primaryLight,
                      color: colors.primary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 800,
                    }}>
                      {cart.reduce((sum, item) => sum + safeNumber(item.quantity), 0)}
                    </span>
                  </h2>
                  {cart.length > 0 && !editingOrder && (
                    <button
                      onClick={clearCart}
                      style={{
                        padding: '6px 9px',
                        background: 'transparent',
                        color: colors.danger,
                        border: `1px solid ${colors.danger}`,
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Ic n="Trash2" size={13} />
                      Clear
                    </button>
                  )}
                </div>

                {editingOrder && (
                  <div style={{
                    marginBottom: '10px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    background: colors.warningLight,
                    color: dark ? '#fcd34d' : '#92400e',
                    border: `1px solid ${colors.warning}`,
                    fontSize: '12px',
                    fontWeight: 650,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                  }}>
                    <Ic n="Edit" size={14} />
                    Editing #{orderReference(editingOrder)} — saving updates this order
                  </div>
                )}

                {/* Receiving branch/customer selection */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <select
                      value={selectedCustomer?.id || ''}
                      disabled={customersLoading}
                      onChange={(e) => {
                        const cust = customers.find(c => c.id === e.target.value)
                        setSelectedCustomer(cust || null)
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 28px 8px 10px',
                        background: colors.bgInput,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        color: colors.textPrimary,
                        fontSize: '13px',
                        cursor: 'pointer',
                        appearance: 'none',
                        outline: 'none',
                      }}
                    >
                      <option value="">{customersLoading ? 'Loading destinations…' : 'Select receiving branch / customer'}</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden="true" style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: colors.textMuted,
                      fontSize: '10px',
                      pointerEvents: 'none',
                    }}>▾</span>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '7px',
                  marginTop: '8px',
                }}>
                  <input
                    value={orderReferenceText}
                    onChange={event => setOrderReferenceText(event.target.value)}
                    placeholder="Demand / transfer reference"
                    maxLength={80}
                    style={{
                      minWidth: 0,
                      width: '100%',
                      padding: '8px 9px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bgInput,
                      color: colors.textPrimary,
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  />
                  <input
                    value={orderNotes}
                    onChange={event => setOrderNotes(event.target.value)}
                    placeholder="Dispatch note"
                    maxLength={240}
                    style={{
                      minWidth: 0,
                      width: '100%',
                      padding: '8px 9px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bgInput,
                      color: colors.textPrimary,
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  />
                </div>

                {selectedCustomer && (
                  <div style={{
                    fontSize: '11px',
                    color: colors.textMuted,
                    marginTop: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    <Ic n="User" size={12} />
                    <strong style={{ color: colors.textSecondary }}>{selectedCustomer.name}</strong>
                    {selectedCustomer.phone && <span>· {selectedCustomer.phone}</span>}
                  </div>
                )}
              </div>

              {/* Cart Items */}
              <div className="stocko-pos-scroll" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 12px',
                background: colors.bgPage,
              }}>
                {cart.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '42px 20px',
                    color: colors.textMuted 
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      margin: '0 auto 12px',
                      borderRadius: '14px',
                      background: colors.primaryLight,
                      color: colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ic n="ShoppingCart" size={22} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>
                      Dispatch is empty
                    </div>
                    <div style={{ fontSize: '12px' }}>Select stock items to prepare this dispatch</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {cart.map(item => (
                      <div
                        key={item.id}
                        style={{
                          background: colors.bgCard,
                          padding: '10px 11px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          boxShadow: colors.shadowSm,
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '7px',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: '13px',
                              fontWeight: 600, 
                              color: colors.textPrimary 
                            }}>
                              {item.name}
                            </div>
                            <div style={{ 
                              fontSize: '11px',
                              color: colors.textMuted, 
                              marginTop: '3px' 
                            }}>
                              {formatPrice(extractLinePrice(item))} each
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
                            <Ic n="X" size={15} />
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
                            {formatPrice(safeNumber(item.quantity) * extractLinePrice(item))}
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
                  padding: '10px 14px',
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
                      max={cartSubtotal}
                      value={discount}
                      onChange={(e) => setDiscount(
                        clamp(safeNumber(e.target.value), 0, cartSubtotal)
                      )}
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
                      onChange={(e) => setTaxRate(
                        clamp(safeNumber(e.target.value), 0, 100)
                      )}
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
                  padding: '11px 14px',
                  borderBottom: `1px solid ${colors.border}`,
                  background: colors.bgCard,
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '6px', 
                    fontSize: '12px'
                  }}>
                    <span style={{ color: colors.textMuted }}>Subtotal:</span>
                    <span style={{ fontWeight: 600, color: colors.textSecondary }}>{formatPrice(cartSubtotal)}</span>
                  </div>
                  {normalizedDiscount > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '6px', 
                      fontSize: '14px' 
                    }}>
                      <span style={{ color: colors.textMuted }}>Discount:</span>
                      <span style={{ color: colors.success, fontWeight: 600 }}>-{formatPrice(normalizedDiscount)}</span>
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
                      <span style={{ fontWeight: 600, color: colors.textSecondary }}>{formatPrice(cartTax)}</span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0 0',
                    borderTop: `2px solid ${colors.border}`,
                    fontSize: '13px',
                  }}>
                    <span style={{ fontWeight: 700, color: colors.textPrimary }}>TOTAL</span>
                    <span style={{ 
                      fontSize: '20px',
                      fontWeight: 900, 
                      color: colors.primary 
                    }}>
                      {formatPrice(cartTotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                padding: '10px 12px',
                display: 'flex',
                gap: '10px',
                background: colors.bgCard,
              }}>
                <button
                  onClick={editingOrder ? cancelEditing : clearCart}
                  disabled={cart.length === 0 && !editingOrder}
                  style={{
                    padding: '9px 13px',
                    background: editingOrder ? colors.bgHover : colors.dangerLight,
                    color: editingOrder ? colors.textSecondary : colors.danger,
                    border: `1px solid ${editingOrder ? colors.border : colors.danger}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: cart.length === 0 && !editingOrder ? 'not-allowed' : 'pointer',
                    opacity: cart.length === 0 && !editingOrder ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Ic n={editingOrder ? 'X' : 'Trash2'} size={15} />
                  {editingOrder ? 'Cancel edit' : 'Clear'}
                </button>
                <button
                  onClick={placeOrder}
                  disabled={processing || cart.length === 0}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    background: colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: processing || cart.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: processing || cart.length === 0 ? 0.5 : 1,
                    transition: 'all 0.2s',
                    boxShadow: processing || cart.length === 0 ? 'none' : '0 2px 8px rgba(33, 150, 243, 0.3)',
                  }}
                >
                  <Ic n={editingOrder ? 'Edit' : 'CheckCircle'} size={17} />
                  {processing
                    ? (editingOrder ? 'Saving…' : 'Placing…')
                    : (editingOrder ? 'Save dispatch changes' : 'Create dispatch')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: PENDING ORDERS ── */}
        {activeTab === 'pending' && (
          <div className="stocko-pos-scroll" style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            <div className="stocko-pos-order-card-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 750,
                  color: colors.textPrimary,
                  margin: '0 0 4px',
                }}>
                  Pending orders
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: colors.textMuted }}>
                  Review branch dispatches, print details, or use manager controls.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  padding: '7px 11px',
                  background: colors.bgCard,
                  borderRadius: '9px',
                  color: colors.textMuted,
                  fontSize: '12px',
                  border: `1px solid ${colors.border}`,
                  fontWeight: 700,
                }}>
                  {pendingOrders.length} open
                </div>
                <button
                  onClick={() => loadOrders()}
                  disabled={ordersLoading}
                  style={{
                    width: '34px',
                    height: '34px',
                    border: `1px solid ${colors.border}`,
                    background: colors.bgCard,
                    borderRadius: '9px',
                    color: colors.textMuted,
                    cursor: ordersLoading ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ic n="RefreshCw" size={15} />
                </button>
              </div>
            </div>

            {ordersLoading ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                color: colors.textMuted,
                background: colors.bgCard,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
              }}>
                Loading pending orders…
              </div>
            ) : pendingOrders.length === 0 ? (
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
                gap: '8px',
              }}>
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="stocko-pos-table-row"
                    style={{
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      padding: '14px',
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
                    <div className="stocko-pos-order-card-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: colors.textPrimary,
                          marginBottom: '4px',
                        }}>
                          Order #{orderReference(order)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                        }}>
                          {formatDateTime(order.created_at)} · {order.customer_name || 'Walk-In'} · {(order.type || order.order_type || 'sale').replaceAll('_', ' ')}
                        </div>
                      </div>
                      <div style={{
                        padding: '5px 10px',
                        ...statusStyle(order.status),
                        borderRadius: '20px',
                        fontSize: '10px',
                        fontWeight: 700,
                        border: `1px solid rgba(255, 152, 0, 0.2)`,
                      }}>
                        {(order.status || ORDER_STATUS.PENDING).replaceAll('_', ' ').toUpperCase()}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '18px',
                      marginBottom: '10px',
                      fontSize: '12px',
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
                          {formatPrice(order.total)}
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
                    <div className="stocko-pos-order-actions" style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      paddingTop: '10px',
                      borderTop: `1px solid ${colors.border}`,
                    }}>
                      <button
                        onClick={() => viewOrderDetail(order)}
                        style={{
                          padding: '7px 10px',
                          background: colors.bgHover,
                          color: colors.textSecondary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="Eye" size={14} />
                        View
                      </button>
                      <button
                        onClick={() => handlePrintOrder(order)}
                        style={{
                          padding: '7px 10px',
                          background: colors.bgHover,
                          color: colors.textSecondary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="Printer" size={14} />
                        Print
                      </button>
                      <button
                        onClick={() => openPaymentModal(order)}
                        style={{
                          padding: '7px 11px',
                          background: colors.success,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="DollarSign" size={14} />
                        Pay
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => requestEditAuthorization(order)}
                            style={{
                              padding: '7px 10px',
                              background: colors.primaryLight,
                              color: colors.primary,
                              border: `1px solid ${colors.primary}`,
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Ic n="Edit" size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => cancelOrder(order)}
                            style={{
                              padding: '7px 10px',
                              background: colors.dangerLight,
                              color: colors.danger,
                              border: `1px solid ${colors.danger}`,
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Ic n="X" size={14} />
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CANCELLED ORDERS ── */}
        {activeTab === 'cancelled' && (
          <div className="stocko-pos-scroll" style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            <div className="stocko-pos-order-card-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 750,
                  color: colors.textPrimary,
                  margin: '0 0 4px',
                }}>
                  Cancelled orders
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: colors.textMuted }}>
                  Audit cancellation reasons and reprint archived receipts.
                </p>
              </div>
              <div style={{
                padding: '7px 11px',
                background: colors.bgCard,
                borderRadius: '20px',
                color: colors.textMuted,
                fontSize: '12px',
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
                gap: '8px',
              }}>
                {cancelledOrders.map((order) => (
                  <div
                    key={order.id}
                    className="stocko-pos-table-row"
                    style={{
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      padding: '14px',
                      opacity: 0.85,
                      boxShadow: colors.shadowSm,
                    }}
                  >
                    <div className="stocko-pos-order-card-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: colors.textPrimary,
                          marginBottom: '4px',
                        }}>
                          Order #{orderReference(order)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                        }}>
                          {formatDateTime(order.created_at)} · {order.customer_name || 'Walk-In'}
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
                          {formatPrice(order.total)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>Cancelled By: </span>
                        <span style={{ color: colors.textSecondary }}>
                          {order.cancelled_by_name || order.cancelled_by || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    {order.cancellation_reason && (
                      <div style={{
                        padding: '10px 12px',
                        marginBottom: '12px',
                        borderRadius: '8px',
                        background: colors.dangerLight,
                        color: dark ? '#fecaca' : '#991b1b',
                        fontSize: '12px',
                        lineHeight: 1.5,
                      }}>
                        <strong>Reason:</strong> {order.cancellation_reason}
                      </div>
                    )}
                    <div className="stocko-pos-order-actions" style={{
                      display: 'flex',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: `1px solid ${colors.border}`,
                    }}>
                      <button
                        onClick={() => viewOrderDetail(order)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '7px',
                          border: `1px solid ${colors.border}`,
                          background: colors.bgHover,
                          color: colors.textSecondary,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="Eye" size={14} />
                        Details
                      </button>
                      <button
                        onClick={() => handlePrintOrder(order)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '7px',
                          border: `1px solid ${colors.border}`,
                          background: colors.bgHover,
                          color: colors.textSecondary,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="Printer" size={14} />
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: REPORTS ── */}
        {activeTab === 'reports' && hasReportAccess && (
          <div className="stocko-pos-scroll" style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            {/* Filter Section */}
            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '16px',
              boxShadow: colors.shadowSm,
            }}>
              <div className="stocko-pos-report-header" style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '14px',
                marginBottom: '14px',
              }}>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 750,
                    color: colors.textPrimary,
                    margin: '0 0 4px',
                  }}>
                    Dispatch report
                  </h3>
                  <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px' }}>
                    Filter branch orders, export CSV, or print an audit-ready summary.
                  </p>
                </div>
                <div style={{
                  padding: '8px 11px',
                  borderRadius: '8px',
                  background: colors.primaryLight,
                  color: colors.primary,
                  fontSize: '12px',
                  fontWeight: 750,
                }}>
                  {currentBranch?.name || user?.branch_name || 'Current branch'}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '10px',
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
                    Status
                  </label>
                  <select
                    value={reportFilters.status}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, status: e.target.value }))}
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
                    {REPORT_STATUS_OPTIONS.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
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
                      status: 'all',
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
                  <Ic n="Search" size={14} />
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
                  {reportData.length} orders · {formatPrice(reportData.reduce((sum, order) => (
                    order.status === ORDER_STATUS.CANCELLED ? sum : sum + safeNumber(order.total)
                  ), 0))}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                }}>
                  <button
                    onClick={exportReportCSV}
                    style={{
                      padding: '7px 11px',
                      background: colors.bgPage,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '7px',
                      color: colors.textSecondary,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Ic n="Download" size={14} />
                    Export CSV
                  </button>
                  <button
                    onClick={printReport}
                    style={{
                      padding: '7px 11px',
                      background: colors.primary,
                      border: `1px solid ${colors.primary}`,
                      borderRadius: '7px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Ic n="Printer" size={14} />
                    Print report
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="stocko-pos-scroll" style={{ overflowX: 'auto' }}>
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
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>
                            {(order.type || order.order_type || 'sale').replaceAll('_', ' ')}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.primary, fontWeight: 700 }}>
                            {orderReference(order)}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>{order.invoice_no || orderReference(order)}</td>
                          <td style={{ padding: '12px 10px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                            {formatDateTime(order.created_at)}
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
                              background: getPaymentMethod(order) === 'cash' ? colors.successLight : 
                                         getPaymentMethod(order) === 'credit' ? colors.infoLight : 
                                         colors.bgPage,
                              color: getPaymentMethod(order) === 'cash' ? colors.success : 
                                    getPaymentMethod(order) === 'credit' ? colors.info : 
                                    colors.textSecondary,
                              border: `1px solid ${colors.border}`,
                            }}>
                              {getPaymentMethod(order)?.replaceAll('_', ' ') || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary, fontWeight: 700 }}>
                            {formatPrice(order.subtotal)}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.success }}>
                            {safeNumber(order.discount) > 0 ? formatPrice(order.discount) : '—'}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>
                            {safeNumber(order.tax) > 0 ? formatPrice(order.tax) : '—'}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.primary, fontWeight: 800 }}>
                            {formatPrice(order.total)}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              ...statusStyle(order.status),
                              border: `1px solid ${colors.border}`,
                            }}>
                              {(order.status || 'pending').replaceAll('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => handlePrintOrder(order)}
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
                                <Ic n="Printer" size={12} />
                              </button>
                              <button
                                onClick={() => viewOrderDetail(order)}
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
                                <Ic n="Eye" size={12} />
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
          <div className="stocko-pos-modal" style={{
            background: colors.bgModal,
            borderRadius: '14px',
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
                <Ic n="X" size={18} />
              </button>
            </div>

            <div className="stocko-pos-payment-layout" style={{ display: 'flex' }}>
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
                  <div><span style={{ color: colors.textMuted }}>Order ID:</span> <span style={{ fontWeight: 600 }}>{orderReference(paymentOrder)}</span></div>
                  <div><span style={{ color: colors.textMuted }}>Customer:</span> <span style={{ fontWeight: 600 }}>{paymentOrder.customer_name || 'Walk-In'}</span></div>
                  <div><span style={{ color: colors.textMuted }}>Order Status:</span> <span style={{ ...statusStyle(paymentOrder.status), fontWeight: 700, padding: '2px 7px', borderRadius: '999px' }}>{(paymentOrder.status || 'pending').replaceAll('_', ' ')}</span></div>
                  <div><span style={{ color: colors.textMuted }}>Order Date:</span> <span>{formatDateTime(paymentOrder.created_at)}</span></div>
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
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textSecondary }}>{formatPrice(extractLinePrice(item))}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textMuted }}>-</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textMuted }}>-</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textPrimary, fontWeight: 700 }}>
                            {formatPrice(safeNumber(item.quantity) * extractLinePrice(item))}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="5" style={{ padding: '10px 8px', textAlign: 'right', color: colors.textMuted, fontWeight: 600 }}>
                          Sub Total
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: colors.textPrimary, fontWeight: 700 }}>
                          {formatPrice(paymentOrder.subtotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Payment Options */}
              <div className="stocko-pos-payment-options" style={{
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
                    {PAYMENT_OPTIONS.map((method) => (
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
                          <Ic n={method.icon} size={16} />
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
                      min={paymentDue}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(Math.max(0, safeNumber(e.target.value)))}
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
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '6px',
                      marginTop: '8px',
                    }}>
                      {[
                        paymentDue,
                        Math.ceil(paymentDue / 100) * 100,
                        Math.ceil(paymentDue / 500) * 500,
                        Math.ceil(paymentDue / 1000) * 1000,
                      ].filter((value, index, list) => value > 0 && list.indexOf(value) === index).map(value => (
                        <button
                          key={value}
                          onClick={() => setCashReceived(value)}
                          style={{
                            padding: '7px 4px',
                            borderRadius: '7px',
                            border: `1px solid ${colors.border}`,
                            background: colors.bgCard,
                            color: colors.textSecondary,
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {safeNumber(value).toFixed(0)}
                        </button>
                      ))}
                    </div>
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
                        color: cashReceived >= paymentDue ? colors.success : colors.danger,
                        fontWeight: 700,
                      }}>
                        {formatPrice(Math.max(0, safeNumber(cashReceived) - paymentDue))}
                      </span>
                    </div>
                  </div>
                )}

                {paymentMethod === PAYMENT_METHODS.CREDIT && !paymentOrder.customer_id && (
                  <div style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: colors.warningLight,
                    color: dark ? '#fcd34d' : '#92400e',
                    fontSize: '12px',
                    lineHeight: 1.5,
                  }}>
                    Select a named customer before recording a credit sale.
                  </div>
                )}

                <label style={{
                  display: 'block',
                  marginBottom: '16px',
                  color: colors.textMuted,
                  fontSize: '12px',
                  fontWeight: 700,
                }}>
                  Payment note
                  <input
                    value={paymentRemarks}
                    onChange={event => setPaymentRemarks(event.target.value)}
                    placeholder="Optional transaction reference"
                    maxLength={180}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '10px 11px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bgCard,
                      color: colors.textPrimary,
                      outline: 'none',
                    }}
                  />
                </label>

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
                    <span style={{ fontSize: '14px', color: colors.textMuted, fontWeight: 600 }}>Amount due</span>
                    <span style={{ 
                      fontSize: '28px', 
                      fontWeight: 900, 
                      color: colors.redText 
                    }}>
                      {formatPrice(paymentDue)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '10px',
                }}>
                  <button
                    onClick={() => processPayment(false)}
                    disabled={
                      paymentProcessing ||
                      (paymentMethod === PAYMENT_METHODS.CASH && cashReceived < paymentDue) ||
                      (paymentMethod === PAYMENT_METHODS.CREDIT && !paymentOrder.customer_id)
                    }
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
                    <Ic n="CheckCircle" size={15} />
                    {paymentProcessing ? 'Processing...' : 'Pay Only'}
                  </button>
                  <button
                    onClick={() => processPayment(true)}
                    disabled={
                      paymentProcessing ||
                      (paymentMethod === PAYMENT_METHODS.CASH && cashReceived < paymentDue) ||
                      (paymentMethod === PAYMENT_METHODS.CREDIT && !paymentOrder.customer_id)
                    }
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
                    <Ic n="Printer" size={15} />
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
          <div className="stocko-pos-modal" style={{
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
                <Ic n="X" size={18} />
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
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') createCustomer()
                  }}
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
                disabled={!newCustomer.name.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: colors.success,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: newCustomer.name.trim() ? 'pointer' : 'not-allowed',
                  opacity: newCustomer.name.trim() ? 1 : 0.55,
                  boxShadow: '0 2px 6px rgba(76, 175, 80, 0.3)',
                }}
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      {showCancelModal && cancelTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: theme?.overlayBg || 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => {
            setShowCancelModal(false)
            setCancelTarget(null)
            setCancelReason('')
          }}
        >
          <div
            className="stocko-pos-modal"
            style={{
              width: '100%',
              maxWidth: '500px',
              background: colors.bgModal,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              boxShadow: colors.shadowLg,
              overflow: 'hidden',
            }}
            onClick={event => event.stopPropagation()}
          >
            <div style={{
              padding: '18px 20px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <div>
                <h3 style={{ margin: '0 0 3px', color: colors.textPrimary, fontSize: '17px' }}>
                  Cancel order #{orderReference(cancelTarget)}
                </h3>
                <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px' }}>
                  Inventory will be restored and the action will be recorded.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                aria-label="Close cancellation dialog"
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  borderRadius: '8px',
                  background: colors.bgHover,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ic n="X" size={17} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                padding: '12px',
                marginBottom: '16px',
                borderRadius: '10px',
                background: colors.bgPage,
                border: `1px solid ${colors.border}`,
              }}>
                <div>
                  <span style={{ display: 'block', color: colors.textMuted, fontSize: '11px' }}>Customer</span>
                  <strong style={{ color: colors.textPrimary, fontSize: '13px' }}>
                    {cancelTarget.customer_name || 'Walk-In'}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: colors.textMuted, fontSize: '11px' }}>Order total</span>
                  <strong style={{ color: colors.primary, fontSize: '13px' }}>
                    {formatPrice(cancelTarget.total)}
                  </strong>
                </div>
              </div>

              <label style={{
                display: 'block',
                color: colors.textSecondary,
                fontSize: '12px',
                fontWeight: 700,
              }}>
                Cancellation reason *
                <textarea
                  autoFocus
                  value={cancelReason}
                  onChange={event => setCancelReason(event.target.value)}
                  placeholder="Explain why this order is being cancelled"
                  maxLength={300}
                  rows={4}
                  style={{
                    width: '100%',
                    marginTop: '7px',
                    padding: '11px 12px',
                    resize: 'vertical',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '9px',
                    background: colors.bgInput,
                    color: colors.textPrimary,
                    outline: 'none',
                    lineHeight: 1.5,
                  }}
                />
              </label>
              <div style={{ textAlign: 'right', color: colors.textMuted, fontSize: '10px' }}>
                {cancelReason.length}/300
              </div>
            </div>

            <div style={{
              padding: '14px 20px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '9px',
              background: colors.bgPage,
            }}>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                style={{
                  padding: '9px 14px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  background: colors.bgCard,
                  color: colors.textSecondary,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Keep order
              </button>
              <button
                onClick={requestCancellationAuthorization}
                disabled={!cancelReason.trim()}
                style={{
                  padding: '9px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  background: colors.danger,
                  color: '#fff',
                  fontWeight: 700,
                  cursor: cancelReason.trim() ? 'pointer' : 'not-allowed',
                  opacity: cancelReason.trim() ? 1 : 0.55,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Ic n="Lock" size={14} />
                Authorize cancellation
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
          <div className="stocko-pos-modal" style={{
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
                Manager authorization
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
                <Ic n="X" size={18} />
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
                Confirm this restricted {authAction?.type || 'management'} action using
                the currently signed-in manager or administrator account.
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
                <div
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                  }}
                >
                  {user?.name || user?.email || 'Current user'} · {user?.role || 'Manager'}
                </div>
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
                  autoFocus
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
                disabled={authProcessing || !authPassword}
                style={{
                  padding: '12px 20px',
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: authProcessing || !authPassword ? 'not-allowed' : 'pointer',
                  opacity: authProcessing || !authPassword ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                }}
              >
                {authProcessing ? 'Verifying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showOrderDetailModal && detailOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: theme?.overlayBg || 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => {
            setShowOrderDetailModal(false)
            setDetailOrder(null)
          }}
        >
          <div
            className="stocko-pos-modal stocko-pos-scroll"
            style={{
              width: '100%',
              maxWidth: '760px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: colors.bgModal,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              boxShadow: colors.shadowLg,
            }}
            onClick={event => event.stopPropagation()}
          >
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              padding: '18px 20px',
              background: colors.bgModal,
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  marginBottom: '3px',
                }}>
                  <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px' }}>
                    Order #{orderReference(detailOrder)}
                  </h3>
                  <span style={{
                    ...statusStyle(detailOrder.status),
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}>
                    {(detailOrder.status || 'pending').replaceAll('_', ' ')}
                  </span>
                </div>
                <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px' }}>
                  {formatDateTime(detailOrder.created_at)}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowOrderDetailModal(false)
                  setDetailOrder(null)
                }}
                aria-label="Close order details"
                style={{
                  width: '34px',
                  height: '34px',
                  border: 'none',
                  borderRadius: '8px',
                  background: colors.bgHover,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ic n="X" size={17} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
                marginBottom: '18px',
              }}>
                {[
                  ['Customer', detailOrder.customer_name || 'Walk-In'],
                  ['Order type', (detailOrder.type || detailOrder.order_type || 'sale').replaceAll('_', ' ')],
                  ['Payment', (getPaymentMethod(detailOrder) || 'Not paid').replaceAll('_', ' ')],
                  ['Cashier', detailOrder.created_by_name || 'Unknown'],
                  ['Reference', detailOrder.reference || '—'],
                  ['Items', String(detailOrder.order_items?.length || 0)],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    background: colors.bgPage,
                    border: `1px solid ${colors.border}`,
                  }}>
                    <span style={{
                      display: 'block',
                      marginBottom: '3px',
                      color: colors.textMuted,
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      {label}
                    </span>
                    <strong style={{ color: colors.textPrimary, fontSize: '13px', textTransform: 'capitalize' }}>
                      {value}
                    </strong>
                  </div>
                ))}
              </div>

              {detailOrder.notes && (
                <div style={{
                  padding: '11px 12px',
                  marginBottom: '16px',
                  borderRadius: '9px',
                  background: colors.warningLight,
                  color: dark ? '#fde68a' : '#92400e',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}>
                  <strong>Order note:</strong> {detailOrder.notes}
                </div>
              )}

              <div className="stocko-pos-scroll" style={{
                overflowX: 'auto',
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: colors.tableHeader }}>
                      {['Item', 'Qty', 'Price', 'Subtotal'].map(header => (
                        <th key={header} style={{
                          padding: '10px 12px',
                          textAlign: header === 'Item' ? 'left' : 'right',
                          color: colors.textSecondary,
                          borderBottom: `1px solid ${colors.border}`,
                        }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(detailOrder.order_items || []).map((item, index) => (
                      <tr key={item.id || `${item.inventory_id}-${index}`}>
                        <td style={{
                          padding: '10px 12px',
                          color: colors.textPrimary,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {item.name || 'Item'}
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          color: colors.textSecondary,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {safeNumber(item.quantity)}
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          color: colors.textSecondary,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {formatPrice(extractLinePrice(item))}
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          color: colors.textPrimary,
                          fontWeight: 700,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {formatPrice(safeNumber(item.quantity) * extractLinePrice(item))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                width: 'min(100%, 320px)',
                marginLeft: 'auto',
                marginTop: '16px',
                display: 'grid',
                gap: '7px',
              }}>
                {[
                  ['Subtotal', safeNumber(detailOrder.subtotal), false],
                  ['Discount', -safeNumber(detailOrder.discount), false],
                  ['Tax', safeNumber(detailOrder.tax), false],
                  ['Total', safeNumber(detailOrder.total), true],
                ].map(([label, value, important]) => (
                  <div key={label} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: important ? '10px' : 0,
                    marginTop: important ? '3px' : 0,
                    borderTop: important ? `2px solid ${colors.border}` : 'none',
                    color: important ? colors.textPrimary : colors.textMuted,
                    fontSize: important ? '15px' : '12px',
                    fontWeight: important ? 800 : 600,
                  }}>
                    <span>{label}</span>
                    <span style={{ color: important ? colors.primary : 'inherit' }}>
                      {value < 0 ? `-${formatPrice(Math.abs(value))}` : formatPrice(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding: '14px 20px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '9px',
              background: colors.bgPage,
            }}>
              <button
                onClick={() => handlePrintOrder(detailOrder)}
                style={{
                  padding: '9px 13px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  background: colors.bgCard,
                  color: colors.textSecondary,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Ic n="Printer" size={15} />
                Print receipt
              </button>
              {[ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID].includes(detailOrder.status) && (
                <button
                  onClick={() => {
                    setShowOrderDetailModal(false)
                    openPaymentModal(detailOrder)
                  }}
                  style={{
                    padding: '9px 13px',
                    border: 'none',
                    borderRadius: '8px',
                    background: colors.success,
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Ic n="DollarSign" size={15} />
                  Take payment
                </button>
              )}
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
          <div className="stocko-pos-modal stocko-pos-scroll" style={{
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
                <Ic n="X" size={18} />
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
                        #{orderReference(order)}
                      </span>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        ...statusStyle(order.status),
                        border: `1px solid ${colors.border}`,
                      }}>
                        {(order.status || 'pending').replaceAll('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.textMuted,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span>{formatDateTime(order.created_at)}</span>
                      <span style={{ color: colors.primary, fontWeight: 700 }}>
                        {formatPrice(order.total)}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '7px',
                      marginTop: '10px',
                    }}>
                      <button
                        onClick={() => {
                          setShowHistoryModal(false)
                          viewOrderDetail(order)
                        }}
                        style={{
                          padding: '6px 9px',
                          borderRadius: '7px',
                          border: `1px solid ${colors.border}`,
                          background: colors.bgCard,
                          color: colors.textSecondary,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Ic n="Eye" size={12} />
                        Details
                      </button>
                      <button
                        onClick={() => handlePrintOrder(order)}
                        style={{
                          padding: '6px 9px',
                          borderRadius: '7px',
                          border: `1px solid ${colors.border}`,
                          background: colors.bgCard,
                          color: colors.textSecondary,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Ic n="Printer" size={12} />
                        Print
                      </button>
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
