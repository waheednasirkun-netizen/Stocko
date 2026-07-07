import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Btn, Card } from '../components/ui'
import { userCan } from '../lib/constants'

/* ── Reusable components ────────────────────────────────── */

function Section({ title, icon, children, theme }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, margin:0 }}>{title}</h3>
      </div>
      {children}
    </Card>
  )
}

function Toggle({ checked, onChange, label, desc, theme }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <div>
        <div style={{ fontSize:14, fontWeight:500, color:theme.text }}>{label}</div>
        {desc && <div style={{ fontSize:12, color:theme.textMuted, marginTop:2 }}>{desc}</div>}
      </div>
      <button onClick={onChange}
        style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
          background: checked ? '#2563eb' : '#d1d5db', position:'relative',
          transition:'background 0.2s', flexShrink:0 }}>
        <span style={{ position:'absolute', top:2, transition:'left 0.2s',
          left: checked ? 22 : 2, width:20, height:20, background:'white', borderRadius:'50%' }}/>
      </button>
    </div>
  )
}

function Radio({ name, value, checked, onChange, label, theme }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:10,
      padding:10, borderRadius:8, background: checked ? 'rgba(37,99,235,0.06)' : 'transparent',
      border: checked ? `1px solid ${theme.border}` : '1px solid transparent',
      transition:'all 0.15s' }}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange}
        style={{ width:18, height:18, accentColor:'#2563eb', cursor:'pointer' }}/>
      <span style={{ fontSize:13, fontWeight: checked ? 600 : 400, color: theme.text }}>{label}</span>
    </label>
  )
}

function Field({ label, value, readOnly, theme, type = 'text', placeholder = '' }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, fontWeight:600, color:theme.textMuted, textTransform:'uppercase',
        letterSpacing:'0.5px', marginBottom:6 }}>{label}</div>
      <input type={type} value={value || ''} readOnly={readOnly}
        placeholder={placeholder}
        style={{ width:'100%', padding:'8px 12px', border:`1px solid ${theme.inputBorder}`,
          borderRadius:7, fontSize:13, background: readOnly ? theme.inputBg : theme.cardBg,
          color:theme.text, opacity: readOnly ? 0.7 : 1, cursor: readOnly ? 'not-allowed' : 'text' }}/>
    </div>
  )
}

function InfoRow({ label, value, theme, highlight }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'10px 0', borderBottom:`1px solid ${theme.border}` }}>
      <span style={{ fontSize:13, color:theme.textMuted }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color: highlight ? '#16a34a' : theme.text }}>{value}</span>
    </div>
  )
}

/* ── Main Settings Page ─────────────────────────────────── */

export default function SettingsPage() {
  const {
    dark, setDark,
    customUnits, setCustomUnits,
    systemEnabled, setSystemEnabled, systemMsg, setSystemMsg,
    theme, user, showToast, allUnits,
    // Assume these exist in context (add defaults)
    notificationsEnabled = true, setNotificationsEnabled,
    lowStockAlerts = true, setLowStockAlerts,
    requestAlerts = true, setRequestAlerts,
    fulfillmentAlerts = true, setFulfillmentAlerts,
    browserNotifs = false, setBrowserNotifs,
    autoRefresh = false, setAutoRefresh,
    lowThreshold = 10, setLowThreshold,
    restaurantName = 'RestoStock', setRestaurantName,
    branchName = 'Main Branch', setBranchName,
    language = 'en', setLanguage,
    timezone = 'UTC', setTimezone,
    logout,
  } = useApp()

  const [newUnit, setNewUnit] = useState('')

  const addUnit = () => {
    const u = newUnit.trim()
    if (!u) return
    if (allUnits.includes(u)) { showToast('warning','Already exists',`"${u}" is already a unit`); return }
    setCustomUnits(prev => [...prev, u])
    setNewUnit('')
    showToast('success','Unit Added',u)
  }

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout()
    }
  }

  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize:18, fontWeight:700, color:theme.text, marginBottom:20 }}>Settings</h2>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }} className="grid-mobile-1">

        {/* ── General ───────────────────────────── */}
        <Section title="General" icon="⚙️" theme={theme}>
          <Field label="Restaurant Name" value={restaurantName}
            onChange={e => setRestaurantName?.(e.target.value)} theme={theme}/>
          <Field label="Branch Name" value={branchName}
            onChange={e => setBranchName?.(e.target.value)} theme={theme}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:theme.textMuted, textTransform:'uppercase',
                letterSpacing:'0.5px', marginBottom:6 }}>Language</div>
              <select value={language} onChange={e => setLanguage?.(e.target.value)}
                style={{ width:'100%', padding:'8px 12px', border:`1px solid ${theme.inputBorder}`,
                  borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text, cursor:'pointer' }}>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ar">العربية</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:theme.textMuted, textTransform:'uppercase',
                letterSpacing:'0.5px', marginBottom:6 }}>Timezone</div>
              <select value={timezone} onChange={e => setTimezone?.(e.target.value)}
                style={{ width:'100%', padding:'8px 12px', border:`1px solid ${theme.inputBorder}`,
                  borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text, cursor:'pointer' }}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Chicago">Central (CT)</option>
                <option value="America/Denver">Mountain (MT)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
              </select>
            </div>
          </div>
        </Section>

        {/* ── Appearance ──────────────────────────── */}
        <Section title="Appearance" icon="🎨" theme={theme}>
          <div style={{ marginBottom:6, fontSize:14, fontWeight:500, color:theme.text }}>Theme</div>
          <div style={{ fontSize:12, color:theme.textMuted, marginBottom:12 }}>
            Choose how RestoStock looks on your device
          </div>
          <Radio name="theme" value="light" checked={!dark}
            onChange={() => setDark(false)} label="☀️ Light Mode" theme={theme}/>
          <Radio name="theme" value="dark" checked={dark}
            onChange={() => setDark(true)} label="🌙 Dark Mode" theme={theme}/>
        </Section>

        {/* ── Notifications ─────────────────────────── */}
        <Section title="Notifications" icon="🔔" theme={theme}>
          <Toggle checked={notificationsEnabled}
            onChange={() => setNotificationsEnabled?.(p => !p)}
            label="Enable Notifications"
            desc="Receive in-app alerts for important events"
            theme={theme}/>
          <Toggle checked={lowStockAlerts}
            onChange={() => setLowStockAlerts?.(p => !p)}
            label="Low Stock Alerts"
            desc="Warn when inventory items fall below threshold"
            theme={theme}/>
          <Toggle checked={requestAlerts}
            onChange={() => setRequestAlerts?.(p => !p)}
            label="Request Alerts"
            desc="Notify on new procurement or demand requests"
            theme={theme}/>
          <Toggle checked={fulfillmentAlerts}
            onChange={() => setFulfillmentAlerts?.(p => !p)}
            label="Fulfillment Alerts"
            desc="Alert when orders are ready or dispatched"
            theme={theme}/>
          <Toggle checked={browserNotifs}
            onChange={() => setBrowserNotifs?.(p => !p)}
            label="Browser Notifications"
            desc="Push alerts even when RestoStock is in background"
            theme={theme}/>
        </Section>

        {/* ── Inventory ─────────────────────────────── */}
        <Section title="Inventory" icon="📦" theme={theme}>
          <Toggle checked={autoRefresh}
            onChange={() => setAutoRefresh?.(p => !p)}
            label="Auto Refresh Inventory"
            desc="Automatically sync inventory data in real time"
            theme={theme}/>
          <Toggle checked={lowStockAlerts}
            onChange={() => setLowStockAlerts?.(p => !p)}
            label="Low Stock Notifications"
            desc="Enable threshold-based stock warnings"
            theme={theme}/>
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:12, fontWeight:600, color:theme.textMuted, textTransform:'uppercase',
              letterSpacing:'0.5px', marginBottom:6 }}>Low Stock Threshold</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="range" min="1" max="100" value={lowThreshold}
                onChange={e => setLowThreshold?.(Number(e.target.value))}
                style={{ flex:1, accentColor:'#2563eb' }}/>
              <span style={{ fontSize:13, fontWeight:600, color:theme.text, minWidth:28, textAlign:'right' }}>
                {lowThreshold}
              </span>
            </div>
          </div>
        </Section>

        {/* ── Custom Units ──────────────────────────── */}
        <Section title="Custom Units" icon="📐" theme={theme}>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
              onKeyDown={e => e.key==='Enter' && addUnit()}
              placeholder="e.g. crate, jar…"
              style={{ flex:1, padding:'8px 12px', border:`1px solid ${theme.inputBorder}`,
                borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}/>
            <Btn variant="primary" onClick={addUnit}>Add</Btn>
          </div>
          {customUnits.length > 0 ? (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {customUnits.map(u => (
                <span key={u} style={{ padding:'3px 10px', background:'#eff6ff', color:'#2563eb',
                  borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
                  {u}
                  <button onClick={() => setCustomUnits(p => p.filter(x => x !== u))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af',
                      padding:0, lineHeight:1 }}>✕</button>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:12, color:theme.textMuted, fontStyle:'italic' }}>
              No custom units added yet
            </div>
          )}
        </Section>

        {/* ── Account ───────────────────────────────── */}
        <Section title="Account" icon="👤" theme={theme}>
          <Field label="Full Name" value={user?.name} readOnly theme={theme}/>
          <Field label="Email" value={user?.email} readOnly theme={theme}/>
          <Field label="Role" value={user?.role} readOnly theme={theme}/>
          <Field label="Branch" value={branchName} readOnly theme={theme}/>
          <div style={{ marginTop:8, paddingTop:12, borderTop:`1px solid ${theme.border}` }}>
            <button onClick={handleLogout}
              style={{ width:'100%', padding:'10px', borderRadius:8, border:'1px solid #fecaca',
                background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:600,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='#fee2e2'; e.currentTarget.style.borderColor='#fca5a5' }}
              onMouseLeave={e => { e.currentTarget.style.background='#fef2f2'; e.currentTarget.style.borderColor='#fecaca' }}>
              <span>🚪</span> Sign Out
            </button>
          </div>
        </Section>

        {/* ── About ─────────────────────────────────── */}
        <Section title="About" icon="ℹ️" theme={theme}>
          <InfoRow label="Software Version" value="v5.0.0" theme={theme}/>
          <InfoRow label="Database" value="PostgreSQL (Supabase)" theme={theme}/>
          <InfoRow label="Supabase Status" value="● Connected" theme={theme} highlight/>
          <InfoRow label="Database Connection" value="● Online" theme={theme} highlight/>
          <div style={{ marginTop:12, padding:10, borderRadius:8, background:'rgba(37,99,235,0.04)',
            border:`1px solid ${theme.border}` }}>
            <div style={{ fontSize:12, color:theme.textMuted, lineHeight:1.5 }}>
              <strong style={{ color:theme.text }}>RestoStock</strong> — Restaurant inventory management powered by Supabase.
              Built for reliability, real-time sync, and multi-branch operations.
            </div>
          </div>
        </Section>

        {/* ── System Control (Admin only) ───────────── */}
        {userCan('manageSystem', user?.role) && (
          <Section title="System Control" icon="⚠️" theme={theme}>
            <Toggle checked={systemEnabled}
              onChange={() => setSystemEnabled(p => !p)}
              label={`System ${systemEnabled ? 'Enabled' : 'Disabled'}`}
              desc="Disable to show maintenance overlay to all users"
              theme={theme}/>
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:12, fontWeight:600, color:theme.textMuted, textTransform:'uppercase',
                letterSpacing:'0.5px', marginBottom:6 }}>Maintenance Message</div>
              <textarea value={systemMsg} onChange={e => setSystemMsg(e.target.value)} rows={2}
                placeholder="Maintenance message shown to users…"
                style={{ width:'100%', padding:'8px 12px', border:`1px solid ${theme.inputBorder}`,
                  borderRadius:7, fontSize:13, resize:'vertical', background:theme.inputBg, color:theme.text }}/>
            </div>
          </Section>
        )}

      </div>
    </div>
  )
}