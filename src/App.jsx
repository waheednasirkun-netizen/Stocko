console.log('[RestoStock] App.jsx loaded')

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
import { userCan } from './lib/constants'

const PAGES = {
  'dashboard':            <Dashboard/>,
  'inventory':            <Inventory/>,
  'item-templates':       <ItemTemplates/>,
  'stock-movement':       <StockMovement/>,
  'demands': <Demands/>,
  'fulfillment-center':   <FulfillmentCenter/>,
  'procurement-requests': <ProcurementRequests/>,
  'purchase-orders':      <PurchaseOrders/>,
  'suppliers':            <Suppliers/>,
  'reports':              <Reports/>,
  'expenses':             <InventoryExpenses/>,
  'user-management':      <UserManagement/>,
  'activity-log':         <ActivityLog/>,
  'settings':             <SettingsPage/>,
}

const MOB_TABS = [
  { key: 'dashboard',          icon: '🏠', label: 'Home'     },
  { key: 'inventory',          icon: '📦', label: 'Stock'    },
  { key: 'demands',            icon: '📋', label: 'Demands'  },
  { key: 'fulfillment-center', icon: '✅', label: 'Fulfill'  },
  { key: 'stock-movement',     icon: '🔄', label: 'Movement' },
]

function MobileBottomNav() {
  const { tab, setTab } = useApp()
  return (
    <nav id="mob-nav">
      {MOB_TABS.map(t => (
        <button key={t.key} className={`mob-nav-btn${tab === t.key ? ' active' : ''}`}
          onClick={() => setTab(t.key)}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

function SystemDisabledOverlay() {
  const { systemMsg, theme, dark } = useApp()
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: dark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)',
      zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div className="system-disabled-box" style={{
        background: theme.modalBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 40, textAlign: 'center', maxWidth: 400, width: '100%'
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          System Disabled
        </h2>
        <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.6 }}>
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

  // Apply dark-mode class to body for CSS overrides
  useEffect(() => {
    if (dark) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
    return () => document.body.classList.remove('dark-mode')
  }, [dark])

  // Step 1: Wait for Supabase to check existing session.
  if (!authReady) {
    return <LoadingScreen message="Checking session…"/>
  }

  // Step 2: No authenticated user
  if (!user) return <Login/>

  // Step 3: Authenticated but data still loading
  if (loading && !dataLoaded) {
    return <LoadingScreen message={`Loading ${user.branch_name ?? 'branch'} data…`}/>
  }

  // Step 4: User has no branch mapping
  if (!user.branch_id) {
    return (
      <div className="no-branch-page" style={{
        minHeight: '100vh', background: theme.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}>
        <div className="no-branch-card" style={{
          background: theme.cardBg,
          borderRadius: 16, padding: 40,
          maxWidth: 480, width: '100%', textAlign: 'center',
          boxShadow: theme.shadowLg, border: `1px solid ${theme.border}`
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
            No Branch Assigned
          </h2>
          <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
            Logged in as <strong>{user.email}</strong>
          </p>
          <p style={{ color: theme.textMuted, fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
            public.users.id: <code style={{
              background: theme.cardHover, padding: '2px 6px', borderRadius: 4, fontSize: 11,
              color: theme.textLight, border: `1px solid ${theme.borderLight}`
            }}>{user.id}</code>
          </p>
          <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            Set <code>branch_id</code> on your user row in the <code>users</code> table
            to a valid branch, then refresh the page.
          </p>
          <button
            onClick={async () => { const { authApi: a } = await import('./lib/api'); await a.logout() }}
            style={{
              padding: '10px 28px', background: theme.primary, color: theme.primaryText,
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Step 5: Everything ready
  return (
    <div style={{ minHeight: '100vh', background: theme.bg }}>
      {!systemEnabled && <SystemDisabledOverlay/>}
      <KeyboardShortcuts/>
      <Sidebar/>
      <div id="main-content" className={sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}>
        <Header/>
        <main style={{ padding: 20 }} className="mobile-p">
          {PAGES[tab] || <Dashboard/>}
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