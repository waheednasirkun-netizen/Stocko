import { useApp } from '../../context/AppContext'
import { Ic } from '../ui'

const navItems = [
  { key: 'dashboard',            label: 'Dashboard',           icon: 'LayoutDashboard',  perm: 'canAccessDashboard' },
  { key: 'inventory',            label: 'Inventory',           icon: 'Package',          perm: 'canAccessInventory' },
  { key: 'item-templates',       label: 'Item Templates',      icon: 'Box',              perm: 'canAccessItemTemplates' },
  { key: 'stock-movement',       label: 'Stock Movement',      icon: 'ArrowLeftRight',   perm: 'canAccessStockMovement' },
  { key: 'demands',              label: 'Demands',             icon: 'ClipboardList',    perm: 'canAccessDemands' },
  { key: 'fulfillment-center',   label: 'Fulfillment',         icon: 'CheckCircle',      perm: 'canAccessFulfillment' },
  { key: 'suppliers',            label: 'Suppliers',           icon: 'Users',            perm: 'canAccessSuppliers' },
  { key: 'reports',              label: 'Reports',             icon: 'BarChart2',          perm: 'canViewReports' },
  { key: 'user-management',      label: 'Users',               icon: 'UserPlus',         perm: 'canAccessUserManagement' },
  { key: 'activity-log',         label: 'Activity Log',        icon: 'Activity',         perm: 'canAccessActivityLog' },
  { key: 'settings',             label: 'Settings',            icon: 'Settings',         perm: 'canAccessSettings' },
]

export default function Sidebar() {
  const {
    user, tab, setTab, sidebarOpen, setSidebar, dark, theme,
    userRole,
    canAccessDashboard,
    canAccessInventory,
    canAccessItemTemplates,
    canAccessStockMovement,
    canAccessDemands,
    canAccessFulfillment,
    canAccessSuppliers,
    canViewReports,
    canAccessUserManagement,
    canAccessActivityLog,
    canAccessSettings,
  } = useApp()

  const go = (key) => {
    setTab(key)
    if (window.innerWidth <= 768) setSidebar(false)
  }

  // Permission check map
  const permChecks = {
    canAccessDashboard,
    canAccessInventory,
    canAccessItemTemplates,
    canAccessStockMovement,
    canAccessDemands,
    canAccessFulfillment,
    canAccessSuppliers,
    canViewReports,
    canAccessUserManagement,
    canAccessActivityLog,
    canAccessSettings,
  }

  const visible = navItems.filter(item => {
    const check = permChecks[item.perm]
    return check ? check() : true
  })

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
        style={{
          background: theme.cardBg,
          borderRight: `1px solid ${theme.border}`
        }}
      >
        {/* Logo */}
        <div style={{
          padding: sidebarOpen ? '20px 16px 16px' : '20px 0 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          borderBottom: `1px solid ${theme.border}`
        }}>
          <div style={{
            width: 36, height: 36, background: '#2563eb', borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Ic n="Package" size={20} color="white"/>
          </div>
          {sidebarOpen && (
            <div>
              <div className="sidebar-logo-text" style={{ fontWeight: 800, fontSize: 15, color: theme.text }}>
                Stocko
              </div>
              <div className="sidebar-version" style={{ fontSize: 10, color: theme.textMuted }}>
                v5 · Supabase
              </div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{
          padding: '12px 8px', overflowY: 'auto', flex: 1,
          height: 'calc(100vh - 160px)'
        }}>
          {visible.map(item => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                className="sidebar-item"
                onClick={() => go(item.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 10, padding: sidebarOpen ? '9px 12px' : '9px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2,
                  background: active ? theme.navActive : 'transparent',
                  color: active ? (dark ? '#60a5fa' : '#2563eb') : theme.textMuted,
                  fontWeight: active ? 600 : 400, fontSize: 13,
                  transition: 'all 0.15s',
                }}
              >
                <Ic
                  n={item.icon}
                  size={18}
                  color={active ? (dark ? '#60a5fa' : '#2563eb') : theme.textMuted}
                />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && active && (
                  <div style={{
                    marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%',
                    background: dark ? '#60a5fa' : '#2563eb'
                  }}/>
                )}
              </button>
            )
          })}
        </nav>

        {/* Role badge */}
        {sidebarOpen && userRole && (
          <div style={{
            padding: '8px 12px',
            borderTop: `1px solid ${theme.border}`,
            fontSize: 11,
            color: theme.textMuted,
            textAlign: 'center',
          }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 10,
              background: dark ? '#1e293b' : '#e5e7eb',
              fontWeight: 600,
            }}>
              {userRole}
            </span>
          </div>
        )}

        {/* Toggle */}
        <div style={{ padding: 8, borderTop: `1px solid ${theme.border}` }}>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebar(p => !p)}
            style={{
              width: '100%', padding: '8px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', color: theme.textMuted,
              display: 'flex', alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center', gap: 8,
              transition: 'background 0.15s'
            }}
          >
            <Ic n={sidebarOpen ? 'X' : 'Menu'} size={18}/>
            {sidebarOpen && <span style={{ fontSize: 12 }}>Collapse</span>}
          </button>
        </div>
      </div>
    </>
  )
}