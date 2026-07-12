import { useApp } from '../context/AppContext'
import { Btn } from '../components/ui'

export default function NotFound() {
  const { theme, setTab } = useApp()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: theme.bg,
      padding: 20,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 80,
        fontWeight: 800,
        color: '#3b82f6',
        lineHeight: 1,
      }}>
        404
      </div>
      <h1 style={{
        fontSize: 28,
        fontWeight: 700,
        color: theme.text,
        marginTop: 16,
      }}>
        Page Not Found
      </h1>
      <p style={{
        fontSize: 16,
        color: theme.textMuted,
        marginTop: 8,
        maxWidth: 400,
      }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <Btn
          variant="primary"
          onClick={() => setTab('dashboard')}
        >
          Go to Dashboard
        </Btn>
        <Btn
          variant="outline"
          onClick={() => window.history.back()}
        >
          Go Back
        </Btn>
      </div>
    </div>
  )
}