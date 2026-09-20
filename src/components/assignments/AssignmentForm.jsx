import { useEffect, useMemo, useState } from 'react'
import { Ic, Btn } from '../ui'
import { useApp } from '../../context/AppContext'

const DAYS = [
  ['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun'],
]
const RECURRENCE = [
  ['daily','Daily'],['weekly','Weekly'],['one_time','One time'],
]
const PRIORITIES = ['Low','Medium','High','Urgent']

const EMPTY = {
  title:'', description:'', assignee_ids:[], branch_id:'', priority:'Medium', recurrence:'daily',
  scheduled_date:'', start_time:'', deadline_time:'', time_limit_minutes:30, start_date:'', end_date:'',
  days_of_week:[], require_note:false, require_photo:false, active:true,
}

function ids(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  return [...new Set(raw.map(x => typeof x === 'object' ? (x.id || x.user_id || '') : x).map(String).filter(Boolean))]
}

function normalize(source) {
  const x = source || {}
  return {
    ...EMPTY, ...x,
    title:x.title || x.name || '',
    description:x.description || '',
    assignee_ids:ids(x.assignee_ids ?? x.assigned_to ?? x.assigned_manager_ids),
    branch_id:x.branch_id || x.branchId || '',
    priority:PRIORITIES.includes(x.priority) ? x.priority : 'Medium',
    recurrence:RECURRENCE.some(([v]) => v === x.recurrence) ? x.recurrence : 'daily',
    scheduled_date:x.scheduled_date || '',
    start_time:x.start_time || x.scheduled_time || '',
    deadline_time:x.deadline_time || '',
    time_limit_minutes:Number(x.time_limit_minutes) > 0 ? Number(x.time_limit_minutes) : 30,
    start_date:x.start_date || '', end_date:x.end_date || '',
    days_of_week:Array.isArray(x.days_of_week) ? x.days_of_week : [],
    require_note:Boolean(x.require_note), require_photo:Boolean(x.require_photo), active:x.active !== false,
  }
}

export default function AssignmentForm({ initialValue=null, users=[], branches=[], user=null, loading=false, submitLabel='Create Task', onSubmit, onCancel }) {
  const { theme } = useApp()
  const [form,setForm] = useState(() => normalize(initialValue))
  const [search,setSearch] = useState('')
  const [error,setError] = useState('')
  const editing = Boolean(initialValue?.id)

  useEffect(() => { setForm(normalize(initialValue)); setSearch(''); setError('') }, [initialValue])

  const options = useMemo(() => {
    const q=search.trim().toLowerCase()
    return (Array.isArray(users)?users:[]).filter(Boolean).filter(x => x.active !== false).filter(x => !q || `${x.name||x.full_name||''} ${x.email||''} ${x.role||''}`.toLowerCase().includes(q))
  },[users,search])

  const set = (key,value) => setForm(p=>({...p,[key]:value}))
  const toggle = id => set('assignee_ids', form.assignee_ids.includes(String(id)) ? form.assignee_ids.filter(x=>x!==String(id)) : [...form.assignee_ids,String(id)])

  const submit = async e => {
    e.preventDefault(); setError('')
    if (!form.title.trim()) return setError('Task title is required.')
    if (!form.assignee_ids.length) return setError('Select at least one user.')
    if ((form.recurrence === 'one_time') && !form.scheduled_date) return setError('Select the task date.')
    if (form.recurrence === 'weekly' && !form.days_of_week.length) return setError('Select at least one day.')
    if (form.start_date && form.end_date && form.end_date < form.start_date) return setError('End date cannot be before start date.')
    await onSubmit?.({ ...form, title:form.title.trim(), description:form.description.trim(), assigned_to:form.assignee_ids })
  }

  const input={width:'100%',boxSizing:'border-box',minHeight:40,border:`1px solid ${theme?.border||'#dbe3ef'}`,borderRadius:9,padding:'9px 11px',background:theme?.inputBg||theme?.cardBg||'#fff',color:theme?.text||'#172033',outline:'none',fontSize:13}
  const label={fontSize:11.5,fontWeight:750,color:theme?.textMuted||'#667085',display:'block',marginBottom:6}
  const text=theme?.text||'#101828'; const muted=theme?.textMuted||'#667085'; const border=theme?.border||'#e4e7ec'

  return <form onSubmit={submit} style={{display:'grid',gap:16,color:text}}>
    <div style={{padding:14,borderRadius:12,background:'#f8fafc',border:`1px solid ${border}`}}>
      <div style={{fontSize:16,fontWeight:800}}>{editing?'Edit task':'Create task'}</div>
      <div style={{fontSize:11.5,color:muted,marginTop:3}}>Assign one task to one or many users. Each user gets their own daily checklist and completion record.</div>
    </div>
    {error && <div style={{padding:10,borderRadius:9,background:'#fef3f2',color:'#b42318',fontSize:12,fontWeight:700}}>{error}</div>}

    <label><span style={label}>Task title</span><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Check kitchen stock before closing" style={input}/></label>
    <label><span style={label}>Instructions / description</span><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3} placeholder="What exactly should the user check or report?" style={{...input,resize:'vertical'}}/></label>

    <div>
      <span style={label}>Assign to users</span>
      <div style={{border:`1px solid ${border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:8,borderBottom:`1px solid ${border}`}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search any user, role or email…" style={{...input,minHeight:36}}/></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#f8fafc',fontSize:11.5,color:muted}}>
          <b>{form.assignee_ids.length} selected</b>
          <div style={{display:'flex',gap:6}}><button type="button" onClick={()=>set('assignee_ids',options.map(x=>String(x.id)))} style={mini}>Select visible</button><button type="button" onClick={()=>set('assignee_ids',[])} style={mini}>Clear</button></div>
        </div>
        <div style={{maxHeight:230,overflow:'auto'}}>{options.map(x=>{const id=String(x.id);const selected=form.assignee_ids.includes(id);return <button key={id} type="button" onClick={()=>toggle(id)} style={{width:'100%',border:0,borderBottom:`1px solid ${border}`,background:selected?'#eef2ff':theme?.cardBg||'#fff',padding:'10px 11px',display:'flex',alignItems:'center',gap:10,textAlign:'left',cursor:'pointer',color:text}}><span style={{width:21,height:21,borderRadius:6,border:`1px solid ${selected?'#6366f1':'#cbd5e1'}`,background:selected?'#6366f1':'transparent',display:'grid',placeItems:'center',color:'#fff'}}>{selected&&<Ic n="Check" size={14}/>}</span><span style={{minWidth:0,flex:1}}><b style={{fontSize:12.5}}>{x.name||x.full_name||x.email||id}</b><span style={{display:'block',fontSize:10.5,color:muted,marginTop:2}}>{x.role||x.role_name||'User'}{x.email?` · ${x.email}`:''}</span></span></button>})}</div>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
      <label><span style={label}>Branch</span><select value={form.branch_id || user?.branch_id || ''} onChange={e=>set('branch_id',e.target.value)} style={input}><option value="">Current branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name||b.id}</option>)}</select></label>
      <label><span style={label}>Priority</span><select value={form.priority} onChange={e=>set('priority',e.target.value)} style={input}>{PRIORITIES.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span style={label}>Repeat</span><select value={form.recurrence} onChange={e=>set('recurrence',e.target.value)} style={input}>{RECURRENCE.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    </div>

    {form.recurrence === 'one_time' && <label><span style={label}>Task date</span><input type="date" value={form.scheduled_date} onChange={e=>set('scheduled_date',e.target.value)} style={input}/></label>}
    {form.recurrence === 'weekly' && <div><span style={label}>Days</span><div style={{display:'flex',flexWrap:'wrap',gap:7}}>{DAYS.map(([v,l])=><button type="button" key={v} onClick={()=>set('days_of_week',form.days_of_week.includes(v)?form.days_of_week.filter(x=>x!==v):[...form.days_of_week,v])} style={{...mini,padding:'8px 10px',background:form.days_of_week.includes(v)?'#eef2ff':'transparent',color:form.days_of_week.includes(v)?'#4338ca':muted,borderColor:form.days_of_week.includes(v)?'#a5b4fc':border}}>{l}</button>)}</div></div>}

    <div style={{padding:13,borderRadius:11,background:'#f8fafc',border:`1px solid ${border}`}}>
      <div style={{fontSize:12.5,fontWeight:800,marginBottom:10}}>Reporting window</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
        <label><span style={label}>Start time</span><input type="time" value={form.start_time} onChange={e=>set('start_time',e.target.value)} style={input}/></label>
        <label><span style={label}>Last time to report</span><input type="time" value={form.deadline_time} onChange={e=>set('deadline_time',e.target.value)} style={input}/></label>
        <label><span style={label}>Allowed minutes</span><input type="number" min="1" value={form.time_limit_minutes} onChange={e=>set('time_limit_minutes',e.target.value)} style={input}/></label>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
      <label><span style={label}>Start date</span><input type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)} style={input}/></label>
      <label><span style={label}>End date</span><input type="date" value={form.end_date} onChange={e=>set('end_date',e.target.value)} style={input}/></label>
    </div>

    <div style={{display:'grid',gap:8}}>
      <label style={check}><input type="checkbox" checked={form.require_note} onChange={e=>set('require_note',e.target.checked)}/><span><b>Require completion note</b><small>User must add a report/note before checking.</small></span></label>
      <label style={check}><input type="checkbox" checked={form.require_photo} onChange={e=>set('require_photo',e.target.checked)}/><span><b>Require photo proof</b><small>User must attach a picture before checking.</small></span></label>
      <label style={check}><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/><span><b>Active task</b><small>Inactive tasks disappear from the daily checklist.</small></span></label>
    </div>

    <div style={{display:'flex',justifyContent:'flex-end',gap:8,borderTop:`1px solid ${border}`,paddingTop:14}}><Btn variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Btn><Btn type="submit" disabled={loading}>{loading?<><Ic n="Loader2" size={15}/> Saving…</>:<><Ic n="CheckCircle" size={15}/>{submitLabel}</>}</Btn></div>
  </form>
}

const mini={border:'1px solid #d0d5dd',background:'transparent',borderRadius:7,padding:'5px 8px',fontSize:10.5,fontWeight:750,cursor:'pointer'}
const check={display:'flex',gap:9,alignItems:'flex-start',fontSize:12,cursor:'pointer'}
