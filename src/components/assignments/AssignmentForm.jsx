import { useEffect, useMemo, useRef, useState } from 'react'
import { Ic, Btn } from '../ui'
import { useApp } from '../../context/AppContext'

const DAYS = [
  ['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun'],
]
const RECURRENCE = [
  ['daily','Daily'],['weekly','Weekly'],['one_time','One time'],
]
const PRIORITIES = ['Low','Medium','High','Urgent']

// Assignment staff are intentionally shown in this order.
// Keep the order stable so the dropdown feels predictable for every user.
const STAFF_GROUPS = [
  { key:'manager', label:'Managers', roles:['manager'] },
  { key:'kitchen', label:'Kitchen Staff', roles:['kitchen staff','kitchen_staff','kitchen'] },
  { key:'store', label:'Store Keepers', roles:['store keeper','store_keeper','storekeeper'] },
]

const EMPTY = {
  title:'', description:'', assignee_ids:[], branch_id:'', priority:'Medium', recurrence:'daily',
  scheduled_date:'', start_time:'', deadline_time:'', time_limit_minutes:30, start_date:'', end_date:'',
  days_of_week:[], require_note:false, require_photo:false, active:true,
}

function normalizeRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function staffGroupFor(person) {
  const role = normalizeRole(person?.role || person?.role_name || person?.user_role)
  return STAFF_GROUPS.find(group => group.roles.includes(role)) || null
}

function personName(person) {
  return person?.name || person?.full_name || person?.fullName || person?.email || person?.id || 'Unknown'
}

function ids(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  return [...new Set(raw
    .map(x => typeof x === 'object' ? (x.id || x.user_id || '') : x)
    .map(String)
    .filter(Boolean))]
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

export default function AssignmentForm({ initialValue=null, users=[], branches=[], user=null, userRole='', loading=false, submitLabel='Create Task', onSubmit, onCancel }) {
  const { theme } = useApp()
  const [form,setForm] = useState(() => normalize(initialValue))
  const [search,setSearch] = useState('')
  const [error,setError] = useState('')
  const [staffOpen,setStaffOpen] = useState(false)
  const staffRef = useRef(null)
  const editing = Boolean(initialValue?.id)

  useEffect(() => { setForm(normalize(initialValue)); setSearch(''); setError(''); setStaffOpen(false) }, [initialValue])

  useEffect(() => {
    const close = event => {
      if (staffRef.current && !staffRef.current.contains(event.target)) setStaffOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const normalizedRole = normalizeRole(userRole || user?.role || user?.role_name)
  const isDeveloper = normalizedRole === 'developer'
  const selectedBranchId = String(form.branch_id || user?.branch_id || '')

  const staffOptions = useMemo(() => {
    const q = search.trim().toLowerCase()

    return (Array.isArray(users) ? users : [])
      .filter(Boolean)
      .filter(x => x.active !== false)
      .filter(x => Boolean(staffGroupFor(x)))
      // Developers can assign across every branch. Other roles stay in the
      // current branch.
      .filter(x => {
        if (isDeveloper) return true
        const staffBranch = String(x?.branch_id || x?.branchId || '')
        return !selectedBranchId || !staffBranch || staffBranch === selectedBranchId
      })
      .filter(x => !q || `${personName(x)} ${x.email || ''} ${x.role || x.role_name || ''}`.toLowerCase().includes(q))
  }, [users, search, isDeveloper, selectedBranchId])

  const branchName = person => {
    const branchId = String(person?.branch_id || person?.branchId || '')
    const branch = (Array.isArray(branches) ? branches : []).find(b => String(b?.id) === branchId)
    return branch?.name || branchId || 'Unassigned branch'
  }

  const groupedStaff = useMemo(() => {
    if (!isDeveloper) {
      return STAFF_GROUPS.map(group => ({
        ...group,
        people: staffOptions.filter(person => group.roles.includes(normalizeRole(person?.role || person?.role_name || person?.user_role))),
      })).filter(group => group.people.length)
    }

    const map = new Map()
    staffOptions.forEach(person => {
      const key = String(person?.branch_id || person?.branchId || 'unassigned')
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(person)
    })

    const roleOrder = role => {
      const value = normalizeRole(role)
      if (value === 'manager') return 0
      if (value === 'kitchen staff' || value === 'kitchen') return 1
      return 2
    }

    return [...map.entries()]
      .map(([key, people]) => ({
        key: `branch-${key}`,
        label: branchName(people[0]),
        people: [...people].sort((a, b) =>
          roleOrder(a?.role || a?.role_name || a?.user_role) -
          roleOrder(b?.role || b?.role_name || b?.user_role) ||
          personName(a).localeCompare(personName(b))
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [staffOptions, isDeveloper, branches])

  const selectedPeople = useMemo(() => {
    const selected = new Set(form.assignee_ids.map(String))
    return (Array.isArray(users) ? users : []).filter(x => selected.has(String(x?.id)))
  }, [users, form.assignee_ids])

  const set = (key,value) => setForm(p=>({...p,[key]:value}))

  const toggle = id => {
    const value = String(id)
    set('assignee_ids', form.assignee_ids.includes(value)
      ? form.assignee_ids.filter(x => x !== value)
      : [...form.assignee_ids, value])
  }

  const selectGroup = people => {
    const idsToAdd = people.map(person => String(person.id)).filter(Boolean)
    set('assignee_ids', [...new Set([...form.assignee_ids, ...idsToAdd])])
  }

  const clearGroup = people => {
    const remove = new Set(people.map(person => String(person.id)))
    set('assignee_ids', form.assignee_ids.filter(id => !remove.has(String(id))))
  }

  const submit = async e => {
    e.preventDefault(); setError('')
    if (!form.title.trim()) return setError('Task title is required.')
    if (!form.assignee_ids.length) return setError('Select at least one staff member.')
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
      <div style={{fontSize:11.5,color:muted,marginTop:3}}>Assign one task to one or many staff members. Each selected person gets their own checklist and completion record.</div>
    </div>
    {error && <div style={{padding:10,borderRadius:9,background:'#fef3f2',color:'#b42318',fontSize:12,fontWeight:700}}>{error}</div>}

    <label><span style={label}>Task title</span><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Check kitchen stock before closing" style={input}/></label>
    <label><span style={label}>Instructions / description</span><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3} placeholder="What exactly should the staff member check or report?" style={{...input,resize:'vertical'}}/></label>

    <div ref={staffRef} style={{position:'relative'}}>
      <span style={label}>{isDeveloper ? 'Assign to staff across all branches' : 'Assign to staff'}</span>
      <button type="button" onClick={()=>setStaffOpen(v=>!v)} style={{...input,display:'flex',alignItems:'center',justifyContent:'space-between',textAlign:'left',cursor:'pointer',minHeight:46}}>
        <span style={{minWidth:0}}>
          {selectedPeople.length
            ? <><b>{selectedPeople.length} staff selected</b><span style={{display:'block',fontSize:10.5,color:muted,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{selectedPeople.slice(0,3).map(personName).join(', ')}{selectedPeople.length > 3 ? ` +${selectedPeople.length-3} more` : ''}</span></>
            : <span style={{color:muted}}>Select one or multiple staff members…</span>}
        </span>
        <Ic n={staffOpen ? 'ChevronUp' : 'ChevronDown'} size={16}/>
      </button>

      {staffOpen && <div style={{position:'absolute',zIndex:50,left:0,right:0,top:'100%',marginTop:5,border:`1px solid ${border}`,borderRadius:11,background:theme?.cardBg||'#fff',boxShadow:'0 14px 35px rgba(16,24,40,.16)',overflow:'hidden'}}>
        <div style={{padding:9,borderBottom:`1px solid ${border}`}}>
          <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder={isDeveloper ? "Search staff across all branches…" : "Search staff by name, role or email…"} style={{...input,minHeight:36}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#f8fafc',fontSize:11.5,color:muted}}>
          <b>{form.assignee_ids.length} selected</b>
          <div style={{display:'flex',gap:6}}>
            <button type="button" onClick={()=>set('assignee_ids',staffOptions.map(x=>String(x.id)))} style={mini}>Select visible</button>
            <button type="button" onClick={()=>set('assignee_ids',[])} style={mini}>Clear all</button>
          </div>
        </div>
        <div style={{maxHeight:310,overflow:'auto'}}>
          {groupedStaff.length === 0 && <div style={{padding:18,textAlign:'center',fontSize:12,color:muted}}>No eligible staff found.</div>}
          {groupedStaff.map(group => {
            const groupSelected = group.people.filter(person => form.assignee_ids.includes(String(person.id))).length
            return <div key={group.key}>
              <div style={{position:'sticky',top:0,zIndex:2,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',background:'#f1f5f9',borderTop:`1px solid ${border}`,borderBottom:`1px solid ${border}`}}>
                <span style={{fontSize:11,fontWeight:850,color:text}}>{group.label} <span style={{color:muted}}>({group.people.length})</span></span>
                <div style={{display:'flex',gap:5}}>
                  <button type="button" onClick={()=>selectGroup(group.people)} style={mini}>Select</button>
                  {groupSelected > 0 && <button type="button" onClick={()=>clearGroup(group.people)} style={mini}>Clear</button>}
                </div>
              </div>
              {group.people.map(person => {
                const id=String(person.id)
                const selected=form.assignee_ids.includes(id)
                return <button key={id} type="button" onClick={()=>toggle(id)} style={{width:'100%',border:0,borderBottom:`1px solid ${border}`,background:selected?'#eef2ff':theme?.cardBg||'#fff',padding:'10px 11px',display:'flex',alignItems:'center',gap:10,textAlign:'left',cursor:'pointer',color:text}}>
                  <span style={{width:21,height:21,borderRadius:6,border:`1px solid ${selected?'#6366f1':'#cbd5e1'}`,background:selected?'#6366f1':'transparent',display:'grid',placeItems:'center',color:'#fff',flex:'0 0 auto'}}>{selected&&<Ic n="Check" size={14}/>}</span>
                  <span style={{minWidth:0,flex:1}}><b style={{fontSize:12.5}}>{personName(person)}</b><span style={{display:'block',fontSize:10.5,color:muted,marginTop:2}}>{person.role || person.role_name || 'Staff'}{person.email?` · ${person.email}`:''}</span></span>
                </button>
              })}
            </div>
          })}
        </div>
        <div style={{padding:9,borderTop:`1px solid ${border}`,display:'flex',justifyContent:'flex-end'}}><Btn type="button" onClick={()=>setStaffOpen(false)}>Done</Btn></div>
      </div>}
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
      <label><span style={label}>{isDeveloper ? 'Task home branch' : 'Branch'}</span><select disabled={!isDeveloper} value={form.branch_id || user?.branch_id || ''} onChange={e=>{set('branch_id',e.target.value);set('assignee_ids',[])}} style={{...input,opacity:isDeveloper?1:.75,cursor:isDeveloper?'pointer':'not-allowed'}}><option value="">Current branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name||b.id}</option>)}</select>{isDeveloper && <small style={{display:'block',marginTop:5,fontSize:10.5,color:muted}}>This is the task's home branch. You can still assign it to staff from any branch above.</small>}</label>
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
