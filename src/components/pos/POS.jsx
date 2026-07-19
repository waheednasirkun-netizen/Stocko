import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { posApi } from '../../lib/pos'

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
}

export default function POSEnhanced() {
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

  const colors = {
    bg: '#f8f9fa', panelBg: '#ffffff', sidebar: '#ffffff', text: '#1a1a2e',
    muted: '#6c757d', border: '#e9ecef', accent: '#0d6efd', accentHover: '#0b5ed7',
    success: '#198754', danger: '#dc3545', warning: '#ffc107', info: '#0dcaf0',
    purple: '#6f42c1', orange: '#fd7e14', darkBlue: '#2c3e50',
    tableHeader: '#f8f9fa', tableBorder: '#dee2e6',
  }

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
      const { data, error } = await posApi.getInventory(user.branch_id)
      if (error) console.error('[POS] inventory error:', error.message)
      else setInventory(data || [])
    }
    load()
  }, [user?.branch_id])

  useEffect(() => {
    const loadBranches = async () => {
      setBranchesLoading(true)
      try {
        const apiMethod = posApi.getBranches || posApi.branches || posApi.listBranches
        if (apiMethod) {
          const { data, error } = await apiMethod()
          if (error) console.error('[POS] branches error:', error.message)
          else setBranches(data || [])
        } else if (posApi.supabase) {
          const { data, error } = await posApi.supabase.from('branches').select('*').eq('is_active', true)
          if (!error && data) setBranches(data)
        }
      } catch (err) { console.error('[POS] branches load failed:', err) }
      finally { setBranchesLoading(false) }
    }
    loadBranches()
  }, [])

  useEffect(() => {
    const loadCustomers = async () => {
      setCustomersLoading(true)
      try {
        const apiMethod = posApi.getCustomers || posApi.customers || posApi.listCustomers
        if (apiMethod) {
          const { data, error } = await apiMethod()
          if (error) console.error('[POS] customers error:', error.message)
          else setCustomers(data || [])
        } else if (posApi.supabase) {
          const { data, error } = await posApi.supabase.from('customers').select('*').eq('is_active', true).order('name')
          if (!error && data) setCustomers(data)
        }
      } catch (err) { console.error('[POS] customers load failed:', err) }
      finally { setCustomersLoading(false) }
    }
    loadCustomers()
  }, [])

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) { showError('Customer name is required'); return }
    setCreatingCustomer(true)
    try {
      const apiMethod = posApi.createCustomer || posApi.addCustomer
      // Only include fields that exist in your customers table.
      // Remove any fields that cause schema errors.
      const payload = {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
        email: newCustomerEmail.trim() || null,
        address: newCustomerAddress.trim() || null,
        // branch_id: user?.branch_id || null,  // uncomment if your table has this
        // created_by: user?.id,                // uncomment if your table has this
        // created_at: new Date().toISOString(), // uncomment if your table has this
      }
      let result
      if (apiMethod) result = await apiMethod(payload)
      else if (posApi.supabase) result = await posApi.supabase.from('customers').insert([payload]).select().single()
      else throw new Error('No customer API available')

      const { data, error } = result || {}
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
      const { data, error } = await posApi.getOrders(user.branch_id)
      if (error) showError('Failed to load orders')
      else setOrders(data || [])
    } catch (err) { showError('Error loading orders') }
    finally { setOrdersLoading(false) }
  }, [user?.branch_id])

  useEffect(() => { if (showOrdersModal) loadOrders() }, [showOrdersModal, loadOrders])

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), 4000) }
  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000) }

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
  }, [])

  const updateQty = useCallback((id, qty) => {
    if (qty < 1) return
    const product = inventory.find(p => p.id === id)
    const maxStock = product ? product.quantity || 0 : Infinity
    if (qty > maxStock) { showError(`Only ${maxStock} units available`); return }
    setCart(prev => prev.map(x => x.id === id ? { ...x, qty } : x))
  }, [inventory])

  const removeItem = useCallback((id) => { setCart(prev => prev.filter(x => x.id !== id)) }, [])
  const clearCart = useCallback(() => { setCart([]); setSelectedCustomer(null); setDiscount(0); setTaxRate(0) }, [])

  const verifyPasswordAndExecute = async () => {
    setPasswordError(''); setProcessing(true)
    try {
      const { data, error } = await posApi.verifyPassword({ userId: user?.id, password: passwordInput })
      if (error) { setPasswordError('Invalid password'); setProcessing(false); return }
      await executePendingAction()
    } catch (err) { setPasswordError('Authentication failed'); setProcessing(false) }
  }

  const executePendingAction = async () => {
    try {
      switch (pendingAction) {
        case 'edit': handleEditOrder(pendingActionData); break
        case 'cancel': handleCancelOrder(pendingActionData); break
        case 'payment': handleProcessPayment(pendingActionData); break
      }
      setShowPasswordModal(false); setPasswordInput(''); setPendingAction(null); setPendingActionData(null)
    } catch (err) { showError('Action failed: ' + err.message) }
    finally { setProcessing(false) }
  }

  const initiateOrderAction = (action, data) => {
    if (!isAdmin) { showError('Only managers can modify orders'); return }
    setPendingAction(action); setPendingActionData(data); setShowPasswordModal(true)
  }

  const handleEditOrder = async (orderId) => {
    try {
      setProcessing(true)
      const order = orders.find(o => o.id === orderId)
      if (!order) { showError('Order not found'); return }
      setCart(order.sale_items || [])
      setSelectedCustomer(order.customer || null)
      setSelectedOrder(null); setShowOrdersModal(false)
      showSuccess('Order loaded for editing')
    } catch (err) { showError('Failed to load order') }
    finally { setProcessing(false) }
  }

  const handleCancelOrder = async (orderId) => {
    try {
      setProcessing(true)
      const { data, error } = await posApi.cancelOrder({ orderId, cancelledBy: user?.id, reason: 'Cancelled via POS' })
      if (error) { showError('Failed to cancel order'); return }
      await loadOrders(); showSuccess('Order cancelled successfully')
    } catch (err) { showError('Cancel operation failed') }
    finally { setProcessing(false) }
  }

  const handleProcessPayment = async (orderId) => {
    try {
      if (!paidAmount || paidAmount <= 0) { showError('Enter paid amount'); return }
      const order = orders.find(o => o.id === orderId)
      if (!order) { showError('Order not found'); return }
      const totalDue = order.total || 0
      const newDue = Math.max(0, totalDue - paidAmount)
      const { data, error } = await posApi.processPayment({
        orderId,
        payment: { amount: paidAmount, method: paymentMethod, remarks: paymentRemarks },
        status: newDue > 0 ? ORDER_STATUS.PARTIALLY_PAID : ORDER_STATUS.PAID,
        paid: paidAmount, due: newDue,
        ledgerEntry: { customer_id: order.customer_id, branch_id: user?.branch_id, amount: paidAmount, type: 'payment', description: `Payment received - ${paymentMethod}` },
        activityLog: { branchId: user?.branch_id, userId: user?.id, userName: user?.name, description: `Payment processed: ${paidAmount} via ${paymentMethod}` },
      })
      if (error) { showError('Payment failed: ' + error.message); return }
      await loadOrders(); setShowPaymentModal(false); setPaidAmount(0); setPaymentRemarks(''); setPaymentMethod(PAYMENT_METHODS.CASH)
      showSuccess('Payment processed successfully')
    } catch (err) { showError('Payment error: ' + err.message) }
    finally { setProcessing(false) }
  }

  const placeOrder = async () => {
    if (!selectedCustomer && !confirm('No customer selected. Continue as Walk-In?')) return
    if (cart.length === 0) { showError('Cart is empty'); return }
    setProcessing(true)
    try {
      const saleData = {
        branch_id: user?.branch_id,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || 'Walk-In',
        subtotal, tax, discount, total,
        // FIX: If your sales table has NO status column, keep this commented out.
        // If it DOES have a status column, uncomment the line below:
        // status: ORDER_STATUS.PENDING,
        created_by: user?.id,
        created_by: user?.name,
      }
      const saleItems = cart.map(item => ({ inventory_id: item.inventory_id, quantity: item.qty, price: item.price, subtotal: item.qty * item.price }))
      const inventoryUpdates = cart.map(item => ({ inventoryId: item.inventory_id, quantity: item.qty }))
      const { data, error } = await posApi.placeOrder({
        sale: saleData, saleItems, inventoryUpdates,
        activityLog: { branchId: user?.branch_id, userId: user?.id, userName: user?.name, description: `Order placed: ${cart.length} items, Total: ${total}` },
      })
      if (error) { showError('Order failed: ' + error.message); return }
      showSuccess('Order placed successfully!'); clearCart(); await loadOrders()
    } catch (err) { showError('Error placing order: ' + err.message) }
    finally { setProcessing(false) }
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
      default: return { background: '#e9ecef', color: '#495057', border: '1px solid #dee2e6' }
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: colors.bg, fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', overflow: 'hidden' }}>

      {/* LEFT PANEL - Product Catalog */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.panelBg, borderRight: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, margin: '0 0 4px' }}>Point of Sale</h1>
            <p style={{ fontSize: '12px', color: colors.muted, margin: 0 }}>{isStorekeeper ? 'Place dispatch orders' : 'Manage orders & process payments'}</p>
          </div>
          <div style={{ background: colors.accent, color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
            {user?.name || 'User'} — {isAdmin ? 'Manager' : 'Storekeeper'}
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
          {isAdmin && (
            <button onClick={() => setShowOrdersModal(true)}
              style={{ padding: '10px 18px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📋 Order History
            </button>
          )}
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
          {cart.length > 0 && (
            <>
              <button onClick={() => {}} style={{ padding: '10px 14px', background: colors.purple, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Remarks</button>
              <button onClick={() => {}} style={{ padding: '10px 14px', background: colors.orange, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Draft</button>
              <button onClick={() => {}} style={{ padding: '10px 14px', background: colors.darkBlue, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Discount</button>
            </>
          )}
          <button onClick={clearCart} disabled={cart.length === 0} style={{ padding: '10px 14px', background: colors.danger, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', opacity: cart.length === 0 ? 0.5 : 1 }}>Clear</button>
          {isStorekeeper && cart.length > 0 && (
            <button onClick={placeOrder} disabled={processing} style={{ flex: 1, padding: '10px 14px', background: colors.success, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.6 : 1 }}>{processing ? 'Processing...' : 'Place Order'}</button>
          )}
          {isAdmin && cart.length > 0 && (
            <button onClick={placeOrder} disabled={processing} style={{ flex: 1, padding: '10px 14px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.6 : 1 }}>{processing ? 'Processing...' : 'Complete Sale'}</button>
          )}
        </div>
      </div>

      {/* CREATE CUSTOMER MODAL */}
      {showCreateCustomerModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '20px' }}>
          <div style={{ background: colors.panelBg, borderRadius: '10px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '14px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '800', color: colors.text, margin: 0 }}>➕ Create New Customer</h2>
              <button onClick={() => { setShowCreateCustomerModal(false); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail(''); setNewCustomerAddress('') }}
                style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: colors.muted, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Customer Name *</label>
                <input type="text" placeholder="Enter customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.bg, color: colors.text, fontSize: '14px', boxSizing: 'border-box' }} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Phone Number</label>
                <input type="tel" placeholder="+92xxxxxxxxxx" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.bg, color: colors.text, fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Email</label>
                <input type="email" placeholder="customer@email.com" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.bg, color: colors.text, fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Address</label>
                <input type="text" placeholder="Customer address..." value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.bg, color: colors.text, fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { setShowCreateCustomerModal(false); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail(''); setNewCustomerAddress('') }}
                style={{ flex: 1, padding: '11px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={handleCreateCustomer} disabled={creatingCustomer || !newCustomerName.trim()}
                style={{ flex: 1, padding: '11px', background: colors.success, border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '700', cursor: creatingCustomer || !newCustomerName.trim() ? 'not-allowed' : 'pointer', opacity: creatingCustomer || !newCustomerName.trim() ? 0.6 : 1, fontSize: '14px' }}>
                {creatingCustomer ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER HISTORY MODAL */}
      {showOrdersModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
          <div style={{ background: colors.panelBg, borderRadius: '10px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: colors.text, margin: 0 }}>📋 Order History</h2>
              <button onClick={() => setShowOrdersModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: colors.muted, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '14px 24px', background: colors.bg, borderBottom: `1px solid ${colors.border}`, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {['all', 'pending', 'paid', 'partially_paid', 'credit', 'cancelled'].map(status => (
                <button key={status} onClick={() => setOrderFilter(status)}
                  style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: orderFilter === status ? colors.accent : colors.panelBg, color: orderFilter === status ? '#fff' : colors.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize', boxShadow: orderFilter === status ? 'none' : `inset 0 0 0 1px ${colors.border}` }}>
                  {status === 'all' ? 'All Orders' : status.replace('_', ' ')}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <div style={{ position: 'relative' }}>
                <input type="text" placeholder="Search orders..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)}
                  style={{ padding: '8px 12px 8px 32px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.panelBg, color: colors.text, fontSize: '13px', width: '200px' }} />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: colors.muted, fontSize: '13px' }}>🔍</span>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
              {ordersLoading ? (
                <div style={{ textAlign: 'center', padding: '50px', color: colors.muted }}>Loading orders...</div>
              ) : filteredOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', color: colors.muted }}>
                  <div style={{ fontSize: '30px', marginBottom: '10px' }}>📭</div>
                  <div style={{ fontSize: '15px', fontWeight: '600' }}>No orders found</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: colors.tableHeader }}>
                      {['Invoice', 'Customer', 'Items', 'Total', 'Status', 'Date', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${colors.tableBorder}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => {
                      const badge = statusBadgeStyle(order.status)
                      return (
                        <tr key={order.id} style={{ borderBottom: `1px solid ${colors.tableBorder}`, background: selectedOrder?.id === order.id ? '#e7f1ff' : 'transparent', cursor: 'pointer' }}
                          onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}>
                          <td style={{ padding: '12px 16px', fontWeight: '600', color: colors.text }}>{order.invoice_no || `#${order.id?.slice(-6)}`}</td>
                          <td style={{ padding: '12px 16px', color: colors.text }}>{order.customer_name || 'Walk-In'}</td>
                          <td style={{ padding: '12px 16px', color: colors.muted }}>{order.sale_items?.length || 0} items</td>
                          <td style={{ padding: '12px 16px', fontWeight: '700', color: colors.accent }}>Rs. {order.total?.toFixed(2)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize', ...badge }}>
                              {order.status?.replace('_', ' ') || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: colors.muted, fontSize: '12px' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {isAdmin && order.status === ORDER_STATUS.PENDING && (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); initiateOrderAction('edit', order.id) }} style={{ padding: '5px 10px', background: colors.info, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                                  <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setShowPaymentModal(true) }} style={{ padding: '5px 10px', background: colors.success, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Pay</button>
                                  <button onClick={(e) => { e.stopPropagation(); initiateOrderAction('cancel', order.id) }} style={{ padding: '5px 10px', background: colors.danger, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                </>
                              )}
                              {[ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID].includes(order.status) && (
                                <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setShowPaymentModal(true) }} style={{ padding: '5px 10px', background: colors.success, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Payment</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '20px' }}>
          <div style={{ background: colors.panelBg, borderRadius: '10px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '14px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '800', color: colors.text, margin: 0 }}>💵 Process Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: colors.muted, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ background: colors.bg, padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: colors.muted }}>Invoice</span><span style={{ fontWeight: '700' }}>{selectedOrder.invoice_no || `Order #${selectedOrder.id}`}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: colors.muted }}>Customer</span><span style={{ fontWeight: '600' }}>{selectedOrder.customer_name || 'Walk-In'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: colors.muted }}>Total Due</span><span style={{ fontWeight: '800', color: colors.accent, fontSize: '15px' }}>Rs. {selectedOrder.total?.toFixed(2) || '0.00'}</span></div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Method</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.values(PAYMENT_METHODS).map(method => (
                  <button key={method} onClick={() => setPaymentMethod(method)}
                    style={{ padding: '8px 16px', borderRadius: '6px', border: `2px solid ${paymentMethod === method ? colors.accent : colors.border}`, background: paymentMethod === method ? colors.accent : 'transparent', color: paymentMethod === method ? '#fff' : colors.text, fontSize: '12px', fontWeight: '700', cursor: 'pointer', textTransform: 'capitalize' }}>
                    {method === 'bank_transfer' ? 'Bank Transfer' : method}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid Amount (Rs.)</label>
              <input type="number" min="0" step="0.01" value={paidAmount || ''} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.bg, color: colors.text, fontSize: '15px', fontWeight: '700', boxSizing: 'border-box' }} />
            </div>
            {paidAmount > 0 && (
              <div style={{ background: colors.bg, padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: colors.muted }}>Remaining Due</span>
                  <span style={{ fontWeight: '800', color: colors.danger }}>Rs. {Math.max(0, (selectedOrder.total || 0) - paidAmount).toFixed(2)}</span>
                </div>
              </div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.muted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Remarks (Optional)</label>
              <input type="text" placeholder="Add payment notes..." value={paymentRemarks} onChange={(e) => setPaymentRemarks(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.bg, color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowPaymentModal(false)} style={{ flex: 1, padding: '11px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={() => { setPendingAction('payment'); setPendingActionData(selectedOrder.id); setShowPaymentModal(false); setShowPasswordModal(true) }} disabled={processing || !paidAmount}
                style={{ flex: 1, padding: '11px', background: colors.success, border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '700', cursor: processing || !paidAmount ? 'not-allowed' : 'pointer', opacity: processing || !paidAmount ? 0.6 : 1, fontSize: '14px' }}>
                {processing ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD MODAL */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 }}>
          <div style={{ background: colors.panelBg, borderRadius: '10px', padding: '32px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔐</div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: colors.text, margin: '0 0 6px' }}>Verify Your Password</h2>
              <p style={{ fontSize: '13px', color: colors.muted, margin: 0 }}>This action requires manager authentication</p>
            </div>
            <input type="password" placeholder="Enter your password" value={passwordInput} onChange={(e) => { setPasswordInput(e.target.value); setPasswordError('') }} onKeyPress={(e) => e.key === 'Enter' && verifyPasswordAndExecute()}
              style={{ width: '100%', padding: '12px 14px', marginBottom: '10px', border: `2px solid ${passwordError ? colors.danger : colors.border}`, borderRadius: '8px', background: colors.bg, color: colors.text, fontSize: '15px', boxSizing: 'border-box', outline: 'none' }} autoFocus />
            {passwordError && <div style={{ color: colors.danger, fontSize: '13px', marginBottom: '16px', fontWeight: '700', textAlign: 'center' }}>{passwordError}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError('') }} style={{ flex: 1, padding: '12px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text, fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={verifyPasswordAndExecute} disabled={processing || !passwordInput}
                style={{ flex: 1, padding: '12px', background: colors.accent, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', cursor: processing || !passwordInput ? 'not-allowed' : 'pointer', opacity: processing || !passwordInput ? 0.6 : 1, fontSize: '14px' }}>
                {processing ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      {errorMsg && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#f8d7da', border: '1px solid #f5c2c7', color: '#842029', padding: '14px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', zIndex: 6000, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#d1e7dd', border: '1px solid #badbcc', color: '#0f5132', padding: '14px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', zIndex: 6000, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          ✅ {successMsg}
        </div>
      )}
    </div>
  )
}