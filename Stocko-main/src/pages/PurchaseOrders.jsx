import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Card, EmptyState, StatusPill } from '../components/ui'
import { fmtPKR, userCan } from '../lib/constants'

export default function PurchaseOrders() {
  const { purchaseOrders, updatePOStatus, suppliers, theme, user, showToast } = useApp()
  const sorted = useMemo(() => [...purchaseOrders].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)), [purchaseOrders])
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.text }}>Purchase Orders</h2>
        <p style={{ fontSize:12, color:theme.textMuted }}>{purchaseOrders.length} orders</p>
      </div>
      <Card style={{ padding:0, overflow:'hidden' }}>
        {sorted.length === 0
          ? <EmptyState icon="FileText" title="No purchase orders" message="Purchase orders will appear here"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:theme.bg }}>
                  {['PO #','Supplier','Total','Status','Date','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sorted.map(po => (
                    <tr key={po.id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                      <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>#{String(po.id).slice(-6)}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, color:theme.textMuted }}>{po.supplier||po.supplier_name||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, color:theme.text }}>{fmtPKR(po.total_amount||po.totalAmount||0)}</td>
                      <td style={{ padding:'10px 14px' }}><StatusPill status={po.status||'Ordered'}/></td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        {userCan('markPOStatus', user?.role) && po.status === 'Ordered' && (
                          <button onClick={() => { updatePOStatus(po.id, 'Received'); showToast('success','PO Received','') }}
                            style={{ padding:'3px 8px', background:'#dcfce7', color:'#166534', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                            Mark Received
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  )
}
