// ─── ROLES & PERMISSIONS ─────────────────────────────────────────────────────
export const ROLE_CAN = {
  stockIn:             ['Developer','Admin','Manager','Store Keeper'],
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
  
  // Text
  text: '#111827',
  textMuted: '#6b7280',
  textLight: '#4b5563',
  
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
  avatarDevBg: '#f1f5f9',      avatarDevText: '#475569',
  
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
  
  // Text — Warm off-white for readability
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textLight: '#cbd5e1',
  
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
  avatarDevBg: '#1e293b',      avatarDevText: '#94a3b8',
  
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
// src/lib/constants.js
// ─── Add these at the bottom of your existing constants.js ───

export const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CHIEF: 'Chief',
  STORE_KEEPER: 'Store Keeper',
};

// ─── Role check helpers ───
export const hasRole = (userRole, role) => userRole === role;
export const hasAnyRole = (userRole, roles) => roles.includes(userRole);
export const isAdmin = (userRole) => userRole === ROLES.ADMIN;
export const isManager = (userRole) => userRole === ROLES.MANAGER;
export const isChief = (userRole) => userRole === ROLES.CHief;
export const isStoreKeeper = (userRole) => userRole === ROLES.STORE_KEEPER;

// ─── Permission helpers ───
export const canCreateUsers = (r) => isAdmin(r);
export const canDeleteUsers = (r) => isAdmin(r);
export const canAssignRoles = (r) => isAdmin(r);
export const canApproveRequests = (r) => isAdmin(r) || isManager(r);
export const canRejectRequests = (r) => isAdmin(r) || isManager(r);
export const canFulfillRequests = (r) => isAdmin(r) || isManager(r) || isStoreKeeper(r);
export const canCreateDemand = (r) => isAdmin(r) || isManager(r) || isChief(r);
export const canManageInventory = (r) => isAdmin(r) || isManager(r) || isStoreKeeper(r);
export const canManageSuppliers = (r) => isAdmin(r) || isManager(r);
export const canManageProcurement = (r) => isAdmin(r) || isManager(r);
export const canManagePurchaseOrders = (r) => isAdmin(r) || isManager(r);
export const canManageFinancials = (r) => isAdmin(r) || isManager(r);
export const canViewReports = (r) => isAdmin(r) || isManager(r) || isChief(r) || isStoreKeeper(r);
export const canAccessSettings = (r) => isAdmin(r);

// ─── Page access helpers ───
export const canAccessUserManagement = (r) => isAdmin(r);
export const canAccessSuppliers = (r) => isAdmin(r) || isManager(r);
export const canAccessProcurement = (r) => isAdmin(r) || isManager(r);
export const canAccessPurchaseOrders = (r) => isAdmin(r) || isManager(r);
export const canAccessFinancials = (r) => isAdmin(r) || isManager(r);
export const canAccessInventory = (r) => isAdmin(r) || isManager(r) || isStoreKeeper(r);
export const canAccessStockMovement = (r) => isAdmin(r) || isManager(r) || isStoreKeeper(r);
export const canAccessFulfillment = (r) => isAdmin(r) || isManager(r) || isStoreKeeper(r);
export const canAccessDemands = (r) => isAdmin(r) || isManager(r) || isChief(r);
export const canAccessDashboard = () => true;
export const canAccessActivityLog = (r) => isAdmin(r) || isManager(r);
export const canAccessItemTemplates = (r) => isAdmin(r) || isManager(r) || isStoreKeeper(r);

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
};