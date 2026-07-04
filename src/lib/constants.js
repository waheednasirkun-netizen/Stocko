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

// ─── THEMES ──────────────────────────────────────────────────────────────────
export const lightTheme = {
  bg:'#f8fafc', cardBg:'#ffffff', border:'#e5e7eb',
  text:'#111827', textMuted:'#6b7280',
  inputBg:'#ffffff', inputBorder:'#d1d5db',
  navActive:'rgba(37,99,235,0.1)', navHover:'#f3f4f6', rowHover:'#f9fafb',
}

export const darkTheme = {
  bg:'#111827', cardBg:'#1f2937', border:'#374151',
  text:'#f9fafb', textMuted:'#9ca3af',
  inputBg:'#374151', inputBorder:'#4b5563',
  navActive:'rgba(37,99,235,0.2)', navHover:'#1f2937', rowHover:'#374151',
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
