console.log('[RestoStock] Login.jsx loaded')

import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Ic } from '../components/ui'
import { supabase } from '../lib/supabase'

/* ═══════════════════════════════════════════════════════════════════════════
   FLOATING SHAPES BACKGROUND COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
function FloatingShapes() {
  const shapes = [
    { size: 80,  x: '10%', y: '20%', delay: '0s',   duration: '20s', color: 'rgba(59,130,246,0.08)' },
    { size: 120, x: '85%', y: '15%', delay: '2s',   duration: '25s', color: 'rgba(59,130,246,0.06)' },
    { size: 60,  x: '75%', y: '70%', delay: '4s',   duration: '18s', color: 'rgba(59,130,246,0.1)' },
    { size: 100, x: '20%', y: '80%', delay: '1s',   duration: '22s', color: 'rgba(59,130,246,0.07)' },
    { size: 50,  x: '50%', y: '10%', delay: '3s',   duration: '28s', color: 'rgba(59,130,246,0.09)' },
    { size: 90,  x: '90%', y: '50%', delay: '5s',   duration: '24s', color: 'rgba(59,130,246,0.05)' },
    { size: 70,  x: '5%',  y: '55%', delay: '0.5s', duration: '19s', color: 'rgba(59,130,246,0.08)' },
    { size: 110, x: '40%', y: '85%', delay: '2.5s', duration: '21s', color: 'rgba(59,130,246,0.06)' },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      {shapes.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: s.size,
            height: s.size,
            left: s.x,
            top: s.y,
            borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '30% 70% 70% 30% / 30% 30% 70% 70%' : '16px',
            background: s.color,
            animation: `float ${s.duration} ease-in-out ${s.delay} infinite`,
            backdropFilter: 'blur(2px)',
          }}
        />
      ))}
      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(59,130,246,0.08) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }}/>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORGOT PASSWORD MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function ForgotPasswordModal({ onClose, dark, theme }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const { error: supaError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (supaError) {
        setError(supaError.message)
      } else {
        setSent(true)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const overlayBg = dark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)'
  const cardBg = theme.cardBg
  const textColor = theme.text
  const mutedColor = theme.textMuted
  const borderColor = theme.border
  const inputBg = theme.inputBg
  const inputBorder = theme.inputBorder
  const primary = theme.primary
  const primaryText = theme.primaryText

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: overlayBg,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div
        style={{
          background: cardBg,
          borderRadius: 20,
          padding: '36px 32px',
          width: '100%',
          maxWidth: 400,
          boxShadow: dark
            ? '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 24px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          animation: 'slideUp 0.3s ease',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: mutedColor,
            padding: 4,
            borderRadius: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = theme.navHover}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Ic n="X" size={18}/>
        </button>

        {!sent ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${primary}20, ${primary}10)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Ic n="Mail" size={24} color={primary}/>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: textColor, margin: '0 0 6px 0' }}>
                Forgot Password?
              </h3>
              <p style={{ fontSize: 14, color: mutedColor, lineHeight: 1.6, margin: 0 }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: textColor,
                  marginBottom: 6,
                }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Ic n="Mail" size={16} color={mutedColor}
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}/>
                  <input
                    ref={inputRef}
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    placeholder="you@restaurant.com"
                    autoComplete="email"
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      border: `1px solid ${error ? theme.danger : inputBorder}`,
                      borderRadius: 10,
                      fontSize: 14,
                      background: inputBg,
                      color: textColor,
                      opacity: loading ? 0.7 : 1,
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      outline: 'none',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = primary
                      e.target.style.boxShadow = `0 0 0 3px ${primary}20`
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = error ? theme.danger : inputBorder
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
                {error && (
                  <p style={{ fontSize: 12, color: theme.danger, margin: '6px 0 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Ic n="AlertTriangle" size={12}/> {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: primary,
                  color: primaryText,
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: `0 4px 14px ${primary}40`,
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = `0 6px 20px ${primary}50`
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = `0 4px 14px ${primary}40`
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                      display: 'inline-block',
                    }}/>
                    Sending…
                  </>
                ) : (
                  <>
                    <Ic n="Send" size={16} color="white"/>
                    Send Reset Link
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${theme.success}20, ${theme.success}10)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Ic n="CheckCircle" size={28} color={theme.success}/>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: textColor, margin: '0 0 8px 0' }}>
              Check Your Email
            </h3>
            <p style={{ fontSize: 14, color: mutedColor, lineHeight: 1.6, margin: '0 0 20px 0' }}>
              We've sent a password reset link to <strong style={{ color: textColor }}>{email}</strong>. The link will expire in 1 hour.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                background: theme.navHover,
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = theme.rowHover}
              onMouseLeave={e => e.currentTarget.style.background = theme.navHover}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN LOGIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Login() {
  const { login, authError, showToast, dark, theme } = useApp()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [localErr,   setLocalErr]   = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  const emailRef = useRef(null)

  useEffect(() => {
    // Auto-focus email on mount
    const timer = setTimeout(() => emailRef.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [])

  // Load remembered email
  useEffect(() => {
    const saved = localStorage.getItem('rs_remember_email')
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  const displayError = localErr || authError || ''

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setLocalErr('')

    if (!email.trim()) {
      setLocalErr('Please enter your email address.')
      emailRef.current?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLocalErr('Please enter a valid email address.')
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setLocalErr('Please enter your password.')
      return
    }

    // Remember me
    if (rememberMe) {
      localStorage.setItem('rs_remember_email', email.trim())
    } else {
      localStorage.removeItem('rs_remember_email')
    }

    setLoading(true)
    const result = await login(email.trim(), password)
    setLoading(false)

    if (result?.error) {
      // Error is already set in authError by AppContext
      // But we can also show a toast
      showToast('error', 'Login Failed', result.error.message || 'Invalid credentials')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit()
    }
  }

  // Theme-aware colors
  const bgGradient = dark
    ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
    : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #eff6ff 100%)'

  const cardBg = dark
    ? 'rgba(30,41,59,0.85)'
    : 'rgba(255,255,255,0.92)'

  const cardBorder = dark
    ? '1px solid rgba(255,255,255,0.08)'
    : '1px solid rgba(255,255,255,0.6)'

  const glassShadow = dark
    ? '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
    : '0 24px 80px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)'

  const textColor = theme.text
  const mutedColor = theme.textMuted
  const primary = theme.primary
  const primaryHover = theme.primaryHover
  const primaryText = theme.primaryText
  const inputBg = theme.inputBg
  const inputBorder = theme.inputBorder
  const danger = theme.danger

  return (
    <div style={{
      minHeight: '100vh',
      background: bgGradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <FloatingShapes/>

      {/* Dark mode toggle */}
      <button
        onClick={() => {
          const newDark = !dark
          // This would need to be exposed from AppContext or handled differently
          // For now, we'll just toggle the body class directly
          document.body.classList.toggle('dark-mode', newDark)
          window.dispatchEvent(new CustomEvent('theme-toggle', { detail: newDark }))
        }}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 10,
          background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 12,
          padding: 10,
          cursor: 'pointer',
          color: mutedColor,
          backdropFilter: 'blur(12px)',
          transition: 'all 0.2s',
        }}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Ic n={dark ? 'Sun' : 'Moon'} size={18}/>
      </button>

      {/* Main Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        background: cardBg,
        borderRadius: 24,
        padding: '44px 40px 36px',
        width: '100%',
        maxWidth: 440,
        boxShadow: glassShadow,
        border: cardBorder,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        animation: 'slideUp 0.5s ease',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Logo */}
          <div style={{
            width: 72,
            height: 72,
            background: `linear-gradient(135deg, ${primary}, ${primaryHover})`,
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: `0 8px 24px ${primary}40`,
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}>
            <Ic n="Package" size={32} color="white"/>
          </div>

          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            color: textColor,
            margin: '0 0 6px 0',
            letterSpacing: '-0.5px',
          }}>
            RestoStock
          </h1>
          <p style={{
            color: mutedColor,
            fontSize: 14,
            fontWeight: 500,
            margin: 0,
          }}>
            Restaurant Inventory Management
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: textColor,
              marginBottom: 8,
            }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Ic n="Mail" size={16} color={focusedField === 'email' ? primary : mutedColor}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  transition: 'color 0.2s',
                }}/>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setLocalErr('') }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                onKeyDown={handleKeyDown}
                placeholder="admin@restaurant.com"
                autoComplete="email"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 44px',
                  border: `1.5px solid ${focusedField === 'email' ? primary : inputBorder}`,
                  borderRadius: 12,
                  fontSize: 14,
                  background: inputBg,
                  color: textColor,
                  opacity: loading ? 0.6 : 1,
                  transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
                  outline: 'none',
                  boxShadow: focusedField === 'email' ? `0 0 0 3px ${primary}15` : 'none',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 10 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: textColor,
              marginBottom: 8,
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Ic n="Lock" size={16} color={focusedField === 'password' ? primary : mutedColor}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  transition: 'color 0.2s',
                }}/>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setLocalErr('') }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 44px',
                  border: `1.5px solid ${focusedField === 'password' ? primary : inputBorder}`,
                  borderRadius: 12,
                  fontSize: 14,
                  background: inputBg,
                  color: textColor,
                  opacity: loading ? 0.6 : 1,
                  transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
                  outline: 'none',
                  boxShadow: focusedField === 'password' ? `0 0 0 3px ${primary}15` : 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: mutedColor,
                  padding: 4,
                  borderRadius: 6,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = textColor}
                onMouseLeave={e => e.currentTarget.style.color = mutedColor}
              >
                <Ic n={showPw ? 'EyeOff' : 'Eye'} size={16}/>
              </button>
            </div>
          </div>

          {/* Remember Me + Forgot Password */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 13,
              color: mutedColor,
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: primary,
                  cursor: 'pointer',
                }}
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              style={{
                background: 'none',
                border: 'none',
                color: primary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'none',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Forgot password?
            </button>
          </div>

          {/* Error Message */}
          {displayError && (
            <div style={{
              padding: '12px 16px',
              background: dark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
              border: `1px solid ${dark ? 'rgba(239,68,68,0.2)' : '#fecaca'}`,
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
              color: danger,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              animation: 'shake 0.4s ease',
            }}>
              <Ic n="AlertTriangle" size={16} color={danger} style={{ flexShrink: 0, marginTop: 1 }}/>
              <span style={{ lineHeight: 1.5 }}>{displayError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: `linear-gradient(135deg, ${primary}, ${primaryHover})`,
              color: primaryText,
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: `0 4px 16px ${primary}40`,
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = `0 6px 24px ${primary}55`
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = `0 4px 16px ${primary}40`
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 18,
                  height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }}/>
                Signing in…
              </>
            ) : (
              <>
                <Ic n="LogIn" size={18} color="white"/>
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 28,
          paddingTop: 20,
          borderTop: `1px solid ${theme.borderLight}`,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 12, color: mutedColor, margin: '0 0 4px 0' }}>
            Secure login powered by Supabase
          </p>
          <p style={{ fontSize: 11, color: dark ? 'rgba(148,163,184,0.5)' : '#cbd5e1', margin: 0 }}>
            &copy; 2026 RestoStock. All rights reserved.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <ForgotPasswordModal
          onClose={() => setShowForgot(false)}
          dark={dark}
          theme={theme}
        />
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-20px) rotate(2deg); }
          66% { transform: translateY(10px) rotate(-1deg); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 8px 24px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 8px 32px rgba(59,130,246,0.5); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}