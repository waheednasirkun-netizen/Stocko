/**
 * UI primitives — all shared components used across pages.
 * Fully theme-aware for light/dark mode.
 */
import { createContext, useContext, useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext'

// ── ICONS ─────────────────────────────────────────────────────────────────────
const iconPaths = {
  LayoutDashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
  Package:         <><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></>,
  ArrowLeftRight:  <><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></>,
  Truck:           <><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></>,
  FileText:        <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  Users:           <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  Settings:        <><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>,
  LogOut:          <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  Bell:            <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  Search:          <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
  Plus:            <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  Minus:           <><line x1="5" y1="12" x2="19" y2="12"/></>,
  Edit:            <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  Trash2:          <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
  Download:        <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  Filter:          <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46"/></>,
  Moon:            <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
  Sun:             <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
  Menu:            <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>,
  X:               <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  TrendingDown:    <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>,
  TrendingUp:      <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  AlertTriangle:   <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  Activity:        <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  Shield:          <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  Printer:         <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
  FileSpreadsheet: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></>,
  MoreVertical:    <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
  UserPlus:        <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></>,
  Lock:            <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  Mail:            <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></>,
  Phone:           <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.09 6.09l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></>,
  MapPin:          <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
  Box:             <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
  Utensils:        <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></>,
  ShoppingCart:    <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>,
  History:         <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></>,
  User:            <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  ClipboardList:   <><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/><line x1="9" y1="8" x2="10" y2="8"/></>,
  CheckCircle:     <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
  Eye:             <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  EyeOff:          <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>,
  BarChart2:       <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  ToggleLeft:      <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="8" cy="12" r="3"/></>,
  ToggleRight:     <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/></>,
  DollarSign:      <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  CreditCard:      <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
  Wallet:          <><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/><circle cx="17" cy="14" r="1" fill="currentColor"/></>,
  RefreshCw:       <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
}

export const Ic = ({ n, size = 18, color, style = {} }) => {
  const paths = iconPaths[n]
  if (!paths) return null
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke={color || 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {paths}
    </svg>
  )
}

// ── BUTTON ────────────────────────────────────────────────────────────────────
export const Btn = ({ variant = 'primary', children, style = {}, disabled, onClick, id, className = '' }) => {
  const { theme } = useApp()

  const variantStyles = {
    primary:  { background: theme.primary, color: theme.primaryText, border: 'none' },
    success:  { background: theme.success, color: theme.successText, border: 'none' },
    danger:   { background: theme.danger, color: theme.dangerText, border: 'none' },
    warning:  { background: theme.warning, color: theme.warningText, border: 'none' },
    outline:  { background: 'transparent', color: theme.text, border: `1px solid ${theme.border}` },
    ghost:    { background: 'transparent', color: theme.textMuted, border: 'none' },
  }

  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, width = 520 }) => {
  const { theme } = useApp()
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: theme.overlayBg,
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.cardBg,
          borderRadius: 14, padding: 28, width: '100%', maxWidth: width,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: theme.shadowLg,
          border: `1px solid ${theme.border}`,
          animation: 'fadeIn 0.2s ease'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
        }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: theme.text }}>{title}</h3>
          <button onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: theme.textMuted, padding: 4
            }}>
            <Ic n="X" size={18}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── TOAST CONTAINER ───────────────────────────────────────────────────────────
export const ToastContainer = ({ toasts, onDismiss }) => {
  const { theme } = useApp()

  const toastMeta = {
    success: { icon: '✅', bg: theme.toastSuccessBg, border: theme.toastSuccessBorder, color: theme.toastSuccessText },
    error:   { icon: '❌', bg: theme.toastErrorBg, border: theme.toastErrorBorder, color: theme.toastErrorText },
    warning: { icon: '⚠️', bg: theme.toastWarningBg, border: theme.toastWarningBorder, color: theme.toastWarningText },
    info:    { icon: 'ℹ️', bg: theme.toastInfoBg, border: theme.toastInfoBorder, color: theme.toastInfoText },
  }

  return (
    <div id="toast-container">
      {toasts.map(t => {
        const meta = toastMeta[t.type] || toastMeta.info
        return (
          <div
            key={t.id}
            className={`toast ${t.type}`}
            style={{
              background: meta.bg,
              border: `1px solid ${meta.border}`,
              color: meta.color,
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
              {meta.icon}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{t.title}</div>
              <div style={{ opacity: 0.85, lineHeight: 1.4 }}>{t.msg}</div>
            </div>
            <button onClick={() => onDismiss(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: 16 }}>
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
const ConfirmContext = createContext(null)

export const ConfirmProvider = ({ children }) => {
  const { theme } = useApp()
  const [state, setState] = useState(null)

  const confirm = useCallback(({
    title = 'Confirm', message = 'Are you sure?',
    variant = 'danger', confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  } = {}) => new Promise(resolve => {
    setState({ title, message, variant, confirmLabel, cancelLabel, resolve })
  }), [])

  const handle = (result) => {
    state?.resolve(result)
    setState(null)
  }

  const alertColors = {
    danger:  { bg: theme.rejected,       iconBg: theme.rejected,       icon: theme.rejectedText },
    warning: { bg: theme.pending,        iconBg: theme.pending,        icon: theme.pendingText },
    primary: { bg: theme.approved,       iconBg: theme.approved,       icon: theme.approvedText },
  }

  const ac = alertColors[state?.variant] || alertColors.danger

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="confirm-overlay" onClick={() => handle(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: ac.bg
              }}>
                <Ic n="AlertTriangle" size={20} color={ac.icon}/>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{state.title}</p>
            </div>
            <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
              {state.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="outline" onClick={() => handle(false)}>{state.cancelLabel}</Btn>
              <Btn
                variant={state.variant === 'danger' ? 'danger' : state.variant === 'warning' ? 'warning' : 'primary'}
                onClick={() => handle(true)}
              >{state.confirmLabel}</Btn>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)

// ── CARD ──────────────────────────────────────────────────────────────────────
export const Card = ({ children, style = {}, className = '' }) => {
  const { theme } = useApp()
  return (
    <div className={`card-hover ${className}`}
      style={{
        background: theme.cardBg,
        borderRadius: 12,
        border: `1px solid ${theme.border}`,
        padding: 20,
        ...style
      }}>
      {children}
    </div>
  )
}

// ── SEARCH DROPDOWN ───────────────────────────────────────────────────────────
export const SearchDropdown = ({ items, onSelect, show }) => {
  const { theme } = useApp()
  if (!show || !items.length) return null

  return (
    <div className="search-dropdown" style={{
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: 0,
      right: 0,
      background: theme.cardBg,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      boxShadow: theme.shadowMd,
      zIndex: 100,
      maxHeight: 240,
      overflowY: 'auto',
    }}>
      {items.map((item, i) => (
        <div
          key={i}
          className="search-result-item"
          onClick={() => onSelect(item)}
          style={{
            padding: '10px 14px',
            cursor: 'pointer',
            borderBottom: `1px solid ${theme.borderLight}`,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = theme.navHover}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ fontWeight: 500, fontSize: 13, color: theme.text }}>{item.name}</div>
          {item.category && (
            <div style={{ fontSize: 11, color: theme.textMuted }}>
              {item.category} · {item.unit}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── STATUS PILL ───────────────────────────────────────────────────────────────
export const StatusPill = ({ status }) => {
  const { theme } = useApp()

  const statusMap = {
    Active:    { bg: theme.success,       text: theme.successText },
    Inactive:  { bg: theme.danger,        text: theme.dangerText },
    Good:      { bg: theme.success,       text: theme.successText },
    Low:       { bg: theme.warning,       text: theme.warningText },
    Critical:  { bg: theme.danger,        text: theme.dangerText },
    Pending:   { bg: theme.pending,       text: theme.pendingText },
    Fulfilled: { bg: theme.completed,     text: theme.completedText },
    Rejected:  { bg: theme.rejected,      text: theme.rejectedText },
    Approved:  { bg: theme.approved,      text: theme.approvedText },
    Open:      { bg: theme.approved,      text: theme.approvedText },
    Closed:    { bg: theme.cardHover,     text: theme.textMuted },
    Ordered:   { bg: '#f3e8ff',           text: '#7c3aed' },
    Received:  { bg: theme.success,       text: theme.successText },
    paid:      { bg: theme.success,       text: theme.successText },
    unpaid:    { bg: theme.danger,        text: theme.dangerText },
    credit:    { bg: theme.warning,       text: theme.warningText },
  }

  const s = statusMap[status] || { bg: theme.cardHover, text: theme.textMuted }

  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: s.bg,
      color: s.text,
      display: 'inline-block'
    }}>
      {status}
    </span>
  )
}

// ── LOADING SCREEN ────────────────────────────────────────────────────────────
export const LoadingScreen = ({ message = 'Loading...' }) => {
  const { theme } = useApp()
  return (
    <div className="loading-screen">
      <div className="spinner"/>
      <p style={{ color: theme.primary, fontWeight: 600, fontSize: 18 }}>Stocko</p>
      <p style={{ color: theme.textMuted, fontSize: 13 }}>{message}</p>
    </div>
  )
}

// ── EMPTY STATE ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon = 'Package', title = 'No data', message = '' }) => {
  const { theme } = useApp()
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textMuted }}>
      <Ic n={icon} size={48} color={theme.border} style={{ display: 'block', margin: '0 auto 16px' }}/>
      <p style={{ fontSize: 16, fontWeight: 600, color: theme.text, marginBottom: 8 }}>{title}</p>
      {message && <p style={{ fontSize: 13 }}>{message}</p>}
    </div>
  )
}

// ── KPI CARD ──────────────────────────────────────────────────────────────────
export const KpiCard = ({ label, value, icon, trend, trendUp }) => {
  const { theme } = useApp()
  return (
    <div style={{
      background: theme.kpiBg,
      border: `1px solid ${theme.kpiBorder}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: theme.shadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
        {value}
      </div>
      {trend && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: trendUp ? theme.success : theme.danger
        }}>
          {trendUp ? '↑' : '↓'} {trend}
        </div>
      )}
    </div>
  )
}

// ── INPUT FIELD ───────────────────────────────────────────────────────────────
export const Input = ({ label, error, ...props }) => {
  const { theme } = useApp()
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: theme.text,
          marginBottom: 6
        }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          width: '100%',
          background: theme.inputBg,
          color: theme.text,
          border: `1px solid ${error ? theme.danger : theme.inputBorder}`,
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 14,
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...props.style,
        }}
      />
      {error && (
        <div className="field-error" style={{ color: theme.danger }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ── SELECT FIELD ──────────────────────────────────────────────────────────────
export const Select = ({ label, error, children, ...props }) => {
  const { theme } = useApp()
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: theme.text,
          marginBottom: 6
        }}>
          {label}
        </label>
      )}
      <select
        {...props}
        style={{
          width: '100%',
          background: theme.inputBg,
          color: theme.text,
          border: `1px solid ${error ? theme.danger : theme.inputBorder}`,
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 14,
          ...props.style,
        }}
      >
        {children}
      </select>
      {error && (
        <div className="field-error" style={{ color: theme.danger }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ── BADGE ─────────────────────────────────────────────────────────────────────
export const Badge = ({ children, variant = 'default' }) => {
  const { theme } = useApp()

  const variants = {
    default: { bg: theme.cardHover, text: theme.textMuted },
    primary: { bg: theme.navActive, text: theme.primary },
    success: { bg: theme.success, text: theme.successText },
    danger:  { bg: theme.danger, text: theme.dangerText },
    warning: { bg: theme.warning, text: theme.warningText },
  }

  const v = variants[variant] || variants.default

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      background: v.bg,
      color: v.text,
    }}>
      {children}
    </span>
  )
}

// ── DIVIDER ───────────────────────────────────────────────────────────────────
export const Divider = ({ style = {} }) => {
  const { theme } = useApp()
  return (
    <hr style={{
      border: 'none',
      borderTop: `1px solid ${theme.border}`,
      margin: '16px 0',
      ...style
    }}/>
  )
}

// ── PAGE HEADER ───────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, actions }) => {
  const { theme } = useApp()
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 24,
      flexWrap: 'wrap',
      gap: 12,
    }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: theme.textMuted, margin: '4px 0 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  )
}

// ── TABLE CONTAINER ───────────────────────────────────────────────────────────
export const TableContainer = ({ children, style = {} }) => {
  const { theme } = useApp()
  return (
    <div style={{
      background: theme.cardBg,
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: theme.shadow,
      ...style
    }}>
      {children}
    </div>
  )
}

// ── PAGINATION ────────────────────────────────────────────────────────────────
export const Pagination = ({ page, totalPages, onChange }) => {
  const { theme } = useApp()
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="pagination" style={{
      display: 'flex',
      gap: 4,
      justifyContent: 'center',
      padding: '12px 0',
    }}>
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: `1px solid ${theme.border}`,
          background: theme.cardBg,
          color: theme.textMuted,
          fontSize: 13,
          cursor: page === 1 ? 'not-allowed' : 'pointer',
          opacity: page === 1 ? 0.5 : 1,
        }}
      >
        Prev
      </button>
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={p === page ? 'active' : ''}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${p === page ? theme.primary : theme.border}`,
            background: p === page ? theme.primary : theme.cardBg,
            color: p === page ? theme.primaryText : theme.text,
            fontSize: 13,
            fontWeight: p === page ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: `1px solid ${theme.border}`,
          background: theme.cardBg,
          color: theme.textMuted,
          fontSize: 13,
          cursor: page === totalPages ? 'not-allowed' : 'pointer',
          opacity: page === totalPages ? 0.5 : 1,
        }}
      >
        Next
      </button>
    </div>
  )
}