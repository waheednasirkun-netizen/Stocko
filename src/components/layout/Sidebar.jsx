import { useApp } from '../../context/AppContext'
import { userCan } from '../../lib/constants'
import { Ic } from '../ui'

const navItems = [
  { key: 'dashboard',            label: 'Dashboard',           icon: 'LayoutDashboard' },
  { key: 'inventory',            label: 'Inventory',           icon: 'Package' },
  { key: 'item-templates',       label: 'Item Templates',      icon: 'Box' },
  { key: 'stock-movement',       label: 'Stock Movement',      icon: 'ArrowLeftRight' },
  { key: 'demands',              label: 'Demands',             icon: 'ClipboardList' },
  { key: 'fulfillment-center',   label: 'Fulfillment',         icon: 'CheckCircle' },
  { key: 'procurement-requests', label: 'Procurement',         icon: 'ShoppingCart' },
  { key: 'purchase-orders',      label: 'Purchase Orders',     icon: 'Truck' },
  { key: 'suppliers',            label: 'Suppliers',           icon: 'Users' },
  { key: 'reports',              label: 'Reports',             icon: 'BarChart2' },
  { key: 'expenses',             label: 'Expenses',            icon: 'DollarSign' },
  { key: 'user-management',      label: 'Users',               icon: 'UserPlus',   perm: 'manageUsers' },
  { key: 'activity-log',         label: 'Activity Log',        icon: 'Activity' },
  { key: 'settings',             label: 'Settings',            icon: 'Settings' },
]

export default function Sidebar() {
  const { user, tab, setTab, sidebarOpen, setSidebar, dark, theme } = useApp()

  const go = (key) => {
    setTab(key)
    if (window.innerWidth <= 768) setSidebar(false)
  }

  const visible = navItems.filter(item =>
    !item.perm || userCan(item.perm, user?.role)
  )

  return (
    <>
      {/* Mobile overlay */}
      <div
        id="mob-overlay"
        className={sidebarOpen && window.innerWidth <= 768 ? 'active' : ''}
        onClick={() => setSidebar(false)}
      />

      <div
        id="sidebar"
        className={sidebarOpen ? 'open' : 'closed'}
        style={{ background: dark ? '#1f2937' : 'white', borderRight: `1px solid ${theme.border}` }}
      >
        {/* Logo */}
        <div style={{ padding: sidebarOpen ? '20px 16px 16px' : '20px 0 16px',
          display:'flex', alignItems:'center', gap:10,
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ width:36, height:36, background:'#2563eb', borderRadius:10, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Ic n="Package" size={20} color="white"/>
          </div>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:theme.text }}>RestoStock</div>
              <div style={{ fontSize:10, color:theme.textMuted }}>v5 · Supabase</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ padding: '12px 8px', overflowY:'auto', flex:1,
          height:'calc(100vh - 130px)' }}>
          {visible.map(item => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                className="sidebar-item"
                onClick={() => go(item.key)}
                style={{
                  width:'100%', display:'flex', alignItems:'center',
                  gap:10, padding: sidebarOpen ? '9px 12px' : '9px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  borderRadius:8, border:'none', cursor:'pointer', marginBottom:2,
                  background: active ? theme.navActive : 'transparent',
                  color: active ? '#2563eb' : theme.textMuted,
                  fontWeight: active ? 600 : 400, fontSize:13,
                  transition:'all 0.15s',
                }}
              >
                <Ic n={item.icon} size={18} color={active ? '#2563eb' : theme.textMuted}/>
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && active && (
                  <div style={{ marginLeft:'auto', width:4, height:4, borderRadius:'50%', background:'#2563eb' }}/>
                )}
              </button>
            )
          })}
        </nav>

        {/* Toggle */}
        <div style={{ padding:8, borderTop:`1px solid ${theme.border}` }}>
          <button
            onClick={() => setSidebar(p => !p)}
            style={{ width:'100%', padding:'8px', borderRadius:8, border:'none',
              background:'transparent', cursor:'pointer', color:theme.textMuted,
              display:'flex', alignItems:'center', justifyContent: sidebarOpen ? 'flex-start' : 'center', gap:8 }}
          >
            <Ic n={sidebarOpen ? 'X' : 'Menu'} size={18}/>
            {sidebarOpen && <span style={{ fontSize:12 }}>Collapse</span>}
          </button>
        </div>
      </div>
    </>
  )
}
