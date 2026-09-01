import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Card, EmptyState, StatusPill } from '../components/ui'
import { fmtNum, fmtPKR, userCan } from '../lib/constants'

export default function InventoryExpenses() {
  const { financialTransactions, updateFinancialTxnStatus, theme, user } = useApp()
  const sorted = useMemo(() => [...financialTransactions].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)), [financialTransactions])
  const canView = userCan('viewFinancials', user?.role)
  if (!canView) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
      <div style={{ textAlign:'center' }}>
        <Ic n="Lock" size={40} color="#d1d5db" style={{ display:'block', margin:'0 auto 12px' }}/>
        <p style={{ color:'#6b7280', fontSize:14 }}>Access restricted to Admin / Manager</p>
      </div>
    </div>
  )
  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize:18, fontWeight:700, color:theme.text, marginBottom:20 }}>Inventory Expenses</h2>
      <Card style={{ padding:0, overflow:'hidden' }}>
        {sorted.length === 0
          ? <EmptyState icon="DollarSign" title="No financial records" message="Records appear automatically on Stock IN"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:theme.bg }}>
                  {['Item','Category','Qty','Unit','Price/Unit','Total','Supplier','Payment','Date',''].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}`, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sorted.map(f => {
                    const name = f.item_name||f.itemName||'—'
                    const ps   = f.payment_status||f.paymentStatus||'paid'
                    return (
                      <tr key={f.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{name}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{f.category||'—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{fmtNum(f.quantity)}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{f.unit||'—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{fmtPKR(f.price_per_unit||f.pricePerUnit||0)}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{fmtPKR(f.total_amount||f.totalAmount||0)}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{f.supplier||'—'}</td>
                        <td style={{ padding:'10px 14px' }}><StatusPill status={ps}/></td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                          {f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          {ps === 'unpaid' && (
                            <button onClick={() => updateFinancialTxnStatus(f.id, 'paid')}
                              style={{ padding:'3px 8px', background:'#dcfce7', color:'#166534', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  )
}
