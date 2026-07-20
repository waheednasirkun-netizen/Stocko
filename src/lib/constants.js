// ─── ROLES & PERMISSIONS ─────────────────────────────────────────────────────
export const ROLE_CAN = {
  stockIn:             ['Developer','Admin','Manager','Store Keeper'],
  stockOut:            ['Developer','Admin','Manager'],
  recordWastage:       ['Developer','Admin','Manager'],
  recordFulfillmentTxn: ['Developer','Admin','Manager'],
  fulfillDemand:       ['Developer','Admin','Manager','Store Keeper'],
  createDemand:        ['Developer','Admin','Manager','Store Keeper','Kitchen Staff'],
  createTemplate:      ['Developer','Admin','Manager'],
  deleteTemplate:      ['Developer','Admin','Manager'],
  createProcurement:   ['Developer','Admin','Manager','Store Keeper','Kitchen Staff'],
  closeProcurement:    ['Developer','Admin','Manager'],
  createPO:            ['Developer','Admin','Manager'],
  markPOStatus:        ['Developer','Admin','Manager'],
  manageSuppliers:     ['Developer','Admin','Manager'],
  manageUsers:         ['Developer','Admin','Manager'],
  viewFinancials:      ['Developer','Admin','Manager'],
  manageSettings:      ['Developer','Admin','Manager'],
  manageSystem:        ['Developer','Admin'],
  createRequest:       ['Developer','Admin','Manager','Store Keeper','Kitchen Staff'],
  approveRequest:      ['Developer','Admin','Manager'],
  rejectRequest:       ['Developer','Admin','Manager'],
  fulfillRequest:      ['Developer','Admin','Manager','Store Keeper'],
  partialFulfillRequest: ['Developer','Admin','Manager','Store Keeper'],
  deleteRequest:       ['Developer','Admin'],
}

export const userCan = (action, role) => ROLE_CAN[action]?.includes(role) ?? false

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────
export const DEPARTMENTS = [
  'Kitchen','Dine-In','Riders','Bar','Management',
  'Front Desk','Maintenance','Event','Other',
]

// ─── UNITS ───────────────────────────────────────────────────────────────────
export const DEFAULT_UNITS = [
  'kg','g','liter','ml','pcs','box','pack','dozen',
  'bottle','can','bag','sack','tray','bunch','lb','oz','gallon','qt','pt','cup',
]

// ─── CHART COLORS ────────────────────────────────────────────────────────────
export const chartColors = {
  light: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'],
  dark:  ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#a3e635'],
}

// ─── THEMES ──────────────────────────────────────────────────────────────────
export const lightTheme = {
  // Backgrounds
  bg: '#f8fafc',
  card: '#ffffff',
  cardBg: '#ffffff',
  cardHover: '#f1f5f9',
  elevated: '#ffffff',
  subtle: '#f1f5f9',
  selected: '#eff6ff',

  // Text
  text: '#111827',
  textMuted: '#6b7280',
  textLight: '#4b5563',
  textSecondary: '#475569',

  // Borders
  border: '#e5e7eb',
  borderLight: '#f3f4f6',

  // Inputs
  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
  inputFocus: '#3b82f6',
  inputPlaceholder: '#9ca3af',

  // Navigation
  navActive: 'rgba(37,99,235,0.1)',
  navHover: '#f3f4f6',
  rowHover: '#f9fafb',

  // Buttons
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryText: '#ffffff',
  success: '#22c55e',
  successHover: '#16a34a',
  successText: '#ffffff',
  danger: '#ef4444',
  dangerHover: '#dc2626',
  dangerText: '#ffffff',
  warning: '#f59e0b',
  warningHover: '#d97706',
  warningText: '#ffffff',

  // Shadows
  shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.08)',
  shadowLg: '0 8px 32px rgba(0, 0, 0, 0.10)',

  // Status colors
  pending: '#fef3c7',
  pendingText: '#92400e',
  approved: '#dbeafe',
  approvedText: '#1e40af',
  completed: '#d1fae5',
  completedText: '#065f46',
  rejected: '#fee2e2',
  rejectedText: '#991b1b',

  // Scrollbar
  scrollbarTrack: '#f1f1f1',
  scrollbarThumb: '#c1c1c1',

  // Overlay
  overlayBg: 'rgba(0,0,0,0.55)',
  modalBg: '#ffffff',

  // Avatar
  avatarAdminBg: '#fee2e2',    avatarAdminText: '#dc2626',
  avatarManagerBg: '#fef9c3',  avatarManagerText: '#854d0e',
  avatarSkBg: '#dcfce7',       avatarSkText: '#166534',
  avatarKitchenBg: '#f3e8ff',  avatarKitchenText: '#7c3aed',
  avatarViewerBg: '#dbeafe',   avatarViewerText: '#1d4ed8',
  avatarDevBg: '#ede9fe',      avatarDevText: '#6d28d9',

  // Toast
  toastSuccessBg: '#dcfce7',   toastSuccessBorder: '#86efac',   toastSuccessText: '#166534',
  toastErrorBg: '#fee2e2',     toastErrorBorder: '#fca5a5',     toastErrorText: '#991b1b',
  toastWarningBg: '#fef9c3',   toastWarningBorder: '#fde68a',   toastWarningText: '#854d0e',
  toastInfoBg: '#dbeafe',      toastInfoBorder: '#93c5fd',      toastInfoText: '#1e40af',

  // KPI / Stats
  kpiBg: '#ffffff',
  kpiBorder: '#e5e7eb',

  // Table
  tableHeaderBg: '#f9fafb',
  tableHeaderText: '#374151',
  tableRowAlt: '#f9fafb',
}

export const darkTheme = {
  // Backgrounds — Deep slate/navy
  bg: '#0f172a',
  card: '#1e293b',
  cardBg: '#1e293b',
  cardHover: '#26354d',
  elevated: '#1e293b',
  subtle: '#162032',
  selected: '#1e3a5f',

  // Text — Warm off-white for readability
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textLight: '#cbd5e1',
  textSecondary: '#cbd5e1',

  // Borders — Subtle
  border: '#334155',
  borderLight: '#475569',

  // Inputs
  inputBg: '#1e293b',
  inputBorder: '#475569',
  inputFocus: '#3b82f6',
  inputPlaceholder: '#64748b',

  // Navigation
  navActive: 'rgba(59,130,246,0.15)',
  navHover: '#26354d',
  rowHover: '#26354d',

  // Buttons (same vibrant colors, work great on dark)
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryText: '#ffffff',
  success: '#22c55e',
  successHover: '#16a34a',
  successText: '#ffffff',
  danger: '#ef4444',
  dangerHover: '#dc2626',
  dangerText: '#ffffff',
  warning: '#f59e0b',
  warningHover: '#d97706',
  warningText: '#ffffff',

  // Shadows — Light-tinted shadows for depth on dark
  shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
  shadowMd: '0 4px 16px rgba(0, 0, 0, 0.5)',
  shadowLg: '0 8px 40px rgba(0, 0, 0, 0.6)',

  // Status colors — Slightly muted for dark mode comfort
  pending: '#451a03',
  pendingText: '#fbbf24',
  approved: '#1e3a5f',
  approvedText: '#93c5fd',
  completed: '#064e3b',
  completedText: '#6ee7b7',
  rejected: '#450a0a',
  rejectedText: '#fca5a5',

  // Scrollbar
  scrollbarTrack: '#1e293b',
  scrollbarThumb: '#475569',

  // Overlay
  overlayBg: 'rgba(0,0,0,0.75)',
  modalBg: '#1e293b',

  // Avatar (slightly muted backgrounds)
  avatarAdminBg: '#450a0a',    avatarAdminText: '#fca5a5',
  avatarManagerBg: '#451a03',  avatarManagerText: '#fcd34d',
  avatarSkBg: '#064e3b',       avatarSkText: '#6ee7b7',
  avatarKitchenBg: '#3b0764',  avatarKitchenText: '#d8b4fe',
  avatarViewerBg: '#1e3a5f',   avatarViewerText: '#93c5fd',
  avatarDevBg: '#2e1065',      avatarDevText: '#c4b5fd',

  // Toast — Dark themed
  toastSuccessBg: '#064e3b',   toastSuccessBorder: '#16a34a',   toastSuccessText: '#86efac',
  toastErrorBg: '#450a0a',     toastErrorBorder: '#dc2626',     toastErrorText: '#fca5a5',
  toastWarningBg: '#451a03',   toastWarningBorder: '#d97706',   toastWarningText: '#fcd34d',
  toastInfoBg: '#1e3a5f',      toastInfoBorder: '#3b82f6',      toastInfoText: '#93c5fd',

  // KPI / Stats
  kpiBg: '#1e293b',
  kpiBorder: '#334155',

  // Table
  tableHeaderBg: '#1e293b',
  tableHeaderText: '#cbd5e1',
  tableRowAlt: '#162032',
}

// ─── NUMBER FORMATTING (PKR) ──────────────────────────────────────────────────
export const fmtNum   = (n) => Number(n||0).toLocaleString('en-PK')
export const fmtPKR   = (n) => `PKR ${Number(n||0).toLocaleString('en-PK')}`
export const fmtAmt   = fmtPKR
export const fmtShort = (n) => {
  const v = Number(n||0)
  if (v >= 1_000_000) return `PKR ${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `PKR ${(v/1_000).toFixed(0)}K`
  return fmtPKR(v)
}

// ─── ROLES ───────────────────────────────────────────────────────────────────
export const ROLES = {
  DEVELOPER: 'Developer',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CHIEF: 'Chief',
  STORE_KEEPER: 'Store Keeper',
  KITCHEN_STAFF: 'Kitchen Staff',
  VIEWER: 'Viewer',
}
export const canAccessLedger = (role) =>
  [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHIEF, ROLES.DEVELOPER].includes(role)
// ALL_ROLES - Full list including Developer (for validation / role checks)
export const ALL_ROLES = ['Developer', 'Admin', 'Manager', 'Store Keeper', 'Kitchen Staff', 'Viewer']

// ALL_ROLES_UI - Excludes Developer (for UI dropdowns where you can't create Developers)
export const ALL_ROLES_UI = ['Admin', 'Manager', 'Store Keeper', 'Kitchen Staff', 'Viewer']

// ─── Role check helpers ───
export const hasRole = (userRole, role) => userRole === role
export const hasAnyRole = (userRole, roles) => roles.includes(userRole)
export const isDeveloper = (r) => r === ROLES.DEVELOPER
export const isAdmin = (r) => r === ROLES.ADMIN
export const isManager = (r) => r === ROLES.MANAGER
export const isChief = (r) => r === ROLES.CHIEF
export const isStoreKeeper = (r) => r === ROLES.STORE_KEEPER
export const isKitchenStaff = (r) => r === ROLES.KITCHEN_STAFF
export const isViewer = (r) => r === ROLES.VIEWER

// ─── Role Colors ───
export const ROLE_COLORS = {
  'Developer': '#8b5cf6',      // Purple
  'Admin': '#3b82f6',          // Blue
  'Manager': '#f59e0b',        // Amber
  'Store Keeper': '#10b981',   // Emerald
  'Kitchen Staff': '#ef4444',  // Red
  'Viewer': '#6b7280',         // Gray
}

// ─── Permission helpers ───
export const canCreateUsers = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canDeleteUsers = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canAssignRoles = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canApproveRequests = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canRejectRequests = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canFulfillRequests = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isStoreKeeper(r)
export const canCreateDemand = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isChief(r) || isKitchenStaff(r)
export const canManageInventory = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isStoreKeeper(r)
export const canManageSuppliers = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canManageProcurement = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canManagePurchaseOrders = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canManageFinancials = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canViewReports = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isStoreKeeper(r)
export const canAccessSettings = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isStoreKeeper(r) || isKitchenStaff(r)

// ─── Page access helpers ───
export const canAccessUserManagement = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canAccessSuppliers = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canAccessProcurement = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canAccessPurchaseOrders = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canAccessFinancials = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)
export const canAccessInventory = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isStoreKeeper(r) || isKitchenStaff(r)
export const canAccessStockMovement = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isStoreKeeper(r)
export const canAccessFulfillment = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isStoreKeeper(r)
export const canAccessDemands = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isChief(r) || isKitchenStaff(r)
export const canAccessDashboard = () => true
export const canAccessActivityLog = (r) => isDeveloper(r) || isAdmin(r) || isManager(r) || isStoreKeeper(r) || isKitchenStaff(r)
export const canAccessItemTemplates = (r) => isDeveloper(r) || isAdmin(r) || isManager(r)

// ─── Sidebar visibility map ───
export const SIDEBAR_PERMISSIONS = {
  'Dashboard': canAccessDashboard,
  'Inventory': canAccessInventory,
  'Stock Movement': canAccessStockMovement,
  'Demands': canAccessDemands,
  'Fulfillment Center': canAccessFulfillment,
  'Item Templates': canAccessItemTemplates,
  'Suppliers': canAccessSuppliers,
  'Procurement Requests': canAccessProcurement,
  'Purchase Orders': canAccessPurchaseOrders,
  'User Management': canAccessUserManagement,
  'Activity Log': canAccessActivityLog,
  'Reports': canViewReports,
  'Inventory Expenses': canAccessFinancials,
  'Settings': canAccessSettings,
}