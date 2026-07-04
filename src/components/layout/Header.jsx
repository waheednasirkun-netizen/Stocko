import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { Ic } from '../ui'

const PAGE_TITLES = {
  'dashboard':            'Dashboard',
  'inventory':            'Inventory',
  'item-templates':       'Item Templates',
  'stock-movement':       'Stock Movement',
  'demands':              'Demand List',
  'fulfillment-center':   'Fulfillment Center',
  'procurement-requests': 'Procurement Requests',
  'purchase-orders':      'Purchase Orders',
  'suppliers':            'Suppliers',
  'reports':              'Reports',
  'expenses':             'Inventory Expenses',
  'user-management':      'User Management',
  'activity-log':         'Activity Log',
  'settings':             'Settings',
}

export default function Header() {
  const { user, setUser, tab, setTab, dark, setDark, theme, setSidebar, sidebarOpen,
    notifications, markAllRead, logout, inventory, showToast } = useApp()

  const [showNotifs,  setShowNotifs]  = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [searchVal,   setSearchVal]   = useState('')
  const [searchRes,   setSearchRes]   = useState([])
  const [showSearch,  setShowSearch]  = useState(false)
  const searchRef = useRef(null)

  const unread = notifications.filter(n => !n.read).length

  // Search inventory
  useEffect(() => {
    if (!searchVal.trim()) { setSearchRes([]); return }
    const q = searchVal.toLowerCase()
    setSearchRes(inventory.filter(i => i.name.toLowerCase().includes(q)).slice(0, 6))
  }, [searchVal, inventory])

  // Click outside to close dropdowns
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('#header-notifs'))  setShowNotifs(false)
      if (!e.target.closest('#header-profile')) setShowProfile(false)
      if (!e.target.closest('#header-search'))  setShowSearch(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const avatarBg = {
    'Admin':        '#fee2e2', 'Manager': '#fef9c3', 'Store Keeper': '#dcfce7',
    'Kitchen Staff':'#f3e8ff', 'Viewer':  '#dbeafe', 'Developer':   '#f1f5f9',
  }
  const avatarColor = {
    'Admin':        '#dc2626', 'Manager': '#854d0e', 'Store Keeper': '#166534',
    'Kitchen Staff':'#7c3aed', 'Viewer':  '#1d4ed8', 'Developer':   '#475569',
  }

  return (
    <header style={{ position:'sticky', top:0, zIndex:40, background:theme.cardBg,
      borderBottom:`1px solid ${theme.border}`, padding:'0 20px',
      display:'flex', alignItems:'center', gap:12, height:58 }}>

      {/* Mobile menu toggle */}
      <button onClick={() => setSidebar(p => !p)} className="hide-desktop"
        style={{ background:'none', border:'none', cursor:'pointer', color:theme.textMuted,
          padding:6, display:'none' }}>
        <Ic n="Menu" size={20}/>
      </button>

      {/* Page title */}
      <h2 style={{ fontSize:16, fontWeight:700, color:theme.text, flex:1 }}>
        {PAGE_TITLES[tab] || 'RestoStock'}
      </h2>

      {/* Search */}
      <div id="header-search" style={{ position:'relative', width:220 }} className="hide-mobile">
        <Ic n="Search" size={15} color="#9ca3af"
          style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}/>
        <input
          ref={searchRef}
          value={searchVal}
          onChange={e => { setSearchVal(e.target.value); setShowSearch(true) }}
          onFocus={() => setShowSearch(true)}
          placeholder="Search inventory…"
          style={{ width:'100%', padding:'7px 10px 7px 32px', border:`1px solid ${theme.border}`,
            borderRadius:8, fontSize:13, background:theme.inputBg, color:theme.text }}
        />
        {showSearch && searchRes.length > 0 && (
          <div className="search-dropdown">
            {searchRes.map((item, i) => (
              <div key={i} className="search-result-item"
                onClick={() => { setTab('inventory'); setSearchVal(''); setShowSearch(false) }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{item.name}</div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>
                  {item.quantity} {item.unit} · {item.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dark mode toggle */}
      <button onClick={() => setDark(p => !p)}
        style={{ background:'none', border:'none', cursor:'pointer', color:theme.textMuted, padding:6 }}>
        <Ic n={dark ? 'Sun' : 'Moon'} size={18}/>
      </button>

      {/* Notifications */}
      <div id="header-notifs" style={{ position:'relative' }}>
        <button onClick={() => { setShowNotifs(p => !p); if (unread > 0) markAllRead() }}
          style={{ background:'none', border:'none', cursor:'pointer', color:theme.textMuted,
            padding:6, position:'relative' }}>
          <Ic n="Bell" size={18}/>
          {unread > 0 && (
            <span style={{ position:'absolute', top:2, right:2, width:8, height:8,
              background:'#ef4444', borderRadius:'50%', border:'2px solid white' }}/>
          )}
        </button>
        {showNotifs && (
          <div style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:300,
            background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:12,
            boxShadow:'0 10px 30px rgba(0,0,0,0.12)', zIndex:200, maxHeight:380, overflowY:'auto' }}>
            <div style={{ padding:'14px 16px', borderBottom:`1px solid ${theme.border}`,
              fontWeight:600, fontSize:14, color:theme.text }}>
              Notifications
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:theme.textMuted, fontSize:13 }}>
                No notifications
              </div>
            ) : notifications.slice(0,10).map(n => (
              <div key={n.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${theme.border}`,
                background: n.read ? 'transparent' : 'rgba(37,99,235,0.03)' }}>
                <div style={{ fontSize:13, fontWeight:500, color:theme.text }}>{n.title}</div>
                <div style={{ fontSize:12, color:theme.textMuted, marginTop:2 }}>{n.msg}</div>
                <div style={{ fontSize:11, color:theme.textMuted, marginTop:4 }}>{n.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile */}
      <div id="header-profile" style={{ position:'relative' }}>
        <button onClick={() => setShowProfile(p => !p)}
          style={{ display:'flex', alignItems:'center', gap:8, background:'none',
            border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:8 }}>
          <div style={{ width:32, height:32, borderRadius:8, display:'flex',
            alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12,
            background: avatarBg[user?.role] || '#f3f4f6',
            color: avatarColor[user?.role] || '#374151' }}>
            {(user?.name || 'U').slice(0,2).toUpperCase()}
          </div>
          <div className="hide-mobile" style={{ textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:600, color:theme.text }}>{user?.name}</div>
            <div style={{ fontSize:11, color:theme.textMuted }}>{user?.role}</div>
          </div>
        </button>
        {showProfile && (
          <div style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:200,
            background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:12,
            boxShadow:'0 10px 30px rgba(0,0,0,0.12)', zIndex:200, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${theme.border}` }}>
              <div style={{ fontSize:13, fontWeight:600, color:theme.text }}>{user?.name}</div>
              <div style={{ fontSize:12, color:theme.textMuted }}>{user?.email}</div>
            </div>
            <div className="profile-menu-item" onClick={() => { setTab('settings'); setShowProfile(false) }}
              style={{ display:'flex', alignItems:'center', gap:8, color:theme.text }}>
              <Ic n="Settings" size={14}/>Settings
            </div>
            <div className="profile-menu-item" onClick={() => { logout(); setShowProfile(false) }}
              style={{ display:'flex', alignItems:'center', gap:8, color:'#dc2626' }}>
              <Ic n="LogOut" size={14}/>Sign Out
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
