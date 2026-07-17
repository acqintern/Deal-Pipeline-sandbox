// app/icmemo.jsx — IC Memo (Grove visual style)
const { useState: useSIC } = React;

// ─── Tokens (Grove palette) ───────────────────────────────────────────────────
const IC = {
  navy:  '#0d1f35',
  navy2: '#1b3e60',
  blue:  '#1f57c4',
  bg:    '#e9ecf3',
  panel: '#ffffff',
  line:  '#dde3ec',
  line2: '#edf0f7',
  muted: '#607080',
  faint: '#8fa0b2',
  pos:   '#096b38',
  neg:   '#c12828',
  warn:  '#a86800',
  gold:  '#c49010',
  sans:  'Inter,"Helvetica Neue",system-ui,sans-serif',
  serif: '"Lora",Georgia,serif',
  mono:  '"IBM Plex Mono",ui-monospace,monospace',
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const _m  = (v) => (v==null||isNaN(+v)) ? '—' : '$'+Math.round(+v).toLocaleString();
const _ms = (v) => {
  if (v==null||isNaN(+v)) return '—';
  const n=+v, a=Math.abs(n), s=n<0?'-':'';
  if (a>=1e9) return s+'$'+(a/1e9).toFixed(1)+'B';
  if (a>=1e6) return s+'$'+(a/1e6).toFixed(1)+'M';
  if (a>=1e3) return s+'$'+Math.round(a/1e3)+'K';
  return s+'$'+Math.round(a).toLocaleString();
};
const _p  = (v,d=1) => (v==null||isNaN(+v)) ? '—' : (+v*100).toFixed(d)+'%';
const _r  = (v,d=2) => (v==null||isNaN(+v)) ? '—' : (+v).toFixed(d)+'%';
const _x  = (v,d=2) => (v==null||isNaN(+v)) ? '—' : (+v).toFixed(d)+'x';
const _n  = (v,d=2) => (v==null||isNaN(+v)) ? '—' : (+v).toFixed(d);

// ─── Panel header ─────────────────────────────────────────────────────────────
function PanelHdr({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 11px',
      borderBottom:'1px solid '+IC.line, fontSize:10, fontWeight:700,
      letterSpacing:'.08em', textTransform:'uppercase', color:IC.navy,
      fontFamily:IC.sans, lineHeight:1.5 }}>
      {children}
    </div>
  );
}

// ─── Data row ─────────────────────────────────────────────────────────────────
function DR({ label, value, strong, sep }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'2px 11px', borderBottom:'1px solid '+IC.line2,
      borderTop: sep ? '1px solid '+IC.line : 'none' }}>
      <span style={{ fontSize:11, color:IC.muted }}>{label}</span>
      <span style={{ fontSize:11, fontWeight:strong?600:500, color:IC.navy,
        fontVariantNumeric:'tabular-nums' }}>{value}</span>
    </div>
  );
}

// ─── Metric cell ──────────────────────────────────────────────────────────────
function MetricCell({ label, value, color, last }) {
  return (
    <div style={{ padding:'0 10px', borderRight: last?'none':'1px solid '+IC.line2,
      display:'flex', flexDirection:'column' }}>
      <div style={{ marginBottom:2 }}>
        <span style={{ fontSize:8.5, fontWeight:600, letterSpacing:'.07em',
          textTransform:'uppercase', color:IC.muted, lineHeight:1.2, display:'block' }}>{label}</span>
      </div>
      <div style={{ fontSize:16, fontWeight:700, color:color||IC.navy, lineHeight:1,
        letterSpacing:'-.02em', fontVariantNumeric:'tabular-nums' }}>{value}</div>
    </div>
  );
}

// ─── Capital structure donut ──────────────────────────────────────────────────
function CapDonut({ uw, basis, deal }) {
  if (!uw) return null;
  const debt   = uw.acqProceeds||0;
  const equity = uw.initialEquity||(basis-debt);
  const total  = debt+equity; if (!total) return null;
  const eqPct  = equity/total;
  const r=40, stroke=11, cx=52, cy=52, size=104;
  const circ   = 2*Math.PI*r;
  const eqDash = eqPct*circ;
  const ltv    = uw.price>0 ? debt/uw.price : null;
  const stabRow = uw.rows ? uw.rows[Math.min(uw.stabYear||3,uw.hold)] : null;
  const dscr    = stabRow ? stabRow.dscr : null;
  const scenario = deal.acqFin && deal.acqFin.scenario;
  const finLabel = scenario && scenario!=='Custom' ? scenario : (uw.acqLabel==='Assumed debt' ? 'Assumable Loan' : uw.acqLabel);
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', padding:'4px 11px 6px' }}>
      <div style={{ flexShrink:0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={IC.navy} strokeWidth={stroke}
            strokeDasharray={`${eqDash} ${circ}`} strokeDashoffset={0}
            transform={`rotate(-90 ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={IC.blue} strokeWidth={stroke}
            strokeDasharray={`${circ-eqDash} ${circ}`} strokeDashoffset={-eqDash}
            transform={`rotate(-90 ${cx} ${cy})`} />
          <text x={cx} y={cy-5} textAnchor="middle" fontSize="7" fontWeight="700"
            fill={IC.faint} fontFamily={IC.sans} letterSpacing=".07em">TOTAL BASIS</text>
          <text x={cx} y={cy+9} textAnchor="middle" fontSize="13" fontWeight="700"
            fill={IC.navy} fontFamily={IC.sans}>{_ms(basis)}</text>
        </svg>
      </div>
      <div style={{ flex:1 }}>
        {[{ label:'Equity', amt:equity, pct:eqPct, col:IC.navy },
          { label:'Sr. Debt', amt:debt, pct:1-eqPct, col:IC.blue }].map(({ label,amt,pct,col }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:6,
            padding:'2px 0', borderBottom:'1px solid '+IC.line2 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:col, flexShrink:0 }}/>
            <span style={{ fontSize:10.5, color:IC.muted, flex:1 }}>{label}</span>
            <span style={{ fontSize:11, fontWeight:600, color:IC.navy, fontVariantNumeric:'tabular-nums' }}>
              {_ms(amt)}<span style={{ fontSize:9.5, color:IC.faint, marginLeft:3 }}>({_p(pct,0)})</span>
            </span>
          </div>
        ))}
        {uw.acqLoan && (
          [['Financing', finLabel||'—'],
           ['LTV', ltv!=null?_p(ltv):'—'],
           ['Interest Rate', (uw.acqLoan.rate*100).toFixed(2)+'%'],
           ['Amortization', Math.round(uw.acqLoan.amMonths/12)+' Yrs'],
           ['DSCR (Stab.)', dscr!=null?(_n(dscr)+'x'):'—']
          ].map(([l,v]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:6,
              padding:'2px 0', borderBottom:'1px solid '+IC.line2 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'transparent',
                border:'1.5px solid '+IC.line, flexShrink:0 }}/>
              <span style={{ fontSize:10.5, color:IC.muted, flex:1 }}>{l}</span>
              <span style={{ fontSize:11, fontWeight:600, color:IC.navy,
                fontVariantNumeric:'tabular-nums' }}>{v}</span>
            </div>
          ))
        )}
        {uw.refiOn && uw.refiLoan && (
          <div style={{ marginTop:4, paddingTop:4, borderTop:'1px dashed '+IC.line }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase',
              color:IC.blue, marginBottom:2 }}>Refinance — Year {uw.refiYear}</div>
            {[['Refi Proceeds', _ms(uw.refiProceeds)],
              ['Refi Rate', (uw.refiLoan.rate*100).toFixed(2)+'%'],
              ['Refi Amortization', Math.round(uw.refiLoan.amMonths/12)+' Yrs'],
              ['Cash-Out to Equity', _ms(uw.refiCashOut)]].map(([l,v]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:6,
                padding:'2px 0', borderBottom:'1px solid '+IC.line2 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'transparent',
                  border:'1.5px solid '+IC.line, flexShrink:0 }}/>
                <span style={{ fontSize:10.5, color:IC.muted, flex:1 }}>{l}</span>
                <span style={{ fontSize:11, fontWeight:600, color:IC.navy,
                  fontVariantNumeric:'tabular-nums' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scenario analysis ────────────────────────────────────────────────────────
function ScenarioAnalysis({ deal, uw }) {
  if (!uw) return (
    <div style={{ fontSize:10, color:IC.faint, fontStyle:'italic', padding:'8px 0' }}>
      Complete Full Underwriting to enable scenario analysis.
    </div>
  );

  const run = (ov) => { try { return window.computeScenario ? window.computeScenario(deal, ov) : null; } catch(e) { return null; } };

  // deal-level override fields are percent-scale numbers (e.g. 3 = 3%), while uw.* are decimals — convert before feeding back into computeScenario
  const gprPct  = (uw.gprGrowth||0.03)*100;
  const opexPct = (uw.opexGrowth||0.025)*100;
  const exitPct = (uw.exitCap||0.065)*100;
  const weakGpr = Math.max(0,gprPct-1), weakOpex = opexPct+1, weakExit = exitPct+0.5;
  const bestGpr = gprPct+1, bestOpex = Math.max(0,opexPct-0.5), bestExit = Math.max(4,exitPct-0.25);

  const scenarios = [
    { label:'WEAK', color:IC.neg,
      desc:`Rent ${weakGpr.toFixed(1)}% · OpEx ${weakOpex.toFixed(1)}% · Exit ${weakExit.toFixed(2)}%`,
      r: run({ gprGrowth:weakGpr, opexGrowth:weakOpex, exitCap:weakExit }) },
    { label:'BASE', color:IC.navy,
      desc:'Current underwriting assumptions',
      r: { dealIRR:uw.irr, equityMultiple:uw.equityMultiple, avgDealYield:uw.avgYield,
           lpIRR:null, avgLpYield:null, lpMultiple:null, gpPromote:null } },
    { label:'BEST', color:IC.pos,
      desc:`Rent ${bestGpr.toFixed(1)}% · OpEx ${bestOpex.toFixed(1)}% · Exit ${bestExit.toFixed(2)}%`,
      r: run({ gprGrowth:bestGpr, opexGrowth:bestOpex, exitCap:bestExit }) },
  ];

  // Augment BASE with LP data
  if (window.computeLP) {
    try {
      const lp = window.computeLP(uw, { pref:deal.lpPref, split:deal.lpSplit });
      if (lp) Object.assign(scenarios[1].r, {
        lpIRR:lp.lpIRR, avgLpYield:lp.avgLpYield, lpMultiple:lp.lpMultiple, gpPromote:lp.gpPromote
      });
    } catch(e) {}
  }

  const hasLP = scenarios.some(s => s.r && s.r.lpIRR != null);
  const hasGP = scenarios.some(s => s.r && s.r.gpPromote != null);

  const scColors = [IC.neg, IC.navy, IC.pos];
  const irrColor = (r) => r&&r.dealIRR!=null ? (r.dealIRR>=.18?IC.pos:r.dealIRR<.12?IC.neg:IC.warn) : IC.navy;
  const lpIrrColor = (r) => r&&r.lpIRR!=null ? (r.lpIRR>=.15?IC.pos:r.lpIRR<.1?IC.neg:IC.warn) : IC.navy;

  const ROWS = [
    { type:'section', label:'DEAL & LP RETURNS' },
    { type:'row', label:'Deal IRR',           fmt:(r,i)=>r&&r.dealIRR!=null?_p(r.dealIRR):'—',        colorFn:irrColor, bold:true },
    { type:'row', label:'Avg Deal Yield',      fmt:(r,i)=>r&&(r.avgDealYield||r.avgCOC)!=null?_p(r.avgDealYield||r.avgCOC):'—', scIdx:true },
    { type:'row', label:'Equity Multiple',     fmt:(r,i)=>r&&r.equityMultiple!=null?_x(r.equityMultiple):'—', scIdx:true },
    ...(hasLP ? [
      { type:'row', label:'LP IRR',             fmt:(r,i)=>r&&r.lpIRR!=null?_p(r.lpIRR):'—',          colorFn:lpIrrColor, bold:true },
      { type:'row', label:'Avg LP Yield',        fmt:(r,i)=>r&&r.avgLpYield!=null?_p(r.avgLpYield):'—', scIdx:true },
      { type:'row', label:'LP Equity Multiple',  fmt:(r,i)=>r&&r.lpMultiple!=null?_x(r.lpMultiple):'—', scIdx:true },
    ] : []),
    ...(hasGP ? [
      { type:'section', label:'GP RETURNS' },
      { type:'row', label:'Total GP Promote',   fmt:(r,i)=>r&&r.gpPromote!=null?_m(r.gpPromote):'—',   scIdx:true },
    ] : []),
  ];

  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
      <thead>
        <tr>
          <th style={{ textAlign:'left', fontSize:9, fontWeight:700, letterSpacing:'.08em',
            textTransform:'uppercase', color:IC.faint, padding:'0 0 4px', width:185 }}>Metric</th>
          {scenarios.map(s => (
            <th key={s.label} style={{ textAlign:'center', padding:'0 4px 3px' }}>
              <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.07em', color:s.color }}>{s.label}</div>
              <div style={{ fontSize:8.5, color:IC.faint, marginTop:1, lineHeight:1.3 }}>{s.desc}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row,i) => row.type==='section' ? (
          <tr key={i}>
            <td colSpan={4} style={{ background:IC.navy, color:'#fff', fontSize:9, fontWeight:700,
              letterSpacing:'.1em', textTransform:'uppercase', padding:'2.5px 9px' }}>
              <span style={{ display:'inline-block', width:8, height:8, borderRadius:2,
                background:IC.blue, marginRight:6, verticalAlign:'middle' }}/>
              {row.label}
            </td>
          </tr>
        ) : (
          <tr key={i}>
            <td style={{ fontSize:11.5, color:'#2b3d52', padding:'3px 0',
              borderBottom:'1px solid '+IC.line2 }}>{row.label}</td>
            {scenarios.map((s,si) => (
              <td key={s.label} style={{ textAlign:'center', padding:'3px 4px',
                borderBottom:'1px solid '+IC.line2, fontVariantNumeric:'tabular-nums',
                fontSize:row.bold?12:11.5, fontWeight:row.bold?700:600,
                color: row.colorFn ? row.colorFn(s.r) : scColors[si] }}>
                {row.fmt(s.r, si)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Return summary — Deal / LP / GP returns, incl. cash-flow split ────────────
function ReturnSummaryPanel({ uw, lp, caps }) {
  if (!uw) return (
    <div style={{ padding:'8px 11px', fontSize:9.5, color:IC.faint, fontStyle:'italic' }}>No UW data.</div>
  );
  const irrColor   = uw.irr!=null?(uw.irr>=.18?IC.pos:uw.irr<.12?IC.neg:IC.warn):IC.faint;
  const lpIrrColor = lp&&lp.lpIRR!=null?(lp.lpIRR>=.15?IC.pos:lp.lpIRR<.1?IC.neg:IC.warn):IC.faint;
  const lpProfit = lp ? (lp.lpDistTotal-lp.LPcap) : null;
  const rows = [
    ['Deal IRR', _p(uw.irr), true, false, irrColor],
    ['LP IRR', lp?_p(lp.lpIRR):'—', true, false, lpIrrColor],
    ['Deal Equity Multiple', _x(uw.equityMultiple), false, true],
    ['LP Equity Multiple', lp?_x(lp.lpMultiple):'—'],
    ['Deal Avg Yield', _p(uw.avgYield), false, true],
    ['LP Avg Yield', lp?_p(lp.avgLpYield):'—'],
    ['GP Total Profit', lp?_ms(lp.gpPromote):'—', false, true],
    ['LP Total Profit', lp?_ms(lpProfit):'—'],
    ['Total Profit', _ms(uw.profit), true, true],
    ['Going-In Cap', _p(caps.goingIn), false, true],
    ['Stabilized Cap (Yr '+(uw.stabYear||3)+')', _p(caps.stab)],
  ];
  return rows.map(([lbl,val,strong,sep,color],i) => (
    <div key={lbl} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'2px 11px', borderBottom:'1px solid '+IC.line2,
      borderTop: sep ? '1px solid '+IC.line : 'none' }}>
      <span style={{ fontSize:11, color:IC.muted }}>{lbl}</span>
      <span style={{ fontSize:11, fontWeight:strong?700:500, color:color||IC.navy,
        fontVariantNumeric:'tabular-nums' }}>{val}</span>
    </div>
  ));
}

// ─── Underwriting assumptions ─────────────────────────────────────────────────
function UWAssumptions({ uw }) {
  if (!uw) return null;
  const items = [
    { label:'Rent Growth',    val:_p(uw.gprGrowth)+' /yr' },
    { label:'Expense Growth', val:_p(uw.opexGrowth)+' /yr' },
    { label:'Stab. Vacancy',  val:_p(uw.stabVac) },
    { label:'Exit Cap Rate',  val:_r(uw.exitCap*100) },
    { label:'Hold Period',    val:uw.hold+' Years' },
  ];
  return (
    <div style={{ display:'flex' }}>
      {items.map((item,i) => (
        <div key={item.label} style={{ flex:1, textAlign:'center', padding:'6px 3px',
          borderRight: i<items.length-1 ? '1px solid '+IC.line : 'none' }}>
          <div style={{ fontSize:8, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase',
            color:IC.muted, marginBottom:2 }}>{item.label}</div>
          <div style={{ fontSize:12, fontWeight:700, color:IC.navy, lineHeight:1 }}>{item.val}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Operating forecast — Current + Y1..Y5, consistent color system ───────────
function OperatingForecast({ uw }) {
  if (!uw||!uw.rows) return null;
  const maxY = Math.min(uw.hold, 5);
  const curNOI = uw.egi0 - ((uw.rows[1]&&uw.rows[1].opex!=null)?uw.rows[1].opex:uw.opexBase);
  const cols = [{ label:'Current', noi:curNOI, netIncome:uw.rows[0].netIncome, cashOnCash:uw.rows[0].cashOnCash,
    yieldOnCost:uw.basis>0?curNOI/uw.basis:null, dscr:uw.rows[0].dscr, vac:uw.inPlaceEconVac, stab:false, isCur:true }];
  for (let y=1; y<=maxY; y++) {
    const row=uw.rows[y]; if(!row) continue;
    cols.push({ label:'Y'+y, noi:row.noi, netIncome:row.netIncome, cashOnCash:row.cashOnCash, yieldOnCost:row.yieldOnCost,
      dscr:row.dscr, vac:uw.econVacForYear?uw.econVacForYear(y):uw.stabVac, stab:y>=uw.stabYear });
  }
  if (cols.length<2) return null;
  const METRICS = [
    { label:'Economic Vacancy', fmt:(r)=>r.vac!=null?_p(r.vac,1):'—' },
    { label:'NOI ($M)',         fmt:(r)=>r.noi!=null?('$'+(r.noi/1e6).toFixed(2)+'M'):'—', bold:true },
    { label:'YOY Growth',       fmt:(r,i)=>{ if(i===0||!cols[i-1]||!cols[i-1].noi) return '—'; return _p((r.noi-cols[i-1].noi)/cols[i-1].noi,1); } },
    { label:'Net Income',       fmt:(r)=>r.netIncome!=null?('$'+(r.netIncome/1e6).toFixed(2)+'M'):'—' },
    { label:'DSCR',             fmt:(r)=>r.dscr!=null?_n(r.dscr)+'x':'—', bold:true },
    { label:'Total Yield',      fmt:(r)=>r.cashOnCash!=null?_p(r.cashOnCash,1):'—', bold:true },
    { label:'Yield on Cost',    fmt:(r)=>r.yieldOnCost!=null?_p(r.yieldOnCost,1):'—' },
  ];
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
      <thead>
        <tr>
          <th style={{ textAlign:'left', fontSize:8.5, fontWeight:700, letterSpacing:'.07em',
            textTransform:'uppercase', color:IC.faint, padding:'3px 7px 3px 0',
            borderBottom:'1.5px solid '+IC.line }}>Year</th>
          {cols.map(r => (
            <th key={r.label} style={{ textAlign:'right', fontSize:9.5, fontWeight:700,
              color:r.stab?IC.pos:r.isCur?IC.muted:IC.navy, padding:'3px 7px',
              borderBottom:'1.5px solid '+IC.line, fontVariantNumeric:'tabular-nums' }}>{r.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {METRICS.map(m => (
          <tr key={m.label}>
            <td style={{ fontSize:8.5, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase',
              color:IC.muted, padding:'4px 7px 4px 0', borderBottom:'1px solid '+IC.line2 }}>{m.label}</td>
            {cols.map((r,i) => (
              <td key={r.label} style={{ textAlign:'right', fontVariantNumeric:'tabular-nums',
                padding:'4px 7px', borderBottom:'1px solid '+IC.line2,
                fontSize:m.bold?12:11, fontWeight:m.bold?700:500,
                color:r.stab?IC.pos:IC.navy }}>
                {m.fmt(r,i)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Bullet ───────────────────────────────────────────────────────────────────
function ICMemoPage2({ deal, mr }) {
  const sent  = mr.residentSentiment || {};
  const crime = mr.crimeSnapshot || {};
  const econ  = mr.economicDrivers || {};
  const sub   = mr.submarketContext || {};
  const panel = { background:IC.panel, border:'1px solid '+IC.line, borderRadius:5, overflow:'hidden' };
  const gradeColor = (sub.overallGrade||'').startsWith('A')?IC.pos:(sub.overallGrade||'').startsWith('B')?IC.blue:(sub.overallGrade||'').startsWith('C')?IC.warn:IC.faint;

  return (
    <div id="ic-memo-page2" style={{ width:1020, background:IC.bg, color:IC.navy,
      fontFamily:IC.sans, WebkitFontSmoothing:'antialiased' }}>
      <div style={{ background:IC.navy, padding:'7px 18px 8px', display:'flex',
        alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <div>
          <div style={{ fontSize:9.5, letterSpacing:'.1em', textTransform:'uppercase',
            color:'rgba(255,255,255,.42)', fontWeight:500, marginBottom:2 }}>
            Altus Equity – Investment Committee Memo – Confidential
          </div>
          <div style={{ fontSize:20, fontWeight:700, color:'#fff', lineHeight:1.05, fontFamily:IC.serif }}>
            Submarket & Location Review — {deal.name||'Untitled Deal'}
          </div>
        </div>
        {sub.overallGrade && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, border:'1.5px solid '+IC.gold,
            borderRadius:4, padding:'5px 12px', color:IC.gold, fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>
            Submarket Grade: {sub.overallGrade}
          </div>
        )}
      </div>

      <div style={{ padding:'5px', display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          <div style={panel}>
            <PanelHdr>Resident Sentiment</PanelHdr>
            <div style={{ padding:'6px 11px 8px' }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:20, fontWeight:700, color:IC.navy }}>{sent.rating!=null?sent.rating.toFixed(1):'—'}</span>
                <span style={{ fontSize:10, color:IC.muted }}>{sent.reviewCount?sent.reviewCount+' reviews · ':''}{sent.trend||''}</span>
              </div>
              {(sent.positives||[]).slice(0,3).map((t,i)=><Bul key={'p'+i} text={t} tone="pos" />)}
              {(sent.negatives||[]).slice(0,3).map((t,i)=><Bul key={'n'+i} text={t} tone="neg" />)}
            </div>
          </div>
          <div style={panel}>
            <PanelHdr>Crime Snapshot (vs. Metro)</PanelHdr>
            <div style={{ padding:'6px 11px 8px' }}>
              {[['Overall', crime.overall], ['Violent Crime', crime.violentCrime], ['Property Crime', crime.propertyCrime]]
                .filter(([,c])=>c).map(([lbl,c])=>
                  <DR key={lbl} label={lbl} value={(c.label||'—')+(c.vsMetro?' · '+c.vsMetro:'')} />
                )}
              {(crime.investmentImplication||[]).slice(0,2).map((t,i)=><Bul key={i} text={t} />)}
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          <div style={panel}>
            <PanelHdr>Economic Drivers</PanelHdr>
            <div style={{ padding:'6px 11px 8px' }}>
              {(econ.capitalInjections||[]).slice(0,4).map((c,i)=>
                <DR key={i} label={c.name} value={c.amount} />
              )}
              {econ.populationTrend && (
                <div style={{ marginTop:6, fontSize:10, color:IC.muted, lineHeight:1.4 }}>
                  Population {econ.populationTrend.cagr5yr} 5-yr CAGR — {econ.populationTrend.vsState}
                </div>
              )}
            </div>
          </div>
          <div style={panel}>
            <PanelHdr>Submarket Context</PanelHdr>
            <div style={{ padding:'6px 11px 8px' }}>
              {sub.overallAssessment && (
                <div style={{ fontSize:11, lineHeight:1.5, color:IC.navy, marginBottom:8 }}>{sub.overallAssessment}</div>
              )}
              {(sub.comparables||[]).length>0 && (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10.5 }}>
                  <tbody>
                    {sub.comparables.slice(0,6).map((c) => (
                      <tr key={c.rank} style={{ background:c.isSubject?IC.line2:'transparent' }}>
                        <td style={{ padding:'2px 6px', color:IC.muted, width:20 }}>{c.rank}</td>
                        <td style={{ padding:'2px 6px', fontWeight:c.isSubject?700:500, color:IC.navy }}>{c.name}</td>
                        <td style={{ padding:'2px 6px', textAlign:'right', color:gradeColor, fontWeight:600 }}>{c.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop:'1px solid '+IC.line, background:'#f4f6f9', padding:'5px 18px',
        display:'flex', justifyContent:'space-between', fontSize:8.5, color:IC.faint }}>
        <span>Altus Equity — For Investment Committee use only.</span>
        <span>Independent read · verify material figures before IC</span>
      </div>
    </div>
  );
}

function Bul({ text, tone }) {
  const bg = tone==='pos'?IC.pos:tone==='neg'?IC.neg:IC.blue;
  return (
    <div style={{ display:'flex', gap:7, marginBottom:4 }}>
      <div style={{ flexShrink:0, width:5, height:5, borderRadius:'50%', background:bg, marginTop:5 }}/>
      <div style={{ fontSize:10, lineHeight:1.4, color:IC.navy }}>{text}</div>
    </div>
  );
}

// ─── IC Memo Sheet ────────────────────────────────────────────────────────────
function ICMemoSheet({ deal }) {
  const m     = window.computeMetrics ? window.computeMetrics(deal) : {};
  const hasUW = window.hasUWInputs && window.hasUWInputs(deal);
  const uw    = hasUW && window.computeUW ? window.computeUW(deal) : null;
  const caps  = window.displayCaps ? window.displayCaps(deal) : { goingIn:m.goingInCap, stab:m.stabilizedCap };
  const memo  = (deal.memo&&deal.memo.data) ? deal.memo.data : {};
  const mr    = (deal.marketReview&&deal.marketReview.status==='done') ? deal.marketReview.data : null;

  const basis   = (+deal.purchasePrice||0)+(+deal.capex||0)+(uw?uw.closingCosts:0);
  const stabRow = uw&&uw.rows ? uw.rows[Math.min(uw.stabYear||3,uw.hold)] : null;
  const yr1Row  = uw&&uw.rows ? uw.rows[1] : null;
  const irr     = uw ? uw.irr : null;
  const em      = uw ? uw.equityMultiple : null;
  const dscr    = stabRow ? stabRow.dscr : null;
  const yoc     = stabRow ? stabRow.yieldOnCost : null;
  const ltv     = uw&&uw.price>0 ? (uw.acqProceeds||0)/uw.price : null;
  const lp      = uw && window.computeLP ? (()=>{ try { return window.computeLP(uw, { pref:deal.lpPref, split:deal.lpSplit }); } catch(e) { return null; } })() : null;

  const statusLabel = { 'New Deal':'Early Stage','Quick UW':'Early Stage','Full UW':'Full UW',
    'Excel UW':'Full UW','LOI Submitted':'LOI Stage','Under Contract':'Under Contract' }[deal.stage]||'IC Review';

  const todayStr = (()=>{ try{return fmtDate(window.ALTUS_TODAY);}catch(e){return new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});} })();

  const panel = { background:IC.panel, border:'1px solid '+IC.line, borderRadius:5, overflow:'hidden' };
  const irrColor = irr!=null?(irr>=.18?IC.pos:irr<.12?IC.neg:IC.warn):IC.faint;
  const emColor  = em!=null?(em>=2?IC.pos:em<1.5?IC.neg:IC.warn):IC.faint;

  return (
    <div id="ic-memo-sheet" style={{ width:1020, background:IC.bg, color:IC.navy,
      fontFamily:IC.sans, WebkitFontSmoothing:'antialiased' }}>

      {/* ── HEADER ── */}
      <div style={{ background:IC.navy, padding:'7px 18px 8px', display:'flex',
        alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <div>
          <div style={{ fontSize:9.5, letterSpacing:'.1em', textTransform:'uppercase',
            color:'rgba(255,255,255,.42)', fontWeight:500, marginBottom:2 }}>
            Altus Equity – Investment Committee Memo – Confidential
          </div>
          <div style={{ fontSize:26, fontWeight:700, color:'#fff', lineHeight:1.05,
            fontFamily:IC.serif }}>{deal.name||'Untitled Deal'}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:7,
            border:'1.5px solid '+IC.gold, borderRadius:4, padding:'5px 10px',
            color:IC.gold, fontSize:11, fontWeight:600, letterSpacing:'.02em', whiteSpace:'nowrap' }}>
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinejoin="round">
              <path d="M7.5 1.5L13 3.5V8.5C13 11.5 10.5 13.6 7.5 14.5C4.5 13.6 2 11.5 2 8.5V3.5Z"/>
              <polyline points="5,7.5 6.5,9 10,5.5"/>
            </svg>
            {statusLabel} – IC Review
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding:'5px', display:'flex', flexDirection:'column', gap:5 }}>

        {/* TOP ROW — Deal Snapshot | Return Summary | Capital Structure & Financing */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5 }}>
          <div style={panel}>
            <PanelHdr>Deal Snapshot</PanelHdr>
            {[
              ['Guidance Price',  _m(deal.askPrice)],
              ['Offer Price',     _m(deal.purchasePrice)],
              ['Closing Costs'+(uw?' ('+_p(uw.closingPct)+')':''), uw?_m(uw.closingCosts):'—'],
              ['CapEx Budget',    _m(deal.capex)],
              ['Total Basis',     _m(basis), true],
              ['Units',           deal.units?deal.units.toLocaleString():'—'],
              ['Year Built',      deal.vintage||'—'],
              ['Physical Vacancy', uw&&uw.gpr0>0?_p(uw.physVac/uw.gpr0):'—'],
              ['Loss to Lease',   uw&&uw.gpr0>0?_p(uw.ltl/uw.gpr0):'—'],
              ['Bad Debt',        uw&&uw.gpr0>0?_p(uw.badDebt/uw.gpr0):'—'],
              ['Concessions',     uw&&uw.gpr0>0?_p(uw.concessions/uw.gpr0):'—'],
              ['Econ. Vacancy',   uw?_p(uw.inPlaceEconVac):'—', false, true],
            ].map(([lbl,val,s,sep])=><DR key={lbl} label={lbl} value={val} strong={!!s} sep={!!sep} />)}
          </div>
          <div style={panel}>
            <PanelHdr>Return Summary</PanelHdr>
            <ReturnSummaryPanel uw={uw} lp={lp} caps={caps} />
          </div>
          <div style={panel}>
            <PanelHdr>Capital Structure & Financing</PanelHdr>
            <CapDonut uw={uw} basis={basis} deal={deal} />
          </div>
        </div>

        {/* ROW 2 — Underwriting Assumptions */}
        <div style={panel}>
          <PanelHdr>Underwriting Assumptions</PanelHdr>
          {uw ? <UWAssumptions uw={uw} /> :
            <div style={{ padding:'8px 11px', fontSize:9.5, color:IC.faint, fontStyle:'italic' }}>No UW data.</div>}
        </div>

        {/* ROW 3 — Operating Forecast (NOI) */}
        <div style={panel}>
          <PanelHdr>Operating Forecast (NOI)</PanelHdr>
          <div style={{ padding:'4px 11px 5px' }}>
            {uw ? <OperatingForecast uw={uw} /> :
              <div style={{ fontSize:9.5, color:IC.faint, fontStyle:'italic' }}>No UW data.</div>}
          </div>
        </div>

        {/* ROW 4 — Scenario Analysis (compact) */}
        <div style={panel}>
          <div style={{ padding:'4px 11px 4px', borderBottom:'1px solid '+IC.line,
            display:'flex', alignItems:'baseline', gap:10 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em',
              textTransform:'uppercase', color:IC.navy }}>Scenario Analysis</span>
            <span style={{ fontSize:9.5, color:IC.muted, fontStyle:'italic' }}>
              Average hold-period yield and IRR at the deal and LP level across three cases.
            </span>
          </div>
          <div style={{ padding:'4px 11px 5px' }}>
            <ScenarioAnalysis deal={deal} uw={uw} />
          </div>
        </div>

        {/* OPTIONAL: Thesis / Risks / Market */}
        {((memo.keyStrengths||memo.valueDrivers||memo.keyRisks||memo.risks||[]).length > 0 || mr) && (
          <div style={{ display:'grid',
            gridTemplateColumns: mr ? '1fr 1fr 1fr' : '1fr 1fr', gap:5 }}>
            {(memo.keyStrengths||memo.valueDrivers||[]).length > 0 && (
              <div style={panel}>
                <PanelHdr>Investment Thesis</PanelHdr>
                <div style={{ padding:'5px 11px' }}>
                  {(memo.keyStrengths||memo.valueDrivers||[]).slice(0,4).map((s,i)=><Bul key={i} text={s} tone="pos" />)}
                </div>
              </div>
            )}
            {(memo.keyRisks||memo.risks||[]).length > 0 && (
              <div style={panel}>
                <PanelHdr>Key Risks</PanelHdr>
                <div style={{ padding:'5px 11px' }}>
                  {(memo.keyRisks||memo.risks||[]).slice(0,4).map((r,i)=><Bul key={i} text={r} tone="neg" />)}
                </div>
              </div>
            )}
            {mr && (
              <div style={panel}>
                <PanelHdr>Market Overview</PanelHdr>
                <div style={{ padding:'5px 0' }}>
                  {[['Submarket Grade', mr.grade||mr.submarketContext?.overallGrade||'—'],
                    ['Resident Sentiment', mr.residentSentiment?(mr.residentSentiment.rating+'/5 · '+mr.residentSentiment.trend):(mr.tenantReviews?.rating||'—')],
                    ['Crime Level', mr.crimeSnapshot?.overall?.label||(mr.crime?.level)||'—'],
                  ].map(([lbl,val])=><DR key={lbl} label={lbl} value={val} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {!uw && (
          <div style={{ ...panel, padding:'8px 11px', fontSize:9.5, color:IC.faint, fontStyle:'italic' }}>
            Complete Full Underwriting to populate scenario analysis, operating forecast, and return decomposition.
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop:'1px solid '+IC.line, background:'#f4f6f9', padding:'5px 18px',
        display:'flex', justifyContent:'space-between', fontSize:8.5, color:IC.faint }}>
        <span>Altus Equity — For Investment Committee use only.</span>
        <span>Prepared {todayStr}</span>
      </div>
    </div>
  );
}

// ─── Button + overlay ─────────────────────────────────────────────────────────
function ICMemoButton({ deal, onRunMemo, onRunMarketReview }) {
  const [open, setOpen] = useSIC(false);
  const [busy, setBusy] = useSIC(false);
  const [exporting, setExporting] = useSIC(false);
  const [err,  setErr]  = useSIC(null);
  const hasMemo = deal.memo&&deal.memo.data;
  const mr = (deal.marketReview&&deal.marketReview.status==='done') ? deal.marketReview.data : null;

  const ensureMR = async () => {
    if (onRunMarketReview && (!deal.marketReview || deal.marketReview.status!=='done')) {
      try { await onRunMarketReview(deal.id); } catch(e) {}
    }
  };
  const openMemo = async () => {
    setOpen(true); setErr(null);
    if (!hasMemo) {
      setBusy(true);
      try   { await Promise.all([onRunMemo(deal.id), ensureMR()]); }
      catch (e) { setErr(String(e&&e.message?e.message:e)); }
      finally   { setBusy(false); }
    } else {
      ensureMR();
    }
  };
  const regen = async () => {
    setBusy(true); setErr(null);
    try   { await Promise.all([onRunMemo(deal.id), ensureMR()]); }
    catch (e) { setErr(String(e&&e.message?e.message:e)); }
    finally   { setBusy(false); }
  };
  const exportPDF = async () => {
    if (!window.html2canvas || !window.jspdf) { window.print(); return; }
    setExporting(true);
    try {
      const { jsPDF } = window.jspdf;
      const node1 = document.getElementById('ic-memo-sheet');
      const c1 = await window.html2canvas(node1, { scale:2, backgroundColor:'#ffffff', useCORS:true });
      const w1 = node1.offsetWidth, h1 = node1.offsetHeight;
      const pdf = new jsPDF({ unit:'px', format:[w1,h1] });
      pdf.addImage(c1.toDataURL('image/png'), 'PNG', 0, 0, w1, h1);
      const node2 = document.getElementById('ic-memo-page2');
      if (node2) {
        const c2 = await window.html2canvas(node2, { scale:2, backgroundColor:'#ffffff', useCORS:true });
        const w2 = node2.offsetWidth, h2 = node2.offsetHeight;
        pdf.addPage([w2,h2]);
        pdf.addImage(c2.toDataURL('image/png'), 'PNG', 0, 0, w2, h2);
      }
      const blobUrl = pdf.output('bloburl');
      const filename = (deal.name||'IC-Memo').replace(/[^a-z0-9]+/gi,'-')+'-IC-Memo.pdf';
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 4000);
    } catch (e) {
      console.error(e);
      window.print();
    } finally { setExporting(false); }
  };

  return (
    <React.Fragment>
      <button onClick={openMemo}
        style={{ display:'inline-flex', alignItems:'center', gap:8, border:'none',
          background:'var(--navy)', color:'#fff', borderRadius:9, padding:'10px 16px',
          fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)',
          width:'100%', justifyContent:'center' }}>
        <Icon name="doc" size={15} /> Generate IC Memo
      </button>

      {open && (
        <div onClick={(e)=>{ if(e.target===e.currentTarget) setOpen(false); }}
          style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(5,13,22,.68)',
            display:'flex', flexDirection:'column', alignItems:'center',
            padding:'20px 0', overflow:'auto' }}>

          <div className="memo-toolbar" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <button onClick={exportPDF} disabled={busy||exporting}
              style={{ border:'none', background:'var(--accent)', color:'#fff', borderRadius:8,
                padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer',
                fontFamily:'var(--font)', display:'inline-flex', alignItems:'center', gap:7 }}>
              <Icon name="download" size={14} /> {exporting?'Exporting…':'Export PDF'}
            </button>
            <button onClick={regen} disabled={busy||exporting}
              style={{ border:'1px solid rgba(255,255,255,.4)', background:'transparent',
                color:'#fff', borderRadius:8, padding:'9px 16px', fontSize:13,
                fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
              {busy?'Generating…':'Regenerate'}
            </button>
            <button onClick={()=>setOpen(false)}
              style={{ border:'1px solid rgba(255,255,255,.4)', background:'transparent',
                color:'#fff', borderRadius:8, padding:'9px 14px', fontSize:13,
                fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
              Close
            </button>
          </div>

          {busy && !hasMemo ? (
            <div style={{ background:'#fff', borderRadius:12, padding:60, textAlign:'center',
              width:1020, maxWidth:'94vw', boxSizing:'border-box' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', border:'3px solid var(--accent)',
                borderTopColor:'transparent', animation:'spin .8s linear infinite', margin:'0 auto 14px' }}/>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)' }}>Drafting IC memo…</div>
              <div style={{ fontSize:12.5, color:'var(--muted)', marginTop:6 }}>
                Synthesizing investment thesis, strengths, risks and deal killers.
              </div>
            </div>
          ) : (
            <React.Fragment>
              <div style={{ boxShadow:'0 24px 64px rgba(0,0,0,.5)', borderRadius:8,
                overflow:'hidden', maxWidth:'94vw' }}>
                <ICMemoSheet deal={deal} />
              </div>
              {mr && (
                <div style={{ boxShadow:'0 24px 64px rgba(0,0,0,.5)', borderRadius:8,
                  overflow:'hidden', maxWidth:'94vw', marginTop:20 }}>
                  <ICMemoPage2 deal={deal} mr={mr} />
                </div>
              )}
            </React.Fragment>
          )}

          {err && <div style={{ marginTop:12, color:'#ffb4b6', fontSize:13 }}>{err}</div>}
        </div>
      )}
    </React.Fragment>
  );
}

window.ICMemoButton = ICMemoButton;
