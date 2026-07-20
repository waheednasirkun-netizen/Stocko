import { useState, useEffect, useMemo } from 'react'
import { useApp } from "../context/AppContext.jsx";
import { posApi } from "../lib/pos";

// Only these roles may access the Customer Ledger page at all.
const PAGE_ACCESS_ROLES = ['admin', 'manager', 'developer']

export default function CustomerLedger() {
  const { user, theme } = useApp()
  const [customers, setCustomers] = useState([])
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState(0)
  const [adjustType, setAdjustType] = useState('credit')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustProcessing, setAdjustProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLedgerModal, setShowLedgerModal] = useState(false)

  // date filter for the ledger history modal
  const [ledgerDateFrom, setLedgerDateFrom] = useState('')
  const [ledgerDateTo, setLedgerDateTo] = useState('')

  // order details modal (opened via "View" on a ledger transaction)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderDetails, setOrderDetails] = useState(null)
  const [orderLoading, setOrderLoading] = useState(false)

  const userRole = (user?.role || '').toLowerCase()
  const hasPageAccess = PAGE_ACCESS_ROLES.includes(userRole)
  const isAdmin = ['admin', 'manager', 'developer', 'superadmin', 'owner'].includes(userRole)
  const branchId = user?.branch_id

  // ── Design tokens ──────────────────────────────────────────────────────
  const colors = {
    bg: '#F5F7FA',
    panelBg: '#FFFFFF',
    panelAlt: '#FAFBFD',
    text: '#111827',
    heading: '#0F1B3D',
    muted: '#6B7280',
    subtle: '#9AA3B2',
    border: '#E7EAF0',
    borderStrong: '#D8DCE6',
    accent: '#2952E3',
    accentDark: '#1F3FB8',
    accentSoft: '#EAEFFD',
    success: '#0E9F6E',
    successSoft: '#E4F8F0',
    danger: '#E0293D',
    dangerSoft: '#FDEAEC',
    warning: '#C8790A',
    warningSoft: '#FBF0DF',
    purple: '#7C4DFF',
    purpleSoft: '#F1ECFF',
  }

  const shadow = {
    sm: '0 1px 2px rgba(15,27,61,0.05)',
    md: '0 2px 8px rgba(15,27,61,0.06), 0 1px 2px rgba(15,27,61,0.04)',
    lg: '0 12px 28px rgba(15,27,61,0.14)',
  }

  useEffect(() => {
    if (!hasPageAccess) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, hasPageAccess])

  // ── Data loading ────────────────────────────────────────────────────────
  // BRANCH ISOLATION: every fetch is scoped to the signed-in user's branch,
  // and every result set is re-filtered client-side as a defense-in-depth
  // guard in case an underlying API helper ever forgets to scope itself.
  const loadData = async () => {
    if (!branchId) {
      setCustomers([])
      setLedgerEntries([])
      return
    }
    setLoading(true)
    try {
      const { data: rawCustomers } =
        (await posApi.getCustomers?.(branchId)) ||
        (await posApi.supabase
          ?.from('customers')
          .select('*')
          .eq('is_active', true)
          .eq('branch_id', branchId)
          .order('name')) ||
        { data: [] }

      // Hard client-side guard: never let a row from another branch render,
      // regardless of what the API layer returned.
      const safeCustomers = (rawCustomers || []).filter(c => c.branch_id === branchId)
      setCustomers(safeCustomers)

      const { data: rawLedger } = await posApi.supabase
        ?.from('ledger_entries')
        .select('*, customers(name)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        || { data: [] }

      const safeLedger = (rawLedger || []).filter(e => e.branch_id === branchId)
      setLedgerEntries(safeLedger)
    } catch (err) {
      console.error('[Ledger] Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle balance adjustment with correct sign logic
  const handleAdjustBalance = async () => {
    if (!selectedCustomer) return
    if (selectedCustomer.branch_id !== branchId) return // never act across branches
    if (!adjustReason.trim()) { alert('Please provide a reason'); return }
    setAdjustProcessing(true)
    try {
      // Credit (customer paid) = negative (reduces balance)
      // Debit (customer owes more) = positive (increases balance)
      const amount = adjustType === 'credit'
        ? -Math.abs(adjustAmount)
        : Math.abs(adjustAmount)

      const { error } = await posApi.supabase.from('ledger_entries').insert([{
        customer_id: selectedCustomer.id,
        branch_id: branchId,
        amount: amount,
        type: 'adjustment',
        description: `Balance adjustment: ${adjustReason}`,
        created_by: user?.id,
        created_by_name: user?.name,
      }])

      if (error) throw error

      const newBalance = (selectedCustomer.balance || 0) + amount
      await posApi.supabase.from('customers')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCustomer.id)
        .eq('branch_id', branchId) // never update a row outside this branch

      setShowAdjustModal(false)
      setAdjustAmount(0)
      setAdjustReason('')
      setSelectedCustomer(null)
      await loadData()
    } catch (err) {
      alert('Adjustment failed: ' + err.message)
    } finally {
      setAdjustProcessing(false)
    }
  }

  // Balance calculation — ledgerEntries is already branch-scoped, so every
  // total derived here is implicitly branch-isolated too.
  // Positive amount = customer owes (sale, debit adjustment)
  // Negative amount = customer paid (payment, credit adjustment)
  const customerBalances = useMemo(() => {
    const balances = {}
    ledgerEntries.forEach(entry => {
      if (!balances[entry.customer_id]) {
        balances[entry.customer_id] = { total: 0, paid: 0, due: 0 }
      }
      balances[entry.customer_id].total += entry.amount
      if (entry.amount < 0) {
        balances[entry.customer_id].paid += Math.abs(entry.amount)
      }
    })
    Object.keys(balances).forEach(id => {
      balances[id].due = Math.max(0, balances[id].total)
    })
    return balances
  }, [ledgerEntries])

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers
    const q = searchQuery.toLowerCase()
    return customers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  }, [customers, searchQuery])

  // Branch-wide summary strip
  const summary = useMemo(() => {
    let outstanding = 0, credit = 0, collected = 0
    Object.values(customerBalances).forEach(b => {
      outstanding += Math.max(0, b.total)
      if (b.total < 0) credit += Math.abs(b.total)
      collected += b.paid
    })
    return { customers: customers.length, outstanding, credit, collected }
  }, [customerBalances, customers])

  // Supports an optional { from, to } date range — used by the ledger history modal.
  const getCustomerLedger = (customerId, range) => {
    let entries = ledgerEntries.filter(e => e.customer_id === customerId)
    if (range?.from) {
      const fromDate = new Date(range.from)
      entries = entries.filter(e => new Date(e.created_at) >= fromDate)
    }
    if (range?.to) {
      const toDate = new Date(range.to)
      toDate.setHours(23, 59, 59, 999)
      entries = entries.filter(e => new Date(e.created_at) <= toDate)
    }
    return entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  const openLedgerModal = (customer) => {
    setSelectedCustomer(customer)
    setLedgerDateFrom('')
    setLedgerDateTo('')
    setShowLedgerModal(true)
  }

  const openAdjustModal = (customer) => {
    setSelectedCustomer(customer)
    setShowAdjustModal(true)
  }

  const closeAdjustModal = () => {
    setShowAdjustModal(false)
    setSelectedCustomer(null)
    setAdjustAmount(0)
    setAdjustReason('')
  }

  const closeLedgerModal = () => {
    setShowLedgerModal(false)
    setSelectedCustomer(null)
    setLedgerDateFrom('')
    setLedgerDateTo('')
  }

  // View the order behind a ledger transaction — branch-scoped fetch,
  // plus a client-side check that refuses to render a mismatched row.
  const viewOrder = async (entry) => {
    if (!entry.order_id) return
    setOrderDetails(null)
    setOrderLoading(true)
    setShowOrderModal(true)
    try {
      const { data, error } = await posApi.supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', entry.order_id)
        .eq('branch_id', branchId) // branch isolation guard — never fetch another branch's order
        .single()
      if (error) throw error
      if (data && data.branch_id !== branchId) {
        // Should be unreachable given the query filter, but never trust a
        // single layer of defense with financial data.
        setOrderDetails(null)
      } else {
        setOrderDetails(data)
      }
    } catch (err) {
      console.error('[Ledger] order fetch error:', err)
      setOrderDetails(null)
    } finally {
      setOrderLoading(false)
    }
  }

  const closeOrderModal = () => {
    setShowOrderModal(false)
    setOrderDetails(null)
  }

  // Export the currently viewed (and date-filtered) ledger as CSV
  const exportLedgerToCSV = () => {
    if (!selectedCustomer) return
    const rows = getCustomerLedger(selectedCustomer.id, { from: ledgerDateFrom, to: ledgerDateTo })
    const header = ['Date', 'Description', 'Type', 'Amount']
    const csvRows = [header.join(',')]
    rows.forEach(entry => {
      const date = new Date(entry.created_at).toLocaleDateString()
      const desc = `"${(entry.description || entry.type || '').replace(/"/g, '""')}"`
      csvRows.push([date, desc, entry.type, entry.amount.toFixed(2)].join(','))
    })
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ledger_${selectedCustomer.name.replace(/\s+/g, '_')}_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // ── Access gate: only admin / manager / developer can open this page ──
  if (!hasPageAccess) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: colors.bg, textAlign: 'center', padding: '20px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '20px',
          background: colors.dangerSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', marginBottom: '20px'
        }}>🔒</div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: colors.heading, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          Access Restricted
        </h2>
        <p style={{ fontSize: '14px', color: colors.muted, maxWidth: '360px', margin: 0, lineHeight: 1.6 }}>
          Your role (<strong style={{ color: colors.text }}>{user?.role || 'unknown'}</strong>) doesn't have access to the Customer Ledger.
          Only Admins, Managers, and Developers can view this page.
        </p>
      </div>
    )
  }

  const modalLedger = selectedCustomer ? getCustomerLedger(selectedCustomer.id, { from: ledgerDateFrom, to: ledgerDateTo }) : []

  const fontStack = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

  const statCard = (label, value, tint, tintSoft, icon) => (
    <div style={{
      flex: '1 1 160px',
      background: colors.panelBg,
      border: `1px solid ${colors.border}`,
      borderRadius: '14px',
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      boxShadow: shadow.sm,
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', background: tintSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '10.5px', fontWeight: 700, color: colors.subtle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: tint, marginTop: '2px', letterSpacing: '-0.01em' }}>
          {value}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '24px', background: colors.bg, minHeight: '100vh', fontFamily: fontStack }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: '20px', flexWrap: 'wrap', gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: colors.heading, margin: 0, letterSpacing: '-0.02em' }}>
              Customer Ledger
            </h1>
            {branchId && (
              <span style={{
                fontSize: '11px', fontWeight: 700, color: colors.accent, background: colors.accentSoft,
                padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.02em'
              }}>
                Branch {branchId}
              </span>
            )}
          </div>
          <p style={{ color: colors.muted, margin: '5px 0 0', fontSize: '13.5px' }}>
            Manage customer balances and payment history for this branch
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: colors.subtle }}>⌕</span>
          <input
            type="text"
            placeholder="Search name, phone, or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '10px 14px 10px 34px',
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              fontSize: '13.5px',
              width: '270px',
              background: colors.panelBg,
              color: colors.text,
              outline: 'none',
              boxShadow: shadow.sm,
            }}
          />
        </div>
      </div>

      {/* Branch summary strip */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '22px' }}>
        {statCard('Customers', summary.customers, colors.heading, colors.accentSoft, '👤')}
        {statCard('Outstanding', `Rs. ${summary.outstanding.toFixed(2)}`, colors.danger, colors.dangerSoft, '⏳')}
        {statCard('Credit Held', `Rs. ${summary.credit.toFixed(2)}`, colors.success, colors.successSoft, '✓')}
        {statCard('Collected', `Rs. ${summary.collected.toFixed(2)}`, colors.accent, colors.accentSoft, '↓')}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '70px', color: colors.muted, fontSize: '14px' }}>
          Loading customers…
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '70px 20px', color: colors.muted, fontSize: '14px',
          background: colors.panelBg, border: `1px dashed ${colors.borderStrong}`, borderRadius: '14px'
        }}>
          {searchQuery ? 'No customers match your search.' : 'No customers found for this branch yet.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredCustomers.map(customer => {
            const balance = customerBalances[customer.id] || { total: 0, paid: 0, due: 0 }
            const hasDue = balance.due > 0
            const hasCredit = balance.total < 0
            const meterTotal = balance.paid + balance.due
            const paidPct = meterTotal > 0 ? Math.round((balance.paid / meterTotal) * 100) : 0

            return (
              <div key={customer.id} style={{
                background: colors.panelBg,
                borderRadius: '14px',
                padding: '20px',
                border: `1px solid ${colors.border}`,
                boxShadow: shadow.md,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = shadow.lg }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = shadow.md }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '11px', background: colors.accentSoft,
                      color: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '15px', flexShrink: 0
                    }}>
                      {(customer.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: colors.heading }}>{customer.name}</h3>
                      {customer.phone && <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: colors.muted }}>{customer.phone}</p>}
                      {customer.email && <p style={{ margin: '1px 0 0', fontSize: '12px', color: colors.subtle }}>{customer.email}</p>}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 11px',
                    borderRadius: '20px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    background: hasDue ? colors.dangerSoft : hasCredit ? colors.successSoft : '#F0F1F4',
                    color: hasDue ? colors.danger : hasCredit ? colors.success : colors.muted
                  }}>
                    {hasDue ? `Due Rs. ${balance.due.toFixed(2)}` : hasCredit ? `Credit Rs. ${Math.abs(balance.total).toFixed(2)}` : 'Settled'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ background: colors.panelAlt, padding: '10px', borderRadius: '9px', textAlign: 'center', border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '10px', color: colors.subtle, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Net</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: balance.total > 0 ? colors.danger : colors.success, marginTop: '2px' }}>
                      Rs. {Math.abs(balance.total).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ background: colors.panelAlt, padding: '10px', borderRadius: '9px', textAlign: 'center', border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '10px', color: colors.subtle, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Paid</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: colors.success, marginTop: '2px' }}>Rs. {balance.paid.toFixed(2)}</div>
                  </div>
                  <div style={{ background: colors.panelAlt, padding: '10px', borderRadius: '9px', textAlign: 'center', border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '10px', color: colors.subtle, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Due</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: hasDue ? colors.danger : colors.subtle, marginTop: '2px' }}>Rs. {balance.due.toFixed(2)}</div>
                  </div>
                </div>

                {meterTotal > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ height: '5px', borderRadius: '3px', background: colors.dangerSoft, overflow: 'hidden' }}>
                      <div style={{ width: `${paidPct}%`, height: '100%', background: colors.success, borderRadius: '3px' }} />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '14px' }}>
                  <h4 style={{ fontSize: '11px', color: colors.subtle, margin: '0 0 8px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                    Recent Activity
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                    {getCustomerLedger(customer.id).slice(0, 3).map((entry, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: colors.panelAlt,
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}>
                        <span style={{ color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                          {entry.description || entry.type}
                        </span>
                        <span style={{
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          color: entry.amount > 0 ? colors.danger : colors.success
                        }}>
                          {entry.amount > 0 ? '+' : ''}Rs. {entry.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {getCustomerLedger(customer.id).length === 0 && (
                      <div style={{ textAlign: 'center', color: colors.subtle, fontSize: '12px', padding: '10px' }}>
                        No transactions yet
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openLedgerModal(customer)}
                    style={{
                      flex: 1,
                      padding: '9px',
                      background: colors.panelAlt,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '9px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    View Ledger
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => openAdjustModal(customer)}
                      style={{
                        flex: 1,
                        padding: '9px',
                        background: colors.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '9px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Adjust Balance
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Adjust Balance Modal */}
      {showAdjustModal && selectedCustomer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,27,61,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 5000, padding: '20px'
        }}>
          <div style={{
            background: colors.panelBg,
            borderRadius: '16px',
            padding: '26px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: shadow.lg,
            fontFamily: fontStack,
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: colors.heading }}>Adjust Balance</h2>
            <p style={{ color: colors.muted, margin: '0 0 18px', fontSize: '13.5px', lineHeight: 1.6 }}>
              Customer: <strong style={{ color: colors.text }}>{selectedCustomer.name}</strong>
              <br />
              Current balance: <strong style={{ color: (selectedCustomer.balance || 0) > 0 ? colors.danger : colors.success }}>
                Rs. {(selectedCustomer.balance || 0).toFixed(2)}
              </strong>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.subtle, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Adjustment Type
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setAdjustType('credit')}
                  style={{
                    flex: 1, padding: '10px',
                    border: `1.5px solid ${adjustType === 'credit' ? colors.success : colors.border}`,
                    background: adjustType === 'credit' ? colors.successSoft : 'transparent',
                    color: adjustType === 'credit' ? colors.success : colors.text,
                    borderRadius: '9px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  Add Credit (Paid)
                </button>
                <button
                  onClick={() => setAdjustType('debit')}
                  style={{
                    flex: 1, padding: '10px',
                    border: `1.5px solid ${adjustType === 'debit' ? colors.danger : colors.border}`,
                    background: adjustType === 'debit' ? colors.dangerSoft : 'transparent',
                    color: adjustType === 'debit' ? colors.danger : colors.text,
                    borderRadius: '9px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  Add Debit (Owes)
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.subtle, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Amount (Rs.)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjustAmount || ''}
                onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '9px',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: colors.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.subtle, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Reason *
              </label>
              <input
                type="text"
                placeholder="e.g., Cash payment, correction, etc."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '9px',
                  fontSize: '13.5px',
                  color: colors.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={closeAdjustModal}
                style={{
                  flex: 1, padding: '12px',
                  background: colors.panelAlt,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '9px',
                  color: colors.text,
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustBalance}
                disabled={adjustProcessing || !adjustAmount || !adjustReason.trim()}
                style={{
                  flex: 1, padding: '12px',
                  background: colors.accent,
                  border: 'none',
                  borderRadius: '9px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: adjustProcessing || !adjustAmount || !adjustReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: adjustProcessing || !adjustAmount || !adjustReason.trim() ? 0.55 : 1
                }}
              >
                {adjustProcessing ? 'Processing…' : 'Confirm Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Ledger Modal */}
      {showLedgerModal && selectedCustomer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,27,61,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 5000, padding: '20px'
        }}>
          <div style={{
            background: colors.panelBg,
            borderRadius: '16px',
            padding: '26px',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: shadow.lg,
            fontFamily: fontStack,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: colors.heading }}>Ledger History</h2>
                <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: '13px' }}>{selectedCustomer.name}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={exportLedgerToCSV}
                  style={{
                    padding: '9px 14px',
                    background: colors.purpleSoft,
                    color: colors.purple,
                    border: 'none',
                    borderRadius: '9px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Export CSV
                </button>
                <button
                  onClick={closeLedgerModal}
                  style={{
                    background: colors.panelAlt,
                    border: `1px solid ${colors.border}`,
                    width: '32px', height: '32px', borderRadius: '9px',
                    fontSize: '15px',
                    cursor: 'pointer',
                    color: colors.muted
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Date range filter */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: colors.subtle, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</label>
                <input
                  type="date"
                  value={ledgerDateFrom}
                  onChange={(e) => setLedgerDateFrom(e.target.value)}
                  style={{ padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '13px', color: colors.text }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: colors.subtle, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</label>
                <input
                  type="date"
                  value={ledgerDateTo}
                  onChange={(e) => setLedgerDateTo(e.target.value)}
                  style={{ padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '13px', color: colors.text }}
                />
              </div>
              {(ledgerDateFrom || ledgerDateTo) && (
                <button
                  onClick={() => { setLedgerDateFrom(''); setLedgerDateTo('') }}
                  style={{ padding: '8px 13px', background: colors.panelAlt, border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: colors.text }}
                >
                  Clear
                </button>
              )}
              <span style={{ fontSize: '12px', color: colors.subtle, marginLeft: 'auto', fontWeight: 600 }}>{modalLedger.length} transaction(s)</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: colors.panelAlt }}>
                    <th style={{ textAlign: 'left', padding: '11px 12px', color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '11px 12px', color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '11px 12px', color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Type</th>
                    <th style={{ textAlign: 'right', padding: '11px 12px', color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Amount</th>
                    <th style={{ textAlign: 'center', padding: '11px 12px', color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Order</th>
                  </tr>
                </thead>
                <tbody>
                  {modalLedger.map((entry, idx) => (
                    <tr key={idx} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '11px 12px', color: colors.text }}>
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '11px 12px', color: colors.text }}>
                        {entry.description || entry.type}
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: entry.type === 'sale' ? colors.accentSoft :
                                     entry.type === 'payment' ? colors.successSoft :
                                     entry.type === 'adjustment' ? colors.warningSoft : colors.panelAlt,
                          color: entry.type === 'sale' ? colors.accent :
                                 entry.type === 'payment' ? colors.success :
                                 entry.type === 'adjustment' ? colors.warning : colors.muted
                        }}>
                          {entry.type}
                        </span>
                      </td>
                      <td style={{
                        padding: '11px 12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: entry.amount > 0 ? colors.danger : colors.success
                      }}>
                        {entry.amount > 0 ? '+' : ''}Rs. {entry.amount.toFixed(2)}
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => viewOrder(entry)}
                          disabled={!entry.order_id}
                          style={{
                            padding: '5px 12px',
                            background: entry.order_id ? colors.accent : colors.border,
                            color: entry.order_id ? '#fff' : colors.subtle,
                            border: 'none',
                            borderRadius: '7px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: entry.order_id ? 'pointer' : 'not-allowed'
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {modalLedger.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: colors.subtle }}>
                        No transactions found{(ledgerDateFrom || ledgerDateTo) ? ' for the selected date range' : ''}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '14px 16px',
              background: colors.panelAlt,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', color: colors.muted, fontWeight: 700 }}>Current Balance</span>
              <span style={{
                fontSize: '17px',
                fontWeight: 800,
                color: (customerBalances[selectedCustomer.id]?.total || 0) > 0 ? colors.danger : colors.success
              }}>
                Rs. {(customerBalances[selectedCustomer.id]?.total || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal (opened via "View" on a ledger transaction) */}
      {showOrderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,27,61,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 6000, padding: '20px'
        }} onClick={closeOrderModal}>
          <div style={{
            background: colors.panelBg,
            borderRadius: '16px',
            padding: '26px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: shadow.lg,
            fontFamily: fontStack,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: colors.heading }}>Order Details</h2>
              <button onClick={closeOrderModal} style={{
                background: colors.panelAlt, border: `1px solid ${colors.border}`,
                width: '32px', height: '32px', borderRadius: '9px', fontSize: '15px', cursor: 'pointer', color: colors.muted
              }}>✕</button>
            </div>

            {orderLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: colors.muted, fontSize: '13.5px' }}>Loading order…</div>
            ) : !orderDetails ? (
              <div style={{ textAlign: 'center', padding: '40px', color: colors.muted, fontSize: '13.5px' }}>
                Order not found, or it belongs to a different branch.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '18px', padding: '14px', background: colors.panelAlt, border: `1px solid ${colors.border}`, borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: colors.muted }}>Invoice</span>
                    <span style={{ fontWeight: 700, color: colors.text }}>#{orderDetails.invoice_no || orderDetails.id?.slice(0, 8)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: colors.muted }}>Customer</span>
                    <span style={{ fontWeight: 700, color: colors.text }}>{orderDetails.customer_name || 'Walk-In'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: colors.muted }}>Date</span>
                    <span style={{ color: colors.text }}>{new Date(orderDetails.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: colors.muted }}>Status</span>
                    <span style={{ fontWeight: 700, color: colors.text, textTransform: 'capitalize' }}>{orderDetails.status?.replace('_', ' ')}</span>
                  </div>
                </div>

                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px', color: colors.heading, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Items</h4>
                <div style={{ border: `1px solid ${colors.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: colors.panelAlt }}>
                        <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item</th>
                        <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qty</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: colors.subtle, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orderDetails.order_items || []).map((item, idx) => (
                        <tr key={idx} style={{ borderTop: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '9px 12px', color: colors.text }}>{item.name || `Item #${idx + 1}`}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', color: colors.text }}>{item.quantity}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: colors.text }}>Rs. {item.price?.toFixed(2)}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: colors.text }}>Rs. {(item.quantity * item.price)?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: colors.muted }}>Subtotal</span>
                    <span style={{ fontWeight: 700, color: colors.text }}>Rs. {orderDetails.subtotal?.toFixed(2)}</span>
                  </div>
                  {orderDetails.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: colors.muted }}>Discount</span>
                      <span style={{ fontWeight: 700, color: colors.success }}>−Rs. {orderDetails.discount?.toFixed(2)}</span>
                    </div>
                  )}
                  {orderDetails.tax > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: colors.muted }}>Tax</span>
                      <span style={{ fontWeight: 700, color: colors.text }}>Rs. {orderDetails.tax?.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 800, color: colors.heading, marginTop: '4px' }}>
                    <span>Total</span>
                    <span>Rs. {orderDetails.total?.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}