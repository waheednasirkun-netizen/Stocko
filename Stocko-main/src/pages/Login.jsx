console.log('[RestoStock] Login.jsx loaded')

import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Ic, Btn } from '../components/ui'

export default function Login() {
  const { login, authError } = useApp()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [localErr, setLocalErr] = useState('')

  const displayError = localErr || authError || ''

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setLocalErr('')
    if (!email.trim()) { setLocalErr('Enter your email address.'); return }
    if (!password)     { setLocalErr('Enter your password.'); return }

    setLoading(true)
    await login(email.trim(), password)
    setLoading(false)
    // Success: AppContext sets user → App.jsx renders dashboard automatically.
    // Failure: authError is set in AppContext and shown via displayError.
  }

  return (
    <div style={{ minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 40,
        width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, background: '#2563eb', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Ic n="Package" size={28} color="white"/>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>RestoStock</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Restaurant Inventory Management</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Ic n="Mail" size={16} color="#9ca3af"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}/>
              <input
                type="email" value={email}
                onChange={e => { setEmail(e.target.value); setLocalErr('') }}
                placeholder="admin@restaurant.com"
                autoFocus autoComplete="email" disabled={loading}
                style={{ width: '100%', padding: '11px 12px 11px 38px',
                  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
                  background: '#f9fafb', color: '#111827', opacity: loading ? 0.7 : 1 }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Ic n="Lock" size={16} color="#9ca3af"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}/>
              <input
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setLocalErr('') }}
                placeholder="••••••••"
                autoComplete="current-password" disabled={loading}
                style={{ width: '100%', padding: '11px 40px 11px 38px',
                  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
                  background: '#f9fafb', color: '#111827', opacity: loading ? 0.7 : 1 }}
              />
              <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <Ic n={showPw ? 'EyeOff' : 'Eye'} size={16}/>
              </button>
            </div>
          </div>

          {/* Error */}
          {displayError && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5',
              borderRadius: 8, margin: '12px 0', fontSize: 13, color: '#991b1b',
              display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Ic n="AlertTriangle" size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }}/>
              <span>{displayError}</span>
            </div>
          )}

          {/* Submit */}
          <Btn type="submit" variant="primary" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15, marginTop: 8 }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/>
                Signing in…
              </span>
            ) : (
              <><Ic n="LogIn" size={16} color="white" style={{ marginRight: 6 }}/>Sign In</>
            )}
          </Btn>
        </form>

        {/* Credentials hint */}
        <div style={{ marginTop: 24, padding: 14, background: '#f8fafc',
          borderRadius: 10, border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>
            Current credentials
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.8 }}>
            superadmin@reastostock.com / 7860222
          </p>
        </div>

      </div>
    </div>
  )
}
