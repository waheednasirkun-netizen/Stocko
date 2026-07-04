import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Card, EmptyState } from '../components/ui'

export default function ActivityLog() {
  const { activityLogs, theme } = useApp()
  const sorted = useMemo(() => [...activityLogs].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)), [activityLogs])
  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize:18, fontWeight:700, color:theme.text, marginBottom:20 }}>Activity Log</h2>
      <Card style={{ padding:0, overflow:'hidden' }}>
        {sorted.length === 0
          ? <EmptyState icon="Activity" title="No activity yet"/>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:theme.bg }}>
                  {['Action','Details','User','Date'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:theme.textMuted, borderBottom:`1px solid ${theme.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sorted.map((log, i) => (
                    <tr key={log.id||i} style={{ borderBottom:`1px solid ${theme.border}` }}>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, background:'#eff6ff', color:'#2563eb' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:13, color:theme.text }}>{log.details||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted }}>{log.user_name||log.userName||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:theme.textMuted, whiteSpace:'nowrap' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  )
}
