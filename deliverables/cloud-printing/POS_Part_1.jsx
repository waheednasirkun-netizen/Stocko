// STOCKO POS — RESOLVED MERGE
// Keeps the compact redesign and merges service-charge, payment and remote functionality.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import {
  PRINT_JOB_TYPES,
  createPosReceiptPayload,
  createPosReportPayload,
  enqueuePrintJob,
} from '../../lib/printQueue'
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
  if (value === null || value === undefined || value === '') {
    return fallback
  }
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

const getServiceCharge = (order) => Math.max(
  0,
  safeNumber(order?.service_charge ?? order?.service_fee)
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
const posReceiptPrintKey = (order) => `pos_receipt:${order?.id || orderReference(order)}`
const POS_REPORT_PRINT_KEY = 'pos_report'
const getPaymentMethod = (order) => (
  order?.payment_type ||
  order?.order_payments?.at?.(-1)?.method ||
  order?.order_payments?.[0]?.method ||
  null
)

const printReceiptInBrowser = (order, items, user) => {
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
  ${getServiceCharge(order) > 0 ? `
    <div style="display:flex; justify-content:space-between; margin:4px 0;">
      <span>Service charge:</span>
      <span class="bold">Rs. ${getServiceCharge(order).toFixed(2)}</span>
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
  const activePrintRequestsRef = useRef(new Set())

  // ── State ──
  const [inventory, setInventory] = useState([])
  const [cart, setCart] = useState([])
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [discount, setDiscount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [serviceCharge, setServiceCharge] = useState(0)
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
  const [paymentAmount, setPaymentAmount] = useState(0)
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
  const [printingJobs, setPrintingJobs] = useState({})

  // Payment balance helpers intentionally live inside the component so a
  // partial merge cannot leave hook code calling an undefined global helper.
  const getRecordedPaidAmount = useCallback((order) => {
    if (!order) return 0

    const total = Math.max(0, safeNumber(order.total))
    const storedPaid = Math.max(0, safeNumber(order.paid_amount))
    const paymentsLoaded = Array.isArray(order.order_payments)
    const paymentsPaid = paymentsLoaded
      ? order.order_payments.reduce(
          (sum, payment) => sum + Math.max(0, safeNumber(payment?.amount)),
          0
        )
      : 0

    const recordedPaid = paymentsLoaded && order.status === ORDER_STATUS.PENDING
      ? paymentsPaid
      : Math.max(storedPaid, paymentsPaid)

    return clamp(recordedPaid, 0, total)
  }, [])

  const getOrderAmountDue = useCallback((order) => {
    if (!order || order.status === ORDER_STATUS.CANCELLED) return 0
    if ([ORDER_STATUS.PAID, ORDER_STATUS.COMPLETED].includes(order.status)) return 0

    const total = Math.max(0, safeNumber(order.total))
    return Math.max(0, total - getRecordedPaidAmount(order))
  }, [getRecordedPaidAmount])

  const runPrintRequest = useCallback(async (key, request) => {
    if (activePrintRequestsRef.current.has(key)) {
      return { success: false, skipped: true }
    }

    activePrintRequestsRef.current.add(key)
    setPrintingJobs(previous => ({ ...previous, [key]: true }))

    try {
      return await request()
    } finally {
      activePrintRequestsRef.current.delete(key)
      setPrintingJobs(previous => {
        const next = { ...previous }
        delete next[key]
        return next
      })
    }
  }, [])

  const submitPosReceipt = useCallback(async (
    order,
    items,
    paymentContext = {},
    origin = 'receipt'
  ) => {
    const receiptUser = {
      ...user,
      branch_name: currentBranch?.name || user?.branch_name,
    }
    const receiptItems = (Array.isArray(items) ? items : []).map(item => {
      const inventoryItem = inventory.find(product => (
        product.id === (item.inventory_id || item.product_id)
      ))
      return {
        ...item,
        name: item.name || inventoryItem?.name,
        unit: item.unit || inventoryItem?.unit,
        sku: item.sku || inventoryItem?.sku,
        barcode: item.barcode || inventoryItem?.barcode,
      }
    })
    let result

    try {
      const payload = createPosReceiptPayload({
        order,
        items: receiptItems,
        branch: {
          ...currentBranch,
          id: branchId,
          name: currentBranch?.name || user?.branch_name,
        },
        user: receiptUser,
        payment: paymentContext,
        metadata: {
          origin,
          order_reference: orderReference(order),
        },
      })
      result = await enqueuePrintJob({
        branchId,
        jobType: PRINT_JOB_TYPES.POS_RECEIPT,
        source: 'pos',
        payload,
      })
    } catch (error) {
      console.error('[POS] Unexpected cloud receipt error:', error)
      result = { success: false, error }
    }

    if (result.success) {
      showToast('success', 'Print queued', `Receipt #${orderReference(order)} was sent to the branch printer`)
      return result
    }

    console.error('[POS] Cloud receipt queue failed; opening browser fallback:', result.error)
    showToast(
      'warning',
      'Printer queue unavailable',
      'The receipt was not queued. Opening the browser print fallback.'
    )
    try {
      printReceiptInBrowser(order, receiptItems, receiptUser)
    } catch (fallbackError) {
      console.error('[POS] Browser receipt fallback failed:', fallbackError)
      showToast('error', 'Browser print failed', 'Open the order details and try printing again.')
    }
    return result
  }, [branchId, currentBranch, inventory, showToast, user])

  const queuePosReceipt = useCallback((
    order,
    items,
    paymentContext = {},
    origin = 'receipt'
  ) => runPrintRequest(
    posReceiptPrintKey(order),
    () => submitPosReceipt(order, items, paymentContext, origin)
  ), [runPrintRequest, submitPosReceipt])

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

  const productGridItems = useMemo(() => filteredInventory.map(product => {
    const stock = getStock(product)
    return {
      product,
      salePrice: extractSalePrice(product),
      stock,
      inStock: stock > 0,
      inCart: cart.find(item => item.id === product.id) || null,
      lowStock: stock > 0 && stock <= Math.max(5, safeNumber(product.threshold)),
    }
  }), [cart, filteredInventory])

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

  const normalizedServiceCharge = useMemo(
    () => Math.max(0, safeNumber(serviceCharge)),
    [serviceCharge]
  )

  const cartTotal = useMemo(() =>
    Math.max(0, cartSubtotal - normalizedDiscount + cartTax + normalizedServiceCharge),
    [cartSubtotal, normalizedDiscount, cartTax, normalizedServiceCharge]
  )

  const paymentDue = useMemo(() => {
    return getOrderAmountDue(paymentOrder)
  }, [getOrderAmountDue, paymentOrder])

  const cashChange = useMemo(() => {
    if (paymentMethod !== PAYMENT_METHODS.CASH) return 0
    return Math.max(0, safeNumber(cashReceived) - safeNumber(paymentAmount))
  }, [cashReceived, paymentAmount, paymentMethod])

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
