import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Card, StatusPill, EmptyState } from '../components/ui'
import { fmtNum, fmtShort, fmtPKR } from '../lib/constants'

const StatCard = ({ icon, label, value, sub, color = '#2563eb', bg = '#eff6ff' }) => (
  <Card style={{ display:'flex', alignItems:'center', gap:16 }}>
    <div style={{ width:48, height:48, borderRadius:12, background:bg,
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <Ic n={icon} size={22} color={color}/>
    </div>
    <div>
      <div style={{ fontSize:22, fontWeight:800, color:'#111827' }}>{value}</div>
      <div style={{ fontSize:13, color:'#6b7280', fontWeight:500 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  </Card>
)

export default function Dashboard() {
  const { inventory, transactions, demands, stats, theme, setTab } = useApp()

  const recentTxns = useMemo(() =>
    [...transactions]
      .sort((a,b) => new Date(b.created_at||b.date) - new Date(a.created_at||a.date))
      .slice(0, 8),
    [transactions]
  )

  const pendingDemands = useMemo(() =>
    demands.filter(d => d.status === 'Pending').slice(0, 5),
    [demands]
  )

  const lowStockItems = useMemo(() =>
    inventory.filter(i => i.status !== 'Good').slice(0, 5),
    [inventory]
  )

  const typeColor = (t) => ({
    'Stock IN':    { bg:'#dcfce7', color:'#166534' },
    'Stock OUT':   { bg:'#fee2e2', color:'#991b1b' },
    'Wastage':     { bg:'#fef9c3', color:'#854d0e' },
    'Fulfillment': { bg:'#f3e8ff', color:'#7c3aed' },
  }[t] || { bg:'#f3f4f6', color:'#374151' })

  return (
    <div className="animate-fade-in">
      {/* Stats Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:24 }}
        className="grid-mobile-2">
        <StatCard icon="Package"      label="Total Items"      value={fmtNum(stats.totalItems)}      color="#2563eb" bg="#eff6ff"/>
        <StatCard icon="AlertTriangle" label="Low/Critical"    value={fmtNum(stats.lowStockCount + stats.criticalCount)} color="#dc2626" bg="#fee2e2"/>
        <StatCard icon="TrendingUp"   label="Stock IN (total)" value={fmtNum(stats.stockInTotal)}    color="#16a34a" bg="#dcfce7"/>
        <StatCard icon="TrendingDown" label="Stock OUT (total)"value={fmtNum(stats.stockOutTotal)}   color="#d97706" bg="#fef9c3"/>
        <StatCard icon="Truck"        label="Active Suppliers" value={fmtNum(stats.activeSuppliers)} color="#7c3aed" bg="#f3e8ff"/>
        <StatCard icon="DollarSign"   label="Inventory Value"  value={fmtShort(stats.inventoryValue)} color="#0891b2" bg="#ecfeff"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}
        className="grid-mobile-1">

        {/* Recent Transactions */}
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:theme.text }}>Recent Transactions</h3>
            <button onClick={() => setTab('stock-movement')}
              style={{ fontSize:12, color:'#2563eb', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
              View all →
            </button>
          </div>
          {recentTxns.length === 0
            ? <EmptyState icon="ArrowLeftRight" title="No transactions yet"/>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {recentTxns.map(t => {
                  const { bg, color } = typeColor(t.type)
                  const itemName = t.item_name || t.item || '—'
                  const qty = t.quantity || t.qty
                  const unit = t.unit || ''
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10,
                      padding:'8px 10px', borderRadius:8, background:theme.rowHover }}>
                      <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, background:bg, color, flexShrink:0 }}>
                        {t.type}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:theme.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {itemName}
                        </div>
                        <div style={{ fontSize:11, color:theme.textMuted }}>
                          {fmtNum(qty)} {unit}
                          {t.price_per_unit > 0 && ` · ${fmtPKR(t.price_per_unit)}/unit`}
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:theme.textMuted, flexShrink:0 }}>
                        {new Date(t.created_at||t.date).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Pending Demands */}
          <Card>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ fontSize:15, fontWeight:700, color:theme.text }}>Pending Demands</h3>
              <button onClick={() => setTab('demands')}
                style={{ fontSize:12, color:'#2563eb', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
                View all →
              </button>
            </div>
            {pendingDemands.length === 0
              ? <div style={{ fontSize:13, color:theme.textMuted, textAlign:'center', padding:'20px 0' }}>No pending demands 🎉</div>
              : pendingDemands.map(d => {
                  const pColors = { Critical:'#fee2e2,#991b1b', High:'#fef9c3,#854d0e', Medium:'#dbeafe,#1e40af', Low:'#dcfce7,#166534' }
                  const [pbg, pc] = (pColors[d.priority] || '#f3f4f6,#374151').split(',')
                  const name = d.item_name || d.name || '—'
                  const qty  = d.quantity  || d.qty
                  return (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8,
                      padding:'7px 0', borderBottom:`1px solid ${theme.border}` }}>
                      <span style={{ padding:'2px 7px', borderRadius:6, fontSize:10, fontWeight:600, background:pbg, color:pc, flexShrink:0 }}>
                        {d.priority}
                      </span>
                      <div style={{ flex:1, fontSize:13, color:theme.text }}>{name}</div>
                      <div style={{ fontSize:12, color:theme.textMuted }}>{fmtNum(qty)} {d.unit}</div>
                    </div>
                  )
                })
            }
          </Card>

          {/* Low Stock Alert */}
          <Card>
            <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:12 }}>
              ⚠️ Low / Critical Stock
            </h3>
            {lowStockItems.length === 0
              ? <div style={{ fontSize:13, color:'#16a34a', textAlign:'center', padding:'12px 0' }}>All items are well-stocked ✓</div>
              : lowStockItems.map(i => (
                  <div key={i.name} style={{ display:'flex', alignItems:'center', gap:8,
                    padding:'7px 0', borderBottom:`1px solid ${theme.border}` }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                      background: i.status==='Critical' ? '#dc2626' : '#d97706' }}/>
                    <div style={{ flex:1, fontSize:13, color:theme.text }}>{i.name}</div>
                    <div style={{ fontSize:12, color: i.status==='Critical' ? '#dc2626' : '#d97706', fontWeight:600 }}>
                      {fmtNum(i.quantity)} {i.unit}
                    </div>
                  </div>
                ))
            }
          </Card>
        </div>
      </div>
    </div>
  )
}
