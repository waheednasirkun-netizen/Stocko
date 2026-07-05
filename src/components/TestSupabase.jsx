import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TestSupabase() {
  const [status, setStatus] = useState('Click to test connection')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setStatus('Testing connection...')
    
    try {
      if (!supabase) {
        setStatus('❌ Supabase client not initialized!')
        setLoading(false)
        return
      }

      console.log('🔍 Testing Supabase...')
      console.log('Supabase URL:', supabase.supabaseUrl)
      
      const { data, error, count } = await supabase
        .from('demands')
        .select('*', { count: 'exact' })
        .limit(5)
      
      if (error) {
        console.error('❌ Supabase error:', error)
        setStatus('❌ Error: ' + error.message)
        setData(null)
      } else {
        console.log('✅ Supabase success! Found:', data)
        setStatus(`✅ Connected! Found ${count || data?.length || 0} demands`)
        setData(data)
      }
    } catch (err) {
      console.error('❌ Exception:', err)
      setStatus('❌ Exception: ' + err.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      padding: '12px 16px', 
      background: '#f0f9ff', 
      border: '1px solid #bae6fd',
      borderRadius: 8, 
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#0369a1' }}>
        🔌 Supabase:
      </span>
      <button 
        onClick={testConnection}
        disabled={loading}
        style={{
          padding: '6px 16px',
          background: loading ? '#94a3b8' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 500
        }}
      >
        {loading ? '⏳ Testing...' : '🔗 Test Connection'}
      </button>
      <span style={{ fontSize: 13, color: '#0c4a6e', fontWeight: 500 }}>
        {status}
      </span>
      {data && data.length > 0 && (
        <span style={{ fontSize: 12, color: '#0c4a6e', background: '#e0f2fe', padding: '2px 10px', borderRadius: 4 }}>
          📊 {data.length} records
        </span>
      )}
    </div>
  )
}