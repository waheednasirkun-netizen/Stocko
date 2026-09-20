import { useApp } from '../../context/AppContext'
import { ROLE_COLORS } from '../../lib/constants'
import { Ic } from '../ui'

const navItems = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    perm: 'canAccessDashboard',
  },
  {
    key: 'pos',
    label: 'Point of Sale',
    icon: 'ShoppingCart',
    perm: 'canAccessPOS',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: 'Package',
    perm: 'canAccessInventory',
  },
  {
    key: 'item-templates',
    label: 'Item Templates',
    icon: 'Box',
    perm: 'canAccessItemTemplates',
  },
  {
    key: 'stock-movement',
    label: 'Stock Movement',
    icon: 'ArrowLeftRight',
    perm: 'canAccessStockMovement',
  },
  {
    key: 'demands',
    label: 'Demands',
    icon: 'ClipboardList',
    perm: 'canAccessDemands',
  },
  {
    key: 'fulfillment-center',
    label: 'Fulfillment',
    icon: 'CheckCircle',
    perm: 'canAccessFulfillment',
  },

  // NEW
  {
    key: 'assignments',
    label: 'Assignments',
    icon: 'ClipboardList',
    perm: 'canAccessAssignments',
  },

  {
    key: 'customer-ledger',
    label: 'Customer Ledger',
    icon: 'Wallet',
    perm: 'canAccessLedger',
  },
  {
    key: 'complaints',
    label: 'Complaints',
    icon: 'MessageSquareWarning',
    perm: 'canAccessComplaints',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    icon: 'Users',
    perm: 'canAccessSuppliers',
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'BarChart2',
    perm: 'canViewReports',
  },
  {
    key: 'user-management',
    label: 'Users',
    icon: 'UserPlus',
    perm: 'canAccessUserManagement',
  },
  {
    key: 'activity-log',
    label: 'Activity Log',
    icon: 'Activity',
    perm: 'canAccessActivityLog',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'Settings',
    perm: 'canAccessSettings',
  },
]

const BRANCH_LOCKED_PAGES = ['pos', 'customer-ledger']

const ALLOWED_BRANCHES = [
  '6c647f96-4160-45c7-85c9-445be42887b1',
  '8b2e0fdb-5337-4aa1-81f2-63d23af7dbbc',
]

export default function Sidebar() {
  const app = useApp() || {}

  const {
    user,
    tab,
    setTab,
    sidebarOpen,
    setSidebar,
    dark,
    theme,
    userRole,

    canAccessPOS,
    canAccessDashboard,
    canAccessInventory,
    canAccessItemTemplates,
    canAccessStockMovement,
    canAccessDemands,
    canAccessFulfillment,
    canAccessAssignments,
    canAccessSuppliers,
    canAccessLedger,
    canAccessComplaints,
    canViewReports,
    canAccessUserManagement,
    canAccessActivityLog,
    canAccessSettings,
  } = app

  const safeTheme = theme || {
    cardBg: dark ? '#111827' : '#ffffff',
    border: dark ? '#374151' : '#e5e7eb',
    text: dark ? '#f9fafb' : '#111827',
    textMuted: dark ? '#9ca3af' : '#6b7280',
    navActive: dark ? '#1e3a5f' : '#eff6ff',
  }

  const isMobile = () => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 768
  }

  const go = (key) => {
    if (typeof setTab === 'function') {
      setTab(key)
    }

    if (isMobile() && typeof setSidebar === 'function') {
      setSidebar(false)
    }
  }

  const permChecks = {
    canAccessPOS,
    canAccessDashboard,
    canAccessInventory,
    canAccessItemTemplates,
    canAccessStockMovement,
    canAccessDemands,
    canAccessFulfillment,
    canAccessAssignments,
    canAccessSuppliers,
    canAccessLedger,
    canAccessComplaints,
    canViewReports,
    canAccessUserManagement,
    canAccessActivityLog,
    canAccessSettings,
  }

  const userBranch =
    user?.branch_id ??
    user?.branchId ??
    null

  const normalizedRole = String(userRole || '')
    .toLowerCase()
    .replace(/[-_\s]/g, '')

  /*
   * Assignment access
   *
   * Assignments are intended for management users.
   * Master / Developer / Admin / Manager can access them.
   *
   * If AppContext already provides canAccessAssignments(),
   * that permission is respected first.
   */
  const assignmentRoles = [
    'master',
    'developer',
    'admin',
    'manager',
    'owner',
  ]

  const canUseAssignments =
    typeof canAccessAssignments === 'boolean'
      ? canAccessAssignments
      : typeof canAccessAssignments === 'function'
        ? (() => {
            try {
              return Boolean(canAccessAssignments())
            } catch (error) {
              console.error(
                'Sidebar assignment permission error:',
                error
              )
              return false
            }
          })()
        : assignmentRoles.includes(normalizedRole)

  const visible = navItems.filter((item) => {
    let hasPermission = true

    /*
     * Assignments special permission handling.
     */
    if (item.key === 'assignments') {
      hasPermission = canUseAssignments
    } else {
      const permission = permChecks[item.perm]

      if (typeof permission === 'function') {
        try {
          hasPermission = Boolean(permission())
        } catch (error) {
          console.error(
            `Sidebar permission error for ${item.perm}:`,
            error
          )
          hasPermission = false
        }
      } else if (typeof permission === 'boolean') {
        hasPermission = permission
      }
    }

    /*
     * Store Keeper can access Item Templates.
     */
    if (
      item.key === 'item-templates' &&
      normalizedRole === 'storekeeper'
    ) {
      hasPermission = true
    }

    if (!hasPermission) {
      return false
    }

    /*
     * POS and Customer Ledger are restricted
     * to specific branches.
     */
    if (BRANCH_LOCKED_PAGES.includes(item.key)) {
      return ALLOWED_BRANCHES.includes(userBranch)
    }

    return true
  })

  const roleColor =
    ROLE_COLORS?.[userRole] ||
    ROLE_COLORS?.[normalizedRole] ||
    safeTheme.textMuted ||
    '#6b7280'

  const activeColor = dark ? '#60a5fa' : '#2563eb'

  const sidebarStyles = {
    background: safeTheme.cardBg,
    borderRight: `1px solid ${safeTheme.border}`,
  }

  const toggleSidebar = () => {
    if (typeof setSidebar === 'function') {
      setSidebar((previous) => !previous)
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        id="mob-overlay"
        className={
          sidebarOpen && isMobile()
            ? 'active'
            : ''
        }
        onClick={() => {
          if (typeof setSidebar === 'function') {
            setSidebar(false)
          }
        }}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        id="sidebar"
        className={sidebarOpen ? 'open' : 'closed'}
        style={sidebarStyles}
        aria-label="Sidebar navigation"
      >
        {/* Logo */}
        <div
          style={{
            padding: sidebarOpen
              ? '20px 16px 16px'
              : '20px 0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: sidebarOpen
              ? 'flex-start'
              : 'center',
            borderBottom:
              `1px solid ${safeTheme.border}`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              background: '#2563eb',
              borderRadius: 10,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ic
              n="Package"
              size={20}
              color="#ffffff"
            />
          </div>

          {sidebarOpen && (
            <div>
              <div
                className="sidebar-logo-text"
                style={{
                  fontWeight: 800,
                  fontSize: 15,
                  color: safeTheme.text,
                }}
              >
                Stocko
              </div>

              <div
                className="sidebar-version"
                style={{
                  fontSize: 10,
                  color: safeTheme.textMuted,
                }}
              >
                v5 · Supabase
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          className="sidebar-nav"
          aria-label="Primary navigation"
          style={{
            padding: '12px 8px',
            overflowY: 'auto',
            flex: 1,
            height: 'calc(100dvh - 160px)',
          }}
        >
          {visible.length === 0 ? (
            <div
              style={{
                padding: '20px 10px',
                textAlign: 'center',
                fontSize: 12,
                color: safeTheme.textMuted,
              }}
            >
              {sidebarOpen
                ? 'No available pages'
                : '—'}
            </div>
          ) : (
            visible.map((item) => {
              const active = tab === item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  className="sidebar-item"
                  onClick={() => go(item.key)}
                  aria-current={
                    active
                      ? 'page'
                      : undefined
                  }
                  title={
                    !sidebarOpen
                      ? item.label
                      : undefined
                  }
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: sidebarOpen
                      ? '9px 12px'
                      : '9px 0',
                    justifyContent: sidebarOpen
                      ? 'flex-start'
                      : 'center',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: 2,
                    background: active
                      ? safeTheme.navActive
                      : 'transparent',
                    color: active
                      ? activeColor
                      : safeTheme.textMuted,
                    fontWeight: active
                      ? 600
                      : 400,
                    fontSize: 13,
                    transition:
                      'all 0.15s',
                  }}
                >
                  <Ic
                    n={item.icon}
                    size={18}
                    color={
                      active
                        ? activeColor
                        : safeTheme.textMuted
                    }
                  />

                  {sidebarOpen && (
                    <span>
                      {item.label}
                    </span>
                  )}

                  {sidebarOpen && active && (
                    <span
                      aria-hidden="true"
                      style={{
                        marginLeft: 'auto',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background:
                          activeColor,
                      }}
                    />
                  )}
                </button>
              )
            })
          )}
        </nav>

        {/* Current role */}
        {sidebarOpen && userRole && (
          <div
            style={{
              padding: '8px 12px',
              borderTop:
                `1px solid ${safeTheme.border}`,
              fontSize: 11,
              color: safeTheme.textMuted,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 10,
                background: `${roleColor}20`,
                color: roleColor,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.3,
              }}
            >
              {userRole}
            </span>
          </div>
        )}

        {/* Collapse / expand */}
        <div
          style={{
            padding: 8,
            borderTop:
              `1px solid ${safeTheme.border}`,
          }}
        >
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            aria-label={
              sidebarOpen
                ? 'Collapse sidebar'
                : 'Expand sidebar'
            }
            title={
              sidebarOpen
                ? 'Collapse sidebar'
                : 'Expand sidebar'
            }
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: safeTheme.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                sidebarOpen
                  ? 'flex-start'
                  : 'center',
              gap: 8,
              transition:
                'background 0.15s',
            }}
          >
            <Ic
              n={
                sidebarOpen
                  ? 'X'
                  : 'Menu'
              }
              size={18}
              color={safeTheme.textMuted}
            />

            {sidebarOpen && (
              <span
                style={{
                  fontSize: 12,
                }}
              >
                Collapse
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}