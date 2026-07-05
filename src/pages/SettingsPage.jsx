import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Btn, Card } from '../components/ui'
import { userCan } from '../lib/constants'

export default function SettingsPage() {
  const { dark, setDark, customUnits, setCustomUnits, systemEnabled, setSystemEnabled, systemMsg, setSystemMsg, theme, user, showToast, allUnits } = useApp()
  const [newUnit, setNewUnit] = useState('')

  const addUnit = () => {
    const u = newUnit.trim()
    if (!u) return
    if (allUnits.includes(u)) { showToast('warning','Already exists',`"${u}" is already a unit`); return }
    setCustomUnits(prev => [...prev, u])
    setNewUnit('')
    showToast('success','Unit Added',u)
  }

  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize:18, fontWeight:700, color:theme.text, marginBottom:20 }}>Settings</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }} className="grid-mobile-1">
        <Card>
          <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:14 }}>Appearance</h3>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:theme.text }}>Dark Mode</div>
              <div style={{ fontSize:12, color:theme.textMuted }}>Switch between light and dark theme</div>
            </div>
            <button onClick={() => setDark(p => !p)}
              style={{ width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                background: dark ? '#2563eb' : '#d1d5db', position:'relative', transition:'background 0.2s' }}>
              <span style={{ position:'absolute', top:3, transition:'left 0.2s',
                left: dark ? 24 : 2, width:20, height:20, background:'white', borderRadius:'50%' }}/>
            </button>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:14 }}>Custom Units</h3>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
              onKeyDown={e => e.key==='Enter' && addUnit()}
              placeholder="e.g. crate, jar…"
              style={{ flex:1, padding:'8px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:7, fontSize:13, background:theme.inputBg, color:theme.text }}/>
            <Btn variant="primary" onClick={addUnit}>Add</Btn>
          </div>
          {customUnits.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {customUnits.map(u => (
                <span key={u} style={{ padding:'3px 10px', background:'#eff6ff', color:'#2563eb',
                  borderRadius:6, fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
                  {u}
                  <button onClick={() => setCustomUnits(p => p.filter(x => x !== u))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0, lineHeight:1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </Card>

        {userCan('manageSystem', user?.role) && (
          <Card>
            <h3 style={{ fontSize:15, fontWeight:700, color:theme.text, marginBottom:14 }}>⚠️ System Control</h3>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:theme.text }}>System {systemEnabled ? 'Enabled' : 'Disabled'}</div>
                <div style={{ fontSize:12, color:theme.textMuted }}>Disable to show maintenance overlay</div>
              </div>
              <button onClick={() => setSystemEnabled(p => !p)}
                style={{ width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                  background: systemEnabled ? '#16a34a' : '#dc2626', position:'relative', transition:'background 0.2s' }}>
                <span style={{ position:'absolute', top:3, transition:'left 0.2s',
                  left: systemEnabled ? 24 : 2, width:20, height:20, background:'white', borderRadius:'50%' }}/>
              </button>
            </div>
            <textarea value={systemMsg} onChange={e => setSystemMsg(e.target.value)} rows={2}
              placeholder="Maintenance message…"
              style={{ width:'100%', padding:'8px 12px', border:`1px solid ${theme.inputBorder}`, borderRadius:7, fontSize:13, resize:'vertical', background:theme.inputBg, color:theme.text }}/>
          </Card>
        )}
      </div>
    </div>
  )
}
