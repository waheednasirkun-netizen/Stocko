
import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { Ic } from '../ui'

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  pos: 'Point of Sale',
  inventory: 'Inventory',
  'item-templates': 'Item Templates',
  'stock-movement': 'Stock Movement',
  demands: 'Demand List',
  'fulfillment-center': 'Fulfillment Center',
  'procurement-requests': 'Procurement Requests',
  'purchase-orders': 'Purchase Orders',
  suppliers: 'Suppliers',
  reports: 'Reports',
  expenses: 'Inventory Expenses',
  'user-management': 'User Management',
  'activity-log': 'Activity Log',
  settings: 'Settings',
  'customer-ledger': 'Customer Ledger',
  complaints: 'Complaints & Feedback',
}

export default function Header() {
  const {
    user,
    tab,
    setTab,
    dark,
    setDark,
    theme,
    setSidebar,
    sidebarOpen,
    notifications = [],
    markAllRead,
    logout,
  } = useApp()

  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const notifRef = useRef(null)
  const profileRef = useRef(null)

  const safeTheme = theme || {
    cardBg: dark ? '#111827' : '#ffffff',
    cardHover: dark ? '#1f2937' : '#f3f4f6',
    border: dark ? '#374151' : '#e5e7eb',
    text: dark ? '#f9fafb' : '#111827',
    textMuted: dark ? '#9ca3af' : '#6b7280',
    danger: '#ef4444',
    dangerText: '#ffffff',
    rejected: '#fee2e2',
    rejectedText: '#991b1b',
    navActive: dark ? '#1e3a5f' : '#eff6ff',
    shadowLg:
      '0 10px 25px rgba(0, 0, 0, 0.12)',
    avatarAdminBg: '#fee2e2',
    avatarAdminText: '#b91c1c',
    avatarManagerBg: '#dbeafe',
    avatarManagerText: '#1d4ed8',
    avatarSkBg: '#dcfce7',
    avatarSkText: '#15803d',
    avatarKitchenBg: '#fef3c7',
    avatarKitchenText: '#b45309',
    avatarViewerBg: '#f3f4f6',
    avatarViewerText: '#4b5563',
    avatarDevBg: '#ede9fe',
    avatarDevText: '#6d28d9',
    avatarMasterBg: '#ccfbf1',
    avatarMasterText: '#0f766e',
  }

  const unread = notifications.filter(
    (notification) => !notification.read
  ).length

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target)
      ) {
        setShowNotifs(false)
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setShowProfile(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
    }
  }, [])

  const avatarBg = {
    Admin: safeTheme.avatarAdminBg,
    Manager: safeTheme.avatarManagerBg,
    'Store Keeper': safeTheme.avatarSkBg,
    'Kitchen Staff': safeTheme.avatarKitchenBg,
    Viewer: safeTheme.avatarViewerBg,
    Developer: safeTheme.avatarDevBg,
    Master:
      safeTheme.avatarMasterBg || '#ccfbf1',
  }

  const avatarColor = {
    Admin: safeTheme.avatarAdminText,
    Manager: safeTheme.avatarManagerText,
    'Store Keeper': safeTheme.avatarSkText,
    'Kitchen Staff':
      safeTheme.avatarKitchenText,
    Viewer: safeTheme.avatarViewerText,
    Developer: safeTheme.avatarDevText,
    Master:
      safeTheme.avatarMasterText || '#0f766e',
  }

  const handleNotifClick = () => {
    setShowNotifs((previous) => !previous)

    if (
      unread > 0 &&
      typeof markAllRead === 'function'
    ) {
      markAllRead()
    }
  }

  const handleSettings = () => {
    if (typeof setTab === 'function') {
      setTab('settings')
    }

    setShowProfile(false)
  }

  const handleLogout = async () => {
    setShowProfile(false)

    if (typeof logout === 'function') {
      await logout()
    }
  }

  const userRole = user?.role || 'User'

  const currentAvatarBg =
    avatarBg[userRole] ||
    safeTheme.cardHover ||
    '#e5e7eb'

  const currentAvatarColor =
    avatarColor[userRole] ||
    safeTheme.textMuted ||
    '#6b7280'

  const userName =
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    'User'

  const userEmail =
    user?.email || ''

  const initials = userName
    .trim()
    .slice(0, 2)
    .toUpperCase()

  const pageTitle =
    PAGE_TITLES[tab] || 'Stocko'

  return (
    <header
      className="app-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: safeTheme.cardBg,
        borderBottom:
          `1px solid ${safeTheme.border}`,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 58,
      }}
    >
      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={() => {
          if (typeof setSidebar === 'function') {
            setSidebar((previous) => !previous)
          }
        }}
        className="hide-desktop"
        aria-label={
          sidebarOpen
            ? 'Close navigation'
            : 'Open navigation'
        }
        aria-expanded={Boolean(sidebarOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: safeTheme.textMuted,
          padding: 6,
          display: 'none',
        }}
      >
        <Ic
          n="Menu"
          size={20}
          color={safeTheme.textMuted}
        />
      </button>

      {/* Page title */}
      <h2
        className="header-title"
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: safeTheme.text,
          flex: 1,
          margin: 0,
        }}
      >
        {pageTitle}
      </h2>

      {/* Dark mode toggle */}
      <button
        type="button"
        onClick={() => {
          if (typeof setDark === 'function') {
            setDark(!dark)
          }
        }}
        className="header-notif-btn"
        title={
          dark
            ? 'Switch to light mode'
            : 'Switch to dark mode'
        }
        aria-label={
          dark
            ? 'Switch to light mode'
            : 'Switch to dark mode'
        }
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: safeTheme.textMuted,
          padding: 6,
          borderRadius: 8,
          transition:
            'background 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ic
          n={dark ? 'Sun' : 'Moon'}
          size={18}
          color={safeTheme.textMuted}
        />
      </button>

      {/* Notifications */}
      <div
        ref={notifRef}
        id="header-notifs"
        style={{
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={handleNotifClick}
          className="header-notif-btn"
          aria-label={
            unread > 0
              ? `Notifications, ${unread} unread`
              : 'Notifications'
          }
          aria-expanded={showNotifs}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: safeTheme.textMuted,
            padding: 6,
            position: 'relative',
            borderRadius: 8,
            transition:
              'background 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic
            n="Bell"
            size={18}
            color={safeTheme.textMuted}
          />

          {unread > 0 && (
            <span
              className="header-notif-badge"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                background: safeTheme.danger,
                borderRadius: '50%',
                border:
                  `2px solid ${safeTheme.cardBg}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: safeTheme.dangerText,
                padding: '0 3px',
                boxSizing: 'border-box',
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {showNotifs && (
          <div
            className="notif-dropdown"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: 340,
              maxWidth:
                'calc(100vw - 24px)',
              background: safeTheme.cardBg,
              border:
                `1px solid ${safeTheme.border}`,
              borderRadius: 12,
              boxShadow:
                safeTheme.shadowLg,
              zIndex: 200,
              maxHeight: 420,
              overflowY: 'auto',
            }}
          >
            {/* Notifications header */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom:
                  `1px solid ${safeTheme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                gap: 10,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: safeTheme.text,
                }}
              >
                Notifications

                {unread > 0 && (
                  <span
                    className="notif-badge"
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      background:
                        safeTheme.rejected,
                      color:
                        safeTheme.rejectedText,
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {unread} new
                  </span>
                )}
              </div>

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      typeof markAllRead ===
                      'function'
                    ) {
                      markAllRead()
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: dark
                      ? '#60a5fa'
                      : '#2563eb',
                    fontWeight: 500,
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Empty state */}
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  textAlign: 'center',
                  color:
                    safeTheme.textMuted,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    marginBottom: 8,
                    opacity: 0.4,
                  }}
                >
                  🔔
                </div>

                <div>
                  No notifications yet
                </div>

                <div
                  style={{
                    fontSize: 12,
                    marginTop: 4,
                    opacity: 0.7,
                  }}
                >
                  You'll see alerts here
                  when they arrive
                </div>
              </div>
            ) : (
              <>
                {/* Unread notifications */}
                {notifications.filter(
                  (notification) =>
                    !notification.read
                ).length > 0 && (
                  <>
                    <div
                      style={{
                        padding:
                          '6px 16px',
                        fontSize: 11,
                        fontWeight: 600,
                        color:
                          safeTheme.textMuted,
                        textTransform:
                          'uppercase',
                        letterSpacing:
                          '0.5px',
                      }}
                    >
                      New
                    </div>

                    {notifications
                      .filter(
                        (notification) =>
                          !notification.read
                      )
                      .map((notification) => (
                        <div
                          key={
                            notification.id
                          }
                          className="notif-item-new"
                          style={{
                            padding:
                              '12px 16px',
                            borderBottom:
                              `1px solid ${safeTheme.border}`,
                            background: dark
                              ? 'rgba(59,130,246,0.08)'
                              : 'rgba(37,99,235,0.04)',
                            cursor:
                              'pointer',
                            transition:
                              'background 0.15s',
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.background =
                              dark
                                ? 'rgba(59,130,246,0.15)'
                                : 'rgba(37,99,235,0.08)'
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background =
                              dark
                                ? 'rgba(59,130,246,0.08)'
                                : 'rgba(37,99,235,0.04)'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems:
                                'flex-start',
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius:
                                  '50%',
                                background:
                                  dark
                                    ? '#60a5fa'
                                    : '#2563eb',
                                marginTop: 5,
                                flexShrink: 0,
                              }}
                            />

                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight:
                                    600,
                                  color:
                                    safeTheme.text,
                                }}
                              >
                                {
                                  notification.title
                                }
                              </div>

                              <div
                                style={{
                                  fontSize: 12,
                                  color:
                                    safeTheme.textMuted,
                                  marginTop: 2,
                                  lineHeight:
                                    1.4,
                                }}
                              >
                                {
                                  notification.msg
                                }
                              </div>

                              <div
                                style={{
                                  fontSize: 11,
                                  color:
                                    safeTheme.textMuted,
                                  marginTop: 4,
                                  opacity: 0.7,
                                }}
                              >
                                {
                                  notification.time
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </>
                )}

                {/* Read notifications */}
                {notifications.filter(
                  (notification) =>
                    notification.read
                ).length > 0 && (
                  <>
                    <div
                      style={{
                        padding:
                          '6px 16px',
                        fontSize: 11,
                        fontWeight: 600,
                        color:
                          safeTheme.textMuted,
                        textTransform:
                          'uppercase',
                        letterSpacing:
                          '0.5px',
                      }}
                    >
                      Earlier
                    </div>

                    {notifications
                      .filter(
                        (notification) =>
                          notification.read
                      )
                      .slice(0, 10)
                      .map((notification) => (
                        <div
                          key={
                            notification.id
                          }
                          style={{
                            padding:
                              '12px 16px',
                            borderBottom:
                              `1px solid ${safeTheme.border}`,
                            background:
                              'transparent',
                            cursor:
                              'pointer',
                            transition:
                              'background 0.15s',
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.background =
                              safeTheme.navActive
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background =
                              'transparent'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems:
                                'flex-start',
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius:
                                  '50%',
                                background:
                                  dark
                                    ? '#475569'
                                    : '#d1d5db',
                                marginTop: 5,
                                flexShrink: 0,
                              }}
                            />

                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight:
                                    500,
                                  color:
                                    safeTheme.text,
                                }}
                              >
                                {
                                  notification.title
                                }
                              </div>

                              <div
                                style={{
                                  fontSize: 12,
                                  color:
                                    safeTheme.textMuted,
                                  marginTop: 2,
                                  lineHeight:
                                    1.4,
                                }}
                              >
                                {
                                  notification.msg
                                }
                              </div>

                              <div
                                style={{
                                  fontSize: 11,
                                  color:
                                    safeTheme.textMuted,
                                  marginTop: 4,
                                  opacity: 0.7,
                                }}
                              >
                                {
                                  notification.time
                                }
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
      <div
        ref={profileRef}
        id="header-profile"
        style={{
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={() =>
            setShowProfile(
              (previous) => !previous
            )
          }
          aria-label="Open profile menu"
          aria-expanded={showProfile}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12,
              background:
                currentAvatarBg,
              color:
                currentAvatarColor,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          <div
            className="hide-mobile"
            style={{
              textAlign: 'left',
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: safeTheme.text,
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow:
                  'ellipsis',
                whiteSpace:
                  'nowrap',
              }}
            >
              {userName}
            </div>

            <div
              style={{
                fontSize: 11,
                color:
                  safeTheme.textMuted,
              }}
            >
              {userRole}
            </div>
          </div>

          <Ic
            n="ChevronDown"
            size={14}
            color={safeTheme.textMuted}
          />
        </button>

        {showProfile && (
          <div
            className="profile-dropdown"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: 220,
              maxWidth:
                'calc(100vw - 24px)',
              background:
                safeTheme.cardBg,
              border:
                `1px solid ${safeTheme.border}`,
              borderRadius: 12,
              boxShadow:
                safeTheme.shadowLg,
              zIndex: 200,
              overflow: 'hidden',
            }}
          >
            {/* Profile information */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom:
                  `1px solid ${safeTheme.border}`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: safeTheme.text,
                  overflow: 'hidden',
                  textOverflow:
                    'ellipsis',
                  whiteSpace:
                    'nowrap',
                }}
              >
                {userName}
              </div>

              {userEmail && (
                <div
                  style={{
                    fontSize: 12,
                    color:
                      safeTheme.textMuted,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow:
                      'ellipsis',
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  {userEmail}
                </div>
              )}

              <div
                style={{
                  display:
                    'inline-block',
                  marginTop: 7,
                  padding:
                    '3px 8px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  background:
                    currentAvatarBg,
                  color:
                    currentAvatarColor,
                }}
              >
                {userRole}
              </div>
            </div>

            {/* Settings */}
            <button
              type="button"
              className="profile-menu-item"
              onClick={handleSettings}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: safeTheme.text,
                background:
                  'transparent',
                border: 'none',
                cursor: 'pointer',
                padding:
                  '10px 16px',
                textAlign: 'left',
                fontSize: 13,
              }}
            >
              <Ic
                n="Settings"
                size={14}
                color={safeTheme.textMuted}
              />
              Settings
            </button>

            {/* Logout */}
            <button
              type="button"
              className="profile-menu-item"
              onClick={handleLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color:
                  safeTheme.danger,
                background:
                  'transparent',
                border: 'none',
                cursor: 'pointer',
                padding:
                  '10px 16px',
                textAlign: 'left',
                fontSize: 13,
              }}
            >
              <Ic
                n="LogOut"
                size={14}
                color={safeTheme.danger}
              />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}