import { useEffect } from 'react'
import { useApp } from './context/AppContext'
import { ToastContainer, LoadingScreen } from './components/ui'
import { ConfirmProvider } from './components/ui'
import Sidebar  from './components/layout/Sidebar'
import Header   from './components/layout/Header'
import Login    from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import StockMovement from './pages/StockMovement'
import Demands from './pages/Demands' 
import FulfillmentCenter from './pages/FulfillmentCenter'
import ItemTemplates from './pages/ItemTemplates'
import Suppliers from './pages/Suppliers'
import ProcurementRequests from './pages/ProcurementRequests'
import PurchaseOrders from './pages/PurchaseOrders'
import UserManagement from './pages/UserManagement'
import ActivityLog from './pages/ActivityLog'
import Reports from './pages/Reports'
import InventoryExpenses from './pages/InventoryExpenses'
import SettingsPage from './pages/SettingsPage'
import CustomerLedger from './pages/CustomerLedger'
import POS from './components/pos/POS'
import NotFound from './pages/NotFound'
import { userCan } from './lib/constants'

console.log('[stocko] App.jsx loaded')

const PAGES = {
  'dashboard':            <Dashboard/>,
  'pos':                  <POS />,
  'inventory':            <Inventory/>,
  'item-templates':       <ItemTemplates/>,
  'stock-movement':       <StockMovement/>,
  'demands':              <Demands/>,
  'fulfillment-center':   <FulfillmentCenter/>,
  'procurement-requests': <ProcurementRequests/>,
  'purchase-orders':      <PurchaseOrders/>,
  'suppliers':            <Suppliers/>,
  'reports':              <Reports/>,
  'expenses':             <InventoryExpenses/>,
  'user-management':      <UserManagement/>,
  'activity-log':         <ActivityLog/>,
  'settings':             <SettingsPage/>,
  'customer-ledger':      <CustomerLedger/>,
}

const MOB_TABS = [
  { key: 'pos',                  icon: '🛒', label: 'POS'      },
  { key: 'dashboard',          icon: '🏠', label: 'Home'     },
  { key: 'inventory',          icon: '📦', label: 'Stock'    },
  { key: 'demands',            icon: '📋', label: 'Demands'  },
  { key: 'fulfillment-center', icon: '✅', label: 'Fulfill'  },
  { key: 'stock-movement',     icon: '🔄', label: 'Movement' },
]

function MobileBottomNav() {
  const { tab, setTab, theme } = useApp()
  return (
    <nav id="mob-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: theme.cardBg || '#ffffff',
      borderTop: `1px solid ${theme.border || '#e2e8f0'}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 0', zIndex: 100, boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
    }}>
      {MOB_TABS.map(t => (
        <button key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 12px', borderRadius: 10, border: 'none', background: 'none',
            cursor: 'pointer', color: tab === t.key ? (theme.primary || '#3b82f6') : (theme.textMuted || '#64748b'),
            fontSize: 11, fontWeight: tab === t.key ? 700 : 500,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

function SystemDisabledOverlay() {
  const { systemMsg, theme } = useApp()
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: theme.cardBg || '#ffffff',
        border: `1px solid ${theme.border || '#e2e8f0'}`,
        borderRadius: 16,
        padding: 40, textAlign: 'center', maxWidth: 400, width: '100%',
        boxShadow: theme.shadowLg || '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: theme.text || '#0f172a', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          System Disabled
        </h2>
        <p style={{ color: theme.textMuted || '#64748b', fontSize: 14, lineHeight: 1.6 }}>
          {systemMsg}
        </p>
      </div>
    </div>
  )
}

function KeyboardShortcuts() {
  const { user, setTab } = useApp()
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        if (userCan('createDemand', user?.role)) {
          setTab('demands')
          setTimeout(() => document.getElementById('btn-new-demand')?.click(), 100)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        if (userCan('stockIn', user?.role)) {
          setTab('stock-movement')
          setTimeout(() => document.getElementById('btn-stock-in')?.click(), 100)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user, setTab])
  return null
}

function AppContent() {
  const {
    user, tab, sidebarOpen, theme, toasts, dismissToast,
    systemEnabled, loading, dataLoaded, authReady, dark,
  } = useApp()

  useEffect(() => {
    if (dark) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
    return () => document.body.classList.remove('dark-mode')
  }, [dark])

  if (!authReady) {
    return <LoadingScreen message="Checking session…"/>
  }

  if (!user) return <Login/>

  if (loading && !dataLoaded) {
    return <LoadingScreen message={`Loading ${user.branch_name ?? 'branch'} data…`}/>
  }

  if (!user.branch_id) {
    return (
      <div style={{
        minHeight: '100vh', background: theme.bg || '#f8fafc',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}>
        <div style={{
          background: theme.cardBg || '#ffffff',
          borderRadius: 16, padding: 40,
          maxWidth: 480, width: '100%', textAlign: 'center',
          boxShadow: theme.shadowLg || '0 20px 60px rgba(0,0,0,0.08)',
          border: `1px solid ${theme.border || '#e2e8f0'}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text || '#0f172a', marginBottom: 8 }}>
            No Branch Assigned
          </h2>
          <p style={{ color: theme.textMuted || '#64748b', fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
            Logged in as <strong>{user.email}</strong>
          </p>
          <p style={{ color: theme.textMuted || '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
            public.users.id: <code style={{
              background: theme.bg || '#f8fafc', padding: '2px 6px', borderRadius: 4, fontSize: 11,
              color: theme.text || '#0f172a', border: `1px solid ${theme.border || '#e2e8f0'}`,
              fontFamily: 'monospace',
            }}>{user.id}</code>
          </p>
          <p style={{ color: theme.textMuted || '#64748b', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            Set <code style={{ fontFamily: 'monospace', background: theme.bg || '#f8fafc', padding: '1px 4px', borderRadius: 4, border: `1px solid ${theme.border || '#e2e8f0'}` }}>branch_id</code> on your user row in the <code style={{ fontFamily: 'monospace', background: theme.bg || '#f8fafc', padding: '1px 4px', borderRadius: 4, border: `1px solid ${theme.border || '#e2e8f0'}` }}>users</code> table
            to a valid branch, then refresh the page.
          </p>
          <button
            onClick={async () => { const { authApi: a } = await import('./lib/api'); await a.logout() }}
            style={{
              padding: '10px 28px', background: theme.primary || '#3b82f6', color: '#ffffff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s', boxShadow: `0 4px 14px ${theme.primary || '#3b82f6'}40`,
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg || '#f8fafc' }}>
      {!systemEnabled && <SystemDisabledOverlay/>}
      <KeyboardShortcuts/>
      <Sidebar/>
      <div id="main-content" className={sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}>
        <Header/>
        <main className="app-main mobile-p">
          <div className="app-page">
            {PAGES[tab] || <NotFound/>}
          </div>
        </main>
      </div>
      <MobileBottomNav/>
      <ToastContainer toasts={toasts} onDismiss={dismissToast}/>
    </div>
  )
}

export default function App() {
  return (
    <ConfirmProvider>
      <AppContent/>
    </ConfirmProvider>
  )
}