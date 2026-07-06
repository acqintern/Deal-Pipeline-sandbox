// app/crm.jsx — CRM view: searchable/sortable contacts table, side panel, CSV import/export
const { useState: useSC, useMemo: useMC, useRef: useRC, useEffect: useEC } = React;

/* ── CSV helpers ── */
function parseCSVRow(row){
  const result=[]; let cur='', inQ=false;
  for(let i=0;i<row.length;i++){
    const c=row[i];
    if(c==='"'){ inQ=!inQ; }
    else if(c===','&&!inQ){ result.push(cur); cur=''; }
    else { cur+=c; }
  }
  result.push(cur);
  return result;
}
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  if(lines.length<2) return [];
  const headers=parseCSVRow(lines[0]).map(h=>h.trim().toLowerCase().replace(/"/g,''));
  return lines.slice(1).map(line=>{
    const vals=parseCSVRow(line);
    const obj={};
    headers.forEach((h,i)=>{ obj[h]=(vals[i]||'').replace(/"/g,'').trim(); });
    return obj;
  }).filter(r=>Object.values(r).some(v=>v));
}
function buildCSV(contacts){
  const headers=['Contact Name','Firm','Title','Email','Phone','Markets Covered','Last Activity','Notes'];
  const esc=v=>`"${(v||'').replace(/"/g,'""')}"`;
  const rows=contacts.map(c=>[c.name,c.firm,c.title,c.email,c.phone,c.markets,c.lastActivity,c.notes].map(esc).join(','));
  return [headers.join(','),...rows].join('\n');
}

/* ── Table column config ── */
const CRM_COLS = [
  { key:'name',         label:'Contact',        defW:210, sortable:true  },
  { key:'firm',         label:'Firm',           defW:160, sortable:true  },
  { key:'title',        label:'Title',          defW:160, sortable:true  },
  { key:'email',        label:'Email',          defW:240, sortable:false },
  { key:'phone',        label:'Phone',          defW:130, sortable:false },
  { key:'markets',      label:'Markets',        defW:150, sortable:false },
  { key:'dealCount',    label:'Deals Sent',     defW:100, align:'right', sortable:true },
  { key:'lastActivity', label:'Last Activity',  defW:128, sortable:true  },
];
const LS_CRM_W = 'altus.crm.colw.v1';
const DEFAULT_CRM_W = CRM_COLS.reduce((o,c)=>{ o[c.key]=c.defW; return o; },{});

/* ── Linked-deal chip in side panel ── */
function DealChip({ d, onOpen }){
  const meta = STAGE_META[d.stage];
  return (
    <button onClick={()=>onOpen(d.id)} style={{
      display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%',
      border:'1px solid var(--line)', borderLeft:`3px solid ${meta.c}`,
      borderRadius:8, padding:'9px 12px', background:'var(--panel)',
      cursor:'pointer', textAlign:'left', transition:'background .1s' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--accent-soft)'}
      onMouseLeave={e=>e.currentTarget.style.background='var(--panel)'}>
      <div style={{ minWidth:0, flex:1 }}>
        <div className="clip" style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>{d.name}</div>
        <div style={{ fontSize:11.5, color:'var(--muted)', marginTop:1, fontWeight:400 }}>{d.market}</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flex:'none', marginLeft:12 }}>
        <span className="num" style={{ fontSize:12.5, fontWeight:600, color:'var(--ink)' }}>{fmtShort(d.askPrice)}</span>
        <StageBadge stage={d.stage} size="sm" dot={false}/>
      </div>
    </button>
  );
}

/* ── Editable field row ── */
function CField({ label, children, span }){
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:4, gridColumn:span?'1/-1':'auto' }}>
      <span style={{ fontSize:10.5, fontWeight:600, color:'var(--muted)', letterSpacing:'.04em', textTransform:'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}
const cIn = { border:'1px solid var(--line-2)', borderRadius:7, height:34, padding:'0 10px',
  fontSize:13, background:'var(--panel)', outline:'none', color:'var(--ink)', width:'100%', boxSizing:'border-box' };
const focusStyle = e=>{ e.target.style.borderColor='var(--accent)'; e.target.style.boxShadow='0 0 0 3px var(--accent-soft)'; };
const blurStyle  = e=>{ e.target.style.borderColor='var(--line-2)'; e.target.style.boxShadow='none'; };

/* ── Contact side panel ── */
function ContactDrawer({ contact, deals, onClose, onPatchContact, onOpenDeal }){
  useEC(()=>{
    const esc=e=>{ if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown',esc);
    return ()=>window.removeEventListener('keydown',esc);
  },[]);

  const set = (k,v) => onPatchContact(contact.id,{ [k]:v });

  // Match deals by explicit OM linkage (dealIds), contactId, email, or last-name match on broker field
  const ids = Array.isArray(contact.dealIds) ? contact.dealIds : [];
  const lastName = (contact.name||'').trim().split(' ').pop().toLowerCase();
  const linkedDeals = deals.filter(d=>
    ids.includes(d.id) ||
    (d.contactId && d.contactId===contact.id) ||
    (contact.email && (d.broker||'').toLowerCase().includes(contact.email.toLowerCase())) ||
    (lastName.length>2 && new RegExp('\\b'+lastName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(d.broker||''))
  );

  const FIELDS = [
    { key:'name',     label:'Name',             type:'text'  },
    { key:'firm',     label:'Firm',             type:'text'  },
    { key:'title',    label:'Title',            type:'text', span:true },
    { key:'email',    label:'Email',            type:'email', span:true },
    { key:'phone',    label:'Phone',            type:'tel'   },
    { key:'markets',  label:'Markets Covered',  type:'text'  },
    { key:'property', label:'Property Name',    type:'text'  },
  ];

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, pointerEvents:'none' }}>

      <div style={{ position:'absolute', top:0, right:0, bottom:0, width:'min(500px,95vw)', pointerEvents:'auto',
        background:'var(--bg)', boxShadow:'-10px 0 36px rgba(11,25,45,.16)',
        animation:'drawerIn .26s cubic-bezier(.2,.7,.2,1) both', display:'flex', flexDirection:'column', zIndex:1 }}>

        {/* Sticky header */}
        <div style={{ background:'rgba(245,247,250,.95)', backdropFilter:'blur(10px)',
          borderBottom:'1px solid var(--line)', padding:'12px 18px', flex:'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={onClose} style={{ border:'1px solid var(--line-2)', background:'var(--panel)',
              borderRadius:7, width:30, height:30, display:'inline-flex', alignItems:'center',
              justifyContent:'center', color:'var(--slate)', cursor:'pointer', flex:'none' }}>
              <Icon name="close" size={14}/>
            </button>
            <Avatar name={contact.name} size={32}/>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 className="clip" style={{ margin:0, fontSize:15, fontWeight:600, color:'var(--ink)' }}>
                {contact.name||'Unnamed contact'}
              </h2>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:1, fontWeight:400 }}>{contact.firm||''}</div>
            </div>
            {linkedDeals.length>0 && (
              <span style={{ fontSize:12, color:'var(--accent)', background:'var(--accent-soft)',
                borderRadius:6, padding:'3px 9px', fontWeight:600, flex:'none' }} className="num">
                {linkedDeals.length} deal{linkedDeals.length!==1?'s':''}
              </span>
            )}
          </div>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'16px 18px 40px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Contact info card */}
          <div style={{ background:'var(--panel)', border:'1px solid var(--line)',
            borderRadius:'var(--radius-lg)', padding:'16px', boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:10.5, fontWeight:600, color:'var(--muted)', letterSpacing:'.05em',
              textTransform:'uppercase', marginBottom:13 }}>Contact Info</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'11px 13px' }}>
              {FIELDS.map(f=>(
                <CField key={f.key} label={f.label} span={f.span}>
                  <input type={f.type} value={contact[f.key]||''} onChange={e=>set(f.key,e.target.value)}
                    style={cIn} onFocus={focusStyle} onBlur={blurStyle}/>
                </CField>
              ))}
            </div>
            <div style={{ marginTop:13 }}>
              <CField label="Notes">
                <textarea value={contact.notes||''} onChange={e=>set('notes',e.target.value)}
                  placeholder="Relationship notes, preferences, context…"
                  style={{ ...cIn, height:'auto', minHeight:76, padding:'9px 10px', resize:'vertical',
                    lineHeight:1.55, fontFamily:'var(--font)', background:'var(--panel-2)' }}
                  onFocus={e=>{ e.target.style.borderColor='var(--accent)'; e.target.style.background='var(--panel)'; }}
                  onBlur={e=>{ e.target.style.borderColor='var(--line-2)'; e.target.style.background='var(--panel-2)'; }}/>
              </CField>
            </div>
            <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid var(--line)',
              display:'flex', gap:18, fontSize:11.5, color:'var(--faint)' }}>
              <span>Added {fmtDate(contact.dateAdded)}</span>
              {contact.lastActivity && <span>Last activity {fmtDate(contact.lastActivity)}</span>}
            </div>
          </div>

          {/* Linked deals */}
          <div>
            <div style={{ fontSize:10.5, fontWeight:600, color:'var(--muted)', letterSpacing:'.05em',
              textTransform:'uppercase', marginBottom:10 }}>
              Deals Sent · {linkedDeals.length}
            </div>
            {linkedDeals.length===0 ? (
              <div style={{ padding:'22px 16px', textAlign:'center', color:'var(--muted)', fontSize:13,
                background:'var(--panel)', borderRadius:'var(--radius-lg)', border:'1px solid var(--line)',
                fontStyle:'italic', fontWeight:400 }}>
                No linked deals yet
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {linkedDeals.map(d=>(
                  <DealChip key={d.id} d={d} onOpen={id=>{ onOpenDeal(id); onClose(); }}/>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Add contact modal ── */
function AddContactModal({ onClose, onAdd, deals = [] }){
  const [f, setF] = useSC({ name:'', firm:'', title:'', email:'', phone:'', markets:'', property:'', notes:'', dealIds:[] });
  const [dealSearch, setDealSearch] = useSC('');
  const set = (k,v)=>setF(s=>({...s,[k]:v}));
  const ref = useRC(null);
  useEC(()=>{
    ref.current?.focus();
    const esc=e=>{ if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown',esc);
    return ()=>window.removeEventListener('keydown',esc);
  },[]);
  const valid = f.name.trim().length>0 || f.email.trim().length>0;
  const submit = ()=>{
    if(!valid) return;
    onAdd({ id:'c-'+Date.now(), name:f.name.trim(), firm:f.firm.trim(),
      title:f.title.trim(), email:f.email.trim(), phone:f.phone.trim(), markets:f.markets.trim(),
      property:f.property.trim(), notes:f.notes, dealIds: f.dealIds,
      dateAdded:window.ALTUS_TODAY, lastActivity:window.ALTUS_TODAY });
    onClose();
  };
  const FIELDS = [
    { key:'name',     label:'Name',          type:'text',  ref:ref },
    { key:'firm',     label:'Firm',          type:'text'   },
    { key:'title',    label:'Title',         type:'text',  span:true },
    { key:'email',    label:'Email',         type:'email', span:true },
    { key:'phone',    label:'Phone',         type:'tel'    },
    { key:'markets',  label:'Markets',       type:'text'   },
    { key:'property', label:'Property Name', type:'text'   },
  ];
  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, display:'flex', alignItems:'flex-start',
      justifyContent:'center', padding:'8vh 16px' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(11,25,45,.45)',
        animation:'scrimIn .18s ease both' }}/>
      <div style={{ position:'relative', width:'min(480px,100%)', background:'var(--bg)',
        borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)',
        animation:'modalIn .22s cubic-bezier(.2,.7,.2,1) both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 18px', borderBottom:'1px solid var(--line)' }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:600, color:'var(--ink)' }}>Add contact</h3>
          <button onClick={onClose} style={{ border:'none', background:'var(--panel-2)', borderRadius:7,
            width:28, height:28, display:'inline-flex', alignItems:'center', justifyContent:'center',
            color:'var(--slate)', cursor:'pointer' }}><Icon name="close" size={14}/></button>
        </div>
        <div style={{ padding:'15px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'11px 12px' }}>
          {FIELDS.map(fi=>(
            <CField key={fi.key} label={fi.label} span={fi.span}>
              <input ref={fi.ref} type={fi.type||'text'} value={f[fi.key]}
                onChange={e=>set(fi.key,e.target.value)} style={cIn}
                onFocus={focusStyle} onBlur={blurStyle}/>
            </CField>
          ))}
          {deals.length > 0 && (
            <CField label="Link to Deals" span>
              <div style={{ border:'1px solid var(--line-2)', borderRadius:8, background:'var(--panel-2)',
                overflow:'hidden', transition:'border-color .12s' }}>
                <input value={dealSearch} onChange={e=>setDealSearch(e.target.value)}
                  placeholder="Search deals…" style={{ ...cIn, border:'none', borderBottom:'1px solid var(--line-2)',
                    borderRadius:0, background:'transparent', width:'100%', boxSizing:'border-box' }}
                  onFocus={e=>e.target.parentNode.style.borderColor='var(--accent)'}
                  onBlur={e=>e.target.parentNode.style.borderColor='var(--line-2)'} />
                <div style={{ maxHeight:140, overflowY:'auto', padding:'4px 0' }}>
                  {deals
                    .filter(d=>!dealSearch || d.name.toLowerCase().includes(dealSearch.toLowerCase()))
                    .map(d=>(
                      <label key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px',
                        cursor:'pointer', background: f.dealIds.includes(d.id)?'var(--accent-soft)':'transparent' }}>
                        <input type="checkbox" checked={f.dealIds.includes(d.id)}
                          onChange={e=>set('dealIds', e.target.checked
                            ? [...f.dealIds, d.id]
                            : f.dealIds.filter(x=>x!==d.id))}
                          style={{ accentColor:'var(--accent)', flex:'none' }} />
                        <span style={{ fontSize:12.5, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                      </label>
                    ))}
                  {deals.filter(d=>!dealSearch||d.name.toLowerCase().includes(dealSearch.toLowerCase())).length===0 &&
                    <div style={{ padding:'8px 10px', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No matching deals</div>}
                </div>
                {f.dealIds.length>0 && (
                  <div style={{ borderTop:'1px solid var(--line-2)', padding:'4px 10px',
                    fontSize:11, color:'var(--accent)', fontWeight:500 }}>
                    {f.dealIds.length} deal{f.dealIds.length!==1?'s':''} linked
                  </div>
                )}
              </div>
            </CField>
          )}
          <CField label="Notes" span>
            <textarea value={f.notes} onChange={e=>set('notes',e.target.value)}
              placeholder="Optional notes…"
              style={{ ...cIn, height:'auto', minHeight:68, padding:'8px 10px', resize:'vertical',
                lineHeight:1.55, fontFamily:'var(--font)', background:'var(--panel-2)' }}
              onFocus={e=>{ e.target.style.borderColor='var(--accent)'; e.target.style.background='var(--panel)'; }}
              onBlur={e=>{ e.target.style.borderColor='var(--line-2)'; e.target.style.background='var(--panel-2)'; }}/>
          </CField>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'11px 18px',
          borderTop:'1px solid var(--line)' }}>
          <button onClick={onClose} style={{ height:34, padding:'0 13px', border:'1px solid var(--line-2)',
            borderRadius:7, background:'var(--panel)', fontSize:13, fontWeight:500,
            color:'var(--slate)', cursor:'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={!valid} style={{ height:34, padding:'0 14px', border:'none',
            borderRadius:7, background:valid?'var(--accent)':'var(--line-2)', color:'#fff',
            fontSize:13, fontWeight:600, cursor:valid?'pointer':'not-allowed',
            display:'inline-flex', alignItems:'center', gap:5 }}>
            <Icon name="plus" size={13}/> Add contact
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main CRM view ── */
function CRMView({ contacts, deals, onAddContact, onPatchContact, onOpenDeal }){
  const [q, setQ]             = useSC('');
  const [sortKey, setSortKey] = useSC('lastActivity');
  const [sortDir, setSortDir] = useSC('desc');
  const [openId, setOpenId]   = useSC(null);
  const [adding, setAdding]   = useSC(false);
  const importRef             = useRC(null);

  /* ── resizable column widths (Notion-style), persisted ── */
  const [colW, setColW] = useSC(()=>{
    try{ const s = JSON.parse(localStorage.getItem(LS_CRM_W)); return (s && typeof s==='object') ? {...DEFAULT_CRM_W, ...s} : {...DEFAULT_CRM_W}; }
    catch(e){ return {...DEFAULT_CRM_W}; }
  });
  useEC(()=>{ try{ localStorage.setItem(LS_CRM_W, JSON.stringify(colW)); }catch(e){} },[colW]);
  const startResize = (key, e)=>{
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startW = colW[key];
    const onMove = ev=> setColW(w=>({ ...w, [key]: Math.max(70, startW + (ev.clientX - startX)) }));
    const onUp = ()=>{
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor=''; document.body.style.userSelect='';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor='col-resize'; document.body.style.userSelect='none';
  };

  /* compute deal count per contact */
  const dealCountFor = useMC(()=>{
    const map = {};
    contacts.forEach(c=>{
      const ids = Array.isArray(c.dealIds) ? c.dealIds : [];
      const lastName = (c.name||'').trim().split(' ').pop().toLowerCase();
      map[c.id] = deals.filter(d=>
        ids.includes(d.id) ||
        (d.contactId && d.contactId===c.id) ||
        (c.email && (d.broker||'').toLowerCase().includes(c.email.toLowerCase())) ||
        (lastName.length>2 && new RegExp('\\b'+lastName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(d.broker||''))
      ).length;
    });
    return map;
  },[contacts, deals]);

  const filtered = useMC(()=>{
    let rows = contacts.map(c=>({...c, _dc: dealCountFor[c.id]||0 }));
    if(q){
      const lq=q.toLowerCase();
      rows=rows.filter(c=>
        (c.name||'').toLowerCase().includes(lq)||
        (c.firm||'').toLowerCase().includes(lq)||
        (c.email||'').toLowerCase().includes(lq)||
        (c.markets||'').toLowerCase().includes(lq)
      );
    }
    rows.sort((a,b)=>{
      const sk = sortKey==='dealCount'?'_dc':sortKey;
      const av=a[sk]??'', bv=b[sk]??'';
      if(typeof av==='number'||typeof bv==='number'){
        return sortDir==='asc'?(av-bv):(bv-av);
      }
      return sortDir==='asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return rows;
  },[contacts,q,sortKey,sortDir,dealCountFor]);

  const handleSort = key=>{
    if(sortKey===key) setSortDir(d=>d==='asc'?'desc':'asc');
    else{ setSortKey(key); setSortDir('asc'); }
  };

  const exportCSV = ()=>{
    const csv = buildCSV(contacts);
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download='altus-contacts.csv'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const importCSV = file=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const rows = parseCSV(e.target.result);
      rows.forEach(row=>{
        const name  = row['contact name']||row['name']||'';
        const email = row['email']||'';
        if(!name && !email) return;
        onAddContact({
          id:'c-'+Date.now()+Math.random().toString(36).slice(2,5),
          name, firm:row['firm']||'', title:row['title']||'', email, phone:row['phone']||'',
          markets:row['markets covered']||row['markets']||'',
          notes:row['notes']||'', dealIds:[],
          dateAdded:window.ALTUS_TODAY,
          lastActivity:row['last activity']||window.ALTUS_TODAY,
        });
      });
    };
    reader.readAsText(file);
  };

  const openContact = contacts.find(c=>c.id===openId);
  const grid = CRM_COLS.map((c,i)=> i===CRM_COLS.length-1 ? `minmax(${colW[c.key]}px,1fr)` : `${colW[c.key]}px`).join(' ');

  return (
    <div className="fade" style={{ padding:'22px 28px 60px', maxWidth:1380, margin:'0 auto' }}>

      {/* Page header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:20, gap:12, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ margin:0, fontSize:19, fontWeight:600, color:'var(--ink)', letterSpacing:'-.01em' }}>CRM</h2>
          <p style={{ margin:'3px 0 0', fontSize:12.5, color:'var(--muted)', fontWeight:400 }}>
            {contacts.length} contact{contacts.length!==1?'s':''} · auto-populated from OM uploads
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input ref={importRef} type="file" accept=".csv,text/csv" style={{ display:'none' }}
            onChange={e=>{ const f=e.target.files[0]; if(f) importCSV(f); e.target.value=''; }}/>
          <button onClick={()=>importRef.current.click()} style={{ display:'inline-flex', alignItems:'center', gap:6,
            height:34, padding:'0 12px', border:'1px solid var(--line-2)', borderRadius:7,
            background:'var(--panel)', fontSize:12.5, fontWeight:500, color:'var(--slate)', cursor:'pointer' }}>
            <Icon name="upload" size={13}/> Import CSV
          </button>
          <button onClick={exportCSV} disabled={contacts.length===0} style={{ display:'inline-flex', alignItems:'center', gap:6,
            height:34, padding:'0 12px', border:'1px solid var(--line-2)', borderRadius:7,
            background:'var(--panel)', fontSize:12.5, fontWeight:500,
            color:contacts.length===0?'var(--faint)':'var(--slate)', cursor:contacts.length===0?'default':'pointer' }}>
            <Icon name="arrowD" size={13}/> Export CSV
          </button>
          <button onClick={()=>setAdding(true)} style={{ display:'inline-flex', alignItems:'center', gap:6,
            height:34, padding:'0 13px', border:'none', borderRadius:7, background:'var(--accent)',
            color:'#fff', fontSize:12.5, fontWeight:600, cursor:'pointer',
            boxShadow:'0 1px 3px rgba(16,30,50,.2)' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--accent-2)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--accent)'}>
            <Icon name="plus" size={13}/> Add contact
          </button>
        </div>
      </div>

      {/* Search + count */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--panel)',
          border:'1px solid var(--line-2)', borderRadius:8, padding:'0 11px', height:36,
          minWidth:230, flex:'0 1 300px' }}>
          <Icon name="search" size={14} style={{ color:'var(--muted)' }}/>
          <input value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Search name, firm, email, market…"
            style={{ border:'none', outline:'none', background:'transparent', flex:1, fontSize:13 }}/>
          {q && <button onClick={()=>setQ('')} style={{ border:'none', background:'transparent',
            color:'var(--muted)', padding:2, cursor:'pointer' }}><Icon name="close" size={12}/></button>}
        </div>
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--faint)', fontWeight:400 }} className="num">
          {filtered.length} of {contacts.length}
        </span>
      </div>

      {/* Table */}
      <div style={{ background:'var(--panel)', border:'1px solid var(--line)',
        borderRadius:'var(--radius-lg)', overflowX:'auto', boxShadow:'var(--shadow)' }}>

        {/* Column headers */}
        <div style={{ display:'grid', gridTemplateColumns:grid, padding:'0 16px',
          background:'var(--panel-2)', borderBottom:'1px solid var(--line)', position:'sticky', top:0, zIndex:3 }}>
          {CRM_COLS.map((c,ci)=>(
            <div key={c.key} onClick={c.sortable?()=>handleSort(c.key):undefined}
              style={{ padding:'9px 8px', fontSize:10.5, fontWeight:600, letterSpacing:'.04em',
                textTransform:'uppercase', color:sortKey===c.key?'var(--accent)':'var(--muted)',
                textAlign:c.align||'left', cursor:c.sortable?'pointer':'default',
                display:'flex', alignItems:'center', gap:4, userSelect:'none', position:'relative',
                justifyContent:c.align==='right'?'flex-end':'flex-start' }}>
              {c.label}
              {c.sortable && sortKey===c.key && <Icon name={sortDir==='asc'?'arrowU':'arrowD'} size={10}/>}
              {ci<CRM_COLS.length-1 && (
                <div onMouseDown={e=>startResize(c.key,e)} onClick={e=>e.stopPropagation()}
                  title="Drag to resize"
                  style={{ position:'absolute', top:0, right:-5, width:11, height:'100%', cursor:'col-resize', zIndex:5 }}
                  onMouseEnter={e=>{ const b=e.currentTarget.firstChild; if(b) b.style.background='var(--accent)'; }}
                  onMouseLeave={e=>{ const b=e.currentTarget.firstChild; if(b) b.style.background='transparent'; }}>
                  <div style={{ position:'absolute', right:5, top:'18%', height:'64%', width:2, background:'transparent', borderRadius:2, transition:'background .1s' }}/>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length===0 && (
          <div style={{ padding:'64px 24px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12, color:'var(--faint)' }}>◎</div>
            <div style={{ fontSize:14, fontWeight:500, color:'var(--ink)', marginBottom:5 }}>
              {contacts.length===0 ? 'No contacts yet' : 'No contacts match'}
            </div>
            <div style={{ fontSize:12.5, color:'var(--muted)', maxWidth:360, margin:'0 auto', lineHeight:1.6 }}>
              {contacts.length===0
                ? 'Contacts are auto-created when you upload an OM with broker info on the Pipeline tab, or add them manually here.'
                : 'Try a different search term.'}
            </div>
          </div>
        )}

        {/* Rows */}
        {filtered.map((c,i)=>(
          <div key={c.id} onClick={()=>setOpenId(c.id)} style={{
            display:'grid', gridTemplateColumns:grid, alignItems:'center',
            padding:'0 16px', minHeight:46, cursor:'pointer',
            borderBottom: i<filtered.length-1 ? '1px solid var(--line)' : 'none',
            background:i%2===1?'var(--panel-2)':'var(--panel)',
            transition:'background .1s' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--accent-soft)'}
            onMouseLeave={e=>e.currentTarget.style.background=i%2===1?'var(--panel-2)':'var(--panel)'}>

            {/* Name */}
            <div style={{ padding:'9px 8px', display:'flex', alignItems:'center', gap:8 }}>
              <Avatar name={c.name} size={26}/>
              <span className="clip" style={{ fontSize:13.5, fontWeight:600, color:'var(--ink)' }}>{c.name||'—'}</span>
            </div>
            {/* Firm */}
            <div className="clip" style={{ padding:'9px 8px', fontSize:13, color:'var(--slate)', fontWeight:400 }}>{c.firm||'—'}</div>
            {/* Title */}
            <div className="clip" style={{ padding:'9px 8px', fontSize:12.5, color:'var(--slate)', fontWeight:400 }}>{c.title||'—'}</div>
            {/* Email */}
            <div style={{ padding:'9px 8px' }}>
              {c.email
                ? <a href={`mailto:${c.email}`} onClick={e=>e.stopPropagation()}
                    style={{ fontSize:12.5, color:'var(--accent)', textDecoration:'none', fontWeight:400 }}
                    onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                    onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>{c.email}</a>
                : <span style={{ color:'var(--faint)', fontSize:12.5 }}>—</span>}
            </div>
            {/* Phone */}
            <div style={{ padding:'9px 8px', fontSize:12.5, color:'var(--slate)', fontWeight:400 }}>{c.phone||'—'}</div>
            {/* Markets */}
            <div className="clip" style={{ padding:'9px 8px', fontSize:12.5, color:'var(--slate)', fontWeight:400 }}>{c.markets||'—'}</div>
            {/* Deals sent */}
            <div style={{ padding:'9px 8px', textAlign:'right' }}>
              {c._dc>0
                ? <span className="num" style={{ fontSize:13, fontWeight:600, color:'var(--accent)',
                    background:'var(--accent-soft)', borderRadius:6, padding:'2px 9px' }}>{c._dc}</span>
                : <span style={{ color:'var(--faint)', fontSize:12.5 }}>—</span>}
            </div>
            {/* Last activity */}
            <div style={{ padding:'9px 8px', fontSize:12.5, color:'var(--muted)', fontWeight:400 }}>
              {fmtDate(c.lastActivity)||'—'}
            </div>
          </div>
        ))}
      </div>

      {/* Side panel */}
      {openContact && (
        <ContactDrawer
          contact={openContact} deals={deals}
          onClose={()=>setOpenId(null)}
          onPatchContact={onPatchContact}
          onOpenDeal={id=>{ onOpenDeal(id); setOpenId(null); }}/>
      )}

      {/* Add modal */}
      {adding && <AddContactModal onClose={()=>setAdding(false)} onAdd={onAddContact} deals={deals}/>}
    </div>
  );
}

window.CRMView = CRMView;
