// app/marketreview.jsx — Property & Location Review (4-section report layout)
const { useState: useSM } = React;

/* ─── Utilities ─────────────────────────────────────────────────────── */
const LABEL_META = {
  'Safer':             { c:'#0c7a43', bg:'#e0f2ea' },
  'Similar':           { c:'#b87214', bg:'#fdf0d8' },
  'Less Safe':         { c:'#c93c40', bg:'#fce8e8' },
  'Better than Metro': { c:'#0c7a43', bg:'#e0f2ea' },
  'Worse than Metro':  { c:'#c93c40', bg:'#fce8e8' },
  'Lower':             { c:'#0c7a43', bg:'#e0f2ea' },
  'Higher':            { c:'#c93c40', bg:'#fce8e8' },
  'At Metro Avg':      { c:'#b87214', bg:'#fdf0d8' },
  'Stable':            { c:'#b87214', bg:'#fdf0d8' },
  'Improving':         { c:'#0c7a43', bg:'#e0f2ea' },
  'Declining':         { c:'#c93c40', bg:'#fce8e8' },
};
function LabelBadge({ label }) {
  const m = LABEL_META[label] || { c:'#5b7088', bg:'#eef1f5' };
  return <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:999, fontSize:11, fontWeight:700, color:m.c, background:m.bg, whiteSpace:'nowrap' }}>{label}</span>;
}
function Stars({ n }) {
  const full = Math.round(n || 0);
  return <span style={{ color:'#e8a000', fontSize:13, letterSpacing:.5 }}>{'★'.repeat(full)}{'☆'.repeat(Math.max(0, 5-full))}</span>;
}
function SHead({ num, title, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, paddingBottom:9, borderBottom:'1px solid var(--line)' }}>
      <span style={{ fontSize:9.5, fontWeight:800, background:'var(--navy)', color:'#fff', borderRadius:4, padding:'2px 7px', flex:'none', letterSpacing:'.03em' }}>{num}</span>
      <span style={{ fontSize:11, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink)', flex:1 }}>{title}</span>
      {sub && <span style={{ fontSize:10, color:'var(--faint)' }}>{sub}</span>}
    </div>
  );
}
function Bullets({ items, color='var(--accent)' }) {
  return (
    <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:4 }}>
      {(items||[]).map((b,i) => (
        <li key={i} style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
          <span style={{ color, fontWeight:800, flex:'none', lineHeight:'18px', fontSize:11 }}>•</span>
          <span style={{ fontSize:12, color:'var(--slate)', lineHeight:1.55, textWrap:'pretty' }}>{b}</span>
        </li>
      ))}
    </ul>
  );
}
/* ─── Source links ──────────────────────────────────────────────────── */
const STATE_ABBR = {
  'alabama':'al','alaska':'ak','arizona':'az','arkansas':'ar','california':'ca',
  'colorado':'co','connecticut':'ct','delaware':'de','florida':'fl','georgia':'ga',
  'hawaii':'hi','idaho':'id','illinois':'il','indiana':'in','iowa':'ia',
  'kansas':'ks','kentucky':'ky','louisiana':'la','maine':'me','maryland':'md',
  'massachusetts':'ma','michigan':'mi','minnesota':'mn','mississippi':'ms','missouri':'mo',
  'montana':'mt','nebraska':'ne','nevada':'nv','new hampshire':'nh','new jersey':'nj',
  'new mexico':'nm','new york':'ny','north carolina':'nc','north dakota':'nd','ohio':'oh',
  'oklahoma':'ok','oregon':'or','pennsylvania':'pa','rhode island':'ri','south carolina':'sc',
  'south dakota':'sd','tennessee':'tn','texas':'tx','utah':'ut','vermont':'vt',
  'virginia':'va','washington':'wa','west virginia':'wv','wisconsin':'wi','wyoming':'wy',
};
function parseMarket(market) {
  if (!market) return {};
  const parts = market.split(',').map(s => s.trim());
  const city  = parts[0] || '';
  const raw   = (parts[1] || '').toLowerCase().trim();
  const st    = raw.length === 2 ? raw : (STATE_ABBR[raw] || '');
  const slug  = city.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  const cdCity  = city.replace(/\s+/g,'-');
  const cdState = parts[1] ? parts[1].trim().replace(/\s+/g,'-') : '';
  return { city, st, slug, cdCity, cdState };
}

const SOURCE_MAP = [
  { key:'google reviews',    name:'Google Reviews',
    url:(d)=>`https://www.google.com/maps/search/${encodeURIComponent([(d&&d.name),(d&&d.market)].filter(Boolean).join(', '))}` },
  { key:'neighborhoodscout', name:'NeighborhoodScout Crime',
    url:(d)=>{ const {st,slug}=parseMarket(d&&d.market); return st&&slug?`https://www.neighborhoodscout.com/${st}/${slug}/crime`:'https://www.neighborhoodscout.com/'; } },
  { key:'fbi ucr',           name:'FBI UCR Crime Data',
    url:()=>'https://ucr.fbi.gov/crime-in-the-u.s' },
  { key:'fbi crime',         name:'FBI Crime Data',
    url:()=>'https://ucr.fbi.gov/crime-in-the-u.s' },
  { key:'local pd',          name:'Local Police Stats',
    url:(d)=>{ const {city,st}=parseMarket(d&&d.market); return `https://www.google.com/search?q=${encodeURIComponent(`${city} ${st} police crime statistics 2024`)}`; } },
  { key:'city-data',         name:'City-Data',
    url:(d)=>{ const {cdCity,cdState}=parseMarket(d&&d.market); return cdCity&&cdState?`https://www.city-data.com/city/${cdCity}-${cdState}.html`:'https://www.city-data.com/'; } },
  { key:'costar',            name:'CoStar',            url:()=>'https://www.costar.com/' },
  { key:'walk score',        name:'Walk Score',
    url:(d)=>{ const {st,slug}=parseMarket(d&&d.market); return st&&slug?`https://www.walkscore.com/${st.toUpperCase()}/${slug}`:'https://www.walkscore.com/'; } },
  { key:'census',            name:'Census QuickFacts',
    url:(d)=>{ const {city,st}=parseMarket(d&&d.market); return city&&st?`https://www.census.gov/quickfacts/${city.replace(/\s/g,'')}${st}`:'https://data.census.gov/'; } },
  { key:'bls',               name:'BLS Metro Employment',
    url:(d)=>{ const {city}=parseMarket(d&&d.market); return city?`https://www.bls.gov/eag/eag.${city.toLowerCase().replace(/\s+/g,'_')}.htm`:'https://www.bls.gov/data/'; } },
  { key:'ddi',               name:'Development Data',
    url:(d)=>{ const {city,st}=parseMarket(d&&d.market); return `https://www.google.com/search?q=${encodeURIComponent(`${city} ${st} economic development projects 2024`)}`; } },
  { key:'loopnet',           name:'LoopNet',           url:()=>'https://www.loopnet.com/' },
  { key:'zillow',            name:'Zillow Research',   url:()=>'https://www.zillow.com/research/data/' },
];

function getSourceLinks(text, deal) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return SOURCE_MAP.filter(s => lower.includes(s.key)).map(s => ({ name:s.name, url:s.url(deal) }));
}

function Src({ text, deal }) {
  if (!text) return null;
  const links = getSourceLinks(text, deal);
  return (
    <div style={{ marginTop:10, fontSize:10.5, color:'var(--faint)', display:'flex', flexWrap:'wrap', gap:'3px 10px', alignItems:'center' }}>
      <span style={{ fontStyle:'italic' }}>Source:</span>
      {links.length > 0
        ? links.map((l,i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer"
              style={{ color:'var(--accent)', textDecoration:'none', fontWeight:500 }}>
              {l.name} ↗
            </a>
          ))
        : <span style={{ fontStyle:'italic' }}>{text}</span>
      }
    </div>
  );
}

/* ─── Sample data ────────────────────────────────────────────────────── */
const SAMPLE_MR = {
  status:'done', generatedAt: new Date().toISOString(),
  data: {
    residentSentiment: {
      rating:3.6, reviewCount:162, trend:'Stable',
      positives:['Location convenience','Quiet environment','Responsive maintenance'],
      negatives:['Parking availability','Gate/security issues','Pest control'],
      recentReviews:[
        { date:'May 18, 2025', stars:4, text:'Great location and maintenance is quick to respond when needed.' },
        { date:'Apr 27, 2025', stars:3, text:'Love the apartments but parking is a nightmare, especially at night.' },
        { date:'May 3, 2025',  stars:3, text:'Had issues with pests in the unit. Management needs to address this.' },
      ],
      source:'Google Reviews',
    },
    crimeSnapshot: {
      overall:       { label:'Better than Metro', vsMetro:'18% below metro avg' },
      violentCrime:  { label:'Lower',             vsMetro:'20% below metro avg' },
      propertyCrime: { label:'Lower',             vsMetro:'15% below metro avg' },
      relativePosition:    ['Crime in South Durham is lower than the Durham MSA across major categories.','Ranks 3rd of 12 comparable submarkets for overall safety.'],
      recentActivity:      ['Activity has been mostly property-related, with isolated vehicle break-ins.','Few violent incidents recently reported in the immediate area.','Nighttime nuisance/parking complaints appear occasionally near retail corridors.'],
      investmentImplication:['Safety profile is supportive of resident retention and rent growth.','Parking lot lighting and gate/security diligence remain worthwhile.'],
      source:'NeighborhoodScout, FBI UCR, Local PD Data',
    },
    economicDrivers: {
      capitalInjections:[
        { name:'Biotech Innovation Hub enhancement', amount:'$250M' },
        { name:'Duke Health ambulatory expansion',   amount:'$180M' },
        { name:'I-885 / NC-147 interchange improvements', amount:'$120M' },
        { name:'Light industrial / logistics expansions', amount:'$90M+' },
      ],
      majorEmployers:[
        { name:'Duke University / Duke Health', size:'large' },
        { name:'RTI International', size:'large' },
        { name:'IBM',   size:'medium' },
        { name:'Cisco', size:'medium' },
        { name:'GSK',   size:'small' },
      ],
      employerNote:'Diverse base across healthcare, research, technology, and services.',
      populationTrend:{ cagr5yr:'+1.6%', vsState:'Growing above NC average (1.1%)', drivers:'Strong in-migration driven by jobs and educational assets' },
      source:'City of Durham, DDI, CoStar',
    },
    submarketContext: {
      overallGrade:'B+',
      overallAssessment:'South Durham offers a safer profile than most submarkets with meaningful access to jobs, healthcare, and major investment. Fundamentals support stable operations and upside potential.',
      comparables:[
        { rank:1, name:'Chapel Hill / Carrboro', crimeIndex:66,  label:'Safer' },
        { rank:2, name:'South Durham (Subject)', crimeIndex:82,  label:'Safer', isSubject:true },
        { rank:3, name:'North Durham',           crimeIndex:91,  label:'Similar' },
        { rank:4, name:'West Durham',            crimeIndex:101, label:'Similar' },
        { rank:5, name:'East Durham',            crimeIndex:112, label:'Less Safe' },
        { rank:6, name:'Downtown Durham',        crimeIndex:147, label:'Less Safe' },
      ],
      source:'NeighborhoodScout, FBI UCR, Local PD Data',
    },
  },
};

/* ─── Main tab component ─────────────────────────────────────────────── */
function MarketReviewTab({ deal, onRun }) {
  const mr      = deal.marketReview;
  const status  = mr && mr.status;
  const [busy, setBusy]       = useSM(false);
  const [preview, setPreview] = useSM(false);
  const run = async () => { setBusy(true); try { await onRun(deal.id); } finally { setBusy(false); } };
  const running       = busy || status === 'running';
  const displayMR     = preview ? SAMPLE_MR : mr;
  const displayStatus = preview ? 'done' : status;

  /* ── empty / error ── */
  if (!displayMR || displayStatus === 'error' || (displayStatus !== 'done' && !running)) {
    const isTimeout = displayStatus === 'error' && displayMR && displayMR.error && /no data|timeout|timed out|30s/i.test(displayMR.error);
    return (
      <div style={{ maxWidth:560, margin:'24px auto', background:'var(--panel)', border:'1px solid var(--line)',
        borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow)', padding:'34px 32px', textAlign:'center' }}>
        <span style={{ width:52, height:52, borderRadius:13, background:'var(--navy)', color:'#fff',
          display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
          <Icon name="pulse" size={24} />
        </span>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--ink)', letterSpacing:'-.01em' }}>
          Property &amp; Location Review
        </div>
        <div style={{ fontSize:13.5, color:'var(--muted)', marginTop:8, lineHeight:1.65, maxWidth:440, marginInline:'auto' }}>
          Resident sentiment, crime snapshot, economic drivers, and submarket context — in one report.
        </div>
        {displayStatus === 'error' && (
          <div style={{ marginTop:14, fontSize:12.5, borderRadius:8, padding:'10px 14px',
            background: isTimeout ? 'rgba(47,109,240,.07)' : 'rgba(201,60,64,.07)',
            color: isTimeout ? 'var(--accent)' : 'var(--neg)', textAlign:'left' }}>
            {isTimeout ? (
              <>
                <div style={{ fontWeight:700, marginBottom:3 }}>AI timed out in the preview.</div>
                <div style={{ color:'var(--muted)', lineHeight:1.6, fontSize:12 }}>
                  Works on your <strong>deployed Cloudflare Pages site</strong> with{' '}
                  <code style={{ background:'var(--panel-3)', padding:'1px 5px', borderRadius:4, fontSize:11 }}>ANTHROPIC_API_KEY</code> set.
                  Use "View sample report" below to preview the layout.
                </div>
              </>
            ) : <>{displayMR.error || 'Something went wrong.'} — try again.</>}
          </div>
        )}
        <button onClick={run} disabled={running}
          style={{ marginTop:20, border:'none', background:'var(--accent)', color:'#fff',
            borderRadius:9, padding:'11px 22px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
          {displayStatus === 'error' ? 'Retry analysis' : 'Run analysis with Claude'}
        </button>
        <div style={{ marginTop:12 }}>
          <button onClick={() => setPreview(true)}
            style={{ border:'none', background:'none', color:'var(--accent)', fontSize:12.5,
              fontWeight:600, cursor:'pointer', textDecoration:'underline', fontFamily:'var(--font)' }}>
            View sample report →
          </button>
        </div>
        <div style={{ fontSize:11, color:'var(--faint)', marginTop:8 }}>Independent read · verify material figures before IC</div>
      </div>
    );
  }

  /* ── loading ── */
  if (running) {
    return (
      <div style={{ maxWidth:560, margin:'48px auto', textAlign:'center' }}>
        <div style={{ width:34, height:34, borderRadius:'50%', border:'3px solid var(--accent)',
          borderTopColor:'transparent', animation:'spin .8s linear infinite', margin:'0 auto 16px' }} />
        <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)' }}>Analyzing the property &amp; submarket…</div>
        <div style={{ fontSize:12.5, color:'var(--muted)', marginTop:6 }}>Sentiment, crime, economic drivers, submarket context. ~30–60 sec.</div>
      </div>
    );
  }

  const d    = displayMR.data || {};
  const sent  = d.residentSentiment  || {};
  const crime = d.crimeSnapshot      || {};
  const econ  = d.economicDrivers    || {};
  const sub   = d.submarketContext   || {};
  const genDate = displayMR.generatedAt
    ? new Date(displayMR.generatedAt).toLocaleDateString('en-US',{month:'short',year:'numeric'})
    : '';
  const EMP_W = { large:100, medium:62, small:35 };

  return (
    <div style={{ maxWidth:1060, margin:'0 auto', borderRadius:'var(--radius-lg)', overflow:'hidden',
      border:'1px solid var(--line)', boxShadow:'var(--shadow-lg)' }}>

      {/* ── Header ── */}
      <div style={{ background:'var(--navy)', padding:'16px 26px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:20, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.12em', color:'#9fb4cf', textTransform:'uppercase', marginBottom:5 }}>Property &amp; Location Review</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-.02em' }}>{deal.name || 'Property'}</div>
          <div style={{ fontSize:13, color:'#9fb4cf', marginTop:2 }}>{deal.market || '—'}</div>
        </div>
        <div style={{ display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
          {[['Units', deal.units ? String(deal.units) : '—'], ['Built', deal.vintage || '—'],
            ['Market', deal.market || '—']].map(([l,v]) => (
            <div key={l} style={{ textAlign:'center' }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.1em', color:'#7a90a8', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{v}</div>
            </div>
          ))}
          <div style={{ display:'flex', gap:6, marginLeft:8 }}>
            {!preview && <button onClick={run} style={{ border:'1px solid rgba(255,255,255,.18)', background:'rgba(255,255,255,.07)', color:'#9fb4cf', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>Re-run</button>}
            {preview  && <button onClick={() => setPreview(false)} style={{ border:'1px solid rgba(255,255,255,.18)', background:'rgba(255,255,255,.07)', color:'#9fb4cf', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>Exit sample</button>}
          </div>
        </div>
      </div>

      {/* ── 2-column grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', background:'var(--line)', gap:1 }}>

        {/* §1 Resident Sentiment */}
        <div style={{ background:'var(--panel)', padding:'18px 20px' }}>
          <SHead num="1" title="Resident Sentiment (Google Reviews)" sub={genDate ? 'As of ' + genDate : ''} />
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:16, marginBottom:16 }}>
            <div style={{ textAlign:'center', paddingRight:12, borderRight:'1px solid var(--line)' }}>
              <div style={{ fontSize:44, fontWeight:800, color:'var(--ink)', lineHeight:1 }}>{sent.rating || '—'}</div>
              <Stars n={sent.rating||0} />
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{sent.reviewCount ? sent.reviewCount + ' reviews' : ''}</div>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', letterSpacing:'.05em', textTransform:'uppercase', marginBottom:6 }}>Trend (last 12 months)</div>
              <div style={{ marginBottom:10 }}><LabelBadge label={sent.trend || 'Stable'} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--pos)', letterSpacing:'.04em', textTransform:'uppercase', marginBottom:6 }}>Positives</div>
                  <Bullets items={sent.positives} color="var(--pos)" />
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--neg)', letterSpacing:'.04em', textTransform:'uppercase', marginBottom:6 }}>Negatives</div>
                  <Bullets items={sent.negatives} color="var(--neg)" />
                </div>
              </div>
            </div>
          </div>
          {Array.isArray(sent.recentReviews) && sent.recentReviews.length > 0 && <>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:8 }}>Latest Review Examples</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {sent.recentReviews.slice(0,3).map((r,i) => (
                <div key={i} style={{ background:'var(--panel-2)', borderRadius:8, padding:'9px 10px', border:'1px solid var(--line)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:10, color:'var(--muted)' }}>{r.date}</span>
                    <Stars n={r.stars||0} />
                  </div>
                  <div style={{ fontSize:11.5, color:'var(--slate)', lineHeight:1.5, textWrap:'pretty' }}>{r.text}</div>
                </div>
              ))}
            </div>
          </>}
          <Src text={sent.source} deal={deal} />
        </div>

        {/* §2 Crime Snapshot */}
        <div style={{ background:'var(--panel)', padding:'18px 20px' }}>
          <SHead num="2" title="Crime Snapshot (Relative to Metro)" sub={genDate ? 'As of ' + genDate : ''} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
            {[['Overall', crime.overall], ['Violent Crime', crime.violentCrime], ['Property Crime', crime.propertyCrime]].map(([lbl, c]) => c && (
              <div key={lbl} style={{ border:'1px solid var(--line)', borderRadius:9, padding:'10px 10px', textAlign:'center' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:7 }}>{lbl}</div>
                <LabelBadge label={c.label||'—'} />
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:5 }}>{c.vsMetro||''}</div>
              </div>
            ))}
          </div>
          {[
            { letter:'A', label:'Relative Position',                          items:crime.relativePosition,     color:'var(--accent)' },
            { letter:'B', label:'Recent Activity (last 90 days, ~1 mile)',    items:crime.recentActivity,       color:'var(--warn)' },
            { letter:'C', label:'Investment Implication',                     items:crime.investmentImplication, color:'var(--pos)' },
          ].map(({ letter, label, items, color }) => Array.isArray(items) && items.length > 0 && (
            <div key={letter} style={{ marginBottom:11 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                <span style={{ width:18, height:18, borderRadius:'50%', background:color, color:'#fff',
                  display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:9.5, fontWeight:800, flex:'none' }}>{letter}</span>
                <span style={{ fontSize:10.5, fontWeight:700, color:'var(--ink)', textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</span>
              </div>
              <Bullets items={items} color={color} />
            </div>
          ))}
          <Src text={crime.source} deal={deal} />
        </div>

        {/* §3 Economic Drivers */}
        <div style={{ background:'var(--panel)', padding:'18px 20px' }}>
          <SHead num="3" title="Economic Drivers" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:18 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:8 }}>Recent Capital Injections</div>
              {(econ.capitalInjections||[]).map((c,i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'flex-start' }}>
                  <span style={{ color:'var(--accent)', fontWeight:800, flex:'none', fontSize:11, lineHeight:'18px' }}>•</span>
                  <span style={{ fontSize:12, color:'var(--slate)', lineHeight:1.5 }}>{c.name} — <strong style={{ color:'var(--ink)' }}>{c.amount}</strong></span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:8 }}>Major Employers</div>
              {(econ.majorEmployers||[]).map((e,i) => (
                <div key={i} style={{ marginBottom:7 }}>
                  <div style={{ fontSize:11.5, color:'var(--ink)', fontWeight:500, marginBottom:3 }}>{e.name}</div>
                  <div style={{ height:5, borderRadius:3, background:'var(--line-2)' }}>
                    <div style={{ height:'100%', width:(EMP_W[e.size]||50)+'%', background:'var(--navy)', borderRadius:3 }} />
                  </div>
                </div>
              ))}
              {econ.employerNote && <div style={{ fontSize:11, color:'var(--muted)', marginTop:8, lineHeight:1.5 }}>{econ.employerNote}</div>}
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:8 }}>Population Trend</div>
              {econ.populationTrend && ['cagr5yr','vsState','drivers'].map(k => econ.populationTrend[k] && (
                <div key={k} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'flex-start' }}>
                  <span style={{ color:'var(--accent)', fontWeight:800, flex:'none', fontSize:11, lineHeight:'18px' }}>•</span>
                  <span style={{ fontSize:12, color:'var(--slate)', lineHeight:1.5 }}>
                    {k === 'cagr5yr' ? <><strong style={{color:'var(--ink)'}}>5-YR CAGR: {econ.populationTrend[k]}</strong></> : econ.populationTrend[k]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Src text={econ.source} deal={deal} />
        </div>

        {/* §4 Submarket Context */}
        <div style={{ background:'var(--panel)', padding:'18px 20px' }}>
          <SHead num="4" title="Submarket Context / Key Takeaway" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:14, alignItems:'start' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', letterSpacing:'.05em', textTransform:'uppercase', marginBottom:7 }}>
                Submarket Comparison — Overall Crime Index <span style={{ fontWeight:400, color:'var(--faint)' }}>(100 = Metro Avg)</span>
              </div>
              <div style={{ border:'1px solid var(--line)', borderRadius:8, overflow:'hidden' }}>
                {(sub.comparables||[]).map((c,i) => {
                  const lm = LABEL_META[c.label] || { c:'#5b7088', bg:'#eef1f5' };
                  return (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'20px 1fr 50px 76px', alignItems:'center',
                      gap:10, padding:'7px 12px', fontWeight: c.isSubject ? 700 : 400,
                      background: c.isSubject ? 'var(--accent-soft)' : i%2===0 ? 'var(--panel)' : 'var(--panel-2)',
                      borderBottom: i < (sub.comparables.length-1) ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontSize:11, color:'var(--muted)', fontWeight:500 }}>{c.rank}.</span>
                      <span style={{ fontSize:12.5, color: c.isSubject ? 'var(--accent)' : 'var(--ink)' }}>{c.name}</span>
                      <span className="num" style={{ fontSize:13, fontWeight:700, color: c.isSubject ? 'var(--accent)' : 'var(--ink)', textAlign:'right' }}>{c.crimeIndex}</span>
                      <span style={{ padding:'2px 7px', borderRadius:999, fontSize:10.5, fontWeight:700, color:lm.c, background:lm.bg, textAlign:'center', display:'inline-block' }}>{c.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ minWidth:155, maxWidth:190 }}>
              <div style={{ background:'var(--pos-soft)', border:'1px solid rgba(12,122,67,.2)', borderRadius:10, padding:'13px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'var(--pos)', color:'#fff',
                    display:'inline-flex', alignItems:'center', justifyContent:'center', flex:'none' }}>
                    <Icon name="check" size={11} />
                  </span>
                  <span style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--pos)' }}>Key Takeaway</span>
                </div>
                <div style={{ fontSize:12, color:'var(--slate)', lineHeight:1.65, textWrap:'pretty' }}>{sub.overallAssessment}</div>
                {sub.overallGrade && (
                  <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ fontSize:26, fontWeight:800, color:'var(--accent)' }}>{sub.overallGrade}</span>
                    <span style={{ fontSize:11, color:'var(--muted)' }}>Overall Grade</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Src text={sub.source} deal={deal} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ background:'var(--panel-2)', padding:'8px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid var(--line)' }}>
        <div style={{ fontSize:10.5, color: preview ? 'var(--warn)' : 'var(--faint)' }}>
          {preview ? '⚠ Sample data — run analysis to generate real data for this property' :
            'Generated ' + (displayMR.generatedAt ? new Date(displayMR.generatedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '') +
            ' · AI-estimated · verify material figures before IC'}
        </div>
        <div style={{ fontSize:10.5, color:'var(--faint)', fontWeight:600, letterSpacing:'.04em' }}>CONFIDENTIAL — FOR INTERNAL USE ONLY</div>
      </div>
    </div>
  );
}

window.MarketReviewTab = MarketReviewTab;
