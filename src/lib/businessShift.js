const pad = n => String(n).padStart(2, '0')
export const localDateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
export const inDateTimeRange = (value, range) => {
  if (!value || !range?.start || !range?.end) return false
  const d = new Date(value)
  return !Number.isNaN(d.getTime()) && d >= new Date(range.start) && d <= new Date(range.end)
}
export const dateKeyFromValue = value => localDateKey(new Date(value))

// Backward-compatible helpers. Operational pages use the database-backed shift from AppContext.
export function getBusinessShift(now = new Date()) {
  const end = new Date(now); const start = new Date(now); start.setHours(0,0,0,0)
  return { active:true, businessDate:localDateKey(start), start, end }
}
export const isStaffCurrentShiftOnly = role => ['Store Keeper','Kitchen Staff'].includes(String(role || ''))
export const inBusinessShift = (value, shift) => inDateTimeRange(value, shift)
