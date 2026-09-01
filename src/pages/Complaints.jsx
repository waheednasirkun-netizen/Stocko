import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Card, Btn, Ic, StatusPill } from '../components/ui'

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Rejected']
const CATEGORIES = ['Food Quality', 'Food Safety', 'Service', 'Staff', 'Cleanliness', 'Delivery', 'Billing', 'Other']

const fmtDate = value => value ? new Date(value).toLocaleString() : '—'
const PUBLIC_COMPLAINT_BASE_URL = 'https://stocko.website'
const qrUrl = token => `${PUBLIC_COMPLAINT_BASE_URL}/complaint/${encodeURIComponent(token)}`
const qrImageUrl = token => `https://quickchart.io/qr?size=360&margin=2&text=${encodeURIComponent(qrUrl(token))}`

export default function Complaints() {
  const { user, userRole, theme, showToast, branches } = useApp()
  const isMaster = userRole === 'Master' || user?.role === 'Master'
  const canManage = ['Developer', 'Admin', 'Manager'].includes(userRole || user?.role)
  const isDeveloper = userRole === 'Developer' || user?.role === 'Developer'

  const [tab, setTab] = useState('complaints')
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('All')
  const [entryType, setEntryType] = useState('All')
  const [orderType, setOrderType] = useState('All')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')

  const [qrRows, setQrRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [qrKind, setQrKind] = useState('table')
  const [qrBranch, setQrBranch] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [qrLabel, setQrLabel] = useState('')
  const [qrLoading, setQrLoading] = useState(false)

  const activeBranchId = isMaster ? null : (user?.branch_id || branches?.[0]?.id || null)

  const loadComplaints = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('customer_complaints')
        .select('*, branches(name)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (!isMaster && activeBranchId) query = query.eq('branch_id', activeBranchId)
      if (status !== 'All') query = query.eq('status', status)
      if (entryType !== 'All') query = query.eq('entry_type', entryType.toLowerCase())
      if (from) query = query.gte('created_at', `${from}T00:00:00`)
      if (to) query = query.lte('created_at', `${to}T23:59:59`)
      const { data, error } = await query
      if (error) throw error
      setRows(data || [])
    } catch (error) {
      console.error('[Complaints] load error:', error)
      showToast('error', 'Complaints unavailable', error.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [activeBranchId, entryType, from, isMaster, showToast, status, to])

  const loadQrs = useCallback(async () => {
    setQrLoading(true)
    try {
      let query = supabase.from('complaint_qr_codes').select('*, branches(name)').order('created_at', { ascending: false })
      if (!isMaster) query = query.eq('branch_id', activeBranchId)
      const { data, error } = await query
      if (error) throw error
      setQrRows(data || [])
    } catch (error) {
      console.error('[Complaints] QR load error:', error)
      showToast('error', 'QR codes unavailable', error.message)
    } finally {
      setQrLoading(false)
    }
  }, [activeBranchId, isMaster, showToast])

  const loadCustomers = useCallback(async () => {
    try {
      let query = supabase.from('customers').select('id, name, phone, customer_code, branch_id').order('name')
      if (!isMaster && activeBranchId) query = query.eq('branch_id', activeBranchId)
      const { data, error } = await query.limit(1000)
      if (!error) setCustomers(data || [])
    } catch (error) {
      console.warn('[Complaints] customer load error:', error)
    }
  }, [activeBranchId, isMaster])

  useEffect(() => { loadComplaints() }, [loadComplaints])
  useEffect(() => { loadQrs(); loadCustomers() }, [loadCustomers, loadQrs])

  useEffect(() => {
    const channel = supabase.channel('stocko-complaints-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_complaints' }, () => loadComplaints())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadComplaints])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      const type = String(r.order_type || '').toLowerCase()
      const matchesType = orderType === 'All' || type.includes(orderType.toLowerCase())
      if (!matchesType) return false
      if (!q) return true
      return [r.complaint_no, r.order_reference, r.customer_name, r.customer_phone, r.description, r.category, r.table_number, r.branches?.name]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    })
  }, [orderType, rows, search])

  const openDetails = async row => {
    setSelected(row)
    setNotes(row.manager_notes || '')
    const { data } = await supabase.from('complaint_status_history').select('*').eq('complaint_id', row.id).order('changed_at', { ascending: false })
    setHistory(data || [])
  }

  const updateStatus = async nextStatus => {
    if (!selected || !canManage || saving) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('customer_complaints')
        .update({ status: nextStatus, manager_notes: notes.trim() || null, resolved_by: user?.id || null })
        .eq('id', selected.id)
        .select('*')
        .single()
      if (error) throw error
      setSelected(data)
      setRows(prev => prev.map(r => r.id === data.id ? { ...r, ...data } : r))
      const { data: h } = await supabase.from('complaint_status_history').select('*').eq('complaint_id', data.id).order('changed_at', { ascending: false })
      setHistory(h || [])
      showToast('success', 'Complaint updated', `Status changed to ${nextStatus}`)
    } catch (error) {
      showToast('error', 'Update failed', error.message)
    } finally { setSaving(false) }
  }

  const createQr = async () => {
    const branchId = qrBranch || activeBranchId || (isDeveloper ? branches?.[0]?.id : null)
    if (!branchId) return showToast('error', 'Branch required', 'Select a branch for this QR code')
    if (qrKind === 'delivery') {
      const existingDelivery = qrRows.find(q => q.branch_id === branchId && q.qr_kind === 'delivery' && q.active)
      if (existingDelivery) return showToast('error', 'Delivery QR already exists', 'Each branch can have only one active delivery complaint QR.')
    }
    if (qrKind === 'table' && !tableNumber.trim()) return showToast('error', 'Table number required', 'Enter the table number')

    setQrLoading(true)
    try {
      const payload = {
        branch_id: branchId,
        qr_kind: qrKind,
        customer_id: null,
        table_number: qrKind === 'table' ? tableNumber.trim() : null,
        label: qrLabel.trim() || (qrKind === 'table' ? `Table ${tableNumber.trim()}` : 'Delivery Complaint QR'),
        created_by: user?.id || null,
      }
      const { data, error } = await supabase.from('complaint_qr_codes').insert(payload).select('*, branches(name)').single()
      if (error) throw error
      setQrRows(prev => [data, ...prev])
      setTableNumber(''); setCustomerId(''); setQrLabel('')
      showToast('success', 'QR created', 'Print the QR and place it where customers can scan it')
    } catch (error) {
      showToast('error', 'Could not create QR', error.message)
    } finally { setQrLoading(false) }
  }

  const deactivateQr = async qr => {
    if (!canManage) return
    if (!window.confirm(`Deactivate this ${qr.qr_kind} QR?`)) return
    const { error } = await supabase.from('complaint_qr_codes').update({ active: false }).eq('id', qr.id)
    if (error) return showToast('error', 'QR update failed', error.message)
    setQrRows(prev => prev.map(x => x.id === qr.id ? { ...x, active: false } : x))
    showToast('success', 'QR deactivated', 'The old QR will no longer accept submissions')
  }

  const printQr = qr => {
    const popup = window.open('', '_blank', 'width=520,height=700')
    if (!popup) return
    popup.document.write(`<!doctype html><html><head><title>Stocko QR</title><style>body{font-family:Arial;text-align:center;padding:40px}img{width:320px;height:320px}h1{font-size:24px;margin:10px 0}p{color:#555}</style></head><body><h1>${String(qr.label || qr.table_number || 'Stocko').replaceAll('<','&lt;')}</h1><p>Scan to submit a complaint or feedback</p><img src="${qrImageUrl(qr.token)}" onload="window.print()"><p>${qr.branches?.name || ''}</p></body></html>`)
    popup.document.close()
  }

  const clearFilters = () => { setStatus('All'); setEntryType('All'); setOrderType('All'); setFrom(''); setTo(''); setSearch('') }

  return (
    <div className="animate-fade-in responsive-page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:18}}>
        <div><h2 style={{fontSize:20,fontWeight:800,color:theme.text,margin:0}}>Complaints & Feedback</h2><p style={{fontSize:12,color:theme.textMuted,margin:'5px 0 0'}}>Customer issues are routed to their branch automatically.</p></div>
        <div style={{display:'flex',gap:8}}><Btn variant={tab==='complaints'?'primary':'outline'} onClick={()=>setTab('complaints')}><Ic n="MessageSquare" size={14}/> Complaints</Btn><Btn variant={tab==='qrs'?'primary':'outline'} onClick={()=>setTab('qrs')}><Ic n="QrCode" size={14}/> QR Codes</Btn></div>
      </div>

      {tab === 'complaints' ? (
        <>
          <Card style={{padding:14,marginBottom:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:9}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search complaint, order, customer…" style={inputStyle(theme)}/>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={inputStyle(theme)}><option>All</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
              <select value={entryType} onChange={e=>setEntryType(e.target.value)} style={inputStyle(theme)}><option>All</option><option>Complaint</option><option>Feedback</option></select>
              <select value={orderType} onChange={e=>setOrderType(e.target.value)} style={inputStyle(theme)}><option>All</option><option>Delivery</option><option>Dine-in</option></select>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inputStyle(theme)}/>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={inputStyle(theme)}/>
              <Btn variant="outline" onClick={clearFilters}>Clear filters</Btn>
              <Btn variant="outline" onClick={loadComplaints}><Ic n="RefreshCw" size={14}/> Refresh</Btn>
            </div>
          </Card>
          <Card style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'13px 15px',borderBottom:`1px solid ${theme.border}`,fontSize:13,fontWeight:700,color:theme.text}}>{filteredRows.length} records</div>
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Complaint','Branch','Type','Order / Table','Customer','Category','Status','Date'].map(h=><th key={h} style={thStyle(theme)}>{h}</th>)}</tr></thead><tbody>
              {loading ? <tr><td colSpan="8" style={emptyStyle(theme)}>Loading complaints…</td></tr> : filteredRows.length===0 ? <tr><td colSpan="8" style={emptyStyle(theme)}>No complaints match these filters.</td></tr> : filteredRows.map(r=><tr key={r.id} onClick={()=>openDetails(r)} style={{cursor:'pointer',borderBottom:`1px solid ${theme.border}`}}>
                <td style={tdStyle(theme)}><strong>#{r.complaint_no}</strong><div style={{fontSize:10,color:theme.textMuted}}>{r.entry_type}</div></td>
                <td style={tdStyle(theme)}>{r.branches?.name || '—'}</td>
                <td style={tdStyle(theme)}>{String(r.order_type || (r.table_number?'dine-in':'delivery')).replaceAll('_',' ')}</td>
                <td style={tdStyle(theme)}>{r.order_reference || (r.table_number ? `Table ${r.table_number}` : '—')}</td>
                <td style={tdStyle(theme)}>{r.customer_name || 'Anonymous'}{r.customer_phone && <div style={{fontSize:10,color:theme.textMuted}}>{r.customer_phone}</div>}</td>
                <td style={tdStyle(theme)}>{r.category}</td>
                <td style={tdStyle(theme)}><StatusBadge status={r.status} theme={theme}/></td>
                <td style={{...tdStyle(theme),whiteSpace:'nowrap'}}>{fmtDate(r.created_at)}</td>
              </tr>)}
            </tbody></table></div>
          </Card>
        </>
      ) : (
        <>
          {canManage && <Card style={{padding:16,marginBottom:14}}><h3 style={{margin:'0 0 12px',fontSize:15,color:theme.text}}>Create complaint QR</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,alignItems:'end'}}>
            <Field label="QR type"><select value={qrKind} onChange={e=>setQrKind(e.target.value)} style={inputStyle(theme)}><option value="table">Dine-in Table QR</option><option value="delivery">Delivery Branch QR</option></select></Field>
            {(isMaster || isDeveloper) && <Field label="Branch"><select value={qrBranch} onChange={e=>setQrBranch(e.target.value)} style={inputStyle(theme)}><option value="">Select branch</option>{(branches||[]).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
            {qrKind==='table' ? <Field label="Table number"><input value={tableNumber} onChange={e=>setTableNumber(e.target.value)} placeholder="e.g. 12" style={inputStyle(theme)}/></Field> : <Field label="Branch delivery QR"><div style={{fontSize:12,color:theme.textMuted,padding:'9px 10px',border:`1px solid ${theme.border}`,borderRadius:9}}>One QR per branch · customer enters order number</div></Field>}
            <Field label="Label (optional)"><input value={qrLabel} onChange={e=>setQrLabel(e.target.value)} placeholder={qrKind==='table'?'Table 12':'Delivery Complaint QR'} style={inputStyle(theme)}/></Field>
            <Btn variant="primary" onClick={createQr} disabled={qrLoading}>{qrLoading?'Creating…':'Create QR'}</Btn>
          </div></Card>}
          <Card style={{padding:0,overflow:'hidden'}}><div style={{padding:'13px 15px',borderBottom:`1px solid ${theme.border}`,fontSize:13,fontWeight:700,color:theme.text}}>QR codes</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:12,padding:15}}>
            {qrRows.length===0 ? <div style={{color:theme.textMuted,fontSize:13,padding:20}}>No QR codes yet.</div> : qrRows.map(q=><div key={q.id} style={{border:`1px solid ${theme.border}`,borderRadius:14,padding:14,opacity:q.active?1:.55}}><div style={{textAlign:'center'}}><img src={qrImageUrl(q.token)} alt={q.label || 'Complaint QR'} style={{width:170,height:170,maxWidth:'100%'}}/></div><div style={{fontWeight:800,color:theme.text,textAlign:'center',marginTop:8}}>{q.label || q.table_number || 'Customer QR'}</div><div style={{fontSize:11,color:theme.textMuted,textAlign:'center',marginTop:3}}>{q.branches?.name} · {q.qr_kind === 'table' ? `Table ${q.table_number}` : 'Delivery branch QR'}</div><div style={{fontSize:9,color:theme.textMuted,textAlign:'center',marginTop:4,wordBreak:'break-all'}}>{qrUrl(q.token)}</div><div style={{display:'flex',gap:7,marginTop:10}}><Btn variant="outline" onClick={()=>printQr(q)} style={{flex:1}}><Ic n="Printer" size={13}/> Print</Btn>{q.active && canManage && <Btn variant="outline" onClick={()=>deactivateQr(q)} style={{color:theme.danger}}><Ic n="X" size={13}/> Deactivate</Btn>}</div></div>)}
          </div></Card>
        </>
      )}

      {selected && <div onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div onClick={e=>e.stopPropagation()} style={{background:theme.cardBg,border:`1px solid ${theme.border}`,borderRadius:16,width:'100%',maxWidth:680,maxHeight:'90vh',overflow:'auto',padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><div style={{fontSize:11,color:theme.textMuted}}>Complaint #{selected.complaint_no}</div><h3 style={{margin:'3px 0',fontSize:18,color:theme.text}}>{selected.category}</h3></div><button onClick={()=>setSelected(null)} style={{border:0,background:'transparent',fontSize:20,color:theme.textMuted,cursor:'pointer'}}>✕</button></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,margin:'16px 0'}}>{[['Branch',selected.branches?.name],['Type',selected.order_type || (selected.table_number?'Dine-in':'Delivery')],['Order',selected.order_reference || '—'],['Table',selected.table_number || '—'],['Customer',selected.customer_name || 'Anonymous'],['Phone',selected.customer_phone || '—'],['Rating',selected.rating ? `${selected.rating}/5` : '—'],['Submitted',fmtDate(selected.created_at)]].map(([k,v])=><div key={k} style={{background:theme.subtle,borderRadius:10,padding:10}}><div style={{fontSize:10,color:theme.textMuted}}>{k}</div><div style={{fontSize:12,fontWeight:700,color:theme.text,marginTop:3}}>{v}</div></div>)}</div>
        <div style={{padding:13,border:`1px solid ${theme.border}`,borderRadius:10,color:theme.text,fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{selected.description}</div>
        {canManage && <div style={{marginTop:14}}><label style={{fontSize:12,fontWeight:700,color:theme.text}}>Manager notes</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...inputStyle(theme),width:'100%',resize:'vertical',marginTop:5}} placeholder="Resolution notes…"/><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:10}}>{STATUSES.map(s=><Btn key={s} variant={selected.status===s?'primary':'outline'} onClick={()=>updateStatus(s)} disabled={saving}>{s}</Btn>)}</div></div>}
        <div style={{marginTop:18}}><h4 style={{margin:'0 0 8px',fontSize:13,color:theme.text}}>Status history</h4>{history.length===0?<div style={{fontSize:12,color:theme.textMuted}}>No status changes recorded yet.</div>:history.map(h=><div key={h.id} style={{padding:'8px 0',borderBottom:`1px solid ${theme.border}`,fontSize:12,color:theme.text}}><strong>{h.old_status || 'Created'} → {h.new_status}</strong><span style={{color:theme.textMuted,marginLeft:8}}>{fmtDate(h.changed_at)}</span>{h.notes&&<div style={{color:theme.textMuted,marginTop:2}}>{h.notes}</div>}</div>)}</div>
      </div></div>}
    </div>
  )
}

function Field({label,children}){return <div><label style={{display:'block',fontSize:11,fontWeight:700,marginBottom:5}}>{label}</label>{children}</div>}
function StatusBadge({status,theme}){const map={Open:[theme.rejected,theme.rejectedText], 'In Progress':[theme.pending,theme.pendingText],Resolved:[theme.completed,theme.completedText],Closed:[theme.approved,theme.approvedText],Rejected:[theme.rejected,theme.rejectedText]};const [bg,color]=map[status]||[theme.subtle,theme.text];return <span style={{padding:'4px 8px',borderRadius:20,background:bg,color,fontSize:10,fontWeight:800,whiteSpace:'nowrap'}}>{status}</span>}
const inputStyle=theme=>({width:'100%',boxSizing:'border-box',padding:'9px 10px',borderRadius:9,border:`1px solid ${theme.inputBorder}`,background:theme.inputBg,color:theme.text,fontSize:12,outline:'none'})
const thStyle=theme=>({textAlign:'left',padding:'11px 10px',background:theme.tableHeaderBg,color:theme.tableHeaderText,fontSize:10,textTransform:'uppercase',letterSpacing:.4,whiteSpace:'nowrap'})
const tdStyle=theme=>({padding:'11px 10px',color:theme.text,verticalAlign:'top'})
const emptyStyle=theme=>({padding:40,textAlign:'center',color:theme.textMuted})
