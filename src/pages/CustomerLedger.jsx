import { useState, useEffect, useMemo } from 'react'
import { useApp } from "../context/AppContext.jsx";
import { posApi } from "../lib/pos";

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

  const isAdmin = ['admin', 'manager', 'developer', 'superadmin', 'owner'].includes(
    (user?.role || '').toLowerCase()
  )

  const colors = {
    bg: '#f8f9fa', panelBg: '#ffffff', text: '#1a1a2e',
    muted: '#6c757d', border: '#e9ecef', accent: '#0d6efd',
    success: '#198754', danger: '#dc3545', warning: '#ffc107',
  }

  useEffect(() => {
    loadData()
  }, [user?.branch_id])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: custData } = await posApi.getCustomers?.() || 
        await posApi.supabase?.from('customers').select('*').eq('is_active', true).order('name') || { data: [] }
      setCustomers(custData || [])

      const { data: ledgerData } = await posApi.supabase
        ?.from('ledger_entries')
        .select('*, customers(name)')
        .eq('branch_id', user?.branch_id)
        .order('created_at', { ascending: false })
        || { data: [] }
      setLedgerEntries(ledgerData || [])
    } catch (err) {
      console.error('[Ledger] Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // FIXED: Handle balance adjustment with correct sign logic
  const handleAdjustBalance = async () => {
    if (!selectedCustomer) return
    if (!adjustReason.trim()) { alert('Please provide a reason'); return }
    setAdjustProcessing(true)
    try {
      // FIXED: Credit (customer paid) = negative (reduces balance)
      //        Debit (customer owes more) = positive (increases balance)
      const amount = adjustType === 'credit' 
        ? -Math.abs(adjustAmount) 
        : Math.abs(adjustAmount)

      const { error } = await posApi.supabase.from('ledger_entries').insert([{
        customer_id: selectedCustomer.id,
        branch_id: user?.branch_id,
        amount: amount,
        type: 'adjustment',
        description: `Balance adjustment: ${adjustReason}`,
        created_by: user?.id,
        created_by_name: user?.name,
      }])

      if (error) throw error

      // FIXED: Update customer balance correctly
      // Credit reduces balance, debit increases it
      const newBalance = (selectedCustomer.balance || 0) + amount
      await posApi.supabase.from('customers').update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      }).eq('id', selectedCustomer.id)

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

  // FIXED: Balance calculation with correct sign logic
  // Positive amount = customer owes (sale, debit adjustment)
  // Negative amount = customer paid (payment, credit adjustment)
  const customerBalances = useMemo(() => {
    const balances = {}
    ledgerEntries.forEach(entry => {
      if (!balances[entry.customer_id]) {
        balances[entry.customer_id] = { total: 0, paid: 0, due: 0 }
      }

      // Add to running total (positive = owes, negative = credit/paid)
      balances[entry.customer_id].total += entry.amount

      // Track total payments (negative entries = money received)
      if (entry.amount < 0) {
        balances[entry.customer_id].paid += Math.abs(entry.amount)
      }
    })

    Object.keys(balances).forEach(id => {
      // FIXED: due = max(0, total) — positive total means customer owes money
      // negative total means customer has overpaid/credit
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

  const getCustomerLedger = (customerId) => {
    return ledgerEntries
      .filter(e => e.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  const openLedgerModal = (customer) => {
    setSelectedCustomer(customer)
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
  }

  return (
    <div style={{ padding: '20px', background: colors.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: colors.text, margin: 0 }}>📒 Customer Ledger</h1>
          <p style={{ color: colors.muted, margin: '4px 0 0' }}>Manage customer balances & payment history</p>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 12px 8px 32px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              fontSize: '14px',
              width: '250px'
            }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
          {filteredCustomers.map(customer => {
            const balance = customerBalances[customer.id] || { total: 0, paid: 0, due: 0 }
            const hasDue = balance.due > 0
            const hasCredit = balance.total < 0

            return (
              <div key={customer.id} style={{
                background: colors.panelBg,
                borderRadius: '10px',
                padding: '20px',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.text }}>{customer.name}</h3>
                    {customer.phone && <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.muted }}>📞 {customer.phone}</p>}
                    {customer.email && <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.muted }}>✉️ {customer.email}</p>}
                  </div>
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: hasDue ? '#f8d7da' : hasCredit ? '#d1e7dd' : '#e2e3e5',
                    color: hasDue ? '#842029' : hasCredit ? '#0f5132' : '#41464b'
                  }}>
                    {hasDue ? `Due: Rs. ${balance.due.toFixed(2)}` : hasCredit ? `Credit: Rs. ${Math.abs(balance.total).toFixed(2)}` : 'Paid Up'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ background: colors.bg, padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: colors.muted, textTransform: 'uppercase' }}>Total Owing</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: balance.total > 0 ? colors.danger : colors.success }}>
                      Rs. {Math.abs(balance.total).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ background: colors.bg, padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: colors.muted, textTransform: 'uppercase' }}>Paid</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: colors.success }}>Rs. {balance.paid.toFixed(2)}</div>
                  </div>
                  <div style={{ background: colors.bg, padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: colors.muted, textTransform: 'uppercase' }}>Due</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: hasDue ? colors.danger : colors.muted }}>Rs. {balance.due.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '12px', color: colors.muted, margin: '0 0 8px', textTransform: 'uppercase' }}>Recent Transactions</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    {getCustomerLedger(customer.id).slice(0, 3).map((entry, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: colors.bg,
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <span style={{ color: colors.text }}>{entry.description?.substring(0, 30)}...</span>
                        <span style={{ 
                          fontWeight: 700,
                          // FIXED: Positive = owes (red), Negative = paid/credit (green)
                          color: entry.amount > 0 ? colors.danger : colors.success
                        }}>
                          {entry.amount > 0 ? '+' : ''}Rs. {entry.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {getCustomerLedger(customer.id).length === 0 && (
                      <div style={{ textAlign: 'center', color: colors.muted, fontSize: '12px', padding: '10px' }}>
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
                      padding: '8px',
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    📋 View Ledger
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => openAdjustModal(customer)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: colors.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      ⚖️ Adjust Balance
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
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 5000, padding: '20px'
        }}>
          <div style={{
            background: colors.panelBg,
            borderRadius: '10px',
            padding: '24px',
            width: '100%',
            maxWidth: '450px'
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800 }}>⚖️ Adjust Balance</h2>
            <p style={{ color: colors.muted, margin: '0 0 16px' }}>
              Customer: <strong>{selectedCustomer.name}</strong>
              <br />
              Current Balance: <strong style={{ color: (selectedCustomer.balance || 0) > 0 ? colors.danger : colors.success }}>
                Rs. {(selectedCustomer.balance || 0).toFixed(2)}
              </strong>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>
                Adjustment Type
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setAdjustType('credit')}
                  style={{
                    flex: 1, padding: '10px',
                    border: `2px solid ${adjustType === 'credit' ? colors.success : colors.border}`,
                    background: adjustType === 'credit' ? colors.success : 'transparent',
                    color: adjustType === 'credit' ? '#fff' : colors.text,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Add Credit (Customer Paid)
                </button>
                <button
                  onClick={() => setAdjustType('debit')}
                  style={{
                    flex: 1, padding: '10px',
                    border: `2px solid ${adjustType === 'debit' ? colors.danger : colors.border}`,
                    background: adjustType === 'debit' ? colors.danger : 'transparent',
                    color: adjustType === 'debit' ? '#fff' : colors.text,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Add Debit (Customer Owes)
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>
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
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 700
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.muted, marginBottom: '6px', textTransform: 'uppercase' }}>
                Reason *
              </label>
              <input
                type="text"
                placeholder="e.g., Cash payment, Correction, etc."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={closeAdjustModal}
                style={{
                  flex: 1, padding: '11px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.text,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustBalance}
                disabled={adjustProcessing || !adjustAmount || !adjustReason.trim()}
                style={{
                  flex: 1, padding: '11px',
                  background: colors.accent,
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: adjustProcessing || !adjustAmount || !adjustReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: adjustProcessing || !adjustAmount || !adjustReason.trim() ? 0.6 : 1
                }}
              >
                {adjustProcessing ? 'Processing...' : 'Confirm Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Ledger Modal */}
      {showLedgerModal && selectedCustomer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 5000, padding: '20px'
        }}>
          <div style={{
            background: colors.panelBg,
            borderRadius: '10px',
            padding: '24px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>📋 Ledger History</h2>
                <p style={{ color: colors.muted, margin: '4px 0 0' }}>{selectedCustomer.name}</p>
              </div>
              <button 
                onClick={closeLedgerModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: colors.muted
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                    <th style={{ textAlign: 'left', padding: '10px', color: colors.muted, fontSize: '11px', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '10px', color: colors.muted, fontSize: '11px', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '10px', color: colors.muted, fontSize: '11px', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ textAlign: 'right', padding: '10px', color: colors.muted, fontSize: '11px', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {getCustomerLedger(selectedCustomer.id).map((entry, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px', color: colors.text }}>
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px', color: colors.text }}>
                        {entry.description || entry.type}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: entry.type === 'sale' ? '#e7f3ff' : 
                                     entry.type === 'payment' ? '#d1e7dd' : 
                                     entry.type === 'adjustment' ? '#fff3cd' : colors.bg,
                          color: entry.type === 'sale' ? colors.accent : 
                                 entry.type === 'payment' ? colors.success : 
                                 entry.type === 'adjustment' ? '#856404' : colors.muted
                        }}>
                          {entry.type}
                        </span>
                      </td>
                      <td style={{ 
                        padding: '10px', 
                        textAlign: 'right',
                        fontWeight: 700,
                        color: entry.amount > 0 ? colors.danger : colors.success
                      }}>
                        {entry.amount > 0 ? '+' : ''}Rs. {entry.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {getCustomerLedger(selectedCustomer.id).length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: colors.muted }}>
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              background: colors.bg, 
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', color: colors.muted, fontWeight: 600 }}>Current Balance</span>
              <span style={{ 
                fontSize: '16px', 
                fontWeight: 800,
                color: (customerBalances[selectedCustomer.id]?.total || 0) > 0 ? colors.danger : colors.success
              }}>
                Rs. {(customerBalances[selectedCustomer.id]?.total || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}