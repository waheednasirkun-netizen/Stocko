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
  const { user, tab, setTab, dark, setDark, theme, setSidebar, sidebarOpen,
    notifications, markAllRead, logout } = useApp()

  const [showNotifs,  setShowNotifs]  = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const notifRef = useRef(null)
  const profileRef = useRef(null)

  const unread = notifications.filter(n => !n.read).length

  // Click outside to close dropdowns
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const avatarBg = {
    'Admin':        theme.avatarAdminBg,
    'Manager':      theme.avatarManagerBg,
    'Store Keeper': theme.avatarSkBg,
    'Kitchen Staff':theme.avatarKitchenBg,
    'Viewer':       theme.avatarViewerBg,
    'Developer':    theme.avatarDevBg,
  }

  const avatarColor = {
    'Admin':        theme.avatarAdminText,
    'Manager':      theme.avatarManagerText,
    'Store Keeper': theme.avatarSkText,
    'Kitchen Staff':theme.avatarKitchenText,
    'Viewer':       theme.avatarViewerText,
    'Developer':    theme.avatarDevText,
  }

  const handleNotifClick = () => {
    setShowNotifs(p => !p)
    if (unread > 0) markAllRead()
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: theme.cardBg,
      borderBottom: `1px solid ${theme.border}`,
      padding: '0 20px',
      display: 'flex', alignItems: 'center', gap: 12, height: 58
    }}>

      {/* Mobile menu toggle */}
      <button
        onClick={() => setSidebar(p => !p)}
        className="hide-desktop"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: theme.textMuted, padding: 6, display: 'none'
        }}>
        <Ic n="Menu" size={20}/>
      </button>

      {/* Page title */}
      <h2 className="header-title" style={{
        fontSize: 16, fontWeight: 700, color: theme.text, flex: 1
      }}>
        {PAGE_TITLES[tab] || 'Stocko'}
      </h2>

      {/* Dark mode toggle */}
      <button
        onClick={() => setDark(!dark)}
        className="header-notif-btn"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: theme.textMuted, padding: 6, borderRadius: 8,
          transition: 'background 0.15s'
        }}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Ic n={dark ? 'Sun' : 'Moon'} size={18}/>
      </button>

      {/* Notifications */}
      <div ref={notifRef} id="header-notifs" style={{ position: 'relative' }}>
        <button
          onClick={handleNotifClick}
          className="header-notif-btn"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.textMuted, padding: 6, position: 'relative',
            borderRadius: 8, transition: 'background 0.15s'
          }}>
          <Ic n="Bell" size={18}/>
          {unread > 0 && (
            <span className="header-notif-badge" style={{
              position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16,
              background: theme.danger, borderRadius: '50%',
              border: `2px solid ${theme.cardBg}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: theme.dangerText, padding: '0 3px'
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        {showNotifs && (
          <div className="notif-dropdown" style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340,
            background: theme.cardBg, border: `1px solid ${theme.border}`,
            borderRadius: 12, boxShadow: theme.shadowLg, zIndex: 200,
            maxHeight: 420, overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 16px', borderBottom: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: theme.text }}>
                Notifications
                {unread > 0 && (
                  <span className="notif-badge" style={{
                    marginLeft: 6, padding: '1px 6px', background: theme.rejected,
                    color: theme.rejectedText, borderRadius: 10, fontSize: 11, fontWeight: 600
                  }}>
                    {unread} new
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <button onClick={markAllRead}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: dark ? '#60a5fa' : '#2563eb', fontWeight: 500
                  }}>
                  Mark all read
                </button>
              )}
            </div>

            {/* Empty state */}
            {notifications.length === 0 ? (
              <div style={{
                padding: 32, textAlign: 'center', color: theme.textMuted, fontSize: 13
              }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>🔔</div>
                <div>No notifications yet</div>
                <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
                  You'll see alerts here when they arrive
                </div>
              </div>
            ) : (
              <>
                {/* Unread */}
                {notifications.filter(n => !n.read).length > 0 && (
                  <>
                    <div style={{
                      padding: '6px 16px', fontSize: 11, fontWeight: 600,
                      color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                      New
                    </div>
                    {notifications.filter(n => !n.read).map(n => (
                      <div
                        key={n.id}
                        className="notif-item-new"
                        style={{
                          padding: '12px 16px', borderBottom: `1px solid ${theme.border}`,
                          background: dark ? 'rgba(59,130,246,0.08)' : 'rgba(37,99,235,0.04)',
                          cursor: 'pointer', transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = dark ? 'rgba(59,130,246,0.08)' : 'rgba(37,99,235,0.04)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div className="notif-dot-new" style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: dark ? '#60a5fa' : '#2563eb',
                            marginTop: 5, flexShrink: 0
                          }}/>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                              {n.title}
                            </div>
                            <div style={{
                              fontSize: 12, color: theme.textMuted, marginTop: 2, lineHeight: 1.4
                            }}>
                              {n.msg}
                            </div>
                            <div style={{
                              fontSize: 11, color: theme.textMuted, marginTop: 4, opacity: 0.7
                            }}>
                              {n.time}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Read */}
                {notifications.filter(n => n.read).length > 0 && (
                  <>
                    <div style={{
                      padding: '6px 16px', fontSize: 11, fontWeight: 600,
                      color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                      Earlier
                    </div>
                    {notifications.filter(n => n.read).slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        style={{
                          padding: '12px 16px', borderBottom: `1px solid ${theme.border}`,
                          background: 'transparent', cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = theme.navActive}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div className="notif-dot-read" style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: dark ? '#475569' : '#d1d5db',
                            marginTop: 5, flexShrink: 0
                          }}/>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>
                              {n.title}
                            </div>
                            <div style={{
                              fontSize: 12, color: theme.textMuted, marginTop: 2, lineHeight: 1.4
                            }}>
                              {n.msg}
                            </div>
                            <div style={{
                              fontSize: 11, color: theme.textMuted, marginTop: 4, opacity: 0.7
                            }}>
                              {n.time}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Profile */}
      <div ref={profileRef} id="header-profile" style={{ position: 'relative' }}>
        <button
          onClick={() => setShowProfile(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8
          }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
            background: avatarBg[user?.role] || theme.cardHover,
            color: avatarColor[user?.role] || theme.textMuted
          }}>
            {(user?.name || 'U').slice(0,2).toUpperCase()}
          </div>
          <div className="hide-mobile" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>{user?.role}</div>
          </div>
        </button>
        {showProfile && (
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 200,
            background: theme.cardBg, border: `1px solid ${theme.border}`,
            borderRadius: 12, boxShadow: theme.shadowLg, zIndex: 200, overflow: 'hidden'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>{user?.email}</div>
            </div>
            <div
              className="profile-menu-item"
              onClick={() => { setTab('settings'); setShowProfile(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.text }}
            >
              <Ic n="Settings" size={14}/>Settings
            </div>
            <div
              className="profile-menu-item"
              onClick={() => { logout(); setShowProfile(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.danger }}
            >
              <Ic n="LogOut" size={14}/>Sign Out
            </div>
          </div>
        )}
      </div>
    </header>
  )
}