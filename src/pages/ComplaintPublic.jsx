import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Food Quality','Food Safety','Service','Staff','Cleanliness','Delivery','Billing','Other']
const styles = {
  page:{minHeight:'100dvh',background:'linear-gradient(135deg,#f8fafc,#eef2ff)',display:'flex',alignItems:'center',justifyContent:'center',padding:18,fontFamily:'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',color:'#111827'},
  card:{width:'100%',maxWidth:560,background:'#fff',border:'1px solid #e5e7eb',borderRadius:20,boxShadow:'0 18px 60px rgba(15,23,42,.12)',padding:'28px 24px'},
  input:{width:'100%',boxSizing:'border-box',padding:'12px 13px',border:'1px solid #d1d5db',borderRadius:10,fontSize:14,outline:'none',background:'#fff'},
  label:{display:'block',fontSize:12,fontWeight:700,marginBottom:6,color:'#374151'},
}

export default function ComplaintPublic({token}){
  const [qr,setQr]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState('')
  const [form,setForm]=useState({entry_type:'complaint',order_reference:'',category:'Other',description:'',rating:5,customer_name:'',customer_phone:''})
  const [submitting,setSubmitting]=useState(false), [result,setResult]=useState(null)

  useEffect(()=>{
    let alive=true
    supabase.rpc('get_complaint_qr',{p_token:token}).then(({data,error:err})=>{
      if(!alive)return
      if(err){setError(err.message);setLoading(false);return}
      const row=Array.isArray(data)?data[0]:data
      if(!row){setError('This QR code is invalid or inactive.');setLoading(false);return}
      setQr(row);setLoading(false)
      if(row.qr_kind==='table')setForm(f=>({...f,customer_name:'',customer_phone:''}))
      if(row.qr_kind==='delivery' && row.customer_name)setForm(f=>({...f,customer_name:row.customer_name}))
    })
    return()=>{alive=false}
  },[token])

  const submit=async e=>{
    e.preventDefault();setError('')
    if(!form.description.trim())return setError('Please describe the complaint or feedback.')
    if(qr.qr_kind==='delivery'&&!form.order_reference.trim())return setError('Order number is required for delivery complaints.')
    setSubmitting(true)
    const {data,error:err}=await supabase.rpc('submit_customer_complaint',{p_token:token,p_order_reference:form.order_reference.trim()||null,p_entry_type:form.entry_type,p_category:form.category,p_description:form.description.trim(),p_rating:Number(form.rating)||null,p_customer_name:form.customer_name.trim()||null,p_customer_phone:form.customer_phone.trim()||null})
    setSubmitting(false)
    if(err){setError(err.message);return}
    if(data?.duplicate){setResult(data);return}
    if(!data?.success){setError(data?.message||'Could not submit your request.');return}
    setResult(data)
  }

  if(loading)return <div style={styles.page}><div style={styles.card}><div style={{textAlign:'center',padding:30}}>Loading…</div></div></div>
  if(error&&!qr)return <div style={styles.page}><div style={styles.card}><h1 style={{fontSize:22,marginTop:0}}>Stocko</h1><p style={{color:'#dc2626',lineHeight:1.6}}>{error}</p></div></div>
  if(result)return <div style={styles.page}><div style={styles.card}><div style={{textAlign:'center'}}><div style={{fontSize:48}}>✓</div><h1 style={{fontSize:24,margin:'8px 0'}}>Thank you</h1><p style={{color:'#4b5563',lineHeight:1.6}}>{result.duplicate?'An active complaint already exists for this order.':'Your complaint/feedback has been submitted successfully.'}</p><div style={{background:'#f1f5f9',borderRadius:12,padding:14,marginTop:18}}><div style={{fontSize:11,color:'#64748b'}}>Reference</div><strong style={{fontSize:18}}>#{result.complaint_no}</strong><div style={{fontSize:12,color:'#64748b',marginTop:4}}>Status: {result.status}</div></div></div></div></div>

  const isTable=qr.qr_kind==='table'
  return <div style={styles.page}><div style={styles.card}>
    <div style={{textAlign:'center',marginBottom:22}}><div style={{fontSize:12,fontWeight:800,color:'#4f46e5',letterSpacing:1,textTransform:'uppercase'}}>Stocko Customer Care</div><h1 style={{fontSize:25,margin:'8px 0 5px'}}>Complaint & Feedback</h1><p style={{fontSize:13,color:'#64748b',margin:0}}>{qr.branch_name}{isTable&&` · Table ${qr.table_number}`}</p></div>
    {error&&<div style={{background:'#fef2f2',color:'#b91c1c',border:'1px solid #fecaca',borderRadius:10,padding:10,fontSize:13,marginBottom:14}}>{error}</div>}
    <form onSubmit={submit}>
      <div style={{marginBottom:14}}><label style={styles.label}>What would you like to submit?</label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{[['complaint','Complaint'],['feedback','Feedback']].map(([v,l])=><button type="button" key={v} onClick={()=>setForm(f=>({...f,entry_type:v}))} style={{padding:11,borderRadius:10,border:`2px solid ${form.entry_type===v?'#4f46e5':'#e5e7eb'}`,background:form.entry_type===v?'#eef2ff':'#fff',color:'#111827',fontWeight:700,cursor:'pointer'}}>{l}</button>)}</div></div>
      <div style={{marginBottom:14}}><label style={styles.label}>{isTable?'Order Number (Optional)':'Order Number *'}</label><input value={form.order_reference} onChange={e=>setForm(f=>({...f,order_reference:e.target.value}))} placeholder="Enter invoice / order number" style={styles.input} required={!isTable}/>{isTable&&<div style={{fontSize:11,color:'#64748b',marginTop:5}}>Table {qr.table_number} was detected automatically from this QR.</div>}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}><div><label style={styles.label}>Name (Optional)</label><input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} style={styles.input} placeholder="Your name"/></div><div><label style={styles.label}>Phone (Optional)</label><input value={form.customer_phone} onChange={e=>setForm(f=>({...f,customer_phone:e.target.value}))} style={styles.input} placeholder="03xx…"/></div></div>
      <div style={{marginBottom:14}}><label style={styles.label}>Category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={styles.input}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div style={{marginBottom:14}}><label style={styles.label}>Rating</label><div style={{display:'flex',gap:4}}>{[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>setForm(f=>({...f,rating:n}))} style={{border:0,background:'transparent',fontSize:30,cursor:'pointer',opacity:n<=form.rating?1:.25}}>★</button>)}</div></div>
      <div style={{marginBottom:18}}><label style={styles.label}>Complaint / Feedback *</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={6} placeholder="Tell us what happened…" style={{...styles.input,resize:'vertical'}} required/></div>
      <button disabled={submitting} style={{width:'100%',padding:13,border:0,borderRadius:11,background:'#4f46e5',color:'#fff',fontWeight:800,fontSize:14,cursor:submitting?'wait':'pointer',opacity:submitting?.7:1}}>{submitting?'Submitting…':'Submit '+(form.entry_type==='feedback'?'Feedback':'Complaint')}</button>
    </form>
    <div style={{textAlign:'center',fontSize:10,color:'#94a3b8',marginTop:14}}>Powered by Stocko</div>
  </div></div>
}
